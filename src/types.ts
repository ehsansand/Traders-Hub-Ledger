export type LedgerType = 'rial' | 'crypto';

export interface RialEntry {
  id: string;
  date: string; // YYYY-MM-DD or Solar Hijri if they write text
  receivedFrom: string; // دریافتی از / مودی دریافت / گیرنده وجه
  amount: number; // معادل تومان
  bankName: string; // اسم بانک
  notes: string; // توضیحات
  createdAt: number;
  type?: 'in' | 'out'; // نوع تراکنش: 'in' (دریافتی) یا 'out' (ارسالی)
  // Conversion links
  linkedCryptoId?: string; // ID of the source crypto entry converted
  convertedAmountInCrypto?: number; // How much crypto was sold (e.g. 5 USDT)
  conversionExchangeName?: string; // The exchange used (e.g. Nobitex)
}

export interface CryptoEntry {
  id: string;
  date: string;
  coinName: string; // اسم ارز (e.g. USDT, BTC)
  amount: number; // مقدار دریافت/ارسال ارز
  coinPrice?: number; // قیمت هر واحد به دلار
  equivalentUsd?: number; // ارزش کل دلاری تراکنش
  walletAddress?: string; // آدرس ولت مقصد واریزی/ارسالی
  network: string; // شبکه (e.g. TRC-20, ERC-20)
  txHash: string; // هش تراکنش
  notes: string; // توضیحات
  createdAt: number;
  type?: 'in' | 'out'; // نوع تراکنش: 'in' (دریافتی) یا 'out' (ارسالی)
  // Conversion tracking
  convertedAmount?: number; // How much of this entry has been converted to Rials so far
  linkedRialEntries?: Array<{
    rialId: string;
    convertedCryptoAmount: number;
    exchangeName: string;
    rialAmount: number;
    date: string;
  }>;
  // Installment tracking
  isInstallment?: boolean;
  installmentTotal?: number;
  installmentPaid?: number;
}

export interface SheetsSyncState {
  spreadsheetId: string | null;
  spreadsheetUrl: string | null;
  lastSyncedAt: string | null;
  syncing: boolean;
  error: string | null;
}
