import { RialEntry, CryptoEntry } from '../types';

/**
 * Extracts a Spreadsheet ID from a standard Google Sheets URL or returns the ID directly.
 */
export function extractSpreadsheetId(urlOrId: string): string | null {
  if (!urlOrId) return null;
  const trimmed = urlOrId.trim();
  if (!trimmed.includes('docs.google.com')) {
    return trimmed; // Assume it's already an ID
  }
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

/**
 * Creates a new Google Spreadsheet with two tabs: "Rial Ledger" and "Crypto Ledger".
 */
export async function createLedgerSpreadsheet(
  accessToken: string
): Promise<{ id: string; url: string }> {
  const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title: 'Traders Hub Ledger - Synced',
      },
      sheets: [
        {
          properties: {
            title: 'Rial Ledger',
            gridProperties: {
              columnCount: 10,
              rowCount: 1000,
            },
          },
        },
        {
          properties: {
            title: 'Crypto Ledger',
            gridProperties: {
              columnCount: 10,
              rowCount: 1000,
            },
          },
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to create spreadsheet: ${errText}`);
  }

  const data = await response.json();
  const id = data.spreadsheetId;
  const url = data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${id}/edit`;

  return { id, url };
}

/**
 * Clears old data on a sheet tab to prevent leftover rows, then writes fresh rows.
 */
async function clearAndWriteSheet(
  accessToken: string,
  spreadsheetId: string,
  sheetName: string,
  headers: string[],
  rows: any[][]
): Promise<void> {
  // 1. Clear A1:Z1000 range first
  const clearRange = `${sheetName}!A1:Z1000`;
  const clearResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
      clearRange
    )}:clear`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    }
  );

  if (!clearResponse.ok) {
    console.warn(`Could not clear sheet ${sheetName}, proceeding anyway...`);
  }

  // 2. Prepare grid format with header
  const allValues = [headers, ...rows];

  // 3. Write data to the range
  const writeRange = `${sheetName}!A1`;
  const writeResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
      writeRange
    )}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range: writeRange,
        majorDimension: 'ROWS',
        values: allValues,
      }),
    }
  );

  if (!writeResponse.ok) {
    const errText = await writeResponse.text();
    throw new Error(`Failed to write to sheet ${sheetName}: ${errText}`);
  }
}

/**
 * Ensures that the required tabs exist in the stylesheet. If they are missing, it adds them automatically.
 */
async function ensureSheetTabs(accessToken: string, spreadsheetId: string, requiredTabs: string[]): Promise<void> {
  try {
    const getUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`;
    const res = await fetch(getUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      }
    });
    if (!res.ok) {
      console.warn("Could not fetch spreadsheet metadata to check for tabs, will attempt write anyway.");
      return;
    }
    const data = await res.json();
    const existingTabs = (data.sheets || []).map((s: any) => s.properties?.title);
    
    const requests = [];
    for (const tab of requiredTabs) {
      if (!existingTabs.includes(tab)) {
        requests.push({
          addSheet: {
            properties: {
              title: tab,
              gridProperties: {
                columnCount: 10,
                rowCount: 1000,
              }
            }
          }
        });
      }
    }

    if (requests.length > 0) {
      const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
      const updateRes = await fetch(updateUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requests })
      });
      if (!updateRes.ok) {
        console.warn("Failed to automatically create missing spreadsheet tabs: ", await updateRes.text());
      }
    }
  } catch (error) {
    console.error("Error in ensureSheetTabs: ", error);
  }
}

/**
 * Syncs Rial and Crypto transactions into their respective sheet tabs.
 */
export async function syncLedgerData(
  accessToken: string,
  spreadsheetId: string,
  rialEntries: RialEntry[],
  cryptoEntries: CryptoEntry[]
): Promise<void> {
  // Ensure "Rial Ledger" and "Crypto Ledger" tabs are present or get created
  await ensureSheetTabs(accessToken, spreadsheetId, ['Rial Ledger', 'Crypto Ledger']);

  // Format Rial logs
  const rialHeaders = [
    'ردیف (ID)',
    'تاریخ دریافت',
    'دریافت شده از (فرستنده)',
    'مبلغ به تومان',
    'نام بانک / درگاه',
    'توضیحات و بابت',
    'ثبت شده در سیستم',
  ];
  
  const rialRows = rialEntries.map((entry) => [
    entry.id,
    entry.date,
    entry.receivedFrom,
    entry.amount,
    entry.bankName,
    entry.notes,
    new Date(entry.createdAt).toLocaleString('fa-IR'),
  ]);

  // Format Crypto logs
  const cryptoHeaders = [
    'شناسه (ID)',
    'تاریخ دریافت',
    'اسم ارز (Symbol)',
    'مقدار واریز',
    'شبکه انتقال (Network)',
    'هش تراکنش (Tx Hash)',
    'توضیحات',
    'ثبت شده در سیستم',
  ];

  const cryptoRows = cryptoEntries.map((entry) => [
    entry.id,
    entry.date,
    entry.coinName,
    entry.amount,
    entry.network,
    entry.txHash,
    entry.notes,
    new Date(entry.createdAt).toLocaleString('fa-IR'),
  ]);

  // Sync Rial sheet
  await clearAndWriteSheet(accessToken, spreadsheetId, 'Rial Ledger', rialHeaders, rialRows);

  // Sync Crypto sheet
  await clearAndWriteSheet(accessToken, spreadsheetId, 'Crypto Ledger', cryptoHeaders, cryptoRows);
}
