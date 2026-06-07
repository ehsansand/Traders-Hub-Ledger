import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { RialEntry, CryptoEntry } from './types';
import { toJalali } from './utils';

/**
 * Exports Rial and Crypto Ledger data into a multi-sheet Microsoft Excel File (.xlsx).
 */
export function exportToExcel(rialEntries: RialEntry[], cryptoEntries: CryptoEntry[], lang: 'fa' | 'en' = 'fa', isFiltered = false) {
  const wb = XLSX.utils.book_new();

  if (lang === 'fa') {
    // 1. Rial Sheet
    const rialRows = rialEntries.map((item) => ({
      "شناسه": item.id,
      "تراکنش": item.type === 'out' ? "خروجی / صادره" : "ورودی / وارده",
      "تاریخ تراکنش (میلادی)": item.date,
      "تاریخ تراکنش (شمسی)": toJalali(item.date, 'fa'),
      "طرف حساب / واریز کننده": item.receivedFrom,
      "مبلغ (تومان)": item.amount,
      "بانک مقصد": item.bankName,
      "توضیحات بابت": item.notes || "---",
    }));
    const rialWs = XLSX.utils.json_to_sheet(rialRows);
    XLSX.utils.book_append_sheet(wb, rialWs, "دریافتی‌های ریالی");

    // 2. Crypto Sheet
    const cryptoRows = cryptoEntries.map((item) => ({
      "شناسه": item.id,
      "تراکنش": item.type === 'out' ? "خروجی / صادره" : "ورودی / وارده",
      "تاریخ تراکنش (میلادی)": item.date,
      "تاریخ تراکنش (شمسی)": toJalali(item.date, 'fa'),
      "ارز رمزنگاری شده": item.coinName,
      "بستر شبکه": item.network,
      "مقدار ارز": item.amount,
      "قیمت واحد (دلار)": item.coinPrice || 0,
      "ارزش معادل دلاری (USD)": item.equivalentUsd || 0,
      "آدرس ولت واریزی": item.walletAddress || "---",
      "هش تراکنش (TxHash)": item.txHash || "---",
      "توضیحات": item.notes || "---",
    }));
    const cryptoWs = XLSX.utils.json_to_sheet(cryptoRows);
    XLSX.utils.book_append_sheet(wb, cryptoWs, "دریافتی‌های کریپتویی");
  } else {
    // English Excel sheet mapping
    const rialRowsEN = rialEntries.map((item) => ({
      "ID": item.id,
      "Type": item.type === 'out' ? "OUT" : "IN",
      "Transaction Date (Gregorian)": item.date,
      "Transaction Date (Jalali)": toJalali(item.date, 'en'),
      "Sender Name": item.receivedFrom,
      "Amount (Toman)": item.amount,
      "Destination Bank": item.bankName,
      "Notes / Purpose": item.notes || "---",
    }));
    const rialWs = XLSX.utils.json_to_sheet(rialRowsEN);
    XLSX.utils.book_append_sheet(wb, rialWs, "Rial Deposits");

    const cryptoRowsEN = cryptoEntries.map((item) => ({
      "ID": item.id,
      "Type": item.type === 'out' ? "OUT" : "IN",
      "Deposit Date (Gregorian)": item.date,
      "Deposit Date (Jalali)": toJalali(item.date, 'en'),
      "Asset Symbol": item.coinName,
      "Network Protocol": item.network,
      "Asset Amount": item.amount,
      "Unit Price (USD)": item.coinPrice || 0,
      "Equivalent USD": item.equivalentUsd || 0,
      "Destination Wallet Address": item.walletAddress || "---",
      "Transaction Hash": item.txHash || "---",
      "Notes": item.notes || "---",
    }));
    const cryptoWs = XLSX.utils.json_to_sheet(cryptoRowsEN);
    XLSX.utils.book_append_sheet(wb, cryptoWs, "Crypto Deposits");
  }

  // Write Excel file
  const suffix = isFiltered ? "Filtered" : "All";
  XLSX.writeFile(wb, `TradersHub_Ledger_${suffix}_${new Date().toISOString().split('T')[0]}.xlsx`);
}

/**
 * Exports Rial and Crypto Ledger data into an elegant consolidated CSV (.csv) file.
 */
