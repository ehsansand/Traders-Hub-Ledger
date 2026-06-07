import { RialEntry, CryptoEntry } from '../types';

export interface LedgerBackupData {
  backupVersion: string;
  timestamp: number;
  rialEntries: RialEntry[];
  cryptoEntries: CryptoEntry[];
  settings: {
    lang: 'fa' | 'en';
    rialCalendarMode: 'jalali' | 'gregorian';
    cryptoCalendarMode: 'jalali' | 'gregorian';
    arbitrageGasFee?: string;
    arbitrageProfitPercent?: string;
    spreadsheetId?: string | null;
  };
}

export interface DriveFileInfo {
  id: string;
  name: string;
  modifiedTime: string;
  size?: string;
}

const BACKUP_FILENAME = 'TradersHubBackup.json';

/**
 * Checks for an existing backup file in Google Drive.
 * Returns file details or null if no backup exists.
 */
export async function findBackupFile(accessToken: string): Promise<DriveFileInfo | null> {
  const query = encodeURIComponent(`name = '${BACKUP_FILENAME}' and trashed = false`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,modifiedTime,size)&spaces=drive`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('Failed to search in Google Drive:', errText);
    throw new Error(`Google Drive search failed: ${response.statusText}`);
  }

  const data = await response.json();
  if (data.files && data.files.length > 0) {
    const file = data.files[0];
    return {
      id: file.id,
      name: file.name,
      modifiedTime: file.modifiedTime,
      size: file.size,
    };
  }

  return null;
}

/**
 * Downloads the backup JSON content from Google Drive by file ID.
 */
export async function downloadBackupFile(accessToken: string, fileId: string): Promise<LedgerBackupData> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('Failed to download file from Google Drive:', errText);
    throw new Error(`Google Drive download failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data as LedgerBackupData;
}

/**
 * Creates/Saves or updates a backup file in Google Drive.
 */
export async function uploadBackupFile(
  accessToken: string,
  backupData: LedgerBackupData
): Promise<{ id: string; isNew: boolean }> {
  // 1. Search if the file already exists
  const existing = await findBackupFile(accessToken);

  if (existing) {
    // Update existing file content (Media Upload via PATCH)
    const uploadUrl = `https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=media`;
    const response = await fetch(uploadUrl, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(backupData),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Failed to update existing backup:', errText);
      throw new Error(`Google Drive backup update failed: ${response.statusText}`);
    }

    return { id: existing.id, isNew: false };
  } else {
    // 2. Create file metadata first
    const metadataUrl = 'https://www.googleapis.com/drive/v3/files';
    const metadataResponse = await fetch(metadataUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: BACKUP_FILENAME,
        mimeType: 'application/json',
      }),
    });

    if (!metadataResponse.ok) {
      const errText = await metadataResponse.text();
      console.error('Failed to create backup metadata:', errText);
      throw new Error(`Google Drive backup placeholder creation failed: ${metadataResponse.statusText}`);
    }

    const fileMeta = await metadataResponse.json();
    const fileId = fileMeta.id;

    // 3. Upload content to the newly created file (Media Upload via PATCH)
    const uploadUrl = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`;
    const response = await fetch(uploadUrl, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(backupData),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Failed to fill backup file content:', errText);
      throw new Error(`Google Drive backup upload failed: ${response.statusText}`);
    }

    return { id: fileId, isNew: true };
  }
}
