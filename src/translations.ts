export interface LanguageTranslations {
  appTitle: string;
  rialLedger: string;
  cryptoLedger: string;
  analytics: string;
  aiAccountant: string;
  logoutConfirm: string;
  googleSheetsSettings: string;
  sheetsUrlInput: string;
  activeSheet: string;
  connectSheet: string;
  syncSuccess: string;
  syncError: string;
  
  // Rial Ledger Specifics
  rialSummary: string;
  searchRialPlaceholder: string;
  newRialButton: string;
  rialFormTitleAdd: string;
  rialFormTitleEdit: string;
  date: string;
  sender: string;
  amount: string;
  bankName: string;
  description: string;
  cancel: string;
  saveRial: string;
  rialTableId: string;
  rialTableDate: string;
  rialTableSender: string;
  rialTableAmount: string;
  rialTableBank: string;
  rialTableNotes: string;
  rialTableActions: string;
  noRialEntries: string;
  transactionTypeLabel: string;
  typeIncoming: string;
  typeOutgoing: string;
  rialSenderOrRecipient: string;
  proportionLabel: string;
  
  // Crypto Ledger Specifics
  cryptoSummary: string;
  searchCryptoPlaceholder: string;
  newCryptoButton: string;
  cryptoFormTitleAdd: string;
  cryptoFormTitleEdit: string;
  coinName: string;
  network: string;
  txHash: string;
  saveCrypto: string;
  cryptoTableId: string;
  cryptoTableDate: string;
  cryptoTableCoin: string;
  cryptoTableNetwork: string;
  cryptoTableTxHash: string;
  cryptoTableNotes: string;
  cryptoTableAmount: string;
  cryptoTableActions: string;
  noCryptoEntries: string;
  coinPriceLabel: string;
  equivalentUsdLabel: string;
  walletAddressLabel: string;

  // Analytics Specifics
  analyticsTitle: string;
  analyticsSubtitle: string;
  noAnalyticsData: string;
  rialsBySender: string;
  rialsByBank: string;
  cryptoTotalsTitle: string;
  cryptoTotalsSubtitle: string;
  cryptoTotalsCount: string;
  cryptoNetworkDeposits: string;
  timesDeposited: string;
  tomanUnit: string;
  transactionUnit: string;

  // Export Specifics
  exportExcel: string;
  exportPdf: string;
  exportCsv: string;
  printList: string;

  // AI Accountant Specifics
  aiTitle: string;
  aiDescription: string;
  aiPlaceholder: string;
  aiSendButton: string;
  aiQuickQuestionTitle: string;
  aiQuickQ1: string;
  aiQuickQ2: string;
  aiQuickQ3: string;
  aiQuickQ4: string;
  aiLoading: string;

  // Onboarding & Auth Spec
  authGateTitle: string;
  authGateDesc: string;
  emailLabel: string;
  passwordLabel: string;
  displayNameLabel: string;
  signUpTab: string;
  signInTab: string;
  guestTab: string;
  guestAction: string;
  orText: string;
  signUpAction: string;
  signInAction: string;
  googleSyncAccess: string;
  errorRequiredFields: string;
  errorInvalidAmount: string;
  profileNameText: string;
  accTypeGuest: string;
  accTypeEmail: string;
  accTypeGoogle: string;
}