export function exportToCSV(rialEntries: RialEntry[], cryptoEntries: CryptoEntry[], lang: 'fa' | 'en' = 'fa', isFiltered = false) {
  const combinedRows = [
    ...rialEntries.map(item => ({
      "Type": "RIAL",
      "ID": item.id,
      "Date (Gregorian)": item.date,
      "Date (Jalali)": toJalali(item.date, lang),
      "Direction": item.type === 'out' ? (lang === 'fa' ? 'صادره / خروج' : 'Outgoing') : (lang === 'fa' ? 'وارده / واریز' : 'Incoming'),
      "Sender / Party": item.receivedFrom,
      "Amount / Quantity": item.amount,
      "Currency / Asset": lang === 'fa' ? 'تومان' : 'Toman',
      "Destination / Network": item.bankName,
      "Notes / TX Hash": item.notes || "---"
    })),
    ...cryptoEntries.map(item => ({
      "Type": "CRYPTO",
      "ID": item.id,
      "Date (Gregorian)": item.date,
      "Date (Jalali)": toJalali(item.date, lang),
      "Direction": item.type === 'out' ? (lang === 'fa' ? 'صادره / خروج' : 'Outgoing') : (lang === 'fa' ? 'وارده / واریز' : 'Incoming'),
      "Sender / Party": item.walletAddress || "---",
      "Amount / Quantity": item.amount,
      "Currency / Asset": item.coinName,
      "Destination / Network": item.network,
      "Notes / TX Hash": item.txHash || "---"
    }))
  ];

  // Sort by date descending
  combinedRows.sort((a, b) => b["Date (Gregorian)"].localeCompare(a["Date (Gregorian)"]));

  const ws = XLSX.utils.json_to_sheet(combinedRows);
  const csvContent = XLSX.utils.sheet_to_csv(ws);
  
  // Create UTF-8 blob with BOM to support Persian characters
  const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const suffix = isFiltered ? "Filtered" : "All";
  link.setAttribute("href", url);
  link.setAttribute("download", `TradersHub_Ledger_${suffix}_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Triggers a highly layout-optimized PDF invoice export mode.
 * The absolute cleanest way to generate high resolution Persian & English PDF tables with correct RTL support, Vazir/Inter typography, 
 * page structure, and absolute positioning is via print simulation or jsPDF generator.
 * This triggers browser print mode specifically targeted towards PDF document creation.
 */
export function exportToPDF() {
  window.print();
}

/**
 * Generates an English standard PDF of the ledger data using jsPDF.
 */
export function exportLegacyPDF(rialEntries: RialEntry[], cryptoEntries: CryptoEntry[], isFiltered = false) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const suffixText = isFiltered ? "(Filtered Criteria)" : "(All Entries)";

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(52, 211, 153); // Emerald brand color
  doc.text("Traders Hub Pro Ledger Report", 15, 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated Date: ${new Date().toLocaleDateString()} ${suffixText}`, 15, 27);
  doc.text(`User ID Instance: Secure Local Profile`, 15, 33);
  
  // Draw line
  doc.setDrawColor(226, 232, 240);
  doc.line(15, 38, 195, 38);

  // Rial Section
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59);
  doc.text("1. Rial Deposit Records", 15, 48);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  let y = 56;
  doc.text("ID", 15, y);
  doc.text("Date", 32, y);
  doc.text("Sender / Recipient", 55, y);
  doc.text("Dir", 100, y);
  doc.text("Amount (Toman)", 115, y);
  doc.text("Bank Name", 152, y);
  doc.text("Notes", 178, y);

  doc.line(15, y + 2, 195, y + 2);
  y += 7;

  rialEntries.forEach((entry) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    doc.text(entry.id, 15, y);
    doc.text(entry.date, 32, y);
    doc.text(entry.receivedFrom.substring(0, 18), 55, y);
    doc.text((entry.type || "in").toUpperCase(), 100, y);
    doc.text(entry.amount.toLocaleString(), 115, y);
    doc.text(entry.bankName.substring(0, 12), 152, y);
    doc.text((entry.notes || "---").substring(0, 10), 178, y);
    y += 7;
  });

  // Crypto Section
  y += 10;
  if (y > 250) {
    doc.addPage();
    y = 20;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59);
  doc.text("2. Crypto Wallet Deposits", 15, y);
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("ID", 15, y);
  doc.text("Date", 32, y);
  doc.text("Coin", 55, y);
  doc.text("Dir", 68, y);
  doc.text("Network", 78, y);
  doc.text("Amount", 105, y);
  doc.text("Price USD", 125, y);
  doc.text("Notes", 150, y);
  doc.text("TxHash", 175, y);

  doc.line(15, y + 2, 195, y + 2);
  y += 7;

  cryptoEntries.forEach((entry) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    doc.text(entry.id, 15, y);
    doc.text(entry.date, 32, y);
    doc.text(entry.coinName, 55, y);
    doc.text((entry.type || "in").toUpperCase(), 68, y);
    doc.text(entry.network, 78, y);
    doc.text(entry.amount.toString(), 105, y);
    doc.text(entry.coinPrice !== undefined ? `$${entry.coinPrice.toLocaleString()}` : "---", 125, y);
    doc.text((entry.notes || "---").substring(0, 12), 150, y);
    doc.text((entry.txHash || "---").substring(0, 8) + "...", 175, y);
    y += 7;
  });

  const filename = isFiltered ? "Filtered" : "All";
  doc.save(`TradersHub_Ledger_${filename}_${new Date().toISOString().split('T')[0]}.pdf`);
}
