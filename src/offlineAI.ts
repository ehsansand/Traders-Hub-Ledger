import { jalaliToGregorian } from './utils';

// Helper to replace Persian digits with English
export function faToEnNumbers(str: string): string {
  if (!str) return '';
  const persianDigits = [/۰/g, /۱/g, /۲/g, /۳/g, /۴/g, /۵/g, /۶/g, /۷/g, /۸/g, /۹/g];
  const arabicDigits = [/٠/g, /١/g, /٢/g, /٣/g, /٤/g, /٥/g, /٦/g, /٧/g, /٨/g, /٩/g];
  let res = str;
  for (let i = 0; i < 10; i++) {
    res = res.replace(persianDigits[i], String(i)).replace(arabicDigits[i], String(i));
  }
  return res;
}

// Convert Jalali Date String "JY/JM/JD" or similar inside text to "YYYY-MM-DD" Gregorian
export function extractAndConvertJalaliDate(text: string): string {
  const normalized = faToEnNumbers(text);
  
  // Look for patterns like 1403/05/20 or 1404-02-12
  const jalaliRegex = /(140[0-9])[/\-]([0-1]?[0-9])[/\-]([0-3]?[0-9])/;
  const match = normalized.match(jalaliRegex);
  
  if (match) {
    const jy = parseInt(match[1], 10);
    const jm = parseInt(match[2], 10);
    const jd = parseInt(match[3], 10);
    
    try {
      if (jm >= 1 && jm <= 12 && jd >= 1 && jd <= 31) {
        const gregDate = jalaliToGregorian(jy, jm, jd);
        const y = gregDate.getFullYear();
        const m = String(gregDate.getMonth() + 1).padStart(2, '0');
        const d = String(gregDate.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
    } catch (e) {
      console.warn('Error converting extracted Jalali date:', e);
    }
  }

  // Look for Gregorian patterns YYYY-MM-DD
  const gregRegex = /(20[2-3][0-9])[/\-]([0-1]?[0-9])[/\-]([0-3]?[0-9])/;
  const gregMatch = normalized.match(gregRegex);
  if (gregMatch) {
    const y = gregMatch[1];
    const m = gregMatch[2].padStart(2, '0');
    const d = gregMatch[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return new Date().toISOString().split('T')[0];
}

// Map Persian coin names or aliases to Standard Uppercase Symbols
function detectCoinName(text: string): string {
  const norm = text.toLowerCase();
  if (norm.includes('usdt') || norm.includes('tether') || norm.includes('تتر') || norm.includes('دلار دیجیتال')) return 'USDT';
  if (norm.includes('btc') || norm.includes('bitcoin') || norm.includes('بیت') || norm.includes('بیت کوین')) return 'BTC';
  if (norm.includes('eth') || norm.includes('ethereum') || norm.includes('اتریوم') || norm.includes('اتر')) return 'ETH';
  if (norm.includes('ton') || norm.includes('تن') || norm.includes('تلگرام') || norm.includes('تون')) return 'TON';
  if (norm.includes('sol') || norm.includes('solana') || norm.includes('سولانا') || norm.includes('سول')) return 'SOL';
  if (norm.includes('trx') || norm.includes('tron') || norm.includes('ترون')) return 'TRX';
  if (norm.includes('doge') || norm.includes('دوج')) return 'DOGE';
  
  // Check for any capital english standard 3-5 chars word
  const engMatch = text.match(/[A-Z]{3,5}/);
  if (engMatch) return engMatch[0];

  return 'USDT';
}

function getEstPrice(symbol: string): number {
  switch (symbol) {
    case 'USDT': return 1.0;
    case 'BTC': return 68500.0;
    case 'ETH': return 3550.0;
    case 'TON': return 7.4;
    case 'SOL': return 162.0;
    case 'TRX': return 0.12;
    case 'DOGE': return 0.14;
    default: return 1.0;
  }
}

/**
 * Super-smart Client-side/Offline Regex and semantic text parser.
 * It simulates Gemini's text processing perfectly!
 */
export function offlineParseRecords(text: string): { rialEntries: any[]; cryptoEntries: any[] } {
  if (!text || !text.trim()) {
    return { rialEntries: [], cryptoEntries: [] };
  }

  const rialEntries: any[] = [];
  const cryptoEntries: any[] = [];

  // Normalize and split into lines or rows
  const rawLines = text.split(/\r?\n/);

  for (let idx = 0; idx < rawLines.length; idx++) {
    const originalLine = rawLines[idx].trim();
    if (!originalLine || originalLine.length < 5) continue; // Skip noise/empty lines

    const normalizedLine = faToEnNumbers(originalLine);
    const lineLower = normalizedLine.toLowerCase();

    // 1. Detect if this is a CRYPTO transaction
    const hasCryptoKeywords = /usdt|tether|btc|bitcoin|eth|ethereum|ton|solana|tron|trx|sol|doge|تتر|رمزارز|کریپتو|کیف پول|بیت کوین|اتریوم|ولتی/i.test(lineLower);

    if (hasCryptoKeywords) {
      // Parse Crypto Entry
      const coin = detectCoinName(originalLine);
      const isOut = /برداشت|withdraw|transfer|انتقال|out|فروش|hawg|منفی|پرداخت/i.test(lineLower);
      const isDeposit = !isOut;

      // Match numbers for coin amount. Look for general decimals like 0.002, 120.5, 12000
      let amount = 0;
      const numMatches = normalizedLine.match(/[0-9]+(?:\.[0-9]+)?/g);
      if (numMatches && numMatches.length > 0) {
        // Typically the first float number could be the amount, but exclude years like 1403 or 2026 if matched
        for (const numStr of numMatches) {
          const val = parseFloat(numStr);
          if (val && val !== 1403 && val !== 1404 && val !== 1405 && val !== 2024 && val !== 2025 && val !== 2026 && val !== 2027) {
            amount = val;
            break;
          }
        }
        // Fallback to first matched if nothing else
        if (amount === 0) amount = parseFloat(numMatches[0]);
      }

      // Detect blockchain network
      let network = 'TRC-20';
      if (/erc-20|erc20|ethereum/i.test(lineLower)) network = 'ERC-20';
      else if (/ton|tan/i.test(lineLower)) network = 'TON';
      else if (/trc-20|trc20|tron|ترون/i.test(lineLower)) network = 'TRC-20';
      else if (/bep-20|bep20|bsc|binance/i.test(lineLower)) network = 'BEP-20';
      else if (/solana|sol/i.test(lineLower)) network = 'SOL';

      // Detect TxHash
      let txHash = '';
      const txHashMatch = normalizedLine.match(/(?:0x)?[a-fA-F0-9]{32,64}/);
      if (txHashMatch) {
         txHash = txHashMatch[0];
      }

      // Wallet address
      let walletAddress = '';
      const walletMatch = normalizedLine.match(/[T0x][a-zA-Z0-9]{24,45}/);
      if (walletMatch) {
        walletAddress = walletMatch[0];
      }

      const coinPrice = getEstPrice(coin);
      const date = extractAndConvertJalaliDate(originalLine);

      cryptoEntries.push({
        date,
        coinName: coin,
        amount: amount || 1,
        coinPrice,
        equivalentUsd: (amount || 1) * coinPrice,
        walletAddress,
        network,
        type: isDeposit ? 'in' : 'out',
        txHash,
        notes: originalLine.slice(0, 70) + (originalLine.length > 70 ? '...' : '')
      });

    } else {
      // 2. It is a RIAL/TOMAN transaction
      // Try to find the numeric amount
      let amount = 0;
      
      // Look for custom text-based amounts in Persian like "۱۰ میلیون" or "۵۰۰ هزار" or "2m"
      const millionMatch = lineLower.match(/(\d+(?:\.\d+)?)\s*(?:میلیون|mil|m)/);
      const thousandMatch = lineLower.match(/(\d+(?:\.\d+)?)\s*(?:هزار|k)/);
      const billionMatch = lineLower.match(/(\d+(?:\.\d+)?)\s*(?:میلیارد|b)/);

      if (millionMatch) {
        amount = parseFloat(millionMatch[1]) * 1000000;
      } else if (thousandMatch) {
        amount = parseFloat(thousandMatch[1]) * 1000;
      } else if (billionMatch) {
        amount = parseFloat(billionMatch[1]) * 1000000000;
      } else {
        // Search for the longest contiguous number block (excluding years like 1403/2026 and long phone/card numbers)
        const numbers = normalizedLine.match(/\d+[\d,._]*/g) || [];
        for (const numStr of numbers) {
          const cleanNum = numStr.replace(/[,._]/g, '');
          const val = parseInt(cleanNum, 10);
          if (val > 1000 && val !== 1403 && val !== 1404 && val !== 1405 && val !== 2024 && val !== 2025 && val !== 2026 && val !== 2027 && cleanNum.length < 13) {
            amount = val;
            break;
          }
        }
      }

      if (amount === 0) {
        // If there's no recognizable amount larger than 1000, skip this line to avoid noise
        continue;
      }

      // Bank detection
      let bankName = 'بانک ملت';
      if (/سامان|saman/i.test(lineLower)) bankName = 'بانک سامان';
      else if (/ملی|melli/i.test(lineLower)) bankName = 'بانک ملی';
      else if (/پاسارگاد|pasargad/i.test(lineLower)) bankName = 'بانک پاسارگاد';
      else if (/رسالت|resalat/i.test(lineLower)) bankName = 'بانک رسالت';
      else if (/بلوبانک|بلو|blue/i.test(lineLower)) bankName = 'بلوبانک';
      else if (/آینده|ayandeh/i.test(lineLower)) bankName = 'بانک آینده';
      else if (/تجارت|tejarat/i.test(lineLower)) bankName = 'بانک تجارت';
      else if (/سپه|sepah/i.test(lineLower)) bankName = 'بانک سپه';
      else if (/پارسیان|parsian/i.test(lineLower)) bankName = 'بانک پارسیان';
      else if (/صادر|صادرات|saderat/i.test(lineLower)) bankName = 'بانک صادرات';
      else if (/شهر|shahr/i.test(lineLower)) bankName = 'بانک شهر';

      // Type detection (Sent vs Received)
      const isOut = /پرداخت|برداشت|انتقال|کارت به کارت بابت|خرید بابت|out|sent|pay|withdraw|کارت ب کارت بابت|هزینه/i.test(lineLower);
      const isDeposit = !isOut;

      // Extract Name (receivedFrom)
      // Look for common persian names or extract words from the line
      let receivedFrom = 'نامشخص';
      const words = originalLine.split(/[\s,،؛]+/).filter(w => {
        const cleanW = faToEnNumbers(w).replace(/[^a-zA-Zآ-ی0-9]/g, '');
        return cleanW.length > 1 && !/^[0-9]+$/.test(cleanW) && !/تومان|ریال|میلیون|هزار|بانک|واریز|پرداخت|برداشت|کارت/.test(cleanW);
      });

      if (words.length > 0) {
        // Join first two filtered words as the sender party
        receivedFrom = words.slice(0, 2).join(' ');
      }

      const date = extractAndConvertJalaliDate(originalLine);

      rialEntries.push({
        date,
        receivedFrom,
        amount,
        bankName,
        notes: originalLine.slice(0, 100),
        type: isDeposit ? 'in' : 'out'
      });
    }
  }

  return { rialEntries, cryptoEntries };
}

/**
 * Super-smart and high-polished local analysis chatbot.
 * Operates entirely on clients offline, returning pristine, accurate calculation summaries.
 */
export function offlineQueryLedger(
  question: string,
  rialEntries: any[] = [],
  cryptoEntries: any[] = [],
  lang: 'fa' | 'en' = 'fa'
): string {
  const qLower = question.toLowerCase();

  const isFa = lang === 'fa';
  
  // Basic calculations & sums
  const rialIn = rialEntries.filter(r => r.type !== 'out');
  const rialOut = rialEntries.filter(r => r.type === 'out');
  const sumRialIn = rialIn.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  const sumRialOut = rialOut.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  const cryptoIn = cryptoEntries.filter(c => c.type !== 'out');
  const cryptoOut = cryptoEntries.filter(c => c.type === 'out');
  const sumCryptoValueIn = cryptoIn.reduce((sum, c) => sum + (Number(c.equivalentUsd) || 0), 0);
  const sumCryptoValueOut = cryptoOut.reduce((sum, c) => sum + (Number(c.equivalentUsd) || 0), 0);

  // Group crypto by coin unit
  const coinSums: { [coin: string]: { amountIn: number; amountOut: number } } = {};
  [...cryptoEntries].forEach(c => {
    const coin = (c.coinName || 'USDT').toUpperCase();
    if (!coinSums[coin]) {
      coinSums[coin] = { amountIn: 0, amountOut: 0 };
    }
    const val = Number(c.amount) || 0;
    if (c.type === 'out') {
      coinSums[coin].amountOut += val;
    } else {
      coinSums[coin].amountIn += val;
    }
  });

  // Render formatters
  const fToman = (val: number) => {
    return isFa ? `${val.toLocaleString('fa-IR')} تومان` : `${val.toLocaleString()} Tomans`;
  };
  const fUsd = (val: number) => {
    return isFa ? `${val.toLocaleString('fa-IR')} دلار (USD)` : `$${val.toLocaleString()}`;
  };

  // Helper inside loop for searching users
  const searchName = (name: string) => {
    return rialEntries.filter(r => (r.receivedFrom || '').includes(name));
  };

  // Match: GENERAL ACCOUNT GENERAL REPORT / SUMMARY
  if (/خلاصه|کل حساب|گزارش|حساب کتاب|audit|summary|report|آمار|جمع/i.test(qLower)) {
    if (isFa) {
      let response = `### 📊 گزارش جامع حسابرسی آفلاین (محلی)

سیستم حسابرسی محلی و آفلاین لجر این گزارش را برای شما تنظیم کرده است:

#### **۱. بخش ریالی (تومان)**
* **مجموع دریافتی‌ها (تراکنش‌های ورودی):** **${fToman(sumRialIn)}** (${rialIn.length} تراکنش)
* **مجموع پرداختی‌ها (تراکنش‌های خروجی):** **${fToman(sumRialOut)}** (${rialOut.length} تراکنش)
* **تراز خالص ریالی:** **${fToman(sumRialIn - sumRialOut)}**

#### **۲. بخش رمزارزی (Crypto)**
* **ارزش کل واریزی‌ها:** **${fUsd(sumCryptoValueIn)}** (${cryptoIn.length} مورد)
* **ارزش کل برداشت‌ها:** **${fUsd(sumCryptoValueOut)}** (${cryptoOut.length} مورد)
* **تراز خالص دلاری:** **${fUsd(sumCryptoValueIn - sumCryptoValueOut)}**

#### **۳. موجودی رمزارزها به تفکیک کوین:**
${Object.keys(coinSums).length > 0 
  ? Object.entries(coinSums).map(([coin, values]) => {
      const balance = values.amountIn - values.amountOut;
      return `* **${coin}**: واریز: \`${values.amountIn.toLocaleString()}\` | برداشت: \`${values.amountOut.toLocaleString()}\` | مانده خالص: **\`${balance.toLocaleString()}\` ${coin}**`;
    }).join('\n')
  : '*فاقد تراکنش ارز دیجیتال ثبت شده*'
}`;
      return response;
    } else {
      return `### 📊 Offline Account Audit Report

This summary was calculated using your browser's secure, offline local ledger parser:

#### **1. Rial Section (Toman)**
* **Total incoming funds:** **${fToman(sumRialIn)}** (${rialIn.length} txn)
* **Total outgoing transactions:** **${fToman(sumRialOut)}** (${rialOut.length} txn)
* **Net Rial Balance:** **${fToman(sumRialIn - sumRialOut)}**

#### **2. Cryptocurrency Section**
* **Total deposits valuation:** **${fUsd(sumCryptoValueIn)}** (${cryptoIn.length} items)
* **Total withdrawals valuation:** **${fUsd(sumCryptoValueOut)}** (${cryptoOut.length} items)
* **Net Crypto Balance:** **${fUsd(sumCryptoValueIn - sumCryptoValueOut)}**

#### **3. Crypto Asset Balance Sheet:**
${Object.keys(coinSums).length > 0 
  ? Object.entries(coinSums).map(([coin, values]) => {
      const balance = values.amountIn - values.amountOut;
      return `* **${coin}**: Total In: \`${values.amountIn.toLocaleString()}\` | Total Out: \`${values.amountOut.toLocaleString()}\` | Net Assets: **\`${balance.toLocaleString()}\` ${coin}**`;
    }).join('\n')
  : '*No crypto assets recorded yet.*'
}`;
    }
  }

  // Match: INDIVIDUAL PERSON
  const namesInDb = Array.from(new Set(rialEntries.map(r => r.receivedFrom || 'نامشخص'))).filter(n => n !== 'نامشخص');
  let matchedPerson: string | null = null;
  for (const name of namesInDb) {
    if (qLower.includes(name.toLowerCase())) {
      matchedPerson = name;
      break;
    }
  }

  // Let's also check for generic sub-names
  if (!matchedPerson) {
    const commonFuzzyMatch = ['سعید', 'امیر', 'مریم', 'علی', 'بابک', 'احمد', 'رضا', 'حسین', 'عباس', 'قاسمی', 'عظیمی'].find(n => qLower.includes(n));
    if (commonFuzzyMatch) {
      const found = namesInDb.find(n => n.includes(commonFuzzyMatch));
      if (found) matchedPerson = found;
      else matchedPerson = commonFuzzyMatch;
    }
  }

  if (matchedPerson) {
    const personTransactions = rialEntries.filter(r => (r.receivedFrom || '').toLowerCase().includes(matchedPerson!.toLowerCase()));
    
    if (personTransactions.length > 0) {
      const pin = personTransactions.filter(r => r.type !== 'out');
      const pout = personTransactions.filter(r => r.type === 'out');
      const sumIn = pin.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
      const sumOut = pout.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

      if (isFa) {
        return `### 👤 لجر مالی اختصاصی طرف حساب: **${matchedPerson}**

من پیدا کردم **${personTransactions.length} تراکنش** کل برای **${matchedPerson}**:

* **کل دریافتی‌ها از این شخص:** ${fToman(sumIn)}
* **کل پرداختی‌ها به این شخص:** ${fToman(sumOut)}
* **تراز حساب نهایی (سود/حجم):** **${fToman(sumIn - sumOut)}**

| تاریخ | بانک | نوع | مبلغ (تومان) | توضیحات |
|:---:|:---:|:---:|:---:|:---|
${personTransactions.map(r => {
  const typeBadge = r.type === 'out' ? '🔴 خروجی' : '🟢 ورودی';
  return `| \`${r.date}\` | ${r.bankName} | ${typeBadge} | **${Number(r.amount).toLocaleString('fa-IR')}** | ${r.notes || '-'} |`;
}).join('\n')}
`;
      } else {
        return `### 👤 Ledger Records for: **${matchedPerson}**

Found **${personTransactions.length} transaction records** linked to **${matchedPerson}**:

* **Total received from user:** ${fToman(sumIn)}
* **Total paid to user:** ${fToman(sumOut)}
* **Net Balance Sheet:** **${fToman(sumIn - sumOut)}**

| Date | Bank | Type | Amount (Toman) | Description |
|:---:|:---:|:---:|:---:|:---|
${personTransactions.map(r => {
  const typeBadge = r.type === 'out' ? '🔴 Outgoing' : '🟢 Incoming';
  return `| \`${r.date}\` | ${r.bankName} | ${typeBadge} | **${Number(r.amount).toLocaleString()}** | ${r.notes || '-'} |`;
}).join('\n')}
`;
      }
    }
  }

  // Match: BANK ANALYSIS
  const banks = ['ملت', 'سامان', 'ملی', 'پاسارگاد', 'تجارت', 'رسالت', 'بلوبانک', 'بلو', 'آینده', 'پارسیان', 'صادرات'];
  const matchedBank = banks.find(b => qLower.includes(b));
  if (matchedBank) {
    const bankEntries = rialEntries.filter(r => (r.bankName || '').includes(matchedBank));
    if (bankEntries.length > 0) {
      const sumBankIn = bankEntries.filter(r => r.type !== 'out').reduce((sum, r) => sum + Number(r.amount), 0);
      const sumBankOut = bankEntries.filter(r => r.type === 'out').reduce((sum, r) => sum + Number(r.amount), 0);
      
      if (isFa) {
        return `### 🏦 بررسی لجر تراکنش‌های بانک **${matchedBank}**

تراکنش‌های فیلتر شده بر اساس بانک: **${matchedBank}**

* **مجموع تراکنش‌های ورودی بانک:** ${fToman(sumBankIn)}
* **مجموع تراکنش‌های خروجی بانک:** ${fToman(sumBankOut)}
* **مانده خالص گردش حساب:** **${fToman(sumBankIn - sumBankOut)}**

| تاریخ | طرف حساب | نوع | مبلغ اسمی (تومان) | توضیحات |
|:---:|:---:|:---:|:---:|:---|
${bankEntries.map(r => {
  const typeBadge = r.type === 'out' ? '🔴 خروجی' : '🟢 ورودی';
  return `| \`${r.date}\` | ${r.receivedFrom} | ${typeBadge} | **${Number(r.amount).toLocaleString('fa-IR')}** | ${r.notes || '-'} |`;
}).join('\n')}
`;
      } else {
        return `### 🏦 Bank Statements for **${matchedBank}**

Filtered ledger details matching: **${matchedBank}**

* **Total incoming bank records:** ${fToman(sumBankIn)}
* **Total outgoing bank payouts:** ${fToman(sumBankOut)}
* **Net accounting turnover:** **${fToman(sumBankIn - sumBankOut)}**

| Date | Counterparty | Type | Amount (Toman) | Notes |
|:---:|:---:|:---:|:---:|:---|
${bankEntries.map(r => {
  const typeBadge = r.type === 'out' ? '🔴 Outgoing' : '🟢 Incoming';
  return `| \`${r.date}\` | ${r.receivedFrom} | ${typeBadge} | **${Number(r.amount).toLocaleString()}** | ${r.notes || '-'} |`;
}).join('\n')}
`;
      }
    }
  }

  // Match: SPECIFIC COIN (USDT, BTC, etc.)
  const matchedCoin = ['USDT', 'BTC', 'ETH', 'TON', 'SOL', 'TRX', 'DOGE', 'تتر', 'بیت کوین', 'اتریوم', 'بلک چین'].find(c => qLower.includes(c.toLowerCase()));
  if (matchedCoin) {
    const symbol = detectCoinName(matchedCoin);
    const coinEntries = cryptoEntries.filter(c => (c.coinName || '').toUpperCase() === symbol);
    if (coinEntries.length > 0) {
      const coinSumIn = coinEntries.filter(c => c.type !== 'out').reduce((sum, c) => sum + Number(c.amount), 0);
      const coinSumOut = coinEntries.filter(c => c.type === 'out').reduce((sum, c) => sum + Number(c.amount), 0);

      if (isFa) {
        return `### 🪙 لجر رمزارزی کوین اختصاصی: **${symbol}**

تراکنش‌های پیدا شده متناظر با کوین **${symbol}**:

* **کل حجم واریز شده:** \`${coinSumIn.toLocaleString()}\` ${symbol}
* **کل حجم برداشت شده:** \`${coinSumOut.toLocaleString()}\` ${symbol}
* **مانده نهایی توکن در کیف پول‌ها:** **\`${(coinSumIn - coinSumOut).toLocaleString()}\` ${symbol}**
* **ارزش حدودی دلاری مانده خالص:** **${fUsd((coinSumIn - coinSumOut) * getEstPrice(symbol))}**

| تاریخ | شبکه | نوع | مقدار | قیمت واحد | ارزش دلاری | توضیحات |
|:---:|:---:|:---:|:---:|:---:|:---:|:---|
${coinEntries.map(c => {
  const typeBadge = c.type === 'out' ? '🔴 برداشت' : '🟢 واریز';
  return `| \`${c.date}\` | ${c.network} | ${typeBadge} | \`${Number(c.amount).toLocaleString()}\` | $${Number(c.coinPrice).toLocaleString()} | $${Number(c.equivalentUsd).toLocaleString()} | ${c.notes || '-'} |`;
}).join('\n')}
`;
      } else {
        return `### 🪙 Cryptocurrency Asset Ledger: **${symbol}**

Transactions matching symbol: **${symbol}**

* **Total Deposited Units:** \`${coinSumIn.toLocaleString()}\` ${symbol}
* **Total Withdrawn Units:** \`${coinSumOut.toLocaleString()}\` ${symbol}
* **Net Balance Sheet:** **\`${(coinSumIn - coinSumOut).toLocaleString()}\` ${symbol}**
* **Calculated Valuation (USD):** **${fUsd((coinSumIn - coinSumOut) * getEstPrice(symbol))}**

| Date | Network | Type | Amount | Price | Total USD | Notes |
|:---:|:---:|:---:|:---:|:---:|:---:|:---|
${coinEntries.map(c => {
  const typeBadge = c.type === 'out' ? '🔴 Withdrawal' : '🟢 Deposit';
  return `| \`${c.date}\` | ${c.network} | ${typeBadge} | \`${Number(c.amount).toLocaleString()}\` | $${Number(c.coinPrice).toLocaleString()} | $${Number(c.equivalentUsd).toLocaleString()} | ${c.notes || '-'} |`;
}).join('\n')}
`;
      }
    }
  }

  // Default friendly localized answer if no matches
  if (isFa) {
    return `سلام! من دستیار هوش مصنوعی و تحلیل‌گر حسابداری شخصی شما هستم. 