export const translations: Record<'fa' | 'en', LanguageTranslations> = {
  fa: {
    appTitle: "دفتر معامله‌گری تریدرز هاب پرو",
    rialLedger: "دریافتی‌های ریالی",
    cryptoLedger: "دریافتی‌های کریپتویی",
    analytics: "محاسبات و آنالیز کل",
    aiAccountant: "هوش مصنوعی حسابدار AI",
    logoutConfirm: "آیا از خروج از حساب مطمئن هستید؟ همگام‌سازی متوقف خواهد شد.",
    googleSheetsSettings: "تنظیمات ارتباطی گوگل شیت",
    sheetsUrlInput: "آدرس کامل گوگل شیت یا ID آن:",
    activeSheet: "شیت فعال فعلی:",
    connectSheet: "اتصال شیت مربوطه",
    syncSuccess: "همگام‌سازی با گوگل شیت با موفقیت انجام شد!",
    syncError: "خطا در همگام‌سازی گوگل شیت:",
    
    // Rial Ledger Spec
    rialSummary: "کل تراکنش‌های ریالی",
    searchRialPlaceholder: "جستجو در دریافتی‌های ریالی (نام فرستنده، بانک، مبلغ، توضیحات...)",
    newRialButton: "ثبت فیش واریزی ریالی جدید (دفتر معین بانک)",
    rialFormTitleAdd: "ثبت فیش واریزی جدید ریالی",
    rialFormTitleEdit: "ویرایش تراکنش ریالی",
    date: "تاریخ تراکنش",
    sender: "دریافتی از (واریزکننده)",
    amount: "مبلغ واریزی ریال / تومان",
    bankName: "نام بانک مقصد واریز",
    description: "توضیحات بابت",
    cancel: "انصراف",
    saveRial: "ثبت و تایید نهایی فیش ریالی",
    rialTableId: "شناسه ردیف",
    rialTableDate: "تاریخ واریز",
    rialTableSender: "دریافتی از شخص",
    rialTableAmount: "مبلغ واریزی (تومان)",
    rialTableBank: "بانک مقصد",
    rialTableNotes: "توضیحات بابت تراکنش",
    rialTableActions: "عملیات",
    noRialEntries: "هیچ فیش ریالی در دفتر کل ثبت نشده است. برای ثبت اولین دریافت روی دکمه بالا کلیک کنید.",
    transactionTypeLabel: "نوع تراکنش (صادره/وارده)",
    typeIncoming: "دریافتی / وارده 📥",
    typeOutgoing: "ارسالی / صادره 📤",
    rialSenderOrRecipient: "فرستنده / گیرنده وجه",
    proportionLabel: "سهم از کل",
    
    // Crypto Ledger Spec
    cryptoSummary: "کل تراکنش‌های کریپتو",
    searchCryptoPlaceholder: "جستجو در دریافتی‌های کریپتو (نام ارز، آدرس شبکه، هش TX، بابت...)",
    newCryptoButton: "ثبت و واریز جدید کریپتویی (دیتابیس ولت دیجیتال)",
    cryptoFormTitleAdd: "ثبت تراکنش کریپتو جدید",
    cryptoFormTitleEdit: "ویرایش تراکنش کریپتویی",
    coinName: "اسم ارز (Symbol)",
    network: "شبکه انتقال ارز",
    txHash: "شناسه / هش تراکنش (Tx Hash)",
    saveCrypto: "ثبت نهایی آدرس ولت",
    cryptoTableId: "شناسه ردیف",
    cryptoTableDate: "تاریخ واریز",
    cryptoTableCoin: "کوین (ارز)",
    cryptoTableNetwork: "بستر شبکه",
    cryptoTableTxHash: "کلاینت هش تراکنش (TxID)",
    cryptoTableNotes: "توضیحات و بابت",
    cryptoTableAmount: "مقدار ارز",
    cryptoTableActions: "عملیات",
    noCryptoEntries: "هیچ تراکنش کریپتویی در دفتر کل ثبت نشده است. برای ثبت اولین دریافت روی دکمه بالا کلیک کنید.",
    coinPriceLabel: "قیمت واحد (به دلار)",
    equivalentUsdLabel: "ارزش معادل دلاری (USD)",
    walletAddressLabel: "آدرس ولت واریزی (مقصد)",

    // Analytics Spec
    analyticsTitle: "گزارشات و آنالیز تلفیقی Traders Hub Pro",
    analyticsSubtitle: "این بخش به صورت اتوماتیک مجموع مبالغ را بر اساس اشخاص پرداخت‌کننده، بانک‌های مقصد و تفکیک رمزارزها محاسبه می‌کند.",
    noAnalyticsData: "هیچ اطلاعاتی یافت نشد.",
    rialsBySender: "برآیند دریافتی به تفکیک اشخاص فرستنده (Rials by Sender)",
    rialsByBank: "توزیع منابع در بانک‌های مختلف (Rials by Bank)",
    cryptoTotalsTitle: "جمع کل دارایی‌های کریپتویی به تفکیک کوین‌ها و شبکه‌ها",
    cryptoTotalsSubtitle: "مجموع دریافتی تجمعی کریپتو",
    cryptoTotalsCount: "کل تراکنش‌ها",
    cryptoNetworkDeposits: "واریز شده در بستر شبکه:",
    timesDeposited: "مرتبه واریزی",
    tomanUnit: "تومان",
    transactionUnit: "تراکنش",

    // Exports
    exportExcel: "خروجی اکسل (Excel)",
    exportPdf: "دریافت PDF رسمی (PDF)",
    exportCsv: "خروجی CSV خام",
    printList: "نسخه چاپی فاکتورها",

    // AI Accountant Spec
    aiTitle: "هوش مصنوعی حسابدار تریدرز هاب پرو",
    aiDescription: "با اتصال مستقیم به تراکنش‌های فعال ریالی و کریپتویی شما، سوالات مالی خود را بپرسید. برای مثال بپرسید: «از سعید چقدر دریافتی داشتم؟» یا «مجموع واریزی‌های سامان چقدره؟»",
    aiPlaceholder: "سوال مالی خود را بپرسید... (مثلاً: چقدر سود کریپتو از ولت پرو داشتم؟)",
    aiSendButton: "ارسال به حسابدار هوشمند",
    aiQuickQuestionTitle: "سوالات آماده و پیشنهادی:",
    aiQuickQ1: "مجموع کل دریافتی‌های من از علی چقدر است؟",
    aiQuickQ2: "توزیع منابع نقدی من در کدام بانک‌ها بیشتر است؟",
    aiQuickQ3: "کدام ارز دیجیتال بیشترین حجم دریافت را داشته است؟",
    aiQuickQ4: "یک گزارش خلاصه از کلیه واریزی‌های ریالی و رمزارزی به من بده.",
    aiLoading: "در حال بررسی تراکنش‌ها و محاسبه پاسخ توسط هوش مصنوعی...",

    // Onboarding Spec
    authGateTitle: "سیستم مدیریت و حسابداری تریدرز هاب پرو",
    authGateDesc: "جهت حفظ امنیت فیش‌ها و جلوگیری از تداخل حساب‌ها، لطفا وارد حساب شخصی خود شوید یا برای خود پروفایل محلی تعیین کنید.",
    emailLabel: "آدرس ایمیل",
    passwordLabel: "رمز عبور (حداقل ۶ کاراکتر)",
    displayNameLabel: "نام و نام خانوادگی",
    signUpTab: "ثبت‌نام کاربر جدید",
    signInTab: "ورود به حساب کاربری",
    guestTab: "ورود مستقیم بدون ثبت‌نام (مهمان)",
    guestAction: "ایجاد پروفایل محلی مهمان",
    orText: "یا",
    signUpAction: "ایجاد حساب کاربری ایمیلی",
    signInAction: "ورود به حساب ایمیلی",
    googleSyncAccess: "ورود مستقیم امن با گوگل (Sheets Sync)",
    errorRequiredFields: "لطفا فیلدهای اجباری را با مقادیر معتبر تکمیل نمایید.",
    errorInvalidAmount: "مبلغ یا مقدار معتبر نمی‌باشد.",
    profileNameText: "حساب کاربری فعال:",
    accTypeGuest: "مهمان (آفلاین)",
    accTypeEmail: "ایمیل ایمن",
    accTypeGoogle: "گوگل شیت سینک"
  },
  en: {
    appTitle: "Traders Hub Ledger Pro",
    rialLedger: "Rial Receipts",
    cryptoLedger: "Crypto Receipts",
    analytics: "Unified Calculations",
    aiAccountant: "AI Financial Accountant",
    logoutConfirm: "Are you sure you want to log out? Cloud Sync will stop.",
    googleSheetsSettings: "Google Sheets Connection Settings",
    sheetsUrlInput: "Full Google Sheets URL or Spreadsheet ID:",
    activeSheet: "Currently Active Sheet:",
    connectSheet: "Connect Selected Spreadsheet",
    syncSuccess: "Synced with Google Sheets successfully!",
    syncError: "Failed to sync with Google Sheets:",
    
    // Rial Ledger Spec
    rialSummary: "Total Rial Transactions",
    searchRialPlaceholder: "Search Rial receipts (Sender name, bank, amount, description...)",
    newRialButton: "Record New Rial Receipt (Bank Subsidiary Ledger)",
    rialFormTitleAdd: "Record New Rial Deposit Receipt",
    rialFormTitleEdit: "Edit Rial Transaction",
    date: "Transaction Date",
    sender: "Received From (Sender Name)",
    amount: "Deposit Amount (Rials / Tomans)",
    bankName: "Destination Bank Name",
    description: "Transaction Description",
    cancel: "Cancel",
    saveRial: "Save and Confirm Rial Receipt",
    rialTableId: "Row ID",
    rialTableDate: "Deposit Date",
    rialTableSender: "Received From Participant",
    rialTableAmount: "Amount (Toman)",
    rialTableBank: "Destination Bank",
    rialTableNotes: "Transaction Notes/Purpose",
    rialTableActions: "Actions",
    noRialEntries: "No Rial receipts registered in the ledger yet. Click the button above to add.",
    transactionTypeLabel: "Transaction Type (In/Out)",
    typeIncoming: "Incoming / Deposit 📥",
    typeOutgoing: "Outgoing / Sent 📤",
    rialSenderOrRecipient: "Sender / Recipient",
    proportionLabel: "Share %",
    
    // Crypto Ledger Spec
    cryptoSummary: "Total Crypto Transactions",
    searchCryptoPlaceholder: "Search crypto receipts (Symbol, network, TX Hash, purpose...)",
    newCryptoButton: "Record New Crypto Deposit (Digital Wallet Database)",
    cryptoFormTitleAdd: "Record New Crypto Transaction",
    cryptoFormTitleEdit: "Edit Crypto Transaction",
    coinName: "Coin Symbol (Name)",
    network: "Transfer Network",
    txHash: "Transaction Hash / TX ID",
    saveCrypto: "Save Crypto Address Ledger",
    cryptoTableId: "Row ID",
    cryptoTableDate: "Wallet Deposit Date",
    cryptoTableCoin: "Coin Symbol",
    cryptoTableNetwork: "Wallet Network",
    cryptoTableTxHash: "Client Transaction TXID",
    cryptoTableNotes: "Description / Purpose",
    cryptoTableAmount: "Quantity / Amount",
    cryptoTableActions: "Actions",
    noCryptoEntries: "No crypto deposits registered in the ledger yet. Click the button above to add.",
    coinPriceLabel: "Unit Price (USD)",
    equivalentUsdLabel: "Equivalent USD Value",
    walletAddressLabel: "Destination Wallet Address",

    // Analytics Spec
    analyticsTitle: "Traders Hub Unified Financial Analytics",
    analyticsSubtitle: "This system aggregates deposits based on incoming senders, destination banks, and isolated crypto blockchain balances automatically.",
    noAnalyticsData: "No data available.",
    rialsBySender: "Total Receipts Distributed By Sender (Rials by Sender)",
    rialsByBank: "Distribution of Funds Across Target Banks (Rials by Bank)",
    cryptoTotalsTitle: "Crypto Balance Distribution By Asset & Blockchain Network",
    cryptoTotalsSubtitle: "Total Received Crypto Balance",
    cryptoTotalsCount: "Total Tx Count",
    cryptoNetworkDeposits: "Received on Blockchain Network:",
    timesDeposited: "deposits",
    tomanUnit: "Toman",
    transactionUnit: "tx",

    // Exports
    exportExcel: "Export as Excel (.xlsx)",
    exportPdf: "Download PDF Certificate",
    exportCsv: "Export Raw CSV Profile",
    printList: "Print Invoice Catalog",

    // AI Accountant Spec
    aiTitle: "Traders Hub AI Accountant",
    aiDescription: "Directly analyze your live Rial and Crypto transactions with our AI. For example, ask: 'How much did I receive from Maryam?' or 'Calculate total deposits in Bank Saman.'",
    aiPlaceholder: "Ask anything about your ledger... (e.g. summarized crypto volume)",
    aiSendButton: "Query AI Financial Assistant",
    aiQuickQuestionTitle: "Frequently Asked Financial Questions:",
    aiQuickQ1: "What is my absolute total received balance from Amir?",
    aiQuickQ2: "In which destination bank is most of my liquid cash distributed?",
    aiQuickQ3: "Which virtual crypto token has the highest received volume?",
    aiQuickQ4: "Provide a comprehensive audit report of all Rial and Crypto deposits.",
    aiLoading: "Analyzing transaction logs and querying model accountant...",

    // Onboarding Spec
    authGateTitle: "Traders Hub Pro Accounting Ledger",
    authGateDesc: "To protect your fiscal privacy and keep records isolated, please log in with your account or establish a secure local ledger profile.",
    emailLabel: "Email Address",
    passwordLabel: "Password (Min 6 Characters)",
    displayNameLabel: "Full Name",
    signUpTab: "Create New Account",
    signInTab: "Login to Existing Account",
    guestTab: "Access via Guest Profile (Offline)",
    guestAction: "Establish Offline Guest Profile",
    orText: "OR",
    signUpAction: "Sign Up Securely",
    signInAction: "Sign In Securely",
    googleSyncAccess: "Secure Access with Google OAuth (Sheets Sync)",
    errorRequiredFields: "Please fill out all required fields with valid inputs.",
    errorInvalidAmount: "Provided amount or quantity is invalid.",
    profileNameText: "Signed In Account:",
    accTypeGuest: "Guest User (Offline)",
    accTypeEmail: "Email Authorized",
    accTypeGoogle: "Google Sheet Synced"
  }
};
