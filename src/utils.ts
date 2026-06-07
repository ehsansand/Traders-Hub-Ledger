import { RialEntry, CryptoEntry } from './types';

/**
 * Converts a Gregorian YYYY-MM-DD string to Jalali (Solar Hijri) format.
 * Uses native Intl.DateTimeFormat with ca-persian for lightweight and robust conversion.
 */
export function toJalali(gregorianDateStr: string, locale: 'fa' | 'en' = 'fa'): string {
  if (!gregorianDateStr) return '';
  try {
    const parts = gregorianDateStr.split('-');
    if (parts.length < 3) return gregorianDateStr;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const date = new Date(year, month, day);

    const formatter = new Intl.DateTimeFormat('fa-IR', {
      calendar: 'persian',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });

    let formatted = formatter.format(date);
    
    // If English layout is preferred, map Persian numbers to English numbers
    if (locale === 'en') {
      const persianDigits = '۰۱۲۳۴۵۶۷۸۹';
      const englishDigits = '0123456789';
      formatted = formatted.replace(/[۰-۹]/g, (char) => {
        const idx = persianDigits.indexOf(char);
        return idx > -1 ? englishDigits[idx] : char;
      });
    }

    return formatted;
  } catch (error) {
    console.error('Error converting date to Jalali:', error);
    return gregorianDateStr;
  }
}

/**
 * Formats a number cleanly in Toman/Rial format with commas
 */
export function formatToman(value: number): string {
  if (value === undefined || value === null) return '0';
  return value.toLocaleString('fa-IR');
}

/**
 * Normalizes English/Persian digits
 */
export function formatPersianNumber(text: string | number): string {
  const normalized = String(text);
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return normalized.replace(/[0-9]/g, (w) => persianDigits[parseInt(w, 10)]);
}

/**
 * Downloads formatted CSV with UTF-8 BOM for full Microsoft Excel Persian support.
 */