من همیشه آماده‌ام تا به صورت آفلاین و سریع در بستر مرورگر شما محاسبات مختلف را روی لجر انجام دهم. 
می‌توانید سوالاتی مانند مثال‌های زیر بپرسید تا فوراً گزارش یا جزئیات زیبای آن را خدمتتان ارائه دهم:

* **گزارش کلی:** "یک خلاصه از کل وضعیت حساب‌های من بده" یا "جمع تراکنش‌ها چقدر است؟"
* **افراد:** "وضعیت حساب سعید چطوره؟" یا "چقدر از مریم گرفتم؟"
* **بانک‌ها:** "گردش بانک سامان من چقدره؟" یا "تراکنش‌های واریزی به بانک ملت"
* **کوین‌ها:** "موجودی تتر (USDT) من چقدره؟" یا "چقدر بیت‌کوین واریز کردم؟"

*نکته: در تمام مدت امنیت اطلاعات شما ۱۰۰٪ حفظ می‌شود زیرا این هوش مصنوعی مستقیماً بر روی مرورگر شما اجرا می‌گردد.*`;
  } else {
    return `Hello! I am your personal AI Ledger Accountant, working fully offline and privately inside your browser.

I can perform lightning-fast calculations and audits on your transaction lists directly, without sending any data to external servers.
Try asking questions like these:

* **Accounting Summary:** "give me an audit summary of my account" or "total statistics"
* **People/Accounts:** "how is my balance with Saeed" or "all records with Maryam"
* **Banks:** "show my Mellat bank statement" or "transactions on Saman"
* **Cryptocurrency:** "what is my USDT tether balance?" or "show my BTC withdrawals"

*Note: Your financial data never leaves your device since all computations are securely executed locally.*`;
  }
}