export function exportToCSV(filename: string, headers: string[], rows: any[][]) {
  const csvContent = [
    headers.map(h => `"${h.replace(/"/g, '""')}"`).join(','),
    ...rows.map(row => row.map(cell => {
      const val = cell === null || cell === undefined ? '' : String(cell);
      return `"${val.replace(/"/g, '""')}"`;
    }).join(','))
  ].join('\r\n');

  const bom = '\uFEFF'; // Bytes Order Mark for Excel UTF-8 compliance
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Initial mock data for a polished first load
 */
export const INITIAL_RIAL_ENTRIES: RialEntry[] = [
  {
    id: 'R-101',
    date: '2026-05-10',
    receivedFrom: 'سعید عظیمی',
    amount: 145000000,
    bankName: 'بانک ملت',
    notes: 'تسویه بابت خرید تتر پارت اول',
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 5
  },
  {
    id: 'R-102',
    date: '2026-05-12',
    receivedFrom: 'مریم حسینی',
    amount: 82000000,
    bankName: 'بانک سامان',
    notes: 'کارمزد فارکس و سبدگردانی کد ۳',
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 3
  },
  {
    id: 'R-103',
    date: '2026-05-15',
    receivedFrom: 'سعید عظیمی',
    amount: 60000000,
    bankName: 'بانک ملی',
    notes: 'پیش پرداخت پارت دوم شارژ صرافی',
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 1
  },
  {
    id: 'R-104',
    date: '2026-05-20',
    receivedFrom: 'امیر قاسمی',
    amount: 320000000,
    bankName: 'بانک پاسارگاد',
    notes: 'واریزی سود معامله‌گری سیگنال طلایی دی‌ماه',
    createdAt: Date.now() - 1000 * 60 * 60 * 12
  }
];

export const INITIAL_CRYPTO_ENTRIES: CryptoEntry[] = [
  {
    id: 'C-201',
    date: '2026-05-09',
    coinName: 'USDT',
    amount: 3500.25,
    coinPrice: 1.001,
    equivalentUsd: 3503.75,
    walletAddress: 'TYr6mUasvD2q7gRw8f3k2asdfbN2eLqxKs',
    network: 'TRC-20',
    type: 'in',
    txHash: 'TLf6R3z8HkdYmWp7N2eLqxKsDjbP1uN3vG',
    notes: 'دریافتی سود ولت پرو بابت آوریل',
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 6
  },
  {
    id: 'C-202',
    date: '2026-05-11',
    coinName: 'BTC',
    amount: 0.125,
    coinPrice: 66800.00,
    equivalentUsd: 8350.00,
    walletAddress: 'bc1qxy2kg3ca70q5m4afun6snv3tw730p4f2x3v73x',
    network: 'Mainnet',
    type: 'in',
    txHash: 'bc1qxy2kg3ca70q5m4afun6snv3tw730p4f2x3v73x',
    notes: 'دریافتی سهم سرمایه‌گذار خارجی ولت دسکتاپ',
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 4
  },
  {
    id: 'C-203',
    date: '2026-05-14',
    coinName: 'USDT',
    amount: 1200.00,
    coinPrice: 1.00,
    equivalentUsd: 1200.00,
    walletAddress: '0x7a9c8032abf5411c5db61298c41d145719bc4a3a6fa65e921d258b3',
    network: 'ERC-20',
    type: 'in',
    txHash: '0x7a9c8032abf5411c5db61298c41d145719bc4a3a6fa65e921d258b3',
    notes: 'واریزی تستی صرافی کریپتو دات کام',
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 2
  },
  {
    id: 'C-204',
    date: '2026-05-18',
    coinName: 'ETH',
    amount: 1.45,
    coinPrice: 3450.00,
    equivalentUsd: 5002.50,
    walletAddress: '0x3344d21ee6f3b79ce4d6df1cd4faf019c9dfda71cff62f33bc1841df',
    network: 'ERC-20',
    type: 'in',
    txHash: '0x3344d21ee6f3b79ce4d6df1cd4faf019c9dfda71cff62f33bc1841df',
    notes: 'فروش توکن های ارز ثانویه در صرافی غیرمتمرکز',
    createdAt: Date.now() - 1000 * 60 * 60 * 8
  }
];

/**
 * Converts Jalali year, month, and day to Gregorian Date object.
 */
export function jalaliToGregorian(jy: number, jm: number, jd: number): Date {
  const g_days_in_month = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const j_days_in_month = [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 29];

  let jy2 = jy - 979;
  let jm2 = jm - 1;
  let jd2 = jd - 1;

  let j_day_no = 365 * jy2 + Math.floor(jy2 / 33) * 8 + Math.floor(((jy2 % 33) + 3) / 4);
  for (let i = 0; i < jm2; ++i) {
    j_day_no += j_days_in_month[i];
  }
  j_day_no += jd2;

  let g_day_no = j_day_no + 79;

  let gy = 1600 + 400 * Math.floor(g_day_no / 146097);
  g_day_no = g_day_no % 146097;

  let leap = true;
  if (g_day_no >= 36525) {
    g_day_no--;
    gy += 100 * Math.floor(g_day_no / 36524);
    g_day_no = g_day_no % 36524;

    if (g_day_no >= 365) {
      g_day_no++;
    } else {
      leap = false;
    }
  }

  gy += 4 * Math.floor(g_day_no / 1461);
  g_day_no %= 1461;

  if (g_day_no >= 366) {
    leap = false;
    g_day_no--;
    gy += Math.floor(g_day_no / 365);
    g_day_no = g_day_no % 365;
  }

  let i = 0;
  for (i = 0; g_day_no >= g_days_in_month[i] + (i === 1 && leap ? 1 : 0); i++) {
    g_day_no -= g_days_in_month[i] + (i === 1 && leap ? 1 : 0);
  }
  const gd = g_day_no + 1;
  const gm = i + 1;

  return new Date(gy, gm - 1, gd);
}

/**
 * Converts Gregorian year, month, and day to Jalali { jy, jm, jd } coordinates.
 */
export function gregorianToJalali(gy: number, gm: number, gd: number): { jy: number; jm: number; jd: number } {
  let g_days_in_month = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let j_days_in_month = [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 29];

  let gy2 = gy - 1600;
  let gm2 = gm - 1;
  let gd2 = gd - 1;

  let g_day_no = 365 * gy2 + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400);
  for (let i = 0; i < gm2; ++i) {
    g_day_no += g_days_in_month[i];
  }
  if (gm2 > 1 && ((gy2 % 4 === 0 && gy2 % 100 !== 0) || gy2 % 400 === 0)) {
    g_day_no++;
  }
  g_day_no += gd2;

  let j_day_no = g_day_no - 79;

  let j_np = Math.floor(j_day_no / 12053);
  j_day_no %= 12053;

  let jy = 979 + 33 * j_np + 4 * Math.floor(j_day_no / 1461);
  j_day_no %= 1461;

  if (j_day_no >= 366) {
    jy += Math.floor((j_day_no - 1) / 365);
    j_day_no = (j_day_no - 1) % 365;
  }

  let i = 0;
  for (i = 0; i < 11 && j_day_no >= j_days_in_month[i]; ++i) {
    j_day_no -= j_days_in_month[i];
  }
  let jm = i + 1;
  let jd = j_day_no + 1;

  return { jy, jm, jd };
}

