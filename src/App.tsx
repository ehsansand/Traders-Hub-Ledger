import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import * as XLSX from 'xlsx';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import {
  TrendingUp,
  Coins,
  DollarSign,
  Globe,
  RefreshCw,
  FileSpreadsheet,
  Download,
  Printer,
  Plus,
  Trash2,
  Edit2,
  Search,
  Database,
  LogOut,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  ChevronLeft,
  Settings,
  X,
  PlusCircle,
  PiggyBank,
  BrainCircuit,
  Lock,
  MessageSquare,
  User,
  Users,
  Key,
  ChevronRight,
  Sparkles,
  SlidersHorizontal,
  Cloud
} from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';

import { RialEntry, CryptoEntry, SheetsSyncState } from './types';
import {
  findBackupFile,
  uploadBackupFile,
  downloadBackupFile,
  LedgerBackupData
} from './lib/driveService';
import {
  initAuth,
  googleSignIn,
  logout,
  emailSignIn,
  emailSignUp,
  auth,
  db
} from './lib/firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocFromServer
} from 'firebase/firestore';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
import {
  createLedgerSpreadsheet,
  syncLedgerData,
  extractSpreadsheetId
} from './lib/sheetsService';
import {
  formatToman,
  formatPersianNumber,
  INITIAL_RIAL_ENTRIES,
  INITIAL_CRYPTO_ENTRIES,
  toJalali,
  gregorianToJalali,
  jalaliToGregorian
} from './utils';
import { exportToExcel, exportLegacyPDF, exportToPDF, exportToCSV } from './exportUtils';
import { translations } from './translations';

export default function App() {
  // Lang Toggle 'fa' | 'en'
  const [lang, setLang] = useState<'fa' | 'en'>(() => {
    const saved = localStorage.getItem('th_language');
    return (saved === 'en' ? 'en' : 'fa');
  });

  useEffect(() => {
    localStorage.setItem('th_language', lang);
  }, [lang]);

  const t = translations[lang];

  // Auth & Session States
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Custom Guest local session for privacy screen protection
  const [guestName, setGuestName] = useState<string | null>(() => {
    return localStorage.getItem('th_guest_profile_name');
  });

  // Determines if the entire database is locked under gate screen
  const isLocked = !currentUser && !guestName;

  // Iframe Safety and Auto-Device Detection for professional web application deployment
  const [isMobileDevice, setIsMobileDevice] = useState<boolean>(false);
  const [isInIframe, setIsInIframe] = useState<boolean>(false);

  useEffect(() => {
    setIsInIframe(window.self !== window.top);

    const handleResizeOrUA = () => {
      const mobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const smallScreen = window.innerWidth < 1024;
      setIsMobileDevice(mobileUA || smallScreen);
    };

    handleResizeOrUA();
    window.addEventListener('resize', handleResizeOrUA);
    return () => window.removeEventListener('resize', handleResizeOrUA);
  }, []);

  // Onboarding Login Credentials Local State
  const [authMode, setAuthMode] = useState<'signin' | 'signup' | 'guest'>('signin');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [displayNameInput, setDisplayNameInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [showSetupGuide, setShowSetupGuide] = useState(false);

  // Custom secure & iframe-safe confirmation overlay state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    cancelText?: string;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const askConfirm = (
    title: string,
    message: string,
    onConfirm: () => void,
    confirmText?: string,
    cancelText?: string
  ) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        setTimeout(() => {
          onConfirm();
        }, 50);
      },
      confirmText,
      cancelText,
    });
  };

  // User-isolated records storage keys
  const userUniqueKey = currentUser ? currentUser.uid : (guestName ? `guest_${guestName}` : 'anonymous');
  const rialsKey = `th_rial_entries_${userUniqueKey}`;
  const cryptoKey = `th_crypto_entries_${userUniqueKey}`;

  // Ledgers states (Persisted and Isolated based on logged-in User Instance)
  const [rialEntries, setRialEntries] = useState<RialEntry[]>([]);
  const [cryptoEntries, setCryptoEntries] = useState<CryptoEntry[]>([]);
  const [rialLoaded, setRialLoaded] = useState(false);
  const [cryptoLoaded, setCryptoLoaded] = useState(false);

  // Investment Tips List & State
  const INVESTMENT_TIPS_FA = useMemo(() => [
    "💡 پیشنهاد کارنابلدان بازار: با ایجاد میانگین قیمت خرید پله‌ای (DCA) روی بیت‌کوین در محدوده حمایتی ۶۲,۰۰۰ دلار، ریسک سبد ارزی خود را کاهش دهید.",
    "📈 استراتژی فیوچرز: همواره حداکثر ۵ الی ۱۰ درصد از کل سرمایه نقدی خود را در پوزیشن‌های اهرم‌دار قرار دهید تا امنیت حساب حفظ شود.",
    "🔐 ولت امنیتی: برای جابجایی تتر ترجیحاً از شبکه‌های ترون (TRC-20) یا تون (TON) استفاده کنید تا کارمزد گس کسر شده به حداقل ممکن برسد.",
    "⚖️ صندوق نقدینگی: پیشنهاد می‌شود حداقل ۲۰ درصد از کل وزن سبد را به صورت استیبل‌کوین نقد نگه دارید تا در ریزش‌های بازار توان شکار داشته باشید.",
    "📊 سبد متعادل: تنوع‌بخشی یعنی داشتن ۴۰٪ بیت‌کوین، ۳۰٪ اتریوم، ۲۰٪ ارزهای با ارزش بازار بالا و ۱۰٪ نقدینگی ریال.",
    "⏳ روانشناسی معامله: از ورود با احساس گوسفندی یا طمع عقب ماندن (FOMO) خودداری کنید. نقد بودن در بازارهای متلاطم خود یک برنده بودن است."
  ], []);

  const INVESTMENT_TIPS_EN = useMemo(() => [
    "💡 Long-term DCA: Build standard Bitcoin cost average (DCA) around $62,000 to manage portfolio volatility safely.",
    "📈 Futures Leverage: Never allocate more than 5-10% of total liquid assets into high-leverage futures positions.",
    "🔐 Optimization: Transact stablecoins using TRC-20 or TON chains to minimize gas expenditure compared to high Ethereum ERC-20 gas.",
    "⚖️ Reserve Asset: Keep at least 20% in secure liquid stablecoins (USDT) to pick up prime assets during market panics.",
    "📊 Portfolio Weights: Maintain a healthy asset weight: 40% BTC, 30% ETH, 20% major layer-1 tokens, and 10% standard cash.",
    "⏳ Trading Psychology: Never let FOMO direct your entry. Staying purely in cash during extreme volatility is a professional trade."
  ], []);

  const [currentTipIndex, setCurrentTipIndex] = useState(() => {
    return Math.floor(Math.random() * 6);
  });

  // Automatically cycle tips every 15 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTipIndex((prev) => (prev + 1) % 6);
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  // AI Excel/Bulk Import Modal States
  const [showAiBulkModal, setShowAiBulkModal] = useState(false);
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const [isParsingText, setIsParsingText] = useState(false);
  const [parsedRialResults, setParsedRialResults] = useState<RialEntry[]>([]);
  const [parsedCryptoResults, setParsedCryptoResults] = useState<CryptoEntry[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  // Spotlight index for random top deposit AI highlight
  const [spotlightIndex, setSpotlightIndex] = useState<number>(0);

  // States for live interactive P2P Arbitrage Yield & USD/Tether Converter Tool
  const [arbitrageUsdtPrice, setArbitrageUsdtPrice] = useState('64500');
  const [arbitrageVolume, setArbitrageVolume] = useState('1000');
  const [arbitrageGasFee, setArbitrageGasFee] = useState('1'); // network gas in USDT
  const [arbitrageProfitPercent, setArbitrageProfitPercent] = useState('1.5'); // target premium profit





  // Validate Connection to Firestore on Mount
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    }
    testConnection();
  }, []);

  // Load database and subscribe to Firestore changes or Guest local storage
  useEffect(() => {
    setRialLoaded(false);
    setCryptoLoaded(false);

    if (isLocked) {
      setRialEntries([]);
      setCryptoEntries([]);
      return;
    }

    if (!currentUser) {
      // Guest User Session - Load from local storage
      const savedRials = localStorage.getItem(rialsKey);
      const savedCrypto = localStorage.getItem(cryptoKey);
      setRialEntries(savedRials ? JSON.parse(savedRials) : []);
      setCryptoEntries(savedCrypto ? JSON.parse(savedCrypto) : []);
      setRialLoaded(true);
      setCryptoLoaded(true);
      return;
    }

    // Authenticated User Session - Real-time sync with cloud Firestore
    const rialCollectionRef = collection(db, 'users', currentUser.uid, 'rialEntries');
    const unsubscribeRial = onSnapshot(rialCollectionRef, async (snapshot) => {
      const entries: RialEntry[] = [];
      snapshot.forEach((docSnap) => {
        entries.push(docSnap.data() as RialEntry);
      });
      // Maintain chronological order based on creation time
      entries.sort((a, b) => b.createdAt - a.createdAt);

      // Handle Data Migration: Laptop localStorage -> Cloud Firestore
      const backupGuestName = localStorage.getItem('th_guest_profile_name');
      const savedRials = localStorage.getItem(rialsKey) ||
                         (backupGuestName ? localStorage.getItem(`th_rial_entries_guest_${backupGuestName}`) : null) ||
                         localStorage.getItem('th_rial_entries_anonymous');
      const rialMigrationDoneKey = `th_rial_migrated_${currentUser.uid}`;
      const isRialMigrated = localStorage.getItem(rialMigrationDoneKey) === 'true';

      if (entries.length > 0 && !isRialMigrated) {
        localStorage.setItem(rialMigrationDoneKey, 'true');
      }

      if (entries.length === 0 && savedRials && !isRialMigrated) {
        try {
          const localRials: RialEntry[] = JSON.parse(savedRials);
          if (localRials.length > 0) {
            console.log("Migrating local Rial entries to cloud Firestore database...");
            for (const entry of localRials) {
              const entryDocRef = doc(db, 'users', currentUser.uid, 'rialEntries', entry.id);
              await setDoc(entryDocRef, entry);
            }
            localStorage.setItem(rialMigrationDoneKey, 'true');
            if (backupGuestName) {
              localStorage.removeItem(`th_rial_entries_guest_${backupGuestName}`);
            }
            localStorage.removeItem('th_rial_entries_anonymous');
            return;
          }
        } catch (e) {
          console.error("Migration error:", e);
        }
      }

      setRialEntries(entries);
      setRialLoaded(true);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${currentUser.uid}/rialEntries`);
    });

    const cryptoCollectionRef = collection(db, 'users', currentUser.uid, 'cryptoEntries');
    const unsubscribeCrypto = onSnapshot(cryptoCollectionRef, async (snapshot) => {
      const entries: CryptoEntry[] = [];
      snapshot.forEach((docSnap) => {
        entries.push(docSnap.data() as CryptoEntry);
      });
      entries.sort((a, b) => b.createdAt - a.createdAt);

      // Handle Data Migration: Laptop localStorage -> Cloud Firestore (Crypto)
      const backupGuestName = localStorage.getItem('th_guest_profile_name');
      const savedCrypto = localStorage.getItem(cryptoKey) ||
                          (backupGuestName ? localStorage.getItem(`th_crypto_entries_guest_${backupGuestName}`) : null) ||
                          localStorage.getItem('th_crypto_entries_anonymous');
      const cryptoMigrationDoneKey = `th_crypto_migrated_${currentUser.uid}`;
      const isCryptoMigrated = localStorage.getItem(cryptoMigrationDoneKey) === 'true';

      if (entries.length > 0 && !isCryptoMigrated) {
        localStorage.setItem(cryptoMigrationDoneKey, 'true');
      }

      if (entries.length === 0 && savedCrypto && !isCryptoMigrated) {
        try {
          const localCrypto: CryptoEntry[] = JSON.parse(savedCrypto);
          if (localCrypto.length > 0) {
            console.log("Migrating local Crypto entries to cloud Firestore database...");
            for (const entry of localCrypto) {
              const entryDocRef = doc(db, 'users', currentUser.uid, 'cryptoEntries', entry.id);
              await setDoc(entryDocRef, entry);
            }
            localStorage.setItem(cryptoMigrationDoneKey, 'true');
            if (backupGuestName) {
              localStorage.removeItem(`th_crypto_entries_guest_${backupGuestName}`);
            }
            localStorage.removeItem('th_crypto_entries_anonymous');
            return;
          }
        } catch (e) {
          console.error("Migration error:", e);
        }
      }

      setCryptoEntries(entries);
      setCryptoLoaded(true);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${currentUser.uid}/cryptoEntries`);
    });

    // Sync Sheets Settings configuration in real-time
    const userDocRef = doc(db, 'users', currentUser.uid);
    const unsubscribeUser = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.syncState) {
          setSyncState((prev) => {
            if (
              prev.spreadsheetId !== data.syncState.spreadsheetId ||
              prev.lastSyncedAt !== data.syncState.lastSyncedAt
            ) {
              return data.syncState;
            }
            return prev;
          });
        }
      } else {
        const savedSyncState = localStorage.getItem('th_sheets_sync_state');
        if (savedSyncState) {
          try {
            const sym = JSON.parse(savedSyncState);
            if (sym.spreadsheetId) {
              setDoc(userDocRef, { syncState: sym }, { merge: true });
            }
          } catch (e) {
            console.error(e);
          }
        }
      }
    }, (error) => {
      console.warn("User config listener failed:", error);
    });

    return () => {
      unsubscribeRial();
      unsubscribeCrypto();
      unsubscribeUser();
    };
  }, [currentUser, isLocked, userUniqueKey, rialsKey, cryptoKey]);

  // Persist State locally (caches/offline fallback for guests)
  useEffect(() => {
    if (!isLocked && rialLoaded) {
      localStorage.setItem(rialsKey, JSON.stringify(rialEntries));
    }
  }, [rialEntries, userUniqueKey, isLocked, rialLoaded]);

  useEffect(() => {
    if (!isLocked && cryptoLoaded) {
      localStorage.setItem(cryptoKey, JSON.stringify(cryptoEntries));
    }
  }, [cryptoEntries, userUniqueKey, isLocked, cryptoLoaded]);

  // Sheets Sync State local & cloud persistence
  const [syncState, setSyncState] = useState<SheetsSyncState>(() => {
    const saved = localStorage.getItem('th_sheets_sync_state');
    return saved
      ? JSON.parse(saved)
      : {
          spreadsheetId: null,
          spreadsheetUrl: null,
          lastSyncedAt: null,
          syncing: false,
          error: null,
        };
  });

  useEffect(() => {
    localStorage.setItem('th_sheets_sync_state', JSON.stringify(syncState));
    if (currentUser) {
      const userRef = doc(db, 'users', currentUser.uid);
      setDoc(userRef, { syncState }, { merge: true }).catch((err) => {
        console.error('Failed to sync settings with Firestore database: ', err);
      });
    }
  }, [syncState, currentUser]);

  // Google Drive Cloud Backup / Synchronisation System States & Operations
  const [isDriveSyncing, setIsDriveSyncing] = useState(false);
  const [driveBackupInfo, setDriveBackupInfo] = useState<{ id: string; modifiedTime: string; size?: string } | null>(null);
  const [driveSyncStatus, setDriveSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [driveSyncMessage, setDriveSyncMessage] = useState<string | null>(null);

  // Check if a backup exists in Google Drive
  const handleCheckDriveBackup = async (silent: boolean = false) => {
    if (!accessToken) return;
    if (!silent) {
      setIsDriveSyncing(true);
      setDriveSyncStatus('idle');
      setDriveSyncMessage(null);
    }
    try {
      const fileInfo = await findBackupFile(accessToken);
      setDriveBackupInfo(fileInfo);
      if (!silent) {
        setDriveSyncStatus('success');
        if (fileInfo) {
          const formattedDate = new Date(fileInfo.modifiedTime).toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-US');
          setDriveSyncMessage(lang === 'fa' 
            ? `یک نسخه پشتیبان ابری یافت شد! تاریخ آخرین تغییر: ${formattedDate}` 
            : `Backup cloud file found! Last modified: ${formattedDate}`);
        } else {
          setDriveSyncMessage(lang === 'fa' 
            ? 'هیچ فایل پشتیبانی در حساب کاربری گوگل درایو شما پیدا نشد.' 
            : 'No existing backup file discovered on your Google Drive.');
        }
      }
    } catch (err: any) {
      console.error(err);
      if (!silent) {
        setDriveSyncStatus('error');
        setDriveSyncMessage(lang === 'fa' 
          ? `خطا در اسکن گوگل درایو: ${err.message || err}` 
          : `Google Drive discovery failed: ${err.message || err}`);
      }
    } finally {
      if (!silent) setIsDriveSyncing(false);
    }
  };

  // Upload/Save current ledger & settings to Google Drive
  const handleBackupToDrive = async () => {
    if (!accessToken) {
      alert(lang === 'fa' ? 'لطفاً ابتدا با حساب گوگل خود وارد شوید.' : 'Please sign in with Google first.');
      return;
    }
    setIsDriveSyncing(true);
    setDriveSyncStatus('idle');
    setDriveSyncMessage(null);

    const backupData: LedgerBackupData = {
      backupVersion: '1.0.0',
      timestamp: Date.now(),
      rialEntries: rialEntries,
      cryptoEntries: cryptoEntries,
      settings: {
        lang,
        rialCalendarMode,
        cryptoCalendarMode,
        arbitrageGasFee,
        arbitrageProfitPercent,
        spreadsheetId: syncState.spreadsheetId
      }
    };

    try {
      await uploadBackupFile(accessToken, backupData);
      setDriveSyncStatus('success');
      setDriveSyncMessage(lang === 'fa' 
        ? 'بایگانی با موفقیت روی گوگل درایو ذخیره شد! ☁️🔒' 
        : 'Ledger successfully backed up to your Google Drive! ☁️🔒');
      await handleCheckDriveBackup(true); // update backup info quietly
    } catch (err: any) {
      console.error(err);
      setDriveSyncStatus('error');
      setDriveSyncMessage(lang === 'fa' 
        ? `خطا در بارگذاری روی کلاود: ${err.message || err}` 
        : `Failed to upload cloud backup: ${err.message || err}`);
    } finally {
      setIsDriveSyncing(false);
    }
  };

  // Download and Restore/Merge ledger from Google Drive
  const handleRestoreFromDrive = async () => {
    if (!accessToken) {
      alert(lang === 'fa' ? 'لطفاً ابتدا با حساب گوگل خود وارد شوید.' : 'Please sign in with Google first.');
      return;
    }
    
    setIsDriveSyncing(true);
    setDriveSyncStatus('idle');
    setDriveSyncMessage(null);

    try {
      const fileInfo = await findBackupFile(accessToken);
      if (!fileInfo) {
        setDriveSyncStatus('error');
        setDriveSyncMessage(lang === 'fa' 
          ? 'امکان بازیابی وجود ندارد؛ هیچ فایلی یافت نشد.' 
          : 'Nothing to restore; no file was found.');
        setIsDriveSyncing(false);
        return;
      }

      const backup = await downloadBackupFile(accessToken, fileInfo.id);
      
      const confirmMsg = lang === 'fa'
        ? `آیا از بازیابی اطلاعات کلاود اطمینان دارید؟\nاین عملیات داده‌های فعلی شما را با داده‌های پشتیبان کلاود (${backup.rialEntries.length} تراکنش ریالی و ${backup.cryptoEntries.length} کریپتو) ادغام یا جایگزین خواهد کرد.`
        : `Are you sure you want to download and restore your cloud database?\nThis will merge/overwrite your current data with the cloud backup (${backup.rialEntries.length} Rial, ${backup.cryptoEntries.length} Crypto).`;

      if (!window.confirm(confirmMsg)) {
        setIsDriveSyncing(false);
        return;
      }

      // Merge strategy: Merge by IDs to prevent duplicates
      setRialEntries((currentRials) => {
        const mergedMap = new Map<string, RialEntry>();
        currentRials.forEach(r => mergedMap.set(r.id, r));
        backup.rialEntries.forEach(r => mergedMap.set(r.id, r));
        const finalRials = Array.from(mergedMap.values());
        
        if (currentUser) {
          finalRials.forEach((entry) => {
            setDoc(doc(db, 'users', currentUser.uid, 'rialEntries', entry.id), entry).catch(e => console.error(e));
          });
        }
        return finalRials;
      });

      setCryptoEntries((currentCryptos) => {
        const mergedMap = new Map<string, CryptoEntry>();
        currentCryptos.forEach(c => mergedMap.set(c.id, c));
        backup.cryptoEntries.forEach(c => mergedMap.set(c.id, c));
        const finalCryptos = Array.from(mergedMap.values());

        if (currentUser) {
          finalCryptos.forEach((entry) => {
            setDoc(doc(db, 'users', currentUser.uid, 'cryptoEntries', entry.id), entry).catch(e => console.error(e));
          });
        }
        return finalCryptos;
      });

      // Restore settings if present
      if (backup.settings) {
        if (backup.settings.lang) setLang(backup.settings.lang);
        if (backup.settings.rialCalendarMode) setRialCalendarMode(backup.settings.rialCalendarMode);
        if (backup.settings.cryptoCalendarMode) setCryptoCalendarMode(backup.settings.cryptoCalendarMode);
        if (backup.settings.arbitrageGasFee) setArbitrageGasFee(backup.settings.arbitrageGasFee);
        if (backup.settings.arbitrageProfitPercent) setArbitrageProfitPercent(backup.settings.arbitrageProfitPercent);
        if (backup.settings.spreadsheetId) {
          setSyncState(prev => ({
            ...prev,
            spreadsheetId: backup.settings.spreadsheetId || null
          }));
        }
      }

      setDriveSyncStatus('success');
      setDriveSyncMessage(lang === 'fa'
        ? 'اطلاعات با موفقیت همگام‌سازی و بازیابی شد!'
        : 'All cloud backups successfully merged and synchronised!');

    } catch (err: any) {
      console.error(err);
      setDriveSyncStatus('error');
      setDriveSyncMessage(lang === 'fa'
        ? `خطا در بازیابی کلاود: ${err.message || err}`
        : `Cloud recovery failed: ${err.message || err}`);
    } finally {
      setIsDriveSyncing(false);
    }
  };

  // Automatically check Google Drive backup when access token becomes available
  useEffect(() => {
    if (accessToken) {
      handleCheckDriveBackup(true);
    } else {
      setDriveBackupInfo(null);
    }
  }, [accessToken]);

  // Automatic Background Sync Effect
  // Debounce background synced updates by 1.5 seconds on array updates to satisfy Google Sheets API limits.
  useEffect(() => {
    if (!accessToken || !syncState.spreadsheetId || isLocked) {
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setSyncState((prev) => ({ ...prev, syncing: true }));
        await syncLedgerData(accessToken, syncState.spreadsheetId!, rialEntries, cryptoEntries);
        setSyncState((prev) => ({
          ...prev,
          lastSyncedAt: new Date().toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-US'),
          syncing: false,
          error: null,
        }));
      } catch (err: any) {
        console.error('Background auto-sync update failed: ', err);
        setSyncState((prev) => ({
          ...prev,
          syncing: false,
          error: err.message || 'Auto-sync background stream error',
        }));
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [rialEntries, cryptoEntries, accessToken, syncState.spreadsheetId, isLocked, lang]);

  // Monitor Google & Firebase Auth State
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setCurrentUser(user);
        if (token) setAccessToken(token);
        setAuthLoading(false);
      },
      () => {
        setCurrentUser(null);
        setAccessToken(null);
        setAuthLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // Transliterates and maps Firebase Authentication errors into friendly localized human-readable warnings.
  const translateAuthError = (err: any, currentLang: 'fa' | 'en'): string => {
    if (!err) return '';
    const message = err.message || '';
    const code = err.code || '';
    
    if (code === 'auth/invalid-credential' || message.includes('auth/invalid-credential')) {
      return currentLang === 'fa'
        ? '⚠️ ایمیل یا رمز عبور اشتباه است! لطفاً مجدداً بررسی کنید. (اگر قبلاً حساب نساخته‌اید، از زبانه فوق بر روی «ثبت نام» کلیک فرمایید)'
        : '⚠️ Invalid email or password. Please check. (If you do not have an account, click the "Sign Up" tab at the top of the form).';
    }
    if (code === 'auth/user-not-found' || message.includes('auth/user-not-found')) {
      return currentLang === 'fa'
        ? '⚠️ هیچ حسابی با این ایمیل یافت نشد. می‌توانید با کلیک بر زبانه «ثبت نام» در بالای همین بخش، حساب جدید ایجاد کنید.'
        : '⚠️ No account found with this email. Switch to the "Sign Up" tab to register.';
    }
    if (code === 'auth/wrong-password' || message.includes('auth/wrong-password')) {
      return currentLang === 'fa'
        ? '⚠️ رمز عبور اشتباه است. لطفاً مجدداً تلاش نمایید.'
        : '⚠️ Incorrect password. Please try again.';
    }
    if (code === 'auth/email-already-in-use' || message.includes('auth/email-already-in-use')) {
      return currentLang === 'fa'
        ? '⚠️ این ایمیل قبلاً ثبت‌نام شده است. لطفاً از زبانه «ورود» وارد حساب خود شوید.'
        : '⚠️ This email is already registered. Please go to the "Sign In" tab.';
    }
    if (code === 'auth/weak-password' || message.includes('auth/weak-password')) {
      return currentLang === 'fa'
        ? '⚠️ رمز عبور بسیار ضعیف است. رمز عبور باید حداقل ۶ کاراکتر یا بیشتر باشد.'
        : '⚠️ Password is too weak. It must be at least 6 characters.';
    }
    if (code === 'auth/invalid-email' || message.includes('auth/invalid-email')) {
      return currentLang === 'fa'
        ? '⚠️ فرمت و ساختار ایمیل وارد شده معتبر نیست.'
        : '⚠️ The email address format is invalid.';
    }
    if (code === 'auth/operation-not-allowed' || message.includes('auth/operation-not-allowed')) {
      return currentLang === 'fa'
        ? '⚠️ خطا: امکان ورود/ثبت‌نام با ایمیل و رمز عبور فعال نیست. لطفاً راهنمای خطای فایربیس در پایین صفحه را بررسی فرمایید.'
        : '⚠️ Error: Email/Password authentication is disabled in Firebase console. Please read the troubleshooting guide below.';
    }
    if (code === 'auth/network-request-failed' || message.includes('auth/network-request-failed')) {
      return currentLang === 'fa'
        ? '⚠️ خطای شبکه. لطفاً صحت اتصال مجرای اینترنت یا ابزار ضدتحریم خود را بررسی کنید.'
        : '⚠️ Network connection failure. Please verify your internet or VPN link.';
    }

    return currentLang === 'fa'
      ? `⚠️ خطا در احراز هویت: ${message || 'ناموفق بود. مجدداً تلاش کنید.'}`
      : `⚠️ Session Login Error: ${message || 'Authentication failed. Please try again.'}`;
  };

  // Handle Google Login Flow
  const handleGoogleLogin = async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setCurrentUser(result.user);
        setAccessToken(result.accessToken);
        setGuestName(null);
      }
    } catch (err: any) {
      console.error('Google Auth error:', err);
      setAuthError(err.message || 'Error authenticating with Google account.');
    } finally {
      setAuthLoading(false);
    }
  };

  // Handle Email & Password Register / Signup
  const handleEmailSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput || !passwordInput || !displayNameInput) {
      setAuthError(t.errorRequiredFields);
      return;
    }
    setAuthLoading(true);
    setAuthError(null);
    try {
      const user = await emailSignUp(emailInput, passwordInput, displayNameInput);
      setCurrentUser(user);
      setGuestName(null);
      // Reset inputs
      setEmailInput('');
      setPasswordInput('');
      setDisplayNameInput('');
    } catch (err: any) {
      console.error(err);
      setAuthError(translateAuthError(err, lang));
    } finally {
      setAuthLoading(false);
    }
  };

  // Handle Email & Password Login / Signin
  const handleEmailSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput || !passwordInput) {
      setAuthError(t.errorRequiredFields);
      return;
    }
    setAuthLoading(true);
    setAuthError(null);
    try {
      const user = await emailSignIn(emailInput, passwordInput);
      setCurrentUser(user);
      setGuestName(null);
      // Reset inputs
      setEmailInput('');
      setPasswordInput('');
    } catch (err: any) {
      console.error(err);
      setAuthError(translateAuthError(err, lang));
    } finally {
      setAuthLoading(false);
    }
  };

  // Handle Guest Mode Setup
  const handleGuestOnboardingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayNameInput.trim()) {
      setAuthError(t.errorRequiredFields);
      return;
    }
    setGuestName(displayNameInput.trim());
    localStorage.setItem('th_guest_profile_name', displayNameInput.trim());
    setCurrentUser(null);
    setAccessToken(null);
    setDisplayNameInput('');
    setAuthError(null);
  };

  const handleLogout = async () => {
    askConfirm(
      lang === 'fa' ? 'خروج از حساب کاربری' : 'Logout Confirmation',
      t.logoutConfirm,
      async () => {
        await logout();
        setCurrentUser(null);
        setAccessToken(null);
        setGuestName(null);
        localStorage.removeItem('th_guest_profile_name');
      },
      lang === 'fa' ? 'بله، خروج' : 'Yes, Logout',
      lang === 'fa' ? 'لغو' : 'Cancel'
    );
  };

  // Create Google Spreadsheet Automatically
  const handleCreateNewSpreadsheet = async () => {
    if (!accessToken) {
      alert(lang === 'fa' ? 'لطفا ابتدا با اکانت گوگل وارد شوید.' : 'Please sign in with Google first.');
      return;
    }

    setSyncState((prev) => ({ ...prev, syncing: true, error: null }));
    try {
      const { id, url } = await createLedgerSpreadsheet(accessToken);
      // Immediately run an initial synchronization so the spreadsheet is filled with current data
      await syncLedgerData(accessToken, id, rialEntries, cryptoEntries);

      setSyncState((prev) => ({
        ...prev,
        spreadsheetId: id,
        spreadsheetUrl: url,
        lastSyncedAt: new Date().toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-US'),
        syncing: false,
        error: null,
      }));
      alert(lang === 'fa' ? 'گوگل شیت پرو Traders Hub با موفقیت ساخته شد و تمام اطلاعات همگام‌سازی گردید!' : 'Traders Hub Pro Spreadsheet created and synchronized successfully!');
    } catch (err: any) {
      console.error(err);
      setSyncState((prev) => ({
        ...prev,
        syncing: false,
        error: err.message || 'Error processing sheets creation request',
      }));
    }
  };

  // Link manual existing Spreadsheet ID / URL
  const [manualSpreadsheetInput, setManualSpreadsheetInput] = useState('');
  const [showConfigModal, setShowConfigModal] = useState(false);

  const handleLinkSpreadsheet = async () => {
    const id = extractSpreadsheetId(manualSpreadsheetInput);
    if (!id) {
      alert(lang === 'fa' ? 'شناسه گوگل شیت معتبر نیست.' : 'Invalid Google Sheet URL/ID.');
      return;
    }
    const url = manualSpreadsheetInput.includes('docs.google.com')
      ? manualSpreadsheetInput.trim()
      : `https://docs.google.com/spreadsheets/d/${id}/edit`;

    setSyncState((prev) => ({ ...prev, syncing: true, error: null }));
    try {
      if (accessToken) {
        // Immediately run an initial synchronization so the matched sheet gets the latest records
        await syncLedgerData(accessToken, id, rialEntries, cryptoEntries);
      }
      setSyncState((prev) => ({
        ...prev,
        spreadsheetId: id,
        spreadsheetUrl: url,
        lastSyncedAt: accessToken ? new Date().toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-US') : prev.lastSyncedAt,
        syncing: false,
        error: null,
      }));
      setManualSpreadsheetInput('');
      setShowConfigModal(false);
      alert(lang === 'fa' ? 'اتصال گوگل شیت برقرار شد و تمام اطلاعات همگام‌سازی گردید!' : 'Google Spreadsheet linked and synchronized successfully!');
    } catch (err: any) {
      console.error(err);
      // Fallback: still link it but notify about background sync error
      setSyncState((prev) => ({
        ...prev,
        spreadsheetId: id,
        spreadsheetUrl: url,
        syncing: false,
        error: err.message || 'Error executing initial sync',
      }));
      setManualSpreadsheetInput('');
      setShowConfigModal(false);
      alert(lang === 'fa' ? 'گوگل شیت متصل شد ولی خطا در همگام‌سازی اولیه رخ داد.' : 'Google Spreadsheet connected, but error occurred during initial synchronization.');
    }
  };

  // Sync Local Ledger Data directly to Google Sheets
  const handleSyncToSheets = async () => {
    if (!accessToken || !syncState.spreadsheetId) {
      alert(lang === 'fa' ? 'ابتدا گوگل شیت خود را متصل یا ایجاد کنید.' : 'Please create or connect a Google Sheet first.');
      return;
    }

    setSyncState((prev) => ({ ...prev, syncing: true, error: null }));
    try {
      await syncLedgerData(accessToken, syncState.spreadsheetId, rialEntries, cryptoEntries);
      setSyncState((prev) => ({
        ...prev,
        lastSyncedAt: new Date().toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-US'),
        syncing: false,
        error: null,
      }));
      alert(t.syncSuccess);
    } catch (err: any) {
      console.error(err);
      setSyncState((prev) => ({
        ...prev,
        syncing: false,
        error: err.message || 'Error committing sync updates',
      }));
      alert(`${t.syncError} ${err.message || ''}`);
    }
  };

  // UI Tabs 'rial' | 'crypto' | 'analytics' | 'ai' | 'split'
  const [activeTab, setActiveTab] = useState<'rial' | 'crypto' | 'analytics' | 'ai' | 'split'>('rial');

  // Search States
  const [rialSearch, setRialSearch] = useState('');
  const [cryptoSearch, setCryptoSearch] = useState('');

  // Advanced Filter state for Rial
  const [showRialAdvanced, setShowRialAdvanced] = useState(false);
  const [rialFilterType, setRialFilterType] = useState<'all' | 'in' | 'out'>('all');
  const [rialFilterStartDate, setRialFilterStartDate] = useState('');
  const [rialFilterEndDate, setRialFilterEndDate] = useState('');
  const [rialFilterMinAmount, setRialFilterMinAmount] = useState('');
  const [rialFilterMaxAmount, setRialFilterMaxAmount] = useState('');
  const [rialSortBy, setRialSortBy] = useState<'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc' | 'sender-asc' | 'sender-desc'>('date-desc');
  const [trendTimeframe, setTrendTimeframe] = useState<number>(15); // Default to last 15 active days

  // Advanced Filter state for Crypto
  const [showCryptoAdvanced, setShowCryptoAdvanced] = useState(false);
  const [cryptoFilterType, setCryptoFilterType] = useState<'all' | 'in' | 'out'>('all');
  const [cryptoFilterStartDate, setCryptoFilterStartDate] = useState('');
  const [cryptoFilterEndDate, setCryptoFilterEndDate] = useState('');
  const [cryptoFilterMinAmount, setCryptoFilterMinAmount] = useState('');
  const [cryptoFilterMaxAmount, setCryptoFilterMaxAmount] = useState('');
  const [cryptoSortBy, setCryptoSortBy] = useState<'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc' | 'coin-asc' | 'coin-desc'>('date-desc');

  // Quick Forms State
  const [showRialForm, setShowRialForm] = useState(false);
  const [showCryptoForm, setShowCryptoForm] = useState(false);

  // Rial Form values
  const [rialFormDate, setRialFormDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [rialFormSender, setRialFormSender] = useState('');
  const [rialFormAmount, setRialFormAmount] = useState('');
  const [rialFormBank, setRialFormBank] = useState('');
  const [rialFormNotes, setRialFormNotes] = useState('');
  const [rialFormType, setRialFormType] = useState<'in' | 'out'>('in');
  const [editingRialId, setEditingRialId] = useState<string | null>(null);

  // Crypto Form values
  const [cryptoFormDate, setCryptoFormDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [cryptoFormCoin, setCryptoFormCoin] = useState('USDT');
  const [cryptoFormAmount, setCryptoFormAmount] = useState('');
  const [cryptoFormPrice, setCryptoFormPrice] = useState('');
  const [cryptoFormWallet, setCryptoFormWallet] = useState('');
  const [cryptoFormNetwork, setCryptoFormNetwork] = useState('TRC-20');
  const [cryptoFormTxHash, setCryptoFormTxHash] = useState('');
  const [cryptoFormNotes, setCryptoFormNotes] = useState('');
  const [cryptoFormType, setCryptoFormType] = useState<'in' | 'out'>('in');
  const [editingCryptoId, setEditingCryptoId] = useState<string | null>(null);

  // Split Purchases / Joint Expenses Form States
  const [splitType, setSplitType] = useState<'split' | 'personal'>('split');
  const [splitTitle, setSplitTitle] = useState('');
  const [splitCryptoWhole, setSplitCryptoWhole] = useState('');
  const [splitCryptoFraction, setSplitCryptoFraction] = useState('');
  const [splitCoinName, setSplitCoinName] = useState('USDT');
  const [splitNetwork, setSplitNetwork] = useState('TRC-20');
  const [splitPartnerName, setSplitPartnerName] = useState('');
  const [splitRialAmount, setSplitRialAmount] = useState('');
  const [splitBank, setSplitBank] = useState('');
  const [splitDate, setSplitDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [splitNotes, setSplitNotes] = useState('');
  const [splitWallet, setSplitWallet] = useState('');
  const [splitTxHash, setSplitTxHash] = useState('');

  // Installment tracking
  const [splitIsInstallment, setSplitIsInstallment] = useState(false);
  const [splitInstallmentTotal, setSplitInstallmentTotal] = useState('3');
  const [splitInstallmentPaid, setSplitInstallmentPaid] = useState('1');

  // Settle modes: Rial / Crypto, and editing state
  const [splitSettleType, setSplitSettleType] = useState<'rial' | 'crypto'>('rial');
  const [splitSettleCryptoAmount, setSplitSettleCryptoAmount] = useState('');
  const [splitSettleCoinName, setSplitSettleCoinName] = useState('USDT');
  const [editingSplitId, setEditingSplitId] = useState<string | null>(null);
  const [editingSplitRialId, setEditingSplitRialId] = useState<string | null>(null);
  const [editingSplitCryptoRefundId, setEditingSplitCryptoRefundId] = useState<string | null>(null);

  // Live Digital Subscription Deals (VPN, streaming services, hosting) powered by Gemini Search Grounding
  const [liveOffers, setLiveOffers] = useState<any[]>([]);
  const [loadingOffers, setLoadingOffers] = useState<boolean>(false);
  const [dealFilter, setDealFilter] = useState<'all' | 'vpn' | 'streaming' | 'hosting'>('all');

  const fetchLiveOffers = async () => {
    setLoadingOffers(true);
    try {
      const apiBase = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${apiBase}/api/gemini/live-offers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: lang })
      });
      const data = await res.json();
      if (data && Array.isArray(data.offers)) {
        setLiveOffers(data.offers);
      }
    } catch (err) {
      console.error('Error fetching live digital subscription offers:', err);
    } finally {
      setLoadingOffers(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'split') {
      fetchLiveOffers();
    }
  }, [activeTab, lang]);

  // States for automated public CoinGecko / Binance price scanner
  const [isFetchingPrice, setIsFetchingPrice] = useState(false);
  const [priceFetchStatus, setPriceFetchStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleFetchPrice = async (coinSymbol: string) => {
    if (!coinSymbol || !coinSymbol.trim()) return;
    setIsFetchingPrice(true);
    setPriceFetchStatus('idle');
    const symbolClean = coinSymbol.trim().toUpperCase();
    
    // Quick routing for standard stablecoins
    if (['USDT', 'USDC', 'BUSD', 'DAI'].includes(symbolClean)) {
      setCryptoFormPrice('1.0');
      setPriceFetchStatus('success');
      setIsFetchingPrice(false);
      return;
    }

    try {
      // 1. Try Binance ticker price first (extremely reliable and no API key limit)
      const binanceSymbol = symbolClean === 'BTC' ? 'BTCUSDT' : symbolClean === 'ETH' ? 'ETHUSDT' : `${symbolClean}USDT`;
      const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${binanceSymbol}`);
      if (res.ok) {
        const data = await res.json();
        const price = parseFloat(data.price);
        if (price && !isNaN(price)) {
          setCryptoFormPrice(price.toString());
          setPriceFetchStatus('success');
          setIsFetchingPrice(false);
          return;
        }
      }
    } catch (err) {
      console.warn("Binance price lookback failed, falling back to CoinGecko", err);
    }

    try {
      // 2. Try CoinGecko official public API
      const coingeckoMap: { [key: string]: string } = {
        'BTC': 'bitcoin',
        'ETH': 'ethereum',
        'USDT': 'tether',
        'USDC': 'usd-coin',
        'BNB': 'binancecoin',
        'SOL': 'solana',
        'XRP': 'ripple',
        'ADA': 'cardano',
        'DOGE': 'dogecoin',
        'TRX': 'tron',
        'TON': 'the-open-network',
        'DOT': 'polkadot',
        'MATIC': 'matic-network',
        'SHIB': 'shiba-inu',
        'LTC': 'litecoin',
        'LINK': 'chainlink',
        'AVAX': 'avalanche-2',
        'XLM': 'stellar',
        'UNI': 'uniswap',
        'ATOM': 'cosmos',
      };
      const cgId = coingeckoMap[symbolClean];
      if (cgId) {
        const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${cgId}&vs_currencies=usd`);
        if (res.ok) {
          const data = await res.json();
          const price = data[cgId]?.usd;
          if (price && !isNaN(price)) {
            setCryptoFormPrice(price.toString());
            setPriceFetchStatus('success');
            setIsFetchingPrice(false);
            return;
          }
        }
      }
    } catch (err) {
      console.warn("CoinGecko API lookback failed", err);
    }

    setPriceFetchStatus('error');
    setIsFetchingPrice(false);
  };

  // Debounced effect to query prices as user types characters
  useEffect(() => {
    if (showCryptoForm && cryptoFormCoin && cryptoFormCoin.trim().length >= 3) {
      const delayDebounce = setTimeout(() => {
        handleFetchPrice(cryptoFormCoin);
      }, 1200);
      return () => clearTimeout(delayDebounce);
    }
  }, [cryptoFormCoin, showCryptoForm]);

  // Convert Crypto to Rial state variables
  const [convertTargetCrypto, setConvertTargetCrypto] = useState<CryptoEntry | null>(null);
  const [convertCoinAmount, setConvertCoinAmount] = useState<string>('');
  const [convertRialAmount, setConvertRialAmount] = useState<string>('');
  const [convertExchange, setConvertExchange] = useState<string>('');
  const [convertBank, setConvertBank] = useState<string>('');
  const [convertDate, setConvertDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [convertNotes, setConvertNotes] = useState<string>('');
  const [convertError, setConvertError] = useState<string | null>(null);

  // Calendar View mode ('jalali' or 'gregorian') - default to 'jalali' for a complete Jalali experience
  const [rialCalendarMode, setRialCalendarMode] = useState<'jalali' | 'gregorian'>('jalali');
  const [cryptoCalendarMode, setCryptoCalendarMode] = useState<'jalali' | 'gregorian'>('jalali');

  // Top deposits merged and calculated across both Ledgers
  const topDepositsMerged = useMemo(() => {
    const rials = rialEntries
      .filter((e) => e.type === 'in')
      .map((e) => ({
        id: e.id,
        date: e.date,
        party: e.receivedFrom || (lang === 'fa' ? 'ناشناس' : 'Anonymous'),
        amount: e.amount,
        unit: lang === 'fa' ? 'تومان' : 'Toman',
        amountUsd: e.amount / 65000,
        detail: e.bankName || (lang === 'fa' ? 'بانک کلی' : 'General Bank'),
        type: 'rial' as const,
        row: e,
      }));

    const cryptos = cryptoEntries
      .filter((e) => e.type === 'in')
      .map((e) => ({
        id: e.id,
        date: e.date,
        party: lang === 'fa' ? 'کیف پول بلاک‌چین' : 'Blockchain Wallet',
        amount: e.amount,
        unit: e.coinName,
        amountUsd: e.equivalentUsd || (e.amount * (e.coinPrice || 1)),
        detail: e.network || 'TRC-20',
        type: 'crypto' as const,
        row: e,
      }));

    // Sort by USD equivalent to get the absolute largest deposits
    return [...rials, ...cryptos].sort((a, b) => b.amountUsd - a.amountUsd);
  }, [rialEntries, cryptoEntries, lang]);

  const featuredDeposit = useMemo(() => {
    if (topDepositsMerged.length === 0) return null;
    const idx = spotlightIndex % topDepositsMerged.length;
    return topDepositsMerged[idx] || topDepositsMerged[0];
  }, [topDepositsMerged, spotlightIndex]);

  const handleRandomizeSpotlight = () => {
    if (topDepositsMerged.length <= 1) return;
    let newIdx = Math.floor(Math.random() * topDepositsMerged.length);
    if (newIdx === (spotlightIndex % topDepositsMerged.length)) {
      newIdx = (newIdx + 1) % topDepositsMerged.length;
    }
    setSpotlightIndex(newIdx);
  };

  const getAiInsight = (dep: typeof topDepositsMerged[0] | null) => {
    if (!dep) return '';
    const isLarge = dep.amountUsd > 1000;
    if (dep.type === 'rial') {
      if (isLarge) {
        return lang === 'fa' 
          ? `🤖 تحلیل هوشمند تریدرز هاب پرو: واریز فوق‌العاده سنگین ریالی به مبلغ ${dep.amount.toLocaleString()} تومان از طرف "${dep.party}". این تراکنش با موفقیت به بانک "${dep.detail}" متصل گردیده و نشان‌دهنده ورود نقدینگی قدرتمند نهنگ‌های ریالی در پلتفرم تریدرز هاب پرو است.`
          : `🤖 Traders Hub Pro AI Insight: Extremely high Rial deposit of ${dep.amount.toLocaleString()} Toman from "${dep.party}". This transaction successfully clears with "${dep.detail}", indicating significant whale funding on Traders Hub Pro.`;
      } else {
        return lang === 'fa'
          ? `🤖 تحلیل هوشمند تریدرز هاب پرو: یک واریز استاندارد ریالی به سیستم شتاب از طرف "${dep.party}". وضعیت تراکنش سبز و کاملاً با ثبات ارزیابی شده است و تحت چتر امنیتی تریدرز هاب پرو اداره می‌شود.`
          : `🤖 Traders Hub Pro AI Insight: Standard retail Rial deposit from "${dep.party}". System logs verify this as a highly stable bank settlement under Traders Hub Pro guard guidelines.`;
      }
    } else {
      if (isLarge) {
        return lang === 'fa'
          ? `🤖 تحلیل هوشمند تریدرز هاب پرو: تراکنش کلان کریپتو روی شبکه "${dep.detail}" با موفقیت تکمیل شد. واریز ${dep.amount} ${dep.unit} دارای مهر تایید دیجیتال بوده و ظرفیت معاملاتی شما را در پروژه‌های تریدرز هاب پرو ارتقا می‌دهد.`
          : `🤖 Traders Hub Pro AI Insight: Massive crypto deposit detected on network "${dep.detail}". The inflow of ${dep.amount} ${dep.unit} is on-chain certified, raising your available trading power within the core of Traders Hub Pro.`;
      } else {
        return lang === 'fa'
          ? `🤖 تحلیل هوشمند تریدرز هاب پرو: واریز موفق ${dep.amount} ${dep.unit} ثبت شده است. کارمزد گس بهینه‌سازی شده و امنیت تراکنش با هش بلاک‌چین در زیرساخت تریدرز هاب پرو تضمین گردیده است.`
          : `🤖 Traders Hub Pro AI Insight: Standard crypto deposit of ${dep.amount} ${dep.unit} confirmed. Target gas optimized safely on network ${dep.detail} connected to Traders Hub Pro ledger system.`;
      }
    }
  };

  const jalaliMonthsList = useMemo(() => [
    { val: 1, name: 'فروردین (Farvardin)' },
    { val: 2, name: 'اردیبهشت (Ordibehesht)' },
    { val: 3, name: 'خرداد (Khordad)' },
    { val: 4, name: 'تیر (Tir)' },
    { val: 5, name: 'مرداد (Mordad)' },
    { val: 6, name: 'شهریور (Shahrivar)' },
    { val: 7, name: 'مهر (Mehr)' },
    { val: 8, name: 'آبان (Aban)' },
    { val: 9, name: 'آذر (Azar)' },
    { val: 10, name: 'دی (Dey)' },
    { val: 11, name: 'بهمن (Bahman)' },
    { val: 12, name: 'اسفند (Esfand)' }
  ], []);

  const getJalaliLimits = (year: number, month: number) => {
    if (month <= 6) return 31;
    if (month <= 11) return 30;
    // Esfand calculation
    const remainder = year % 33;
    const isLeap = [1, 5, 9, 13, 17, 22, 26, 30].includes(remainder);
    return isLeap ? 30 : 29;
  };

  const rialJalaliParts = useMemo(() => {
    if (!rialFormDate) return { jy: 1405, jm: 3, jd: 5 };
    const parts = rialFormDate.split('-');
    if (parts.length < 3) return { jy: 1405, jm: 3, jd: 5 };
    return gregorianToJalali(
      parseInt(parts[0], 10),
      parseInt(parts[1], 10),
      parseInt(parts[2], 10)
    );
  }, [rialFormDate]);

  const updateRialJalaliValue = (field: 'y' | 'm' | 'd', val: number) => {
    const jy = field === 'y' ? val : rialJalaliParts.jy;
    const jm = field === 'm' ? val : rialJalaliParts.jm;
    const jd = field === 'd' ? val : rialJalaliParts.jd;

    const maxDays = getJalaliLimits(jy, jm);
    const resolvedDay = Math.min(jd, maxDays);

    const greg = jalaliToGregorian(jy, jm, resolvedDay);
    const yStr = greg.getFullYear();
    const mStr = String(greg.getMonth() + 1).padStart(2, '0');
    const dStr = String(greg.getDate()).padStart(2, '0');
    setRialFormDate(`${yStr}-${mStr}-${dStr}`);
  };

  const cryptoJalaliParts = useMemo(() => {
    if (!cryptoFormDate) return { jy: 1405, jm: 3, jd: 5 };
    const parts = cryptoFormDate.split('-');
    if (parts.length < 3) return { jy: 1405, jm: 3, jd: 5 };
    return gregorianToJalali(
      parseInt(parts[0], 10),
      parseInt(parts[1], 10),
      parseInt(parts[2], 10)
    );
  }, [cryptoFormDate]);

  const updateCryptoJalaliValue = (field: 'y' | 'm' | 'd', val: number) => {
    const jy = field === 'y' ? val : cryptoJalaliParts.jy;
    const jm = field === 'm' ? val : cryptoJalaliParts.jm;
    const jd = field === 'd' ? val : cryptoJalaliParts.jd;

    const maxDays = getJalaliLimits(jy, jm);
    const resolvedDay = Math.min(jd, maxDays);

    const greg = jalaliToGregorian(jy, jm, resolvedDay);
    const yStr = greg.getFullYear();
    const mStr = String(greg.getMonth() + 1).padStart(2, '0');
    const dStr = String(greg.getDate()).padStart(2, '0');
    setCryptoFormDate(`${yStr}-${mStr}-${dStr}`);
  };

  // AI Chat accountant system
  const [aiInput, setAiInput] = useState('');
  const [aiHistory, setAiHistory] = useState<Array<{ sender: 'user' | 'ai'; text: string }>>(() => {
    return [
      {
        sender: 'ai',
        text: lang === 'fa' 
          ? 'سلام! من حسابدار هوشمند تریدرز هاب پرو هستم. از دیتابیس فعلی شما آگاهم. سوالات مالی خود را بپرسید تا سریع بررسی کنم.' 
          : 'Hello! I am your Traders Hub smart accountant. I am aware of your live cash and crypto database records. Ask me any analytical query.'
      }
    ];
  });
  const [aiLoading, setAiLoading] = useState(false);

  // Trigger Playground load to fill mock templates optionally
  const handleLoadDemoPlayground = () => {
    askConfirm(
      lang === 'fa' ? 'بارگذاری اطلاعات دمو' : 'Load Demo Data',
      lang === 'fa' 
        ? 'آیا مایلید فیش‌های تست پیش‌فرض را جهت ارزیابی در این پروفایل بارگذاری کنید؟' 
        : 'Do you want to populate this profile with demo template logs?',
      () => {
        if (currentUser) {
          INITIAL_RIAL_ENTRIES.forEach((entry) => {
            setDoc(doc(db, 'users', currentUser.uid, 'rialEntries', entry.id), entry).catch((e) => console.error(e));
          });
          INITIAL_CRYPTO_ENTRIES.forEach((entry) => {
            setDoc(doc(db, 'users', currentUser.uid, 'cryptoEntries', entry.id), entry).catch((e) => console.error(e));
          });
        } else {
          setRialEntries(INITIAL_RIAL_ENTRIES);
          setCryptoEntries(INITIAL_CRYPTO_ENTRIES);
        }
      },
      lang === 'fa' ? 'بله، بارگذاری شود' : 'Yes, Load Demo',
      lang === 'fa' ? 'لغو' : 'Cancel'
    );
  };

  // Form Submission Rial
  const handleSaveRial = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rialFormSender.trim() || !rialFormAmount.trim() || !rialFormBank.trim()) {
      alert(t.errorRequiredFields);
      return;
    }

    const numericAmount = parseFloat(rialFormAmount.replace(/,/g, ''));
    if (isNaN(numericAmount) || numericAmount <= 0) {
      alert(t.errorInvalidAmount);
      return;
    }

    if (editingRialId) {
      const updatedEntry: RialEntry = {
        id: editingRialId,
        date: rialFormDate,
        receivedFrom: rialFormSender.trim(),
        amount: numericAmount,
        bankName: rialFormBank.trim(),
        notes: rialFormNotes.trim(),
        createdAt: rialEntries.find((e) => e.id === editingRialId)?.createdAt || Date.now(),
        type: rialFormType,
      };

      if (currentUser) {
        setDoc(doc(db, 'users', currentUser.uid, 'rialEntries', editingRialId), updatedEntry).catch((error) =>
          handleFirestoreError(error, OperationType.WRITE, `users/${currentUser.uid}/rialEntries/${editingRialId}`)
        );
      } else {
        setRialEntries((prev) =>
          prev.map((entry) => (entry.id === editingRialId ? updatedEntry : entry))
        );
      }
      setEditingRialId(null);
    } else {
      const newEntry: RialEntry = {
        id: `R-${Math.floor(100 + Math.random() * 900)}`,
        date: rialFormDate,
        receivedFrom: rialFormSender.trim(),
        amount: numericAmount,
        bankName: rialFormBank.trim(),
        notes: rialFormNotes.trim(),
        createdAt: Date.now(),
        type: rialFormType,
      };

      if (currentUser) {
        setDoc(doc(db, 'users', currentUser.uid, 'rialEntries', newEntry.id), newEntry).catch((error) =>
          handleFirestoreError(error, OperationType.WRITE, `users/${currentUser.uid}/rialEntries/${newEntry.id}`)
        );
      } else {
        setRialEntries((prev) => [newEntry, ...prev]);
      }
    }

    // Reset Form
    setRialFormSender('');
    setRialFormAmount('');
    setRialFormBank('');
    setRialFormNotes('');
    setRialFormType('in');
    setShowRialForm(false);
  };

  // Form Submission Crypto
  const handleSaveCrypto = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cryptoFormCoin.trim() || !cryptoFormAmount.trim() || !cryptoFormNetwork.trim()) {
      alert(t.errorRequiredFields);
      return;
    }

    const numericAmount = parseFloat(cryptoFormAmount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      alert(t.errorInvalidAmount);
      return;
    }

    let numericPrice = cryptoFormPrice.trim() ? parseFloat(cryptoFormPrice) : undefined;
    const coinUpper = cryptoFormCoin.trim().toUpperCase();
    if (numericPrice === undefined && ['USDT', 'USDC', 'BUSD', 'DAI'].includes(coinUpper)) {
      numericPrice = 1.0;
    }
    const equivalentUsdVal = (numericPrice !== undefined && !isNaN(numericPrice)) ? (numericAmount * numericPrice) : (numericAmount * 1.0);
    const targetWallet = cryptoFormWallet.trim() ? cryptoFormWallet.trim() : undefined;

    if (editingCryptoId) {
      const updatedEntry: CryptoEntry = {
        id: editingCryptoId,
        date: cryptoFormDate,
        coinName: cryptoFormCoin.trim().toUpperCase(),
        amount: numericAmount,
        coinPrice: numericPrice,
        equivalentUsd: equivalentUsdVal,
        walletAddress: targetWallet,
        network: cryptoFormNetwork.trim().toUpperCase(),
        txHash: cryptoFormTxHash.trim(),
        notes: cryptoFormNotes.trim(),
        createdAt: cryptoEntries.find((e) => e.id === editingCryptoId)?.createdAt || Date.now(),
        type: cryptoFormType,
      };

      if (currentUser) {
        setDoc(doc(db, 'users', currentUser.uid, 'cryptoEntries', editingCryptoId), updatedEntry).catch((error) =>
          handleFirestoreError(error, OperationType.WRITE, `users/${currentUser.uid}/cryptoEntries/${editingCryptoId}`)
        );
      } else {
        setCryptoEntries((prev) =>
          prev.map((entry) => (entry.id === editingCryptoId ? updatedEntry : entry))
        );
      }
      setEditingCryptoId(null);
    } else {
      const newEntry: CryptoEntry = {
        id: `C-${Math.floor(100 + Math.random() * 900)}`,
        date: cryptoFormDate,
        coinName: cryptoFormCoin.trim().toUpperCase(),
        amount: numericAmount,
        coinPrice: numericPrice,
        equivalentUsd: equivalentUsdVal,
        walletAddress: targetWallet,
        network: cryptoFormNetwork.trim().toUpperCase(),
        txHash: cryptoFormTxHash.trim(),
        notes: cryptoFormNotes.trim(),
        createdAt: Date.now(),
        type: cryptoFormType,
      };

      if (currentUser) {
        setDoc(doc(db, 'users', currentUser.uid, 'cryptoEntries', newEntry.id), newEntry).catch((error) =>
          handleFirestoreError(error, OperationType.WRITE, `users/${currentUser.uid}/cryptoEntries/${newEntry.id}`)
        );
      } else {
        setCryptoEntries((prev) => [newEntry, ...prev]);
      }
    }

    // Reset Form
    setCryptoFormAmount('');
    setCryptoFormPrice('');
    setCryptoFormWallet('');
    setCryptoFormTxHash('');
    setCryptoFormNotes('');
    setCryptoFormType('in');
    setShowCryptoForm(false);
  };

  const handleSaveSplitExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate based on split or personal type
    const isSplit = splitType === 'split';
    
    const wholeValStr = splitCryptoWhole.replace(/\s/g, '');
    const fracValStr = splitCryptoFraction.replace(/\s/g, '');
    const fullAmountStr = `${wholeValStr || '0'}.${fracValStr || '0'}`;
    const cryptoAmtVal = parseFloat(fullAmountStr);

    if (!splitTitle.trim()) {
      alert(lang === 'fa' ? 'لطفاً موضوع / بابت خرید را وارد کنید.' : 'Please enter the Purchase Subject / Item Name.');
      return;
    }

    if (isNaN(cryptoAmtVal) || cryptoAmtVal <= 0) {
      alert(lang === 'fa' ? 'لطفاً مبلغ کل یا خرد دلار را به درستی وارد کنید (باید بزرگتر از صفر باشد).' : 'Please enter a valid crypto/USD amount (greater than zero).');
      return;
    }

    if (isSplit) {
      if (!splitPartnerName.trim()) {
        alert(lang === 'fa' ? 'لطفاً نام شخص شریک در هزینه را وارد کنید.' : 'Please enter the Shared Partner Name.');
        return;
      }
      if (splitSettleType === 'rial') {
        if (!splitRialAmount.trim()) {
          alert(lang === 'fa' ? 'لطفاً سهم دریافتی ریالی را وارد کنید.' : 'Please enter the Rial Share Received (Toman).');
          return;
        }
        if (!splitBank.trim()) {
          alert(lang === 'fa' ? 'لطفاً بانک واسطه/مقصد دریافتی را وارد کنید.' : 'Please enter the Target Bank Account.');
          return;
        }
      } else {
        if (!splitSettleCryptoAmount.trim()) {
          alert(lang === 'fa' ? 'لطفاً مبلغ سهم دریافتی ارزی را وارد کنید.' : 'Please enter the Crypto Share Received.');
          return;
        }
      }
    }

    let rialAmtVal = 0;
    if (isSplit && splitSettleType === 'rial') {
      rialAmtVal = parseFloat(splitRialAmount.replace(/,/g, ''));
      if (isNaN(rialAmtVal) || rialAmtVal <= 0) {
        alert(lang === 'fa' ? 'مبلغ ریال نامعتبر است.' : 'Invalid Rial amount.');
        return;
      }
    }

    let refundCryptoAmtVal = 0;
    if (isSplit && splitSettleType === 'crypto') {
      refundCryptoAmtVal = parseFloat(splitSettleCryptoAmount);
      if (isNaN(refundCryptoAmtVal) || refundCryptoAmtVal <= 0) {
        alert(lang === 'fa' ? 'مبلغ سهم ارزی نامعتبر است.' : 'Invalid Crypto share amount.');
        return;
      }
    }

    try {
      // 1. If we are editing, first purge previous linked documents to prevent duplicate keys or outdated settlement paths
      if (editingSplitId) {
        if (currentUser) {
          await deleteDoc(doc(db, 'users', currentUser.uid, 'cryptoEntries', editingSplitId));
          if (editingSplitRialId) {
            await deleteDoc(doc(db, 'users', currentUser.uid, 'rialEntries', editingSplitRialId));
          }
          if (editingSplitCryptoRefundId) {
            await deleteDoc(doc(db, 'users', currentUser.uid, 'cryptoEntries', editingSplitCryptoRefundId));
          }
        } else {
          setCryptoEntries((prev) => prev.filter((c) => c.id !== editingSplitId && c.id !== editingSplitCryptoRefundId));
          if (editingSplitRialId) {
            setRialEntries((prev) => prev.filter((r) => r.id !== editingSplitRialId));
          }
        }
      }

      // 2. Generate unique matching ID keys
      const rand1 = Math.floor(100 + Math.random() * 900);
      const rand2 = Math.floor(100 + Math.random() * 900);
      const cryptoId = editingSplitId ? editingSplitId : (isSplit ? `C-SPL-${rand1}` : `C-EXP-${rand1}`);
      const rialId = (isSplit && splitSettleType === 'rial') ? (editingSplitRialId ? editingSplitRialId : `R-SPL-${rand2}`) : undefined;
      const cryptoRefundId = (isSplit && splitSettleType === 'crypto') ? (editingSplitCryptoRefundId ? editingSplitCryptoRefundId : `C-SPL-REF-${rand2}`) : undefined;

      // 3. Build detailed description notes
      const normalizedCoin = splitCoinName.trim().toUpperCase();
      const normalizedNetwork = splitNetwork.trim().toUpperCase();
      
      let customCryptoNotes = '';
      let customRialNotes = '';
      let customCryptoRefundNotes = '';
      
      const installSuffix = (!isSplit && splitIsInstallment)
        ? (lang === 'fa' ? ` [قسطی: قسط ${splitInstallmentPaid} از ${splitInstallmentTotal}]` : ` [Installments: ${splitInstallmentPaid} of ${splitInstallmentTotal}]`)
        : '';

      if (isSplit) {
        if (splitSettleType === 'rial') {
          customCryptoNotes = lang === 'fa'
            ? `[خرید اشتراکی] ${splitTitle.trim()} با ${splitPartnerName.trim()}. پرداخت من: ${cryptoAmtVal} ${normalizedCoin}. سهم دریافتی ریالی از شریک بابت دونگ: ${rialAmtVal.toLocaleString()} تومان به بانک ${splitBank.trim()}. ${splitNotes.trim()}`
            : `[Shared/Split Purchase] ${splitTitle.trim()} with ${splitPartnerName.trim()}. Spent total: ${cryptoAmtVal} ${normalizedCoin}. Reimbursement: ${rialAmtVal.toLocaleString()} Tomans to bank ${splitBank.trim()}. ${splitNotes.trim()}`;

          customRialNotes = lang === 'fa'
            ? `[دریافت سهم دونگ کلاود] بابت خرید ${splitTitle.trim()} توسط ${splitPartnerName.trim()}. مبلغ کل پرداختی ارز من: ${cryptoAmtVal} ${normalizedCoin}. شناسه مبدا: ${cryptoId}. ${splitNotes.trim()}`
            : `[Split Expense Refund] From ${splitPartnerName.trim()} for ${splitTitle.trim()} purchase. Total paid: ${cryptoAmtVal} ${normalizedCoin}. Partner ID: ${cryptoId}. ${splitNotes.trim()}`;
        } else {
          const refundCoin = splitSettleCoinName.trim().toUpperCase();
          customCryptoNotes = lang === 'fa'
            ? `[خرید اشتراکی] ${splitTitle.trim()} با ${splitPartnerName.trim()}. پرداخت من: ${cryptoAmtVal} ${normalizedCoin}. سهم دریافتی ارزی از شریک بابت دونگ: ${refundCryptoAmtVal} ${refundCoin}. ${splitNotes.trim()}`
            : `[Shared/Split Purchase] ${splitTitle.trim()} with ${splitPartnerName.trim()}. Spent total: ${cryptoAmtVal} ${normalizedCoin}. Reimbursement: ${refundCryptoAmtVal} ${refundCoin}. ${splitNotes.trim()}`;

          customCryptoRefundNotes = lang === 'fa'
            ? `[دریافت سهم دونگ کلاود] از شریک ${splitPartnerName.trim()} بابت خرید ${splitTitle.trim()}. پرداخت کل من: ${cryptoAmtVal} ${normalizedCoin}. سهم دریافتی: ${refundCryptoAmtVal} ${refundCoin}. شناسه مبدا: ${cryptoId}. ${splitNotes.trim()}`
            : `[Split Expense Refund] (Crypto) From ${splitPartnerName.trim()} for ${splitTitle.trim()} purchase. Spent: ${cryptoAmtVal} ${normalizedCoin}. Received: ${refundCryptoAmtVal} ${refundCoin}. Parent ID: ${cryptoId}. ${splitNotes.trim()}`;
        }
      } else {
        customCryptoNotes = lang === 'fa'
          ? `[مخارج شخصی]${installSuffix} ${splitTitle.trim()}. پرداخت من: ${cryptoAmtVal} ${normalizedCoin}. ${splitNotes.trim()}`
          : `[Personal Expense]${installSuffix} ${splitTitle.trim()}. Paid by myself: ${cryptoAmtVal} ${normalizedCoin}. ${splitNotes.trim()}`;
      }

      // 4. Create Crypto Entry (Outflow representing VPN/product purchase cost)
      let coinUnitPrice = ['USDT', 'USDC', 'BUSD', 'DAI'].includes(normalizedCoin) ? 1.0 : undefined;
      const usdValue = coinUnitPrice !== undefined ? (cryptoAmtVal * coinUnitPrice) : cryptoAmtVal;

      const newCryptoEntry: CryptoEntry = {
        id: cryptoId,
        date: splitDate,
        coinName: normalizedCoin,
        amount: cryptoAmtVal,
        network: normalizedNetwork,
        txHash: splitTxHash.trim(),
        notes: customCryptoNotes,
        createdAt: Date.now(),
        type: 'out', // This is an expense (outgoing crypto)
        isInstallment: !isSplit ? splitIsInstallment : undefined,
        installmentTotal: (!isSplit && splitIsInstallment) ? (parseInt(splitInstallmentTotal) || undefined) : undefined,
        installmentPaid: (!isSplit && splitIsInstallment) ? (parseInt(splitInstallmentPaid) || undefined) : undefined
      };

      if (coinUnitPrice !== undefined) {
        newCryptoEntry.coinPrice = coinUnitPrice;
        newCryptoEntry.equivalentUsd = usdValue;
      }
      if (splitWallet.trim()) {
        newCryptoEntry.walletAddress = splitWallet.trim();
      }

      // 5. Create Rial Refund Entry if split
      let newRialEntry: RialEntry | undefined = undefined;
      if (isSplit && rialId && splitSettleType === 'rial') {
        newRialEntry = {
          id: rialId,
          date: splitDate,
          receivedFrom: splitPartnerName.trim(),
          amount: rialAmtVal,
          bankName: splitBank.trim(),
          notes: customRialNotes,
          createdAt: Date.now() + 50,
          type: 'in', // This is incoming money (reimbursement)
          linkedCryptoId: cryptoId // Directly cross-referenced!
        };
      }

      // 6. Create Crypto Refund Entry if split & settled in crypto
      let newCryptoRefundEntry: CryptoEntry | undefined = undefined;
      if (isSplit && cryptoRefundId && splitSettleType === 'crypto') {
        const refundCoin = splitSettleCoinName.trim().toUpperCase();
        let refundCoinPrice = ['USDT', 'USDC', 'BUSD', 'DAI'].includes(refundCoin) ? 1.0 : undefined;
        newCryptoRefundEntry = {
          id: cryptoRefundId,
          date: splitDate,
          coinName: refundCoin,
          amount: refundCryptoAmtVal,
          network: normalizedNetwork,
          txHash: '',
          notes: customCryptoRefundNotes,
          createdAt: Date.now() + 60,
          type: 'in' // Incoming refund
        };
        if (refundCoinPrice !== undefined) {
          newCryptoRefundEntry.coinPrice = refundCoinPrice;
          newCryptoRefundEntry.equivalentUsd = refundCryptoAmtVal * refundCoinPrice;
        }
      }

      // Helper to strip undefined values so Firestore won't throw
      const cleanData = (obj: any) => {
        const copy = { ...obj };
        Object.keys(copy).forEach(key => {
          if (copy[key] === undefined) {
            delete copy[key];
          }
        });
        return copy;
      };

      // 7. Commit/Save
      if (currentUser) {
        await setDoc(doc(db, 'users', currentUser.uid, 'cryptoEntries', cryptoId), cleanData(newCryptoEntry));
        if (newRialEntry && rialId) {
          await setDoc(doc(db, 'users', currentUser.uid, 'rialEntries', rialId), cleanData(newRialEntry));
        }
        if (newCryptoRefundEntry && cryptoRefundId) {
          await setDoc(doc(db, 'users', currentUser.uid, 'cryptoEntries', cryptoRefundId), cleanData(newCryptoRefundEntry));
        }
      } else {
        setCryptoEntries((prev) => [newCryptoEntry, ...prev]);
        if (newRialEntry) {
          setRialEntries((prev) => [newRialEntry, ...prev]);
        }
        if (newCryptoRefundEntry) {
          setCryptoEntries((prev) => [newCryptoRefundEntry, ...prev]);
        }
      }

      // 8. Reset Form split states
      setSplitTitle('');
      setSplitCryptoWhole('');
      setSplitCryptoFraction('');
      setSplitPartnerName('');
      setSplitRialAmount('');
      setSplitBank('');
      setSplitSettleCryptoAmount('');
      setSplitNotes('');
      setSplitWallet('');
      setSplitTxHash('');
      setSplitIsInstallment(false);
      setSplitInstallmentTotal('3');
      setSplitInstallmentPaid('1');
      
      setEditingSplitId(null);
      setEditingSplitRialId(null);
      setEditingSplitCryptoRefundId(null);
      
      const isEditMode = !!editingSplitId;
      if (isSplit) {
        alert(lang === 'fa' 
          ? isEditMode 
            ? '✅ خرید اشتراکی با موفقیت ویرایش و بروزرسانی شد!'
            : '✅ خرید اشتراکی با موفقیت ثبت شد! هر دو تراکنش (برداشت ارز کلاود و بازپرداخت دونگ) به دفتر کل با موفقیت ثبت شدند.' 
          : isEditMode
            ? '✅ Shared split purchase successfully edited and updated!'
            : '✅ Shared split purchase recorded! Both entries have been successfully saved.'
        );
      } else {
        alert(lang === 'fa'
          ? isEditMode 
            ? '✅ هزینه شخص شما با موفقیت ویرایش و بروزرسانی شد.'
            : '✅ هزینه شخص شما با موفقیت به دفتر ثبت مخارج شخصی اضافه شد.'
          : isEditMode
            ? '✅ Your personal expense has been successfully edited!'
            : '✅ Your personal expense has been successfully saved to the ledger!'
        );
      }
      setActiveTab('split');

    } catch (err: any) {
      console.error(err);
      alert(lang === 'fa' ? `خطا در ثبت مخارج: ${err.message || err}` : `Failed to save expense: ${err.message || err}`);
    }
  };

  const handleDeleteSplitPair = async (rialId?: string, cryptoId?: string, cryptoRefundId?: string) => {
    const confirmMsg = lang === 'fa'
      ? 'آیا از حذف این فیش هزینه مطمئن هستید؟ تمام تراکنش‌های هم‌بسته حذف خواهند شد.'
      : 'Are you sure you want to delete this expense slip? All associated transactions will be removed.';
    
    if (!window.confirm(confirmMsg)) return;

    try {
      if (currentUser) {
        if (rialId) {
          await deleteDoc(doc(db, 'users', currentUser.uid, 'rialEntries', rialId));
        }
        if (cryptoId) {
          await deleteDoc(doc(db, 'users', currentUser.uid, 'cryptoEntries', cryptoId));
        }
        if (cryptoRefundId) {
          await deleteDoc(doc(db, 'users', currentUser.uid, 'cryptoEntries', cryptoRefundId));
        }
      } else {
        if (rialId) {
          setRialEntries((prev) => prev.filter((r) => r.id !== rialId));
        }
        if (cryptoId) {
          setCryptoEntries((prev) => prev.filter((c) => c.id !== cryptoId));
        }
        if (cryptoRefundId) {
          setCryptoEntries((prev) => prev.filter((c) => c.id !== cryptoRefundId));
        }
      }
      alert(lang === 'fa' ? '✅ با موفقیت حذف شد.' : '✅ Successfully deleted.');
    } catch (err: any) {
      console.error(err);
      alert(lang === 'fa' ? 'خطا در حذف هزینه' : 'Failed to delete expense.');
    }
  };

  const handleStartEditSplit = (item: any) => {
    setEditingSplitId(item.cryptoId || null);
    setEditingSplitRialId(item.rialId || null);
    setEditingSplitCryptoRefundId(item.cryptoRefundId || null);

    setSplitType(item.type);
    setSplitTitle(item.title);
    
    const parts = String(item.cryptoAmount).split('.');
    setSplitCryptoWhole(parts[0] || '0');
    setSplitCryptoFraction(parts[1] || '0');
    setSplitCoinName(item.coinName || 'USDT');
    setSplitNetwork(item.network || 'TRC-20');
    setSplitDate(item.date);
    
    // Smooth parsing clean notes
    let rawNotes = item.notes || '';
    setSplitNotes(rawNotes);
    setSplitWallet(item.walletAddress || '');
    setSplitTxHash(item.txHash || '');
    
    if (item.type === 'split') {
      setSplitPartnerName(item.partnerName || '');
      setSplitSettleType(item.settleType || 'rial');
      if (item.settleType === 'crypto') {
        setSplitSettleCryptoAmount(String(item.settleCryptoAmount || ''));
        setSplitSettleCoinName(item.settleCoinName || 'USDT');
        setSplitRialAmount('');
        setSplitBank('');
      } else {
        setSplitRialAmount((item.rialAmount || 0).toLocaleString());
        setSplitBank(item.bankName || '');
        setSplitSettleCryptoAmount('');
      }
    } else {
      setSplitIsInstallment(!!item.isInstallment);
      setSplitInstallmentTotal(String(item.installmentTotal || '3'));
      setSplitInstallmentPaid(String(item.installmentPaid || '1'));
    }

    // Scroll nicely to the form
    const formElement = document.getElementById('split-expense-form');
    if (formElement) {
      formElement.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleStartEditRial = (entry: RialEntry) => {
    setEditingRialId(entry.id);
    setRialFormDate(entry.date);
    setRialFormSender(entry.receivedFrom);
    setRialFormAmount(entry.amount.toString());
    setRialFormBank(entry.bankName);
    setRialFormNotes(entry.notes);
    setRialFormType(entry.type || 'in');
    setShowRialForm(true);
  };

  const handleStartEditCrypto = (entry: CryptoEntry) => {
    setEditingCryptoId(entry.id);
    setCryptoFormDate(entry.date);
    setCryptoFormCoin(entry.coinName);
    setCryptoFormAmount(entry.amount.toString());
    setCryptoFormPrice(entry.coinPrice !== undefined ? entry.coinPrice.toString() : '');
    setCryptoFormWallet(entry.walletAddress || '');
    setCryptoFormNetwork(entry.network);
    setCryptoFormTxHash(entry.txHash);
    setCryptoFormNotes(entry.notes);
    setCryptoFormType(entry.type || 'in');
    setShowCryptoForm(true);
  };

  const handleDeleteRial = (id: string) => {
    askConfirm(
      lang === 'fa' ? 'حذف تراکنش ریالی' : 'Delete Rial Transaction',
      lang === 'fa' ? `آیا از حذف تراکنش با شناسه ${id} مطمئن هستید؟` : 'Are you sure you want to delete this row?',
      () => {
        setRialEntries((prev) => prev.filter((r) => r.id !== id));
        if (currentUser) {
          deleteDoc(doc(db, 'users', currentUser.uid, 'rialEntries', id)).catch((error) =>
            handleFirestoreError(error, OperationType.DELETE, `users/${currentUser.uid}/rialEntries/${id}`)
          );
        }
      },
      lang === 'fa' ? 'بله، حذف شود' : 'Yes, Delete',
      lang === 'fa' ? 'لغو' : 'Cancel'
    );
  };

  const handleDeleteCrypto = (id: string) => {
    askConfirm(
      lang === 'fa' ? 'حذف تراکنش کریپتو' : 'Delete Crypto Transaction',
      lang === 'fa' ? `آیا از حذف تراکنش با شناسه ${id} مطمئن هستید؟` : 'Are you sure you want to delete this row?',
      () => {
        setCryptoEntries((prev) => prev.filter((c) => c.id !== id));
        if (currentUser) {
          deleteDoc(doc(db, 'users', currentUser.uid, 'cryptoEntries', id)).catch((error) =>
            handleFirestoreError(error, OperationType.DELETE, `users/${currentUser.uid}/cryptoEntries/${id}`)
          );
        }
      },
      lang === 'fa' ? 'بله، حذف شود' : 'Yes, Delete',
      lang === 'fa' ? 'لغو' : 'Cancel'
    );
  };

  const handleOpenConvertModal = (item: CryptoEntry) => {
    setConvertTargetCrypto(item);
    const remaining = item.amount - (item.convertedAmount || 0);
    setConvertCoinAmount(remaining > 0 ? remaining.toString() : item.amount.toString());
    setConvertRialAmount('');
    setConvertExchange(lang === 'fa' ? 'نوبیتکس (Nobitex)' : 'Nobitex');
    setConvertBank('');
    setConvertDate(new Date().toISOString().split('T')[0]);
    setConvertNotes(
      lang === 'fa'
        ? `بابت تبدیل بخشی از رمزارز ${item.coinName} به ریال`
        : `Conversion of part of ${item.coinName} to Rials`
    );
    setConvertError(null);
  };

  const handleConfirmConversion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!convertTargetCrypto) return;

    const coinAmt = parseFloat(convertCoinAmount);
    if (isNaN(coinAmt) || coinAmt <= 0) {
      setConvertError(lang === 'fa' ? 'لطفا مقدار معتبر رمزارز را وارد کنید.' : 'Please enter a valid crypto amount.');
      return;
    }

    const remaining = convertTargetCrypto.amount - (convertTargetCrypto.convertedAmount || 0);
    if (coinAmt > remaining + 0.00001) {
      setConvertError(
        lang === 'fa'
          ? `مقدار انتخابی (${coinAmt}) بیشتر از وزن باقیمانده تراکنش (${remaining.toFixed(4)}) است.`
          : `Entered amount (${coinAmt}) exceeds current remaining balance (${remaining.toFixed(4)}).`
      );
      return;
    }

    const cleanedRialStr = convertRialAmount.replace(/,/g, '');
    const rialAmt = parseFloat(cleanedRialStr);
    if (isNaN(rialAmt) || rialAmt <= 0) {
      setConvertError(lang === 'fa' ? 'لطفا مبلغ ریالی دریافتی را وارد کنید.' : 'Please enter a valid Rial amount.');
      return;
    }

    if (!convertBank.trim()) {
      setConvertError(lang === 'fa' ? 'لطفا نام بانک مقصد را وارد کنید.' : 'Please enter the target bank name.');
      return;
    }

    // Generate unique ID for Rial Entry
    const newRialId = `R-CONV-${Math.floor(1000 + Math.random() * 9000)}`;

    // Create the new Rial Entry
    const newRialEntry: RialEntry = {
      id: newRialId,
      date: convertDate,
      receivedFrom: lang === 'fa' ? `فروش رمزارز (${convertTargetCrypto.coinName})` : `Sold Crypto (${convertTargetCrypto.coinName})`,
      amount: rialAmt,
      bankName: convertBank.trim(),
      notes: convertNotes.trim() || `${lang === 'fa' ? 'تبدیل رمزارز' : 'Crypto conversion'} ${convertTargetCrypto.id}`,
      createdAt: Date.now(),
      type: 'in',
      linkedCryptoId: convertTargetCrypto.id,
      convertedAmountInCrypto: coinAmt,
      conversionExchangeName: convertExchange.trim(),
    };

    // Prepare updated Crypto Entry
    const updatedCryptoEntry: CryptoEntry = {
      ...convertTargetCrypto,
      convertedAmount: (convertTargetCrypto.convertedAmount || 0) + coinAmt,
      linkedRialEntries: [
        ...(convertTargetCrypto.linkedRialEntries || []),
        {
          rialId: newRialId,
          convertedCryptoAmount: coinAmt,
          exchangeName: convertExchange.trim(),
          rialAmount: rialAmt,
          date: convertDate,
        },
      ],
    };

    try {
      if (currentUser) {
        // Write to Firestore securely
        await setDoc(doc(db, 'users', currentUser.uid, 'rialEntries', newRialId), newRialEntry);
        await setDoc(doc(db, 'users', currentUser.uid, 'cryptoEntries', convertTargetCrypto.id), updatedCryptoEntry);
      } else {
        // Local Guest Storage Offline
        setRialEntries((prev) => [newRialEntry, ...prev]);
        setCryptoEntries((prev) =>
          prev.map((e) => (e.id === convertTargetCrypto.id ? updatedCryptoEntry : e))
        );
      }

      // Close Modal and notify
      setConvertTargetCrypto(null);
      alert(
        lang === 'fa'
          ? `تبدیل با موفقیت ثبت شد! فیش بانکی ${newRialId} به حساب رمزارز ${convertTargetCrypto.id} متصل گردید.`
          : `Conversion successfully saved! Receipt ${newRialId} linked to Crypto transaction ${convertTargetCrypto.id}.`
      );
    } catch (err: any) {
      console.error(err);
      setConvertError(lang === 'fa' ? `خطا در ثبت تبدیل: ${err.message}` : `Error saving conversion: ${err.message}`);
    }
  };

  const handleClearDatabase = () => {
    askConfirm(
      lang === 'fa' ? 'پاکسازی کامل دفتر کل' : 'Reset Entire Ledger',
      lang === 'fa' ? 'آیا مایلید تمام تراکنش‌های جاری حذف شده و دفتر کل مجدداً صفر گردد؟' : 'Are you sure you want to completely clear and reset this user database ledger?',
      () => {
        if (currentUser) {
          rialEntries.forEach((r) => {
            deleteDoc(doc(db, 'users', currentUser.uid, 'rialEntries', r.id)).catch((e) => console.error(e));
          });
          cryptoEntries.forEach((c) => {
            deleteDoc(doc(db, 'users', currentUser.uid, 'cryptoEntries', c.id)).catch((e) => console.error(e));
          });
        } else {
          setRialEntries([]);
          setCryptoEntries([]);
        }
      },
      lang === 'fa' ? 'بله، حذف همه' : 'Yes, Reset All',
      lang === 'fa' ? 'لغو' : 'Cancel'
    );
  };

  // Filter Logics
  const filteredRialEntries = useMemo(() => {
    let result = rialEntries.filter((entry) => {
      // Exclude split-related items from the main Rial accounts
      if (entry.id.startsWith('R-SPL-')) {
        return false;
      }

      // 1. Keyword search (Rial)
      const keywordMatch = !rialSearch ? true : (
        entry.receivedFrom.toLowerCase().includes(rialSearch.toLowerCase()) ||
        entry.bankName.toLowerCase().includes(rialSearch.toLowerCase()) ||
        entry.notes.toLowerCase().includes(rialSearch.toLowerCase()) ||
        entry.id.toLowerCase().includes(rialSearch.toLowerCase())
      );

      // 2. Transaction Type ('all' | 'in' | 'out')
      const entryType = entry.type || 'in'; // back-compatibility
      const typeMatch = rialFilterType === 'all' ? true : entryType === rialFilterType;

      // 3. Date Range
      let dateMatch = true;
      if (rialFilterStartDate) {
        dateMatch = dateMatch && entry.date >= rialFilterStartDate;
      }
      if (rialFilterEndDate) {
        dateMatch = dateMatch && entry.date <= rialFilterEndDate;
      }

      // 4. Amount Range
      let amountMatch = true;
      if (rialFilterMinAmount) {
        amountMatch = amountMatch && entry.amount >= parseFloat(rialFilterMinAmount);
      }
      if (rialFilterMaxAmount) {
        amountMatch = amountMatch && entry.amount <= parseFloat(rialFilterMaxAmount);
      }

      return keywordMatch && typeMatch && dateMatch && amountMatch;
    });

    // 5. Sorting
    result = [...result].sort((a, b) => {
      if (rialSortBy === 'date-desc') {
        return b.date.localeCompare(a.date) || b.createdAt - a.createdAt;
      }
      if (rialSortBy === 'date-asc') {
        return a.date.localeCompare(b.date) || a.createdAt - b.createdAt;
      }
      if (rialSortBy === 'amount-desc') {
        return b.amount - a.amount;
      }
      if (rialSortBy === 'amount-asc') {
        return a.amount - b.amount;
      }
      if (rialSortBy === 'sender-asc') {
        return a.receivedFrom.localeCompare(b.receivedFrom, 'fa');
      }
      if (rialSortBy === 'sender-desc') {
        return b.receivedFrom.localeCompare(a.receivedFrom, 'fa');
      }
      return 0;
    });

    return result;
  }, [rialEntries, rialSearch, rialFilterType, rialFilterStartDate, rialFilterEndDate, rialFilterMinAmount, rialFilterMaxAmount, rialSortBy]);

  const filteredCryptoEntries = useMemo(() => {
    let result = cryptoEntries.filter((entry) => {
      // Exclude split and personal expense tracker entries from main ledger
      if (entry.id.startsWith('C-SPL-') || entry.id.startsWith('C-EXP-')) {
        return false;
      }

      // 1. Keyword search (Crypto)
      const keywordMatch = !cryptoSearch ? true : (
        entry.coinName.toLowerCase().includes(cryptoSearch.toLowerCase()) ||
        entry.network.toLowerCase().includes(cryptoSearch.toLowerCase()) ||
        entry.notes.toLowerCase().includes(cryptoSearch.toLowerCase()) ||
        entry.txHash.toLowerCase().includes(cryptoSearch.toLowerCase()) ||
        entry.id.toLowerCase().includes(cryptoSearch.toLowerCase())
      );

      // 2. Transaction Type ('all' | 'in' | 'out')
      const entryType = entry.type || 'in';
      const typeMatch = cryptoFilterType === 'all' ? true : entryType === cryptoFilterType;

      // 3. Date Range
      let dateMatch = true;
      if (cryptoFilterStartDate) {
        dateMatch = dateMatch && entry.date >= cryptoFilterStartDate;
      }
      if (cryptoFilterEndDate) {
        dateMatch = dateMatch && entry.date <= cryptoFilterEndDate;
      }

      // 4. Amount Range
      let amountMatch = true;
      if (cryptoFilterMinAmount) {
        amountMatch = amountMatch && entry.amount >= parseFloat(cryptoFilterMinAmount);
      }
      if (cryptoFilterMaxAmount) {
        amountMatch = amountMatch && entry.amount <= parseFloat(cryptoFilterMaxAmount);
      }

      return keywordMatch && typeMatch && dateMatch && amountMatch;
    });

    // 5. Sorting
    result = [...result].sort((a, b) => {
      if (cryptoSortBy === 'date-desc') {
        return b.date.localeCompare(a.date) || b.createdAt - a.createdAt;
      }
      if (cryptoSortBy === 'date-asc') {
        return a.date.localeCompare(b.date) || a.createdAt - b.createdAt;
      }
      if (cryptoSortBy === 'amount-desc') {
        return b.amount - a.amount;
      }
      if (cryptoSortBy === 'amount-asc') {
        return a.amount - b.amount;
      }
      if (cryptoSortBy === 'coin-asc') {
        return a.coinName.localeCompare(b.coinName);
      }
      if (cryptoSortBy === 'coin-desc') {
        return b.coinName.localeCompare(a.coinName);
      }
      return 0;
    });

    return result;
  }, [cryptoEntries, cryptoSearch, cryptoFilterType, cryptoFilterStartDate, cryptoFilterEndDate, cryptoFilterMinAmount, cryptoFilterMaxAmount, cryptoSortBy]);

  const filteredRialStats = useMemo(() => {
    let inflowTotal = 0;
    let outflowTotal = 0;
    let inflowCount = 0;
    let outflowCount = 0;

    const bankMap: { [key: string]: number } = {};

    filteredRialEntries.forEach((entry) => {
      const type = entry.type || 'in';
      if (type === 'in') {
        inflowTotal += entry.amount;
        inflowCount++;
      } else {
        outflowTotal += entry.amount;
        outflowCount++;
      }

      const bank = entry.bankName ? entry.bankName.trim() : (lang === 'fa' ? 'نامشخص' : 'Unspecified');
      bankMap[bank] = (bankMap[bank] || 0) + entry.amount;
    });

    const netTotal = inflowTotal - outflowTotal;

    const sortedBanks = Object.entries(bankMap)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);

    return {
      inflowTotal,
      outflowTotal,
      inflowCount,
      outflowCount,
      netTotal,
      sortedBanks
    };
  }, [filteredRialEntries, lang]);

  const filteredCryptoStats = useMemo(() => {
    let inflowTotalUsd = 0;
    let outflowTotalUsd = 0;
    let inflowCount = 0;
    let outflowCount = 0;

    const coinMap: { [key: string]: { amount: number; usd: number } } = {};

    filteredCryptoEntries.forEach((entry) => {
      const type = entry.type || 'in';
      const usdValue = entry.equivalentUsd || (entry.amount * (entry.coinPrice || 1));
      if (type === 'in') {
        inflowTotalUsd += usdValue;
        inflowCount++;
      } else {
        outflowTotalUsd += usdValue;
        outflowCount++;
      }

      const coin = entry.coinName ? entry.coinName.trim().toUpperCase() : 'USDT';
      if (!coinMap[coin]) {
        coinMap[coin] = { amount: 0, usd: 0 };
      }
      coinMap[coin].amount += entry.amount;
      coinMap[coin].usd += usdValue;
    });

    const netTotalUsd = inflowTotalUsd - outflowTotalUsd;

    const sortedCoins = Object.entries(coinMap)
      .map(([name, data]) => ({ name, amount: data.amount, usd: data.usd }))
      .sort((a, b) => b.usd - a.usd);

    return {
      inflowTotalUsd,
      outflowTotalUsd,
      inflowCount,
      outflowCount,
      netTotalUsd,
      sortedCoins
    };
  }, [filteredCryptoEntries]);

  // Aggregated calculations for quick stats summary
  const rialStats = useMemo(() => {
    let incoming = 0;
    let outgoing = 0;
    rialEntries.forEach((entry) => {
      // Exclude split-related items from the main Rial account stats
      if (entry.id.startsWith('R-SPL-')) {
        return;
      }
      if (entry.type === 'out') {
        outgoing += entry.amount;
      } else {
        incoming += entry.amount;
      }
    });
    return {
      incoming,
      outgoing,
      net: incoming - outgoing,
      total: incoming + outgoing || 1 // denominator shouldn't be 0
    };
  }, [rialEntries]);

  const totalRialVal = rialStats.total;
  const netRialVal = rialStats.net;

  const cryptoStats = useMemo(() => {
    let incomingUsd = 0;
    let outgoingUsd = 0;
    cryptoEntries.forEach((entry) => {
      // Exclude split and personal expense tracker entries from main crypto account stats
      if (entry.id.startsWith('C-SPL-') || entry.id.startsWith('C-EXP-')) {
        return;
      }
      const usdValue = entry.equivalentUsd !== undefined ? entry.equivalentUsd : (entry.amount * (entry.coinPrice || 1));
      if (entry.type === 'out') {
        outgoingUsd += usdValue;
      } else {
        incomingUsd += usdValue;
      }
    });
    return {
      incomingUsd,
      outgoingUsd,
      netUsd: incomingUsd - outgoingUsd,
      totalUsd: incomingUsd + outgoingUsd || 1 // denominator shouldn't be 0
    };
  }, [cryptoEntries]);

  const totalCryptoUsdVal = cryptoStats.totalUsd;
  const netCryptoUsdVal = cryptoStats.netUsd;

  // Let's create getCryptoPercentage utility
  const getCryptoPercentage = (item: CryptoEntry) => {
    if (item.equivalentUsd !== undefined && totalCryptoUsdVal > 1) {
      return (item.equivalentUsd / totalCryptoUsdVal) * 100;
    }
    // Fallback if USD value not present: relative to same coin total quantity (excluding split entries)
    const sameCoinTotal = cryptoEntries
      .filter((c) => !c.id.startsWith('C-SPL-') && !c.id.startsWith('C-EXP-') && c.coinName.toUpperCase() === item.coinName.toUpperCase())
      .reduce((sum, c) => sum + c.amount, 0);
    return sameCoinTotal > 0 ? (item.amount / sameCoinTotal) * 100 : 0;
  };

  const rialsBySender = useMemo(() => {
    const groups: { [name: string]: { total: number; count: number } } = {};
    rialEntries.forEach((entry) => {
      if (entry.id.startsWith('R-SPL-')) return; // Exclude split
      const name = entry.receivedFrom.trim() || '---';
      if (!groups[name]) {
        groups[name] = { total: 0, count: 0 };
      }
      groups[name].total += entry.amount;
      groups[name].count += 1;
    });
    return Object.entries(groups).map(([name, stats]) => ({
      name,
      total: stats.total,
      count: stats.count,
    })).sort((a, b) => b.total - a.total);
  }, [rialEntries]);

  const rialsByBank = useMemo(() => {
    const groups: { [bank: string]: { total: number; count: number } } = {};
    rialEntries.forEach((entry) => {
      if (entry.id.startsWith('R-SPL-')) return; // Exclude split
      const bank = entry.bankName.trim() || '---';
      if (!groups[bank]) {
        groups[bank] = { total: 0, count: 0 };
      }
      groups[bank].total += entry.amount;
      groups[bank].count += 1;
    });
    return Object.entries(groups).map(([bank, stats]) => ({
      bank,
      total: stats.total,
      count: stats.count,
    })).sort((a, b) => b.total - a.total);
  }, [rialEntries]);

  const rialTrendData = useMemo(() => {
    const dailyMap: { [date: string]: { inflow: number; outflow: number } } = {};
    
    rialEntries.forEach((entry) => {
      if (entry.id.startsWith('R-SPL-')) return; // Exclude split
      const dateStr = entry.date || '---';
      if (!dailyMap[dateStr]) {
        dailyMap[dateStr] = { inflow: 0, outflow: 0 };
      }
      const amt = entry.amount || 0;
      if (entry.type === 'out') {
        dailyMap[dateStr].outflow += amt;
      } else {
        dailyMap[dateStr].inflow += amt;
      }
    });

    const sortedData = Object.entries(dailyMap)
      .map(([date, values]) => ({
        date,
        inflow: values.inflow,
        outflow: values.outflow,
        net: values.inflow - values.outflow
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return sortedData;
  }, [rialEntries]);

  const filteredTrendData = useMemo(() => {
    if (trendTimeframe === 0) return rialTrendData;
    return rialTrendData.slice(-trendTimeframe);
  }, [rialTrendData, trendTimeframe]);

  const formatChartYAxis = (value: number) => {
    if (value >= 1_000_000_000) {
      return `${(value / 1_000_000_000).toFixed(1)}B`;
    }
    if (value >= 1_000_000) {
      return `${(value / 1_000_000).toFixed(1)}M`;
    }
    if (value >= 1_000) {
      return `${(value / 1_000).toFixed(0)}K`;
    }
    return value.toString();
  };

  const linkedSplitPurchases = useMemo(() => {
    const list: Array<{
      id: string;
      type: 'split' | 'personal';
      title: string;
      partnerName?: string;
      date: string;
      cryptoAmount: number;
      coinName: string;
      network: string;
      rialAmount?: number;
      bankName?: string;
      settleType?: 'rial' | 'crypto';
      settleCryptoAmount?: number;
      settleCoinName?: string;
      notes: string;
      cryptoId?: string;
      rialId?: string;
      cryptoRefundId?: string;
      isInstallment?: boolean;
      installmentTotal?: number;
      installmentPaid?: number;
      walletAddress?: string;
      txHash?: string;
    }> = [];

    cryptoEntries.forEach((crypto) => {
      if (crypto.type !== 'out') return;

      const isPersonal = crypto.notes.includes('[مخارج شخصی]') || crypto.notes.includes('[Personal Expense]') || crypto.notes.includes('[خرید شخصی]');
      const isSplit = crypto.notes.includes('[خرید اشتراکی]') || crypto.notes.includes('[Shared/Split Purchase]') || crypto.id.startsWith('C-SPL-');

      if (isPersonal) {
        let title = crypto.notes
          .replace(/\[مخارج شخصی\]/, '')
          .replace(/\[خرید شخصی\]/, '')
          .replace(/\[Personal Expense\]/, '')
          .split('. پرداخت من:')[0]
          .split('. Spent:')[0]
          .split(' [قسطی')[0]
          .split(' [Installments')[0]
          .trim();

        list.push({
          id: crypto.id,
          type: 'personal',
          title: title || (lang === 'fa' ? 'مخارج شخصی خودم' : 'Personal Expense'),
          date: crypto.date,
          cryptoAmount: crypto.amount,
          coinName: crypto.coinName,
          network: crypto.network,
          notes: crypto.notes,
          cryptoId: crypto.id,
          isInstallment: crypto.isInstallment,
          installmentTotal: crypto.installmentTotal,
          installmentPaid: crypto.installmentPaid,
          walletAddress: crypto.walletAddress,
          txHash: crypto.txHash
        });
      } else if (isSplit) {
        let title = crypto.notes
          .replace(/\[خرید اشتراکی \/ دونگ\]/, '')
          .replace(/\[Shared\/Split Purchase\]/, '')
          .replace(/\[خرید اشتراکی\]/, '')
          .split(' با ')[0]
          .trim();

        const rialRefund = rialEntries.find(r => r.linkedCryptoId === crypto.id || r.notes.includes(crypto.id) || (r.date === crypto.date && r.type === 'in' && r.notes.includes(crypto.id)));
        const cryptoRefund = cryptoEntries.find(c => c.type === 'in' && (c.id.startsWith('C-SPL-REF-') || c.id.startsWith('C-REF-') || c.notes.includes(crypto.id)));

        let partnerName = '';
        if (rialRefund) {
          partnerName = rialRefund.receivedFrom;
        } else if (cryptoRefund) {
          const matchPartner = cryptoRefund.notes.match(/شریک\s+([^\s\.]+)/) || cryptoRefund.notes.match(/From\s+([^\s\.]+)/);
          partnerName = matchPartner ? matchPartner[1] : (lang === 'fa' ? 'شریک' : 'Partner');
        } else {
          const matchPartner = crypto.notes.match(/با\s+([^\s\.]+)/) || crypto.notes.match(/with\s+([^\s\.]+)/);
          partnerName = matchPartner ? matchPartner[1] : (lang === 'fa' ? 'شریک' : 'Partner');
        }

        if (rialRefund) {
          list.push({
            id: crypto.id,
            type: 'split',
            title: title || (lang === 'fa' ? 'خرید اشتراکی ریالی' : 'Shared Rial Split'),
            partnerName: partnerName,
            date: crypto.date,
            cryptoAmount: crypto.amount,
            coinName: crypto.coinName,
            network: crypto.network,
            settleType: 'rial',
            rialAmount: rialRefund.amount,
            bankName: rialRefund.bankName,
            notes: crypto.notes,
            cryptoId: crypto.id,
            rialId: rialRefund.id,
            walletAddress: crypto.walletAddress,
            txHash: crypto.txHash
          });
        } else if (cryptoRefund) {
          list.push({
            id: crypto.id,
            type: 'split',
            title: title || (lang === 'fa' ? 'خرید اشتراکی ارزی' : 'Shared Crypto Split'),
            partnerName: partnerName,
            date: crypto.date,
            cryptoAmount: crypto.amount,
            coinName: crypto.coinName,
            network: crypto.network,
            settleType: 'crypto',
            settleCryptoAmount: cryptoRefund.amount,
            settleCoinName: cryptoRefund.coinName,
            notes: crypto.notes,
            cryptoId: crypto.id,
            cryptoRefundId: cryptoRefund.id,
            walletAddress: crypto.walletAddress,
            txHash: crypto.txHash
          });
        } else {
          list.push({
            id: crypto.id,
            type: 'split',
            title: title || (lang === 'fa' ? 'خرید اشتراکی' : 'Shared Expense'),
            partnerName: partnerName,
            date: crypto.date,
            cryptoAmount: crypto.amount,
            coinName: crypto.coinName,
            network: crypto.network,
            settleType: 'rial',
            rialAmount: 0,
            bankName: '---',
            notes: crypto.notes,
            cryptoId: crypto.id,
            walletAddress: crypto.walletAddress,
            txHash: crypto.txHash
          });
        }
      }
    });

    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [rialEntries, cryptoEntries, lang]);

  const cryptoBreakdown = useMemo(() => {
    const groups: { [coin: string]: { [network: string]: number } } = {};
    const coinTotals: { [coin: string]: number } = {};

    cryptoEntries.forEach((entry) => {
      // Exclude split-related and expense tracker entries from main balance breakdown
      if (entry.id.startsWith('C-SPL-') || entry.id.startsWith('C-EXP-')) {
        return;
      }
      const coin = entry.coinName.trim().toUpperCase() || 'UNKNOWN';
      const net = entry.network.trim().toUpperCase() || 'MAINNET';

      if (!groups[coin]) groups[coin] = {};
      groups[coin][net] = (groups[coin][net] || 0) + entry.amount;

      coinTotals[coin] = (coinTotals[coin] || 0) + entry.amount;
    });

    return { groups, coinTotals };
  }, [cryptoEntries]);

  // AI query posting to backend custom server
  const handleQueryAIChat = async (forcedQuery?: string) => {
    const queryToSubmit = forcedQuery || aiInput;
    if (!queryToSubmit.trim()) return;

    // Push User message
    const updatedHistory = [...aiHistory, { sender: 'user' as const, text: queryToSubmit }];
    setAiHistory(updatedHistory);
    if (!forcedQuery) setAiInput('');
    setAiLoading(true);

    try {
      const apiBase = import.meta.env.VITE_API_URL || '';
      const response = await fetch(`${apiBase}/api/gemini/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: queryToSubmit,
          rialEntries,
          cryptoEntries,
          language: lang,
        }),
      });

      const data = await response.json();
      if (data.error) {
        setAiHistory((prev) => [
          ...prev,
          { sender: 'ai', text: `خطا در اجرای حسابرسی هوش مصنوعی: ${data.error}` }
        ]);
      } else {
        setAiHistory((prev) => [
          ...prev,
          { sender: 'ai', text: data.answer || 'پاسخی یافت نشد.' }
        ]);
      }
    } catch (err: any) {
      console.error(err);
      setAiHistory((prev) => [
        ...prev,
        {
          sender: 'ai',
          text: lang === 'fa' 
            ? 'خطا در برقراری ارتباط با مدل هوش مصنوعی. لطفاً بررسی کنید که سرور ما به درستی فعال باشد یا کلید API آن درست ست شده باشد.'
            : 'Unreachable server backend for AI Accountant. Ensure key configurations exist.'
        }
      ]);
    } finally {
      setAiLoading(false);
    }
  };

  const handleDownloadStandardExcelTemplate = () => {
    try {
      // 1. Rial Entries sheet (Persian template headers mapped nicely)
      const rialData = [
        {
          "تاریخ (YYYY-MM-DD)": "2026-05-25",
          "نام واریز کننده (Name)": "علی رضایی",
          "مبلغ ریالی به تومان (Toman)": 25000000,
          "نام بانک مقصد (Bank)": "بانک ملت",
          "توضیحات (Notes)": "تسویه فاز اول همکاری تجاری",
          "نوع (Type - in/out)": "in"
        },
        {
          "تاریخ (YYYY-MM-DD)": "2026-05-26",
          "نام واریز کننده (Name)": "شرکت تریدرز کلاب",
          "مبلغ ریالی به تومان (Toman)": 12000000,
          "نام بانک مقصد (Bank)": "بانک سامان",
          "توضیحات (Notes)": "پورسانت معرفی همکاران",
          "نوع (Type - in/out)": "out"
        }
      ];

      // 2. Crypto Entries sheet
      const cryptoData = [
        {
          "تاریخ (YYYY-MM-DD)": "2026-05-25",
          "نام کوین (Coin - e.g. USDT)": "USDT",
          "مقدار عددی (Amount)": 1500,
          "قیمت واحد دلار (Price USD)": 1.00,
          "آدرس ولت (Wallet Address)": "TYv2oH2P16vX3D9X8Gz49j",
          "شبکه انتقال (Network)": "TRC-20",
          "کد رهگیری تراکنش (TxHash)": "9f7a8b6c5d4e3f2a1b0c",
          "توضیحات (Notes)": "بستن معامله صندوق آربیتراژ تتر",
          "نوع (Type - in/out)": "in"
        },
        {
          "تاریخ (YYYY-MM-DD)": "2026-05-27",
          "نام کوین (Coin - e.g. USDT)": "TON",
          "مقدار عددی (Amount)": 280,
          "قیمت واحد دلار (Price USD)": 7.25,
          "آدرس ولت (Wallet Address)": "EQBvW3D9X8Gz49jTYv2oH2P16v",
          "شبکه انتقال (Network)": "TON",
          "کد رهگیری تراکنش (TxHash)": "7c1d3e2a9b8c0d5e4f1a",
          "توضیحات (Notes)": "خرید و جابجایی کارمزد گاز در تون‌کیپر",
          "نوع (Type - in/out)": "in"
        }
      ];

      const wb = XLSX.utils.book_new();
      const wsRial = XLSX.utils.json_to_sheet(rialData);
      const wsCrypto = XLSX.utils.json_to_sheet(cryptoData);

      XLSX.utils.book_append_sheet(wb, wsRial, "Rial Entries");
      XLSX.utils.book_append_sheet(wb, wsCrypto, "Crypto Entries");

      XLSX.writeFile(wb, "Traders_Hub_Excel_Template.xlsx");
    } catch (err: any) {
      alert(`خطا در ایجاد نمونه فایل اکسل: ${err.message}`);
    }
  };

  const handleParseBulkAI = async () => {
    if (!pastedText.trim()) {
      setParseError(lang === 'fa' ? 'لطفاً ابتدا متنی را کپی کرده یا فایلی آپلود کنید.' : 'Please paste some text or upload a file first.');
      return;
    }
    setIsParsingText(true);
    setParseError(null);
    setParsedRialResults([]);
    setParsedCryptoResults([]);

    try {
      const apiBase = import.meta.env.VITE_API_URL || '';
      const response = await fetch(`${apiBase}/api/gemini/parse-records`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ dataText: pastedText }),
      });

      if (!response.ok) {
        throw new Error(`Server returned status code ${response.status}`);
      }

      const data = await response.json();
      if (data.error) {
        setParseError(data.error);
        return;
      }

      const rawRials: any[] = data.rialEntries || [];
      const rawCryptos: any[] = data.cryptoEntries || [];

      // Map raw items properly to official interface structure
      const rials = rawRials.map((r, i) => ({
        id: `R-AI-${Math.floor(1000 + Math.random() * 9000)}-${i}`,
        date: r.date || new Date().toISOString().split('T')[0],
        receivedFrom: r.receivedFrom || 'نامشخص',
        amount: Number(r.amount) || 0,
        bankName: r.bankName || 'نامشخص',
        notes: r.notes || 'پردازش شده با هوش مصنوعی',
        createdAt: Date.now() + i,
        type: r.type || 'in',
      }));

      const cryptos = rawCryptos.map((c, i) => ({
        id: `C-AI-${Math.floor(1000 + Math.random() * 9000)}-${i}`,
        date: c.date || new Date().toISOString().split('T')[0],
        coinName: (c.coinName || 'USDT').toUpperCase(),
        amount: Number(c.amount) || 0,
        coinPrice: c.coinPrice !== undefined ? Number(c.coinPrice) : 1,
        equivalentUsd: c.equivalentUsd !== undefined ? Number(c.equivalentUsd) : (Number(c.amount) || 0) * (Number(c.coinPrice) || 1),
        walletAddress: c.walletAddress || '',
        network: (c.network || 'TRC-20').toUpperCase(),
        txHash: c.txHash || '',
        notes: c.notes || 'پردازش شده با هوش مصنوعی',
        createdAt: Date.now() + i,
        type: c.type || 'in',
      }));

      if (rials.length === 0 && cryptos.length === 0) {
        setParseError(lang === 'fa' 
          ? 'هیچ تراکنش معتبری در متن وارد شده یافت نشد. لطفاً مطمئن شوید متنی که فرستاده‌اید درست کپی شده باشد یا ستون‌های مناسب مایه داشته باشد.' 
          : 'No valid transactions detected. Make sure your input contains recognizable ledger numbers or details.');
      } else {
        setParsedRialResults(rials);
        setParsedCryptoResults(cryptos);
      }
    } catch (err: any) {
      console.error(err);
      setParseError(lang === 'fa' ? `خطا در برقراری ارتباط با هوش مصنوعی: ${err.message}` : `AI communication error: ${err.message}`);
    } finally {
      setIsParsingText(false);
    }
  };

  const handleSaveBulkImported = async () => {
    const rialsToSave = [...parsedRialResults];
    const cryptosToSave = [...parsedCryptoResults];

    try {
      if (currentUser) {
        for (const entry of rialsToSave) {
          await setDoc(doc(db, 'users', currentUser.uid, 'rialEntries', entry.id), entry);
        }
        for (const entry of cryptosToSave) {
          await setDoc(doc(db, 'users', currentUser.uid, 'cryptoEntries', entry.id), entry);
        }
      } else {
        setRialEntries((prev) => [...rialsToSave, ...prev]);
        setCryptoEntries((prev) => [...cryptosToSave, ...prev]);
      }

      alert(lang === 'fa' 
        ? `تراکنش‌های استخراج شده با موفقیت به دفتر ثبت اضافه شدند (${rialsToSave.length} ردیف ریالی و ${cryptosToSave.length} کریپتو).` 
        : `Extracted records saved successfully (${rialsToSave.length} Rial, ${cryptosToSave.length} Crypto).`);

      setParsedRialResults([]);
      setParsedCryptoResults([]);
      setPastedText('');
      setParseError(null);
      setShowAiBulkModal(false);
    } catch (err: any) {
      alert(`خطا در ثبت گروهی: ${err.message}`);
    }
  };

  return (
    <div id="applet-container" className="min-h-screen bg-[#0A0B0D] font-sans antialiased text-white pb-12 selection:bg-emerald-400 selection:text-black">
      {/* 1. SECURITY LOCK & ONBOARDING GATE */}
      {isLocked && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0A0B0D] overflow-y-auto">
          <div className="w-full max-w-lg bg-[#14161A] border-4 border-black border-dashed rounded-3xl p-6 sm:p-10 shadow-[0_25px_60px_rgba(0,0,0,0.8)] relative mt-8 mb-8">
            {/* Top Branding */}
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 rounded-lg bg-emerald-400 flex items-center justify-center shadow-[0_0_15px_rgba(52,211,153,0.5)]">
                  <TrendingUp className="h-6 w-6 text-black" />
                </div>
                <div>
                  <h1 className="text-xl font-black uppercase tracking-tight text-emerald-400">
                    TRADERS HUB <span className="text-white">PRO</span>
                  </h1>
                </div>
              </div>
              
              {/* Language Selector */}
              <button
                onClick={() => setLang(lang === 'fa' ? 'en' : 'fa')}
                className="flex items-center gap-1.5 px-3 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-black transition-all text-white"
              >
                <Globe className="h-3.5 w-3.5 text-emerald-400" />
                <span>{lang === 'fa' ? 'EN' : 'فا'}</span>
              </button>
            </div>

            {/* Core Message */}
            <div className="space-y-2 text-right mb-6" style={{ direction: lang === 'fa' ? 'rtl' : 'ltr' }}>
              <div className="flex items-center gap-2 text-white font-black text-lg">
                <Lock className="h-5 w-5 text-rose-400 shrink-0" />
                <h2 className="text-md sm:text-lg font-black">{t.authGateTitle}</h2>
              </div>
              <p className="text-xs text-white/50 leading-relaxed font-semibold">
                {t.authGateDesc}
              </p>
            </div>

            {/* Segmented Auth Selector */}
            <div className="grid grid-cols-3 bg-[#0A0B0D] p-1 border border-white/5 rounded-xl mb-6">
              <button
                onClick={() => { setAuthMode('signin'); setAuthError(null); }}
                className={`py-2 px-1 text-xs font-black rounded-lg transition-all ${
                  authMode === 'signin' ? 'bg-white/10 text-emerald-400' : 'text-white/40 hover:text-white'
                }`}
              >
                {t.signInTab}
              </button>
              <button
                onClick={() => { setAuthMode('signup'); setAuthError(null); }}
                className={`py-2 px-1 text-xs font-black rounded-lg transition-all ${
                  authMode === 'signup' ? 'bg-white/10 text-emerald-400' : 'text-white/40 hover:text-white'
                }`}
              >
                {t.signUpTab}
              </button>
              <button
                onClick={() => { setAuthMode('guest'); setAuthError(null); }}
                className={`py-2 px-1 text-xs font-black rounded-lg transition-all ${
                  authMode === 'guest' ? 'bg-white/10 text-emerald-400' : 'text-white/40 hover:text-white'
                }`}
              >
                {t.guestTab}
              </button>
            </div>

            {/* Errors Panel */}
            {authError && (
              <div className="bg-rose-500/10 border border-rose-500/25 p-3 rounded-xl flex items-start gap-2 text-xs text-rose-300 mb-6 text-right" style={{ direction: lang === 'fa' ? 'rtl' : 'ltr' }}>
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span className="font-semibold">{authError}</span>
              </div>
            )}

            {/* Onboarding Input Modules */}
            {authMode === 'signin' && (
              <form onSubmit={handleEmailSignInSubmit} className="space-y-4 text-right" style={{ direction: lang === 'fa' ? 'rtl' : 'ltr' }}>
                <div className="space-y-1.5">
                  <label className="block text-xs font-black text-white/50 uppercase tracking-widest">{t.emailLabel}</label>
                  <input
                    type="email"
                    required
                    placeholder="email@example.com"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="w-full px-4 py-3 bg-[#0A0B0D] border border-white/10 focus:border-emerald-400 focus:outline-none rounded-xl text-sm text-left font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-black text-white/50 uppercase tracking-widest">{t.passwordLabel}</label>
                  <input
                    type="password"
                    required
                    placeholder="******"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="w-full px-4 py-3 bg-[#0A0B0D] border border-white/10 focus:border-emerald-400 focus:outline-none rounded-xl text-sm text-left font-mono"
                  />
                </div>
                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-3 bg-emerald-400 hover:bg-emerald-300 text-black font-black text-xs uppercase tracking-wider rounded-xl shadow-[0_5px_20px_rgba(52,211,153,0.3)] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Key className="h-4 w-4" />
                  {authLoading ? '...' : t.signInAction}
                </button>
              </form>
            )}

            {authMode === 'signup' && (
              <form onSubmit={handleEmailSignUpSubmit} className="space-y-4 text-right" style={{ direction: lang === 'fa' ? 'rtl' : 'ltr' }}>
                <div className="space-y-1.5">
                  <label className="block text-xs font-black text-white/50 uppercase tracking-widest">{t.displayNameLabel}</label>
                  <input
                    type="text"
                    required
                    placeholder={lang === 'fa' ? 'به فارسی بنویسید (مثلاً: امیرعلی)' : 'Full Name'}
                    value={displayNameInput}
                    onChange={(e) => setDisplayNameInput(e.target.value)}
                    className="w-full px-4 py-3 bg-[#0A0B0D] border border-white/10 focus:border-emerald-400 focus:outline-none rounded-xl text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-black text-white/50 uppercase tracking-widest">{t.emailLabel}</label>
                  <input
                    type="email"
                    required
                    placeholder="email@example.com"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="w-full px-4 py-3 bg-[#0A0B0D] border border-white/10 focus:border-emerald-400 focus:outline-none rounded-xl text-sm text-left font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-black text-white/50 uppercase tracking-widest">{t.passwordLabel}</label>
                  <input
                    type="password"
                    required
                    placeholder="******"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="w-full px-4 py-3 bg-[#0A0B0D] border border-white/10 focus:border-emerald-400 focus:outline-none rounded-xl text-sm text-left font-mono"
                  />
                </div>
                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-3 bg-indigo-500 hover:bg-indigo-400 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-[0_5px_20px_rgba(99,102,241,0.3)] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <User className="h-4 w-4" />
                  {authLoading ? '...' : t.signUpAction}
                </button>
              </form>
            )}

            {authMode === 'guest' && (
              <form onSubmit={handleGuestOnboardingSubmit} className="space-y-4 text-right" style={{ direction: lang === 'fa' ? 'rtl' : 'ltr' }}>
                <div className="space-y-1.5">
                  <label className="block text-xs font-black text-white/50 uppercase tracking-widest">{t.displayNameLabel}</label>
                  <input
                    type="text"
                    required
                    placeholder={lang === 'fa' ? 'نام نمایشی شما (مثلاً: علی احمدی)' : 'Guest Username'}
                    value={displayNameInput}
                    onChange={(e) => setDisplayNameInput(e.target.value)}
                    className="w-full px-4 py-3 bg-[#0A0B0D] border border-white/10 focus:border-emerald-400 focus:outline-none rounded-xl text-sm text-right"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-3 bg-white/10 hover:bg-white/15 text-white font-black text-xs uppercase tracking-wider rounded-xl border border-white/10 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="h-4 w-4 text-amber-400" />
                  {t.guestAction}
                </button>
              </form>
            )}

            <div className="relative my-6 text-center">
              <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[1px] bg-white/10"></span>
              <span className="relative z-10 px-3 bg-[#14161A] text-[10px] font-black uppercase text-white/35 tracking-widest">{t.orText}</span>
            </div>

            {/* Google Authentication Direct Sheet Trigger */}
            <button
              onClick={handleGoogleLogin}
              disabled={authLoading}
              className="w-full py-3 bg-white hover:bg-slate-150 text-black font-black text-xs uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 shadow-xl cursor-pointer"
            >
              <Database className="h-4 w-4 text-emerald-500 animate-bounce" />
              <span>{t.googleSyncAccess}</span>
            </button>

            {/* Iframe Safety Link for frictionless Google Auth */}
            {isInIframe && (
              <div className="mt-4 p-4 bg-amber-400/[0.04] border border-amber-400/20 rounded-2xl flex flex-col gap-2.5 text-right" style={{ direction: lang === 'fa' ? 'rtl' : 'ltr' }}>
                <div className="flex items-center gap-2 text-amber-300 font-bold text-xs" style={{ justifyContent: lang === 'fa' ? 'start' : 'end' }}>
                  <AlertCircle className="h-4 w-4 text-amber-400 shrink-0" />
                  <span>{lang === 'fa' ? 'توجه: شبیه‌ساز امن مروگر شناسایی شد' : 'Notice: Preview Sub-Frame Detected'}</span>
                </div>
                <p className="text-[10.5px] leading-relaxed text-white/70 font-medium">
                  {lang === 'fa'
                    ? 'به دلیل قوانین ویژه امنیتی مرورگرها در لایه فریم (iframe)، ورود مستقیم با گوگل نیازمند باز بودن مستقل برنامه است. برای باز کردن بدون مشکل برنامه در تب جدید کلیک کنید:'
                    : 'To bypassed secure sandboxing rules blocking third-party Google Auth popups in mock iframe containers, open this applet independently in a new tab:'}
                </p>
                <button
                  type="button"
                  onClick={() => window.open(window.location.href, '_blank')}
                  className="w-full py-2 bg-gradient-to-r from-emerald-500 to-indigo-500 hover:scale-[1.01] active:scale-[0.99] text-white font-black text-[11px] uppercase tracking-wider rounded-xl shadow-lg cursor-pointer transition-all text-center"
                >
                  {lang === 'fa' ? '🔗 باز کردن لوکیشن برنامه در تب جدید' : '🔗 Open Web Application in New Tab'}
                </button>
              </div>
            )}

            {/* Interactive Troubleshooting Guide Section */}
            <div className="mt-5 border-t border-white/10 pt-4" style={{ direction: lang === 'fa' ? 'rtl' : 'ltr' }}>
              <button
                type="button"
                onClick={() => setShowSetupGuide(!showSetupGuide)}
                className="w-full flex items-center justify-between text-xs font-bold text-amber-400 hover:text-amber-300 transition-all focus:outline-none"
              >
                <span className="flex items-center gap-1.5 text-left">
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                  </span>
                  <span>{lang === 'fa' ? '💡 راهنمای حل فوری خطاهای اتصال (فایربیس / گوگل)' : '💡 Instant Firebase / Google Auth Fix Guide'}</span>
                </span>
                <span className="text-sm font-semibold leading-none">{showSetupGuide ? '−' : '+'}</span>
              </button>

              {showSetupGuide && (
                <div className="mt-3.5 space-y-4 text-xs bg-amber-400/[0.03] border border-amber-400/20 rounded-xl p-4 text-right leading-relaxed text-slate-300">
                  
                  {/* Error 1: Email Password sign up */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-amber-400 font-black">
                      <span className="bg-amber-400/20 text-amber-300 px-1.5 py-0.5 rounded text-[10px] font-mono">1</span>
                      <h4>{lang === 'fa' ? 'حل خطای (auth/operation-not-allowed) هنگام ایجاد حساب:' : 'Fix (auth/operation-not-allowed) during Signup:'}</h4>
                    </div>
                    <p className="text-white/70 font-semibold text-[11px]">
                      {lang === 'fa' 
                        ? 'این خطا یعنی روش ورود با «ایمیل و رمزعبور» در تنظیمات کنسول فایربیس شما هنوز فعال نشده است. برای حل سریع:' 
                        : 'This means the "Email/Password" provider is disabled inside your Firebase Project. To enable:'}
                    </p>
                    <ol className="list-decimal list-inside pr-1 text-white/60 space-y-1">
                      <li>{lang === 'fa' ? 'وارد کنسول فایربیس (Firebase Console) شوید.' : 'Go to your Firebase Console.'}</li>
                      <li>{lang === 'fa' ? 'از منوی سمت چپ به بخش Authentication وارد شده و تب Sign-in method را باز کنید.' : 'Go to Authentication in the left sidebar, then open the "Sign-in method" tab.'}</li>
                      <li>{lang === 'fa' ? 'روی Add new provider کلیک کنید، گزینه Email/Password را انتخاب کرده، آن را فعال (Enable) و ذخیره کنید.' : 'Click "Add new provider", select "Email/Password", toggle to "Enable", and hit Save.'}</li>
                    </ol>
                  </div>

                  {/* Error 2: Google Verification blocks */}
                  <div className="space-y-1 pt-3.5 border-t border-white/5">
                    <div className="flex items-center gap-1.5 text-amber-400 font-black">
                      <span className="bg-amber-400/20 text-amber-300 px-1.5 py-0.5 rounded text-[10px] font-mono">2</span>
                      <h4>{lang === 'fa' ? 'حل خطای مسدود شدن ورود با گوگل (Google Verification Process):' : 'Fix Google Verification Blocked Error:'}</h4>
                    </div>
                    <p className="text-white/70 font-semibold text-[11px]">
                      {lang === 'fa'
                        ? 'اگر گوگل اجازه اجرای لاگین را نمی‌دهد، به این دلیل است که شناسه پروژه شما هنوز تایید تجاری عمومی نشده و در فاز توسعه (Testing) است. برای معافیت فوری ایمیل خود:'
                        : 'If Google blocks access with "Has not completed verification", it is because your Google Cloud project is in Testing mode. To bypass immediately:'}
                    </p>
                    <ol className="list-decimal list-inside pr-1 text-white/60 space-y-1">
                      <li>{lang === 'fa' ? 'وارد کنسول گوگل کلاود (Google Cloud Console) مربوط به پروژه خود شوید.' : 'Open the Google Cloud Console for your project.'}</li>
                      <li>{lang === 'fa' ? 'از منوی اصلی وارد APIs & Services شده و صفحه OAuth consent screen را باز کنید.' : 'Go to main menu > APIs & Services > OAuth consent screen.'}</li>
                      <li>{lang === 'fa' ? 'به سمت پایین اسکرول کنید و زیر بخش Test users، دکمه ADD USERS را بزنید و آدرس ایمیل خود (مانند mfbvoice80@gmail.com) را اضافه و ذخیره نمایید.' : 'Scroll to "Test users", click "ADD USERS", write your gmail (e.g. mfbvoice80@gmail.com), and save.'}</li>
                    </ol>
                  </div>

                  {/* Bonus Bypass: Guest Mode */}
                  <div className="bg-emerald-400/5 border border-emerald-400/20 rounded-lg p-3 text-center text-[10.5px] text-emerald-300">
                    💡 {lang === 'fa' ? 'عجله دارید؟ تب «مهمان» را از بالای همین فرم انتخاب کنید! در این حالت تمام بخش‌های دیتابیس لوکال و هوش محاسباتی AI به صورت ایمن بدون نیاز به فایربیس فوراً برای شما آماده به کار خواهد بود.' : 'In a hurry? Toggle the "Guest Profile" tab at the top of this card! You can use 100% of the ledger tracker, edit records, and query the accountant AI instantly using off-grid browser local-storage.'}
                  </div>

                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* HEADER SECTION (HIDDEN ON PRINT) */}
      {!isLocked && (
        <header className="no-print border-b border-white/10 bg-[#0A0B0D]/50 sticky top-0 z-40 backdrop-blur-md px-4 sm:px-8 h-20 flex items-center select-none" style={{ direction: lang === 'fa' ? 'rtl' : 'ltr' }}>
          <div className="max-w-7xl w-full mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            
            {/* Logo & Project Title in Bold Theme */}
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-lg bg-emerald-400 flex items-center justify-center shadow-[0_0_15px_rgba(52,211,153,0.4)]">
                <TrendingUp className="h-6 w-6 text-black" />
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tighter leading-none text-emerald-400 uppercase">
                  TRADERSHUB <span className="text-white">PRO</span>
                </h1>
                <span className="text-[10px] uppercase tracking-[0.2em] font-black text-white/40 block mt-0.5" style={{ letterSpacing: '0.15em' }}>
                  {guestName ? `${t.profileNameText} ${guestName} (${t.accTypeGuest})` : (currentUser ? `${t.profileNameText} ${currentUser.displayName || currentUser.email}` : 'TRADING LEDGER')}
                </span>
              </div>
            </div>

            {/* Language & Authentication controllers */}
            <div className="flex items-center flex-wrap gap-2 sm:gap-3">
              {/* Language Switch */}
              <button
                onClick={() => setLang(lang === 'fa' ? 'en' : 'fa')}
                className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-black text-white flex items-center gap-1 cursor-pointer"
              >
                <Globe className="h-3.5 w-3.5 text-emerald-400" />
                <span>{lang === 'fa' ? 'ENGLISH' : 'فارسی'}</span>
              </button>

              {/* Guest Profile Exit Shortcut */}
              {guestName && (
                <button
                  onClick={handleLogout}
                  className="px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded-lg text-xs font-black text-rose-400 flex items-center gap-1.5 cursor-pointer transition-all hover:scale-[1.02]"
                >
                  <LogOut className="h-3.5 w-3.5 animate-pulse" />
                  <span>{lang === 'fa' ? 'خروج از حالت مهمان (ورود با ایمیل یا ثبت‌نام)' : 'Exit Guest Profile (Email Login & Sign-up)'}</span>
                </button>
              )}

              {/* Device Auto-Detected System Mode Badge */}
              <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs select-none">
                {isMobileDevice ? (
                  <>
                    <span className="text-amber-400 font-bold">📱</span>
                    <span className="text-amber-400 font-black text-[10px] tracking-wider uppercase font-mono">
                      {lang === 'fa' ? 'حالت موبایل' : 'Mobile Web App'}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-sky-400 font-bold">💻</span>
                    <span className="text-sky-400 font-black text-[10px] tracking-wider uppercase font-mono">
                      {lang === 'fa' ? 'حالت سیستم دسکتاپ' : 'System Desktop'}
                    </span>
                  </>
                )}
              </div>

              {/* Status Badge */}
              <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white/80 font-semibold">
                <div className="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></div>
                <span className="font-mono text-emerald-400 uppercase">
                  {currentUser ? (accessToken ? 'SYNC ENABLED' : 'EMAIL SECURE') : 'LOCAL WORKSPACE'}
                </span>
                <button
                  onClick={handleLogout}
                  title={lang === 'fa' ? 'خروج از حساب' : 'Log Out'}
                  className="mr-1.5 p-1 text-rose-400 hover:text-rose-300 transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Quick Config */}
              <button
                onClick={() => setShowConfigModal(true)}
                title={t.googleSheetsSettings}
                className="p-2 border border-white/10 bg-white/5 hover:bg-white/10 rounded-lg text-white/60 hover:text-white transition-colors"
              >
                <Settings className="h-4 w-4" />
              </button>
            </div>
          </div>
        </header>
      )}

      {/* CORE INFO BAR - GOOGLE SHEETS & GOOGLE DRIVE CLOUD SYNC DASHBOARDS (no-print) */}
      {!isLocked && (
        <section className="no-print max-w-7xl mx-auto mt-6 px-4 sm:px-8" style={{ direction: lang === 'fa' ? 'rtl' : 'ltr' }}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Card 1: Google Sheets Live Sync */}
            <div className="bg-[#14161A] border-2 border-black rounded-2xl p-5 shadow-2xl flex flex-col justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="p-3 bg-emerald-400/10 border border-emerald-400/20 text-emerald-400 rounded-xl">
                  <FileSpreadsheet className="h-6 w-6" />
                </div>
                <div className="text-right">
                  <h2 className="font-black text-sm text-white uppercase tracking-tight">{t.googleSheetsSettings}</h2>
                  <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-white/50">
                    {syncState.spreadsheetId ? (
                      <>
                        <span className="flex items-center gap-1 text-emerald-400 font-bold">
                          <CheckCircle className="h-3 w-3" />
                          {t.activeSheet}
                        </span>
                        <span>•</span>
                        <a
                          href={syncState.spreadsheetUrl || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-amber-400 hover:underline flex items-center gap-1"
                        >
                          <span>{lang === 'fa' ? 'مشاهده زنده شیت کل' : 'Open Spreadsheet'}</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </>
                    ) : (
                      <span className="text-slate-400 flex items-center gap-1">
                        <AlertCircle className="h-3.5 w-3.5 text-slate-500" />
                        {lang === 'fa' ? 'شیت متصل نیست. برای همگام‌ساز آنلاین روی دکمه راست کلیک کنید.' : 'No active sheet linked yet.'}
                      </span>
                    )}
                    {syncState.lastSyncedAt && (
                      <>
                        <span>•</span>
                        <span>{lang === 'fa' ? 'آخرین ثبت:' : 'Last Synced:'} <strong className="text-indigo-400">{syncState.lastSyncedAt}</strong></span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-stretch justify-end mt-2">
                {!syncState.spreadsheetId ? (
                  <button
                    onClick={handleCreateNewSpreadsheet}
                    disabled={syncState.syncing || !currentUser}
                    className="w-full px-4 py-2 bg-emerald-400 disabled:bg-white/5 disabled:text-white/20 text-black font-black text-xs rounded-xl shadow-[0_4px_12px_rgba(52,211,153,0.3)] hover:bg-emerald-350 transition-all text-center uppercase cursor-pointer"
                  >
                    {!currentUser ? (lang === 'fa' ? 'قفل (نیازمند گوگل درایو)' : 'Sheets Disabled') : t.googleSyncAccess}
                  </button>
                ) : (
                  <button
                    onClick={handleSyncToSheets}
                    disabled={syncState.syncing || !currentUser}
                    className="w-full px-4 py-2 bg-emerald-400 disabled:bg-white/5 disabled:text-white/20 text-black font-black text-xs rounded-xl shadow-[0_4px_12px_rgba(52,211,153,0.3)] hover:bg-emerald-350 transition-all flex items-center justify-center gap-1.5 uppercase cursor-pointer"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${syncState.syncing ? 'animate-spin' : ''}`} />
                    {syncState.syncing ? '...' : (lang === 'fa' ? 'همگام‌سازی آنلاین کلاود (گوگل شیت)' : 'Sync to Cloud Sheets')}
                  </button>
                )}
              </div>
            </div>

            {/* Card 2: Google Drive Backup & Multi-Device Sync */}
            <div className="bg-[#14161A] border-2 border-black rounded-2xl p-5 shadow-2xl flex flex-col justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="p-3 bg-indigo-400/10 border border-indigo-400/20 text-indigo-400 rounded-xl">
                  <Cloud className="h-6 w-6" />
                </div>
                <div className="text-right flex-1">
                  <h2 className="font-black text-sm text-white uppercase tracking-tight">
                    {lang === 'fa' ? 'پشتیبان کلاود و همگام‌ساز دستگاه‌ها (گوگل درایو)' : 'Google Drive Cloud Backup & Sync'}
                  </h2>
                  <div className="mt-1 text-xs text-white/50 space-y-1">
                    {!currentUser ? (
                      <span className="text-slate-400 flex items-center gap-1">
                        <AlertCircle className="h-3.5 w-3.5 text-slate-500" />
                        {lang === 'fa' ? 'نیازمند ورود به سیستم جهت پشتیبان کلاود.' : 'Requires sign-in for cloud backup.'}
                      </span>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          {driveBackupInfo ? (
                            <span className="text-indigo-400 font-bold flex items-center gap-1">
                              <CheckCircle className="h-3 w-3" />
                              {lang === 'fa' ? 'نسحه پشتیبان کلاود فعال' : 'Cloud Backup Active'}
                            </span>
                          ) : (
                            <span className="text-amber-400 font-semibold">
                              {lang === 'fa' ? 'بدون پشتیبان کلاود موجود' : 'No Backup on Drive'}
                            </span>
                          )}
                          {driveBackupInfo?.modifiedTime && (
                            <>
                              <span>•</span>
                              <span>
                                {lang === 'fa' ? 'آخرین اصلاح:' : 'Last Modified:'}{' '}
                                <strong className="text-indigo-400">
                                  {new Date(driveBackupInfo.modifiedTime).toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-US')}
                                </strong>
                              </span>
                            </>
                          )}
                          {driveBackupInfo?.size && (
                            <>
                              <span>•</span>
                              <span className="font-mono text-[10px] text-zinc-400">
                                ({Math.round((parseInt(driveBackupInfo.size) / 1024) * 100) / 100} KB)
                              </span>
                            </>
                          )}
                        </div>
                        {driveSyncMessage && (
                          <p className={`text-[11px] font-semibold ${driveSyncStatus === 'error' ? 'text-rose-400' : 'text-emerald-400'}`}>
                            {driveSyncMessage}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-stretch justify-end mt-2 flex-wrap sm:flex-nowrap">
                <button
                  onClick={() => handleCheckDriveBackup(false)}
                  disabled={isDriveSyncing || !currentUser}
                  className="w-full sm:w-auto px-3 py-2 bg-zinc-800 border-2 border-dashed border-zinc-700 hover:border-indigo-500 disabled:opacity-30 disabled:hover:bg-zinc-800 text-white font-black text-xs rounded-xl transition-all uppercase cursor-pointer"
                  title={lang === 'fa' ? 'بررسی وجود پشتیبان کلاود روی درایو شما' : 'Check existing file on your Drive'}
                >
                  {isDriveSyncing ? '...' : (lang === 'fa' ? 'اسکن کلاود' : 'Scan Cloud')}
                </button>

                <button
                  onClick={handleRestoreFromDrive}
                  disabled={isDriveSyncing || !currentUser || !driveBackupInfo}
                  className="w-full sm:w-auto px-3.5 py-2 bg-indigo-500 disabled:bg-white/5 disabled:text-white/20 hover:bg-indigo-600 font-black text-xs rounded-xl transition-all uppercase cursor-pointer text-white"
                  title={lang === 'fa' ? 'بازیابی و ادغام اطلاعات کلاود در این سیستم' : 'Download and replace/merge from Drive'}
                >
                  {lang === 'fa' ? 'بازیابی اطلاعات کلاود' : 'Restore Backup'}
                </button>

                <button
                  onClick={handleBackupToDrive}
                  disabled={isDriveSyncing || !currentUser}
                  className="w-full sm:w-auto px-4 py-2 bg-emerald-400 hover:bg-emerald-350 disabled:bg-white/5 disabled:text-white/20 text-black font-black text-xs rounded-xl shadow-[0_4px_12px_rgba(52,211,153,0.3)] hover:shadow-[0_4px_16px_rgba(52,211,153,0.4)] transition-all uppercase cursor-pointer"
                  title={lang === 'fa' ? 'پشتیبان‌گیری کامل از تمام اطلاعات و تنظیمات به کلاود' : 'Backup all data & config to Drive'}
                >
                  {lang === 'fa' ? 'پشتیبان‌گیری هم‌اکنون' : 'Backup Now'}
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* USER DEVICE-SYNC WARNING BANNER */}
      {!isLocked && (
        <section className="no-print max-w-7xl mx-auto mt-4 px-4 sm:px-8" style={{ direction: lang === 'fa' ? 'rtl' : 'ltr' }}>
          {!currentUser ? (
            <div className="bg-amber-500/10 border-2 border-amber-500/20 text-amber-200 p-5 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
              <div className="flex items-start gap-4">
                <span className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl mt-0.5 shrink-0 animate-pulse">
                  <AlertCircle className="h-5 w-5" />
                </span>
                <div className="text-right">
                  <h3 className="font-bold text-sm text-yellow-400">
                    {lang === 'fa' ? '⚠️ شما در وضعیت محلی (مهمان آفلاین) هستید' : '⚠️ You are in local Guest mode'}
                  </h3>
                  <p className="text-xs text-white/70 mt-1 leading-relaxed md:max-w-4xl">
                    {lang === 'fa' 
                      ? 'داده‌های شما هم‌اکنون فقط روی حافظه موقت این دستگاه (مرورگر جاری) ذخیره شده و با "رفرش سخت‌افزاری"، "پاک کردن کش" یا "تغییر سیستم/موبایل" کلاً ناپدید خواهد شد. داده‌های شما با سیستم‌های دیگر هماهنگ نیست!'
                      : 'Your transactions are only stored inside this specific browser. They will not sync to other devices/mobile or survive complete cache resets.'}
                  </p>
                  <p className="text-[11px] text-amber-300 font-semibold mt-2.5 font-sans">
                    {lang === 'fa'
                      ? '💡 راهکار فوری برای همگام‌سازی دائمی: دکمه خروج را بزنید، سپس در تب "ثبت‌نام کاربر جدید" ثبت‌نام کنید یا دکمه "ورود با گوگل" را فشار دهید. دیتابیس ابری فایربیس فعال خواهد شد و اطلاعات لوکال شما فوراً و خودکار به کلاود منتقل می‌شود.'
                      : '💡 Fix for permanent sync: Log out from the option below, then select "Create New Account" or click "Login with Google" to enable real-time cloud sync and auto-migrate.'}
                  </p>
                </div>
              </div>
              <button 
                onClick={handleLogout}
                className="w-full md:w-auto shrink-0 px-5 py-2.5 bg-yellow-500 hover:bg-yellow-400 text-black text-xs font-black rounded-xl transition-all shadow-md cursor-pointer text-center uppercase"
              >
                {lang === 'fa' ? 'خروج و ساخت حساب ابری' : 'Log out & Create Cloud Account'}
              </button>
            </div>
          ) : (
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 p-4 rounded-xl flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg shrink-0">
                  <CheckCircle className="h-4 w-4 text-emerald-400" />
                </span>
                <div className="text-right">
                  <h4 className="text-xs font-bold text-emerald-400">
                    {lang === 'fa' ? '🟢 به دیتابیس ابری متصل هستید (کاملاً ایمن و هماهنگ)' : '🟢 Connected to Cloud Database (Fully Synced)'}
                  </h4>
                  <p className="text-[11px] text-white/65 mt-0.5">
                    {lang === 'fa'
                      ? 'تراکنش‌های شما به صورت زنده و با استاندارد امنیتی قوی روی تمام سیستم‌ها و موبایل‌ها همگام‌سازی می‌شود.'
                      : 'Your transaction records are instantly synchronized. You can safely access them on any mobile or laptop by logging in.'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* INVESTMENT RECOMMENDATIONS TICKER & BANNER */}
      {!isLocked && (
        <section className="no-print max-w-7xl mx-auto mt-4 px-4 sm:px-8" style={{ direction: lang === 'fa' ? 'rtl' : 'ltr' }}>
          <div className="bg-[#14161A]/60 border border-amber-500/20 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl shadow-amber-500/5 hover:border-amber-400/40 transition-all select-none">
            <div className="flex items-center gap-3 w-full">
              <span className="p-2 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20 shrink-0 select-none animate-pulse">
                <Sparkles className="h-4 w-4" />
              </span>
              <div className="w-full">
                <h5 className="text-[10px] font-black uppercase text-amber-400 tracking-wider">
                  {lang === 'fa' ? '💡 پیشنهاد معاملاتی و سرمایه‌گذاری (هوش مصنوعی تصادفی)' : '💡 AI INVESTMENT RECOMMENDATIONS & ACCENTS'}
                </h5>
                <p className="text-xs text-white/85 font-black mt-1 leading-relaxed text-right md:text-right">
                  {lang === 'fa' ? INVESTMENT_TIPS_FA[currentTipIndex] : INVESTMENT_TIPS_EN[currentTipIndex]}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                const randIndex = Math.floor(Math.random() * 6);
                setCurrentTipIndex(randIndex);
              }}
              className="shrink-0 px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-black text-[10px] font-black tracking-tight rounded-xl shadow-lg transition-all active:scale-95 cursor-pointer uppercase"
            >
              {lang === 'fa' ? 'کوچک / بعدی 🔄' : 'Next Tip 🔄'}
            </button>
          </div>
        </section>
      )}

      {/* TRADERS HUB PRO AI DEPOSIT RADAR & ANALYZER */}
      {!isLocked && (
        <section className="no-print max-w-7xl mx-auto mt-6 px-4 sm:px-8 font-sans" style={{ direction: lang === 'fa' ? 'rtl' : 'ltr' }}>
          <div className="bg-[#14161A]/85 border-2 border-indigo-500/15 rounded-3xl p-6 shadow-2xl shadow-indigo-500/5 select-none hover:border-indigo-500/30 transition-all">
            
            {/* Widget Brand Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-4">
              <div className="flex items-center gap-3">
                <span className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-2xl border border-indigo-500/20 shrink-0">
                  <BrainCircuit className="h-5 w-5 animate-pulse" />
                </span>
                <div className="text-right">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-black text-white text-sm">
                      {lang === 'fa' ? 'رادار هوشمند تریدرز هاب پرو | تحلیل واریزهای بزرگ' : 'TRADERS HUB PRO AI RADAR | LARGE DEPOSIT SCANNER'}
                    </h4>
                    <span className="px-2.5 py-0.5 text-[9px] bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400 text-black font-black uppercase rounded-full tracking-wider shadow-lg">
                      {lang === 'fa' ? 'نسخه پرو' : 'PRO VERSION'}
                    </span>
                  </div>
                  <p className="text-[10px] text-white/45 mt-0.5">
                    {lang === 'fa'
                      ? 'تحلیل عمیق بر روی گردش‌های ورودی با مقیاس کلان و ارزیابی نقدینگی حساب‌های متصل تریدرز هاب پرو'
                      : 'Deep-dive analytical scanner focusing on highest value inflows & capital balance in Traders Hub Pro account'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                <span className="text-[9px] text-emerald-400 font-black uppercase tracking-widest font-mono">
                  {lang === 'fa' ? 'سیستم اسکن زنده' : 'LIVE SCANNING MODULE'}
                </span>
              </div>
            </div>

            {/* Content Logic */}
            {topDepositsMerged.length === 0 ? (
              <div className="py-8 flex flex-col items-center justify-center text-center">
                <AlertCircle className="h-10 w-10 text-amber-500/60 mb-3 animate-bounce" />
                <p className="text-xs text-white/60 font-medium max-w-lg">
                  {lang === 'fa'
                    ? 'هیچ تراکنش واریزی (ورودی) هنوز یافت نشد. لطفاً در بخش‌های ثبت تراکنش ریالی یا رمزارزی یک ردیف واریز (ورود) اضافه کنید تا سامانه هوش مصنوعی تریدرز هاب پرو اطلاعات آن را به عنوان برترین واریزها فیلتر و آنالیز کند.'
                    : 'No incoming deposits registered yet. Add at least one incoming (in) transaction to see Traders Hub Pro AI analyze it.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
                
                {/* Visual Active Spotlight Card */}
                <div className="lg:col-span-7 bg-[#101216] border border-white/5 p-5 rounded-2xl flex flex-col justify-between relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl group-hover:bg-indigo-500/10 transition-colors" />
                  
                  <div className="space-y-4 z-10">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-1 bg-indigo-500/15 text-indigo-300 border border-indigo-500/20 text-[9px] font-black rounded-lg uppercase tracking-wider">
                        🎯 {lang === 'fa' ? 'واریز کانالیزه تصادفی' : 'Featured Spotlight'}
                      </span>
                      <span className="text-[10px] text-white/40 font-mono">
                        {featuredDeposit?.date}
                      </span>
                    </div>

                    {/* Deposit Info Value */}
                    <div className="space-y-1.5 text-right">
                      <div className="flex items-baseline justify-start gap-1">
                        {featuredDeposit?.type === 'rial' ? (
                          <>
                            <span className="text-2xl font-black text-emerald-400 font-mono">
                              {featuredDeposit.amount.toLocaleString()}
                            </span>
                            <span className="text-[10px] text-white/50 font-black">
                              {featuredDeposit.unit}
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="text-2.5xl font-black text-amber-400 font-mono">
                              {featuredDeposit?.amount}
                            </span>
                            <span className="text-[11px] bg-[#14161A] text-amber-300 px-1.5 py-0.5 rounded font-black border border-white/5">
                              {featuredDeposit?.unit}
                            </span>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-white/60">
                        <span className="font-bold">{lang === 'fa' ? 'فرستنده/مبدأ:' : 'Sender:'}</span>
                        <span className="font-black text-white">{featuredDeposit?.party}</span>
                        <span className="h-1 w-1 rounded-full bg-white/20 mx-1" />
                        <span className="font-bold">{lang === 'fa' ? 'درگاه/شبکه:' : 'Channel:'}</span>
                        <span className="font-black text-emerald-400">{featuredDeposit?.detail}</span>
                      </div>
                    </div>

                    {/* AI Generated Insight Log */}
                    <div className="bg-[#090A0C]/80 border border-indigo-500/10 rounded-xl p-3 text-xs leading-relaxed text-indigo-200 text-right font-medium relative shadow-inner">
                      <div className="absolute top-2 left-2 animate-pulse text-indigo-400">
                        <Sparkles className="h-3.5 w-3.5" />
                      </div>
                      {getAiInsight(featuredDeposit)}
                    </div>
                  </div>

                  {/* Actions footer */}
                  <div className="mt-4 pt-4 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3 z-10">
                    <p className="text-[9px] text-white/35">
                      {lang === 'fa' ? '* این بخش بر اساس برترین محاسبات وزنی تریدرز هاب پرو است.' : '* Extracted dynamically based on volume sorting in Traders Hub Pro.'}
                    </p>
                    <button
                      type="button"
                      onClick={handleRandomizeSpotlight}
                      className="w-full sm:w-auto px-4 py-2 bg-[#1E1B4B] hover:bg-indigo-900 border border-indigo-500/30 hover:border-indigo-500/60 text-indigo-300 hover:text-indigo-200 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <span>{lang === 'fa' ? 'چرخش و واریز تصادفی بعدی 🎲' : 'Spin Another Random Top Deposit 🎲'}</span>
                    </button>
                  </div>

                </div>

                {/* Top Listings Column */}
                <div className="lg:col-span-5 flex flex-col justify-between space-y-3">
                  <h5 className="text-[10px] font-black uppercase tracking-wider text-indigo-400 text-right pb-1">
                    {lang === 'fa' ? '🏆 معتبرترین واریزی‌های کشف شده (بالاترین بر اساس ارزش):' : '🏆 HIGHEST DETECTED DEPOSITS (BY VALUE):'}
                  </h5>
                  
                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {topDepositsMerged.slice(0, 4).map((dep, index) => {
                      const isFocused = featuredDeposit?.id === dep.id;
                      return (
                        <div 
                          key={dep.id}
                          className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 text-right ${
                            isFocused 
                              ? 'bg-indigo-500/10 border-indigo-500/30 shadow-indigo-500/5' 
                              : 'bg-[#101216] border-white/5 hover:border-white/10'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            {/* Ranking Badge */}
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black ${
                              index === 0 ? 'bg-amber-500 text-black' :
                              index === 1 ? 'bg-slate-300 text-black' :
                              index === 2 ? 'bg-amber-700 text-white' : 'bg-white/10 text-white/50'
                            }`}>
                              {index + 1}
                            </span>
                            <div className="text-right">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-black text-white/95 truncate max-w-[110px]">
                                  {dep.party}
                                </span>
                                {dep.type === 'crypto' ? (
                                  <span className="text-[8px] bg-amber-500/10 text-amber-400 px-1 rounded uppercase font-bold">
                                    {dep.unit}
                                  </span>
                                ) : (
                                  <span className="text-[8px] bg-emerald-500/10 text-emerald-400 px-1 rounded uppercase font-bold">
                                    {lang === 'fa' ? 'ریال' : 'Rial'}
                                  </span>
                                )}
                              </div>
                              <p className="text-[8px] text-white/35 font-mono">{dep.date}</p>
                            </div>
                          </div>

                          {/* Amount and Scanner Status */}
                          <div className="text-left font-mono">
                            <p className="text-xs font-black text-white">
                              {dep.type === 'rial' ? `${dep.amount.toLocaleString()} ${dep.unit}` : `${dep.amount} ${dep.unit}`}
                            </p>
                            {isFocused ? (
                              <span className="inline-flex items-center gap-1 text-[8px] text-indigo-400 font-extrabold uppercase animate-pulse">
                                <span className="h-1 w-1 rounded-full bg-indigo-500 animate-ping" />
                                {lang === 'fa' ? 'مانیتورینگ فعال 📡' : 'ACTIVE MONITORING 📡'}
                              </span>
                            ) : (
                              <span className="text-[8px] text-white/20 uppercase">
                                {lang === 'fa' ? 'در انتظار بررسی' : 'IN QUEUE'}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Micro branding tagline */}
                  <div className="bg-white/5 rounded-xl p-2.5 flex items-center justify-between gap-2 border border-white/5">
                    <span className="text-[9px] font-extrabold text-[#94A3B8]">
                      {lang === 'fa' ? 'تریدرز هاب پرو (Traders Hub Pro)' : 'Traders Hub Pro'}
                    </span>
                    <span className="text-[8px] font-mono text-[#475569]">
                      2026-05-27 UTC
                    </span>
                  </div>

                </div>

              </div>
            )}

          </div>
        </section>
      )}

      {/* TABS & ACTIONS ROW (no-print) */}
      {!isLocked && (
        <section className="no-print max-w-7xl mx-auto mt-8 px-4 sm:px-8" style={{ direction: lang === 'fa' ? 'rtl' : 'ltr' }}>
          <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4 border-b border-white/10 pb-4">
            
            {/* Navigation Tab Pickers in Bold Minimalist Theme */}
            {!isMobileDevice && (
              <div className="flex flex-wrap border-b xl:border-b-0 border-white/10 gap-1 p-1 bg-[#14161A]/80 border border-white/5 rounded-xl self-start">
                <button
                  onClick={() => setActiveTab('rial')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs md:text-sm font-black tracking-tight transition-all cursor-pointer ${
                    activeTab === 'rial'
                      ? 'bg-emerald-400 text-black shadow-lg font-black'
                      : 'text-white/40 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <PiggyBank className="h-4 w-4 shrink-0" />
                  <span>{t.rialLedger}</span>
                </button>
                <button
                  onClick={() => setActiveTab('crypto')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs md:text-sm font-black tracking-tight transition-all cursor-pointer ${
                    activeTab === 'crypto'
                      ? 'bg-emerald-400 text-black shadow-lg font-black'
                      : 'text-white/40 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Coins className="h-4 w-4 shrink-0" />
                  <span>{t.cryptoLedger}</span>
                </button>
                <button
                  onClick={() => setActiveTab('analytics')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs md:text-sm font-black tracking-tight transition-all cursor-pointer ${
                    activeTab === 'analytics'
                      ? 'bg-emerald-400 text-black shadow-lg font-black'
                      : 'text-white/40 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <TrendingUp className="h-4 w-4 shrink-0" />
                  <span>{t.analytics}</span>
                </button>
                <button
                  onClick={() => setActiveTab('split')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs md:text-sm font-black tracking-tight transition-all cursor-pointer ${
                    activeTab === 'split'
                      ? 'bg-indigo-500 text-white shadow-lg font-black'
                      : 'text-white/40 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Users className="h-4 w-4 shrink-0" />
                  <span>{lang === 'fa' ? 'مخارج دونگی (اشتراکی)' : 'Split/Shared Expenses'}</span>
                </button>
                <button
                  onClick={() => setActiveTab('ai')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs md:text-sm font-black tracking-tight transition-all cursor-pointer ${
                    activeTab === 'ai'
                      ? 'bg-gradient-to-r from-emerald-400 to-indigo-500 text-black shadow-lg font-black'
                      : 'text-white/40 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <BrainCircuit className="h-4 w-4 shrink-0" />
                  <span>{t.aiAccountant}</span>
                </button>
              </div>
            )}

            {/* Quick Export Tools Header */}
            <div className="flex items-center flex-wrap gap-2 justify-end" style={{ direction: 'ltr' }}>
              {/* Bulk AI Excel Button */}
              <button
                onClick={() => {
                  setParsedRialResults([]);
                  setParsedCryptoResults([]);
                  setPastedText('');
                  setParseError(null);
                  setShowAiBulkModal(true);
                }}
                className="px-3.5 py-2 bg-indigo-500 hover:bg-indigo-400 text-white font-black text-xs rounded-lg flex items-center gap-1.5 transition-all shadow-lg shadow-indigo-500/10 hover:shadow-indigo-500/20 cursor-pointer uppercase border border-indigo-400/20"
              >
                <Sparkles className="h-3.5 w-3.5 text-emerald-300 animate-pulse" />
                <span>{lang === 'fa' ? 'ثبت گروهی با هوش مصنوعی' : 'Bulk Import (AI)'}</span>
              </button>
              
              <button
                onClick={handleLoadDemoPlayground}
                className="px-3 py-2 border border-white/10 hover:border-emerald-400/40 bg-white/5 text-slate-300 text-xs font-bold rounded-lg transition-all cursor-pointer"
              >
                {lang === 'fa' ? 'بارگذاری دیتای آزمایشی' : 'Load Trial Mockups'}
              </button>
              <button
                onClick={handleClearDatabase}
                className="px-3 py-2 border border-white/10 hover:border-rose-500 bg-white/5 text-rose-300 text-xs font-bold rounded-lg transition-all cursor-pointer"
              >
                {lang === 'fa' ? 'پاکسازی کامل ردیف‌ها' : 'Clear Database'}
              </button>
              
              {/* Unified Dynamic Advanced Exporter System */}
              <div className="relative font-sans text-right" style={{ direction: 'ltr' }}>
                <button
                  type="button"
                  onClick={() => setShowExportDropdown(!showExportDropdown)}
                  className="px-4 py-2 bg-gradient-to-r from-emerald-400 to-indigo-500 hover:opacity-90 text-black font-black text-xs rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-emerald-500/10 active:scale-95"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>{lang === 'fa' ? 'دانلود و خروجی پیشرفته (Excel, PDF, CSV) 📊' : 'Advanced Finance Exporter'}</span>
                </button>
                
                {showExportDropdown && (
                  <>
                    <div 
                      className="fixed inset-0 z-40 bg-black/10" 
                      onClick={() => setShowExportDropdown(false)}
                    />
                    <div className="absolute right-0 mt-2 w-80 bg-[#16181D]/95 backdrop-blur-md border border-white/10 rounded-xl p-4 shadow-2xl z-50 text-right space-y-4 animate-fade-in" style={{ direction: lang === 'fa' ? 'rtl' : 'ltr' }}>
                      <div className="border-b border-white/10 pb-2">
                        <h4 className="font-extrabold text-xs text-white uppercase tracking-wider">{lang === 'fa' ? 'تنظیمات خروجی فایل مالی' : 'Export Controls & Settings'}</h4>
                        <p className="text-[10px] text-white/40 mt-0.5">
                          {lang === 'fa' ? 'فرمت دلخواه جهت ثبت فیزیکی یا گزارش مالی را انتخاب کنید:' : 'Choose a ledger report format:'}
                        </p>
                      </div>

                      <div className="space-y-3.5 text-right">
                        {/* 1. EXCEL */}
                        <div className="space-y-1">
                          <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block">{lang === 'fa' ? '۱. مایکروسافت اکسل (.XLSX)' : '1. Microsoft Excel (.XLSX)'}</span>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                exportToExcel(rialEntries, cryptoEntries, lang, false);
                                setShowExportDropdown(false);
                              }}
                              className="px-2 py-1.5 bg-white/5 hover:bg-emerald-500/20 text-white rounded text-[11px] font-bold transition-colors flex items-center justify-between cursor-pointer"
                            >
                              <span>{lang === 'fa' ? '📥 همه ردیف‌ها' : '📥 All Rows'}</span>
                              <span className="text-[9px] text-[#A5B4FC] font-mono">({rialEntries.length + cryptoEntries.length})</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                exportToExcel(filteredRialEntries, filteredCryptoEntries, lang, true);
                                setShowExportDropdown(false);
                              }}
                              className="px-2 py-1.5 bg-white/5 hover:bg-emerald-500/20 text-white rounded text-[11px] font-bold transition-colors flex items-center justify-between border border-emerald-500/10 cursor-pointer"
                            >
                              <span>{lang === 'fa' ? '🔍 فیلتر شده' : '🔍 Filtered'}</span>
                              <span className="text-[9px] text-[#A5B4FC] font-mono">({filteredRialEntries.length + filteredCryptoEntries.length})</span>
                            </button>
                          </div>
                        </div>

                        {/* 2. CSV */}
                        <div className="space-y-1">
                          <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider block">{lang === 'fa' ? '۲. فایل معین حسابداری (.CSV)' : '2. Comma Separated Values (.CSV)'}</span>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                exportToCSV(rialEntries, cryptoEntries, lang, false);
                                setShowExportDropdown(false);
                              }}
                              className="px-2 py-1.5 bg-white/5 hover:bg-indigo-500/20 text-white rounded text-[11px] font-bold transition-colors flex items-center justify-between cursor-pointer"
                            >
                              <span>{lang === 'fa' ? '📥 همه ردیف‌ها' : '📥 All Rows'}</span>
                              <span className="text-[9px] text-[#A5B4FC] font-mono">({rialEntries.length + cryptoEntries.length})</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                exportToCSV(filteredRialEntries, filteredCryptoEntries, lang, true);
                                setShowExportDropdown(false);
                              }}
                              className="px-2 py-1.5 bg-white/5 hover:bg-indigo-500/20 text-white rounded text-[11px] font-bold transition-colors flex items-center justify-between border border-indigo-500/10 cursor-pointer"
                            >
                              <span>{lang === 'fa' ? '🔍 فیلتر شده' : '🔍 Filtered'}</span>
                              <span className="text-[9px] text-[#A5B4FC] font-mono">({filteredRialEntries.length + filteredCryptoEntries.length})</span>
                            </button>
                          </div>
                        </div>

                        {/* 3. PDF */}
                        <div className="space-y-1">
                          <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block">{lang === 'fa' ? '۳. سند نهایی و چاپی (.PDF)' : '3. Document Format (.PDF)'}</span>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                if (lang === 'fa') {
                                  exportToPDF();
                                } else {
                                  exportLegacyPDF(rialEntries, cryptoEntries, false);
                                }
                                setShowExportDropdown(false);
                              }}
                              className="px-2 py-1.5 bg-white/5 hover:bg-amber-500/20 text-white rounded text-[11px] font-bold transition-colors flex items-center justify-between cursor-pointer"
                            >
                              <span>{lang === 'fa' ? '🖨️ چاپ مرورگر' : '🖨️ Browser Report'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                exportLegacyPDF(filteredRialEntries, filteredCryptoEntries, true);
                                setShowExportDropdown(false);
                              }}
                              className="px-2 py-1.5 bg-white/5 hover:bg-amber-500/20 text-white rounded text-[11px] font-bold transition-colors flex items-center justify-between border border-amber-500/10 cursor-pointer"
                            >
                              <span>{lang === 'fa' ? '📄 سند PDF' : '📄 PDF Ledger'}</span>
                              <span className="text-[9px] text-[#A5B4FC] font-mono">({filteredRialEntries.length + filteredCryptoEntries.length})</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* CORE TRANSITIONS AND VIEW RENDER */}
      {!isLocked && (
        <main className="max-w-7xl mx-auto mt-6 px-4 sm:px-8">
          
          {/* TAB CONTENT 1: RIAL LEDGER SYSTEM */}
          {activeTab === 'rial' && (
            <div className="space-y-6" style={{ direction: lang === 'fa' ? 'rtl' : 'ltr' }}>
              
              {/* Summary widget & live search */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
                <div className="bg-[#14161A] p-6 rounded-2xl border border-white/5 relative overflow-hidden flex items-center justify-between">
                  <div className="absolute left-6 -bottom-5 text-7xl font-sans font-black text-white/[0.012] select-none italic tracking-tighter uppercase pointer-events-none">RIALS</div>
                  <div className="z-10 text-right w-full">
                    <div className="flex flex-col gap-1 z-10">
                      <p className="text-[10px] font-black uppercase text-white/40 tracking-widest mb-0.5">{t.rialSummary}</p>
                      <p className={`text-2xl sm:text-3xl font-black font-mono tracking-tight ${netRialVal >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {netRialVal < 0 ? '-' : ''}{formatToman(Math.abs(netRialVal))} <span className="text-xs font-sans text-white/50 mr-0.5">{t.tomanUnit}</span>
                      </p>
                      <div className="flex items-center gap-3 text-[10px] font-bold mt-1 text-slate-400 flex-wrap justify-start">
                        <span className="flex items-center gap-1 text-emerald-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                          <span>{lang === 'fa' ? 'دریافتی:' : 'In:'}</span>
                          <span className="font-mono">{formatToman(rialStats.incoming)}</span>
                        </span>
                        <span className="flex items-center gap-1 text-rose-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                          <span>{lang === 'fa' ? 'ارسالی:' : 'Out:'}</span>
                          <span className="font-mono">{formatToman(rialStats.outgoing)}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="p-3 bg-white/5 rounded-xl border border-white/10 text-emerald-400 z-10 shrink-0 self-start mt-2">
                    <DollarSign className="h-6 w-6" />
                  </div>
                </div>

                <div className="space-y-3 relative lg:col-span-2">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <span className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-white/35">
                        <Search className="h-4 w-4" />
                      </span>
                      <input
                        type="text"
                        placeholder={t.searchRialPlaceholder}
                        value={rialSearch}
                        onChange={(e) => setRialSearch(e.target.value)}
                        className="w-full pr-10 pl-4 py-4 bg-[#14161A] border border-white/10 focus:border-emerald-400 focus:outline-none rounded-xl text-sm transition-all text-right placeholder-white/20 text-white font-medium"
                        style={{ textAlign: lang === 'fa' ? 'right' : 'left', paddingRight: lang === 'fa' ? '2.5rem' : '1rem', paddingLeft: lang === 'fa' ? '1rem' : '2.5rem' }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowRialAdvanced(!showRialAdvanced)}
                      className={`px-4 py-3 rounded-xl border font-bold text-xs flex items-center gap-2 cursor-pointer transition-all shrink-0 ${
                        showRialAdvanced 
                          ? 'bg-amber-400 border-amber-400 text-black shadow-[0_0_15px_rgba(251,191,36,0.3)]' 
                          : 'bg-[#14161A] border-white/10 text-white/85 hover:border-white/25 hover:bg-[#1C1F24]'
                      }`}
                    >
                      <SlidersHorizontal className="h-4 w-4" />
                      <span className="hidden sm:inline">{lang === 'fa' ? 'فیلتر پیشرفته و مرتب‌سازی' : 'Advanced Filters & Sort'}</span>
                      {(rialFilterType !== 'all' || rialFilterStartDate || rialFilterEndDate || rialFilterMinAmount || rialFilterMaxAmount) && (
                        <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse"></span>
                      )}
                    </button>
                  </div>

                  {/* Advanced Filters Panel */}
                  {showRialAdvanced && (
                    <div className="bg-[#14161A] border border-white/10 rounded-xl p-5 space-y-4 shadow-2xl animate-fadeIn text-right relative z-30" style={{ direction: lang === 'fa' ? 'rtl' : 'ltr' }}>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        
                        {/* Ledger Type Transfer (to satisfy: transaction type (Rial or crypto)) */}
                        <div className="space-y-1.5 text-right">
                          <label className="block text-xs text-white/50 font-black uppercase tracking-wider">{lang === 'fa' ? 'نوع دفتر مالی' : 'Ledger Unit'}</label>
                          <select
                            value="rial"
                            onChange={(e) => {
                              if (e.target.value === 'crypto') {
                                setActiveTab('crypto');
                                setShowCryptoAdvanced(true);
                              }
                            }}
                            className="w-full px-3 py-2.5 bg-[#0A0B0D] border border-white/10 rounded-lg text-xs text-emerald-400 font-bold focus:border-emerald-400 focus:outline-none"
                          >
                            <option value="rial">{lang === 'fa' ? '🇮🇷 فقط تراکنش‌های ریالی' : '🇮🇷 Rial Transactions Only'}</option>
                            <option value="crypto">{lang === 'fa' ? '🪙 فقط تراکنش‌های کریپتو (سوییچ)' : '🪙 Crypto Transactions Only (Switch)'}</option>
                          </select>
                        </div>

                        {/* Transaction Sub-Type (In vs Out) */}
                        <div className="space-y-1.5 text-right">
                          <label className="block text-xs text-white/50 font-black uppercase tracking-wider">{lang === 'fa' ? 'جهت و نوع تراکنش' : 'Transaction Direction'}</label>
                          <select
                            value={rialFilterType}
                            onChange={(e) => setRialFilterType(e.target.value as any)}
                            className="w-full px-3 py-2.5 bg-[#0A0B0D] border border-white/10 rounded-lg text-xs text-white focus:border-emerald-400 focus:outline-none"
                          >
                            <option value="all">{lang === 'fa' ? 'همه (دریافتی و ارسالی)' : 'All (In & Out)'}</option>
                            <option value="in">{lang === 'fa' ? 'دریافتی‌ها / وارده 📥' : 'Rial Inflow 📥'}</option>
                            <option value="out">{lang === 'fa' ? 'پرداختی‌ها / صادره 📤' : 'Rial Outflow 📤'}</option>
                          </select>
                        </div>

                        {/* Date Filters: Start Date */}
                        <div className="space-y-1.5 text-right">
                          <label className="block text-xs text-white/50 font-black uppercase tracking-wider">{lang === 'fa' ? 'از تاریخ' : 'Start Date'}</label>
                          <input
                            type="date"
                            value={rialFilterStartDate}
                            onChange={(e) => setRialFilterStartDate(e.target.value)}
                            className="w-full px-3 py-2.5 bg-[#0A0B0D] border border-white/10 rounded-lg text-xs text-white focus:border-emerald-400 focus:outline-none"
                          />
                        </div>

                        {/* Date Filters: End Date */}
                        <div className="space-y-1.5 text-right">
                          <label className="block text-xs text-white/50 font-black uppercase tracking-wider">{lang === 'fa' ? 'تا تاریخ' : 'End Date'}</label>
                          <input
                            type="date"
                            value={rialFilterEndDate}
                            onChange={(e) => setRialFilterEndDate(e.target.value)}
                            className="w-full px-3 py-2.5 bg-[#0A0B0D] border border-white/10 rounded-lg text-xs text-white focus:border-emerald-400 focus:outline-none"
                          />
                        </div>

                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
                        
                        {/* Min Amount */}
                        <div className="space-y-1.5 text-right">
                          <label className="block text-xs text-white/50 font-black uppercase tracking-wider">{lang === 'fa' ? 'حداقل مبلغ (تومان)' : 'Min Amount (Toman)'}</label>
                          <input
                            type="number"
                            placeholder="0"
                            value={rialFilterMinAmount}
                            onChange={(e) => setRialFilterMinAmount(e.target.value)}
                            className="w-full px-3 py-2.5 bg-[#0A0B0D] border border-white/10 rounded-lg text-xs text-white focus:border-emerald-400 focus:outline-none font-mono"
                          />
                        </div>

                        {/* Max Amount */}
                        <div className="space-y-1.5 text-right">
                          <label className="block text-xs text-white/50 font-black uppercase tracking-wider">{lang === 'fa' ? 'حداکثر مبلغ (تومان)' : 'Max Amount (Toman)'}</label>
                          <input
                            type="number"
                            placeholder="مثلا: 10000000"
                            value={rialFilterMaxAmount}
                            onChange={(e) => setRialFilterMaxAmount(e.target.value)}
                            className="w-full px-3 py-2.5 bg-[#0A0B0D] border border-white/10 rounded-lg text-xs text-white focus:border-emerald-400 focus:outline-none font-mono"
                          />
                        </div>

                        {/* Sorting options (Implement sorting options for search results) */}
                        <div className="space-y-1.5 text-right col-span-1 sm:col-span-2">
                          <label className="block text-xs text-white/50 font-black uppercase tracking-wider">{lang === 'fa' ? 'مرتب‌سازی بر اساس' : 'Sort Results By'}</label>
                          <select
                            value={rialSortBy}
                            onChange={(e) => setRialSortBy(e.target.value as any)}
                            className="w-full px-3 py-2.5 bg-[#0A0B0D] border border-white/10 rounded-lg text-xs text-amber-300 font-bold focus:border-emerald-400 focus:outline-none"
                          >
                            <option value="date-desc">{lang === 'fa' ? '📅 تاریخ تراکنش (جدیدترین به قدیمی‌ترین)' : '📅 Date: Newest First'}</option>
                            <option value="date-asc">{lang === 'fa' ? '📅 تاریخ تراکنش (قدیمی‌ترین به جدیدترین)' : '📅 Date: Oldest First'}</option>
                            <option value="amount-desc">{lang === 'fa' ? '💎 مبلغ تراکنش (سنگین‌ترین نخست)' : '💎 Amount: Highest First'}</option>
                            <option value="amount-asc">{lang === 'fa' ? '💎 مبلغ تراکنش (کم‌ترین نخست)' : '💎 Amount: Lowest First'}</option>
                            <option value="sender-asc">{lang === 'fa' ? '👤 نام فرستنده (الف تا ی)' : '👤 Sender Name: A to Z'}</option>
                            <option value="sender-desc">{lang === 'fa' ? '👤 نام فرستنده (ی تا الف)' : '👤 Sender Name: Z to A'}</option>
                          </select>
                        </div>

                      </div>

                      {/* Clear/Reset Advanced Filters */}
                      <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
                        <button
                          type="button"
                          onClick={() => {
                            setRialFilterType('all');
                            setRialFilterStartDate('');
                            setRialFilterEndDate('');
                            setRialFilterMinAmount('');
                            setRialFilterMaxAmount('');
                            setRialSearch('');
                            setRialSortBy('date-desc');
                          }}
                          className="px-3.5 py-1.5 bg-[#1F2228] hover:bg-[#282B33] text-white/70 hover:text-white rounded-lg text-xs transition-colors cursor-pointer"
                        >
                          {lang === 'fa' ? 'پاک کردن همه فیلترها' : 'Reset Filters'}
                        </button>
                      </div>

                    </div>
                  )}
                </div>
              </div>

              {/* Quick Add Form Section */}
              <div className="no-print">
                {!showRialForm ? (
                  <button
                    onClick={() => {
                      setEditingRialId(null);
                      setRialFormSender('');
                      setRialFormAmount('');
                      setRialFormBank('');
                      setRialFormNotes('');
                      setShowRialForm(true);
                    }}
                    className="w-full py-4 border-2 border-dashed border-white/10 hover:border-emerald-400/40 bg-[#14161A]/30 hover:bg-[#14161A]/55 rounded-xl text-emerald-400 hover:text-emerald-300 text-sm font-black transition-all flex items-center justify-center gap-2 cursor-pointer uppercase"
                  >
                    <PlusCircle className="h-5 w-5 animate-bounce" />
                    <span>{t.newRialButton}</span>
                  </button>
                ) : (
                  <form
                    onSubmit={handleSaveRial}
                    className="bg-[#14161A] border border-emerald-400/30 rounded-2xl p-6 shadow-2xl space-y-4 text-right"
                  >
                    <div className="flex items-center justify-between border-b border-white/10 pb-3">
                      <h3 className="font-black text-sm text-emerald-400 flex items-center gap-1.5 uppercase">
                        <Plus className="h-4 w-4" />
                        {editingRialId ? `${t.rialFormTitleEdit} ${editingRialId}` : t.rialFormTitleAdd}
                      </h3>
                      <button
                        type="button"
                        onClick={() => setShowRialForm(false)}
                        className="p-1 text-white/40 hover:text-white rounded-lg hover:bg-white/5 cursor-pointer"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Transaction Status Selector (Incoming / Outgoing) */}
                    <div className="flex justify-end pt-1 pb-1" style={{ direction: lang === 'fa' ? 'rtl' : 'ltr' }}>
                      <div className="flex items-center gap-1.5 bg-[#090A0C] p-1 rounded-xl border border-white/5">
                        <button
                          type="button"
                          onClick={() => setRialFormType('in')}
                          className={`px-4 py-2 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                            rialFormType === 'in'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'text-white/40 hover:text-white/70 border border-transparent'
                          }`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                          <span>{t.typeIncoming}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setRialFormType('out')}
                          className={`px-4 py-2 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                            rialFormType === 'out'
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              : 'text-white/40 hover:text-white/70 border border-transparent'
                          }`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                          <span>{t.typeOutgoing}</span>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {/* Date */}
                      <div className="space-y-1.5 col-span-1">
                        <div className="flex items-center justify-between">
                          <label className="block text-xs text-white/50 font-black uppercase tracking-wider">{t.date} *</label>
                          <button
                            type="button"
                            onClick={() => setRialCalendarMode(p => p === 'jalali' ? 'gregorian' : 'jalali')}
                            className="text-[10px] text-amber-400 hover:text-amber-300 font-bold underline cursor-pointer transition-colors"
                          >
                            {rialCalendarMode === 'jalali' 
                              ? (lang === 'fa' ? '🔄 ورود میلادی' : '🔄 Switch to Gregorian')
                              : (lang === 'fa' ? '🔄 ورود شمسی' : '🔄 Switch to Jalali')}
                          </button>
                        </div>

                        {rialCalendarMode === 'jalali' ? (
                          <div className="space-y-1.5">
                            {/* Jalali selects layout */}
                            <div className="grid grid-cols-3 gap-1.5" style={{ direction: 'rtl' }}>
                              {/* Day Select */}
                              <div>
                                <select
                                  value={rialJalaliParts.jd}
                                  onChange={(e) => updateRialJalaliValue('d', parseInt(e.target.value, 10))}
                                  className="w-full px-1 py-1.5 bg-[#0A0B0D] border border-white/10 rounded-lg text-xs text-white focus:border-amber-400 focus:outline-none"
                                >
                                  {Array.from({ length: getJalaliLimits(rialJalaliParts.jy, rialJalaliParts.jm) }, (_, i) => 1 + i).map(num => (
                                    <option key={num} value={num}>{num}</option>
                                  ))}
                                </select>
                                <span className="block text-[8px] text-center text-white/30 font-bold mt-0.5">{lang === 'fa' ? 'روز' : 'Day'}</span>
                              </div>

                              {/* Month Select */}
                              <div>
                                <select
                                  value={rialJalaliParts.jm}
                                  onChange={(e) => updateRialJalaliValue('m', parseInt(e.target.value, 10))}
                                  className="w-full px-1 py-1.5 bg-[#0A0B0D] border border-white/10 rounded-lg text-xs text-white focus:border-amber-400 focus:outline-none"
                                >
                                  {jalaliMonthsList.map(m => (
                                    <option key={m.val} value={m.val}>
                                      {lang === 'fa' ? m.name.split(' (')[0] : m.name}
                                    </option>
                                  ))}
                                </select>
                                <span className="block text-[8px] text-center text-white/30 font-bold mt-0.5">{lang === 'fa' ? 'ماه' : 'Month'}</span>
                              </div>

                              {/* Year Select */}
                              <div>
                                <select
                                  value={rialJalaliParts.jy}
                                  onChange={(e) => updateRialJalaliValue('y', parseInt(e.target.value, 10))}
                                  className="w-full px-1 py-1.5 bg-[#0A0B0D] border border-white/10 rounded-lg text-xs text-[#E1A63E] font-bold focus:border-amber-400 focus:outline-none"
                                >
                                  {Array.from({ length: 26 }, (_, i) => 1390 + i).map(y => (
                                    <option key={y} value={y}>{y}</option>
                                  ))}
                                </select>
                                <span className="block text-[8px] text-center text-white/30 font-bold mt-0.5">{lang === 'fa' ? 'سال' : 'Year'}</span>
                              </div>
                            </div>
                            
                            {/* Standard value preview */}
                            <div className="text-[10px] text-white/40 font-mono mt-1" style={{ direction: lang === 'fa' ? 'rtl' : 'ltr' }}>
                              <span>📅 {lang === 'fa' ? 'معادل میلادی: ' : 'Gregorian: '}</span>
                              <span className="font-bold text-slate-300">{rialFormDate}</span>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <input
                              type="date"
                              required
                              value={rialFormDate}
                              onChange={(e) => setRialFormDate(e.target.value)}
                              className="w-full px-3 py-2 bg-[#0A0B0D] border border-white/10 rounded-lg text-sm text-white focus:border-emerald-400 focus:outline-none"
                            />
                            {rialFormDate && (
                              <div className="text-[10px] text-amber-400 font-bold flex items-center gap-1.5 px-1 mt-1 select-none" style={{ direction: lang === 'fa' ? 'rtl' : 'ltr' }}>
                                <span>📅 {lang === 'fa' ? 'معادل شمسی:' : 'Jalali:'}</span>
                                <span className="font-mono text-xs text-amber-300 font-black">{toJalali(rialFormDate, lang)}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Sender */}
                      <div className="space-y-1.5">
                        <label className="block text-xs text-white/50 font-black uppercase tracking-wider">{t.sender} *</label>
                        <input
                          type="text"
                          placeholder={lang === 'fa' ? 'مثلا: مریم حسینی' : 'Sender name'}
                          required
                          value={rialFormSender}
                          onChange={(e) => setRialFormSender(e.target.value)}
                          className="w-full px-3 py-2.5 bg-[#0A0B0D] border border-white/10 rounded-lg text-sm text-white focus:border-emerald-400 focus:outline-none text-right"
                          style={{ textAlign: lang === 'fa' ? 'right' : 'left' }}
                        />
                      </div>

                      {/* Amount in Toman */}
                      <div className="space-y-1.5">
                        <label className="block text-xs text-white/50 font-black uppercase tracking-wider">{t.amount} *</label>
                        <input
                          type="text"
                          placeholder="50,000,000"
                          required
                          value={rialFormAmount}
                          onChange={(e) => {
                            const val = e.target.value.replace(/[^0-9]/g, '');
                            if (val === '') {
                              setRialFormAmount('');
                            } else {
                              setRialFormAmount(Number(val).toLocaleString());
                            }
                          }}
                          className="w-full px-3 py-2.5 bg-[#0A0B0D] border border-white/10 rounded-lg text-sm font-mono text-white focus:border-emerald-400 focus:outline-none text-left"
                        />
                        {rialFormAmount && lang === 'fa' && (
                          <span className="text-[10px] text-emerald-400 block text-right mt-1">
                            {formatPersianNumber(rialFormAmount)} تومان
                          </span>
                        )}
                      </div>

                      {/* Bank Name */}
                      <div className="space-y-1.5">
                        <label className="block text-xs text-white/50 font-black uppercase tracking-wider">{t.bankName} *</label>
                        <input
                          type="text"
                          placeholder={lang === 'fa' ? 'سامان / بانک ملی / ملت' : 'Bank target'}
                          required
                          value={rialFormBank}
                          onChange={(e) => setRialFormBank(e.target.value)}
                          className="w-full px-3 py-2.5 bg-[#0A0B0D] border border-white/10 rounded-lg text-sm text-white focus:border-emerald-400 focus:outline-none text-right"
                          style={{ textAlign: lang === 'fa' ? 'right' : 'left' }}
                        />
                      </div>
                    </div>

                    {/* Notes */}
                    <div className="space-y-1.5">
                      <label className="block text-xs text-white/50 font-black uppercase tracking-wider">{t.description}</label>
                      <textarea
                        placeholder={lang === 'fa' ? 'توضیحات بابت فیش واریز...' : 'Description notes...'}
                        value={rialFormNotes}
                        onChange={(e) => setRialFormNotes(e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2.5 bg-[#0A0B0D] border border-white/10 rounded-lg text-sm text-white focus:border-emerald-400 focus:outline-none text-right"
                        style={{ textAlign: lang === 'fa' ? 'right' : 'left' }}
                      />
                    </div>

                    <div className="flex justify-end gap-2.5 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowRialForm(false)}
                        className="px-4 py-2 border border-white/10 hover:bg-white/5 rounded-xl text-xs font-bold text-white/50 hover:text-white transition-colors cursor-pointer"
                      >
                        {t.cancel}
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 bg-emerald-400 hover:bg-emerald-350 text-black font-black text-xs rounded-xl shadow-lg hover:shadow-[0_0_15px_rgba(52,211,153,0.5)] active:scale-95 transition-all uppercase cursor-pointer"
                      >
                        {t.saveRial}
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* Dynamic Sum & Classification System (Rial) */}
              <div className="bg-[#14161A] border border-white/5 rounded-2xl p-6 shadow-2xl space-y-6 no-print">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <div className="flex items-center gap-2.5">
                    <span className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/15">
                      <TrendingUp className="h-5 w-5" />
                    </span>
                    <div className="text-right">
                      <h3 className="font-black text-sm text-white">
                        {lang === 'fa' ? '📊 محاسبات و طبقه‌بندی خودکار فیلترها (ریالی)' : '📊 Rial Filter Analytics & Auto Sum'}
                      </h3>
                      <p className="text-[10px] text-white/40 mt-0.5">
                        {lang === 'fa' ? 'محاسبات زنده دریافتی‌ها و تفکیک بر اساس بانک فیلتر شده' : 'Real-time inflows & bank categorization for filtered criteria'}
                      </p>
                    </div>
                  </div>
                  <div className="text-[10px] font-mono bg-white/5 text-emerald-400 border border-white/10 px-2.5 py-1 rounded-lg">
                    {lang === 'fa' ? `تعداد کل: ${filteredRialEntries.length} فیش` : `Total: ${filteredRialEntries.length} records`}
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Column 1: Core sums stats */}
                  <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Inflow Box */}
                    <div className="bg-[#090A0C] border border-emerald-500/15 p-4 rounded-xl flex flex-col justify-between" style={{ direction: lang === 'fa' ? 'rtl' : 'ltr' }}>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-white/50 font-black uppercase">
                          {lang === 'fa' ? 'جمع ورودی‌ها (دریافتی)' : 'Total Inflows'}
                        </span>
                        <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded text-[9px] font-bold">
                          {lang === 'fa' ? `${filteredRialStats.inflowCount} فیش` : `${filteredRialStats.inflowCount} In`}
                        </span>
                      </div>
                      <div className="mt-3 text-right" style={{ textAlign: lang === 'fa' ? 'right' : 'left' }}>
                        <span className="text-lg font-black font-mono text-emerald-400 block tracking-tight">
                          {formatToman(filteredRialStats.inflowTotal)}
                        </span>
                        <span className="text-[9px] text-white/30 font-sans block mt-0.5">{t.tomanUnit}</span>
                      </div>
                    </div>

                    {/* Outflow Box */}
                    <div className="bg-[#090A0C] border border-rose-500/15 p-4 rounded-xl flex flex-col justify-between" style={{ direction: lang === 'fa' ? 'rtl' : 'ltr' }}>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-white/50 font-black uppercase">
                          {lang === 'fa' ? 'جمع خروجی‌ها (پرداختی)' : 'Total Outflows'}
                        </span>
                        <span className="px-1.5 py-0.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded text-[9px] font-bold">
                          {lang === 'fa' ? `${filteredRialStats.outflowCount} فیش` : `${filteredRialStats.outflowCount} Out`}
                        </span>
                      </div>
                      <div className="mt-3 text-right" style={{ textAlign: lang === 'fa' ? 'right' : 'left' }}>
                        <span className="text-lg font-black font-mono text-rose-400 block tracking-tight">
                          {formatToman(filteredRialStats.outflowTotal)}
                        </span>
                        <span className="text-[9px] text-white/30 font-sans block mt-0.5">{t.tomanUnit}</span>
                      </div>
                    </div>

                    {/* Net Box */}
                    <div className="bg-[#090A0C] border border-white/5 p-4 rounded-xl flex flex-col justify-between" style={{ direction: lang === 'fa' ? 'rtl' : 'ltr' }}>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-white/50 font-black uppercase">
                          {lang === 'fa' ? 'تفاضل خالص فیلتر شده' : 'Net Surplus'}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          filteredRialStats.netTotal >= 0 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}>
                          {filteredRialStats.netTotal >= 0 ? '+' : '-'}
                        </span>
                      </div>
                      <div className="mt-3 text-right" style={{ textAlign: lang === 'fa' ? 'right' : 'left' }}>
                        <span className={`text-lg font-black font-mono block tracking-tight ${
                          filteredRialStats.netTotal >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}>
                          {filteredRialStats.netTotal < 0 ? '-' : ''}{formatToman(Math.abs(filteredRialStats.netTotal))}
                        </span>
                        <span className="text-[9px] text-white/30 font-sans block mt-0.5">{t.tomanUnit}</span>
                      </div>
                    </div>
                  </div>

                  {/* Column 2: Bank Breakdown classification */}
                  <div className="lg:col-span-5 bg-[#090A0C] border border-white/5 rounded-xl p-4 flex flex-col justify-between text-right" style={{ direction: lang === 'fa' ? 'rtl' : 'ltr' }}>
                    <div>
                      <span className="text-[10px] text-white/40 font-black uppercase tracking-widest block mb-3 text-right">
                        {lang === 'fa' ? '🏦 تفکیک دریافتی‌ها بر اساس بانک‌ها' : '🏦 Bank Classification breakdown'}
                      </span>
                      {filteredRialStats.sortedBanks.length === 0 ? (
                        <div className="text-center py-4 text-xs text-white/20 font-bold">
                          {lang === 'fa' ? 'داده‌ای برای تفکیک یافت نشد' : 'No breakdown data available'}
                        </div>
                      ) : (
                        <div className="space-y-3 max-h-[120px] overflow-y-auto pl-1 pr-1">
                          {filteredRialStats.sortedBanks.slice(0, 4).map((b) => {
                            const totalVal = filteredRialStats.inflowTotal || 1;
                            const percentage = (b.total / totalVal) * 100;
                            return (
                              <div key={b.name} className="space-y-1">
                                <div className="flex items-center justify-between text-xs font-semibold">
                                  <span className="text-white/80">{b.name}</span>
                                  <span className="font-mono text-emerald-400 font-bold">
                                    {formatToman(b.total)} <span className="text-[9px] font-sans text-white/40">{t.tomanUnit}</span>
                                  </span>
                                </div>
                                <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-emerald-400 transition-all duration-500 rounded-full"
                                    style={{ width: `${Math.min(100, percentage)}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Excel Grid Representation */}
              <div className="bg-[#14161A] border-2 border-black rounded-2xl overflow-hidden shadow-2xl print-card">
                {/* Printable-only Page Header */}
                <div className="hidden print-only p-5 border-b border-white/30 text-center text-black">
                  <h1 className="text-xl font-bold">دفتر معامله‌گری تریدرز هاب پرو</h1>
                  <p className="text-xs">بایگانی فیش‌های دریافت ریالی</p>
                  <p className="text-[10px] mt-1">پرینت شده در تاریخ: {new Date().toLocaleDateString('fa-IR')}</p>
                </div>

                <div className="overflow-x-auto min-h-[250px]">
                  <table className="w-full text-right border-collapse">
                    <thead className="bg-white/5 border-b border-white/10 text-white/40 text-[10px] font-black uppercase tracking-widest text-right whitespace-nowrap">
                      <tr>
                        <th className="p-3.5 font-bold" style={{ textAlign: lang === 'fa' ? 'right' : 'left' }}>{t.rialTableId}</th>
                        <th className="p-3.5 font-bold" style={{ textAlign: lang === 'fa' ? 'right' : 'left' }}>{t.rialTableDate}</th>
                        <th className="p-3.5 font-bold" style={{ textAlign: lang === 'fa' ? 'right' : 'left' }}>{t.rialTableSender}</th>
                        <th className="p-3.5 font-bold" style={{ textAlign: lang === 'fa' ? 'right' : 'left' }}>{t.rialTableBank}</th>
                        <th className="p-3.5 font-bold" style={{ textAlign: lang === 'fa' ? 'right' : 'left' }}>{t.rialTableNotes}</th>
                        <th className="p-3.5 font-bold" style={{ textAlign: lang === 'fa' ? 'left' : 'right' }}>{t.rialTableAmount}</th>
                        <th className="p-3.5 font-bold text-center no-print">عملیات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-sm text-white/95">
                      {filteredRialEntries.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-12 text-center text-slate-500 text-xs">
                            {t.noRialEntries}
                          </td>
                        </tr>
                      ) : (
                        filteredRialEntries.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-800/20 transition-colors">
                            <td className="p-3.5 font-mono text-xs font-bold text-amber-500" style={{ textAlign: lang === 'fa' ? 'right' : 'left' }}>
                              {item.id}
                            </td>
                            <td className="p-3.5 whitespace-nowrap text-xs font-mono" style={{ textAlign: lang === 'fa' ? 'right' : 'left' }}>
                              <div className="flex flex-col gap-0.5">
                                <span className="text-slate-100 font-bold">{toJalali(item.date, lang)}</span>
                                <span className="text-[10px] text-slate-500">{item.date}</span>
                              </div>
                            </td>
                            <td className="p-3.5 font-semibold text-slate-100" style={{ textAlign: lang === 'fa' ? 'right' : 'left' }}>
                              <div className="flex items-start gap-2 flex-col" style={{ alignItems: 'start', direction: lang === 'fa' ? 'rtl' : 'ltr' }}>
                                <div className="flex items-center gap-2 flex-wrap" style={{ justifyContent: 'start' }}>
                                  {item.type === 'out' ? (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-black tracking-tighter bg-rose-500/10 text-rose-400 border border-rose-500/15">
                                      {lang === 'fa' ? 'صادره 📤' : 'OUT 📤'}
                                    </span>
                                  ) : (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-black tracking-tighter bg-emerald-500/10 text-emerald-400 border border-emerald-500/15">
                                      {lang === 'fa' ? 'وارده 📥' : 'IN 📥'}
                                    </span>
                                  )}
                                  <span>{item.receivedFrom}</span>
                                </div>
                                {item.linkedCryptoId && (
                                  <div className="mt-1 flex items-center gap-1 flex-wrap text-[10px] bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-2 py-0.5 rounded-lg font-sans" style={{ direction: 'ltr' }}>
                                    <span className="font-mono text-[9px] bg-indigo-500/30 px-1 rounded font-black text-white">{item.linkedCryptoId}</span>
                                    <span className="font-sans font-bold text-[10px]">{lang === 'fa' ? 'تبدیل شده:' : 'Converted:'}</span>
                                    <span className="font-mono font-black text-yellow-400">{item.convertedAmountInCrypto} Crypto</span>
                                    {item.conversionExchangeName && (
                                      <span className="bg-[#14161A] text-emerald-400 px-1.5 py-0.2 rounded font-black text-[9px] border border-white/5">{item.conversionExchangeName}</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="p-3.5" style={{ textAlign: lang === 'fa' ? 'right' : 'left' }}>
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-800/70 text-xs font-medium text-slate-300 border border-slate-800">
                                <PiggyBank className="h-3.5 w-3.5 text-emerald-400" />
                                {item.bankName}
                              </span>
                            </td>
                            <td className="p-3.5 max-w-[280px] text-slate-400 text-xs" style={{ textAlign: lang === 'fa' ? 'right' : 'left' }}>
                              {item.notes || '---'}
                            </td>
                            <td className="p-3.5 font-mono tracking-wide whitespace-nowrap" style={{ textAlign: lang === 'fa' ? 'left' : 'right' }}>
                              <div className="flex flex-col gap-1 items-end" style={{ alignItems: lang === 'fa' ? 'flex-end' : 'flex-start' }}>
                                <span className={`font-black text-sm ${item.type === 'out' ? 'text-rose-400' : 'text-emerald-400'}`}>
                                  {item.type === 'out' ? '-' : ''}{formatToman(item.amount)} <span className="text-[10px] font-sans text-slate-400 mr-0.5">{t.tomanUnit}</span>
                                </span>
                                {/* Mini-bar proportion representation */}
                                {(() => {
                                  const percentage = totalRialVal > 1 ? (item.amount / totalRialVal) * 100 : 0;
                                  return (
                                    <div className="flex items-center gap-1.5 select-none" style={{ direction: 'ltr' }}>
                                      <span className="text-[9px] text-white/30 font-bold">{percentage.toFixed(1)}%</span>
                                      <div className="w-16 bg-white/5 h-1 rounded-full overflow-hidden shrink-0">
                                        <div
                                          style={{ width: `${percentage}%` }}
                                          className={`h-full transition-all duration-500 ${
                                            item.type === 'out' ? 'bg-rose-500' : 'bg-emerald-500'
                                          }`}
                                        />
                                      </div>
                                    </div>
                                  );
                                })()}
                              </div>
                            </td>
                            <td className="p-3.5 no-print whitespace-nowrap text-center">
                              <div className="inline-flex items-center gap-1">
                                <button
                                  onClick={() => handleStartEditRial(item)}
                                  className="p-1.5 text-indigo-400 hover:bg-indigo-500/10 hover:text-indigo-300 rounded-lg transition-all cursor-pointer"
                                  title="Edit"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteRial(item.id)}
                                  className="p-1.5 text-rose-500 hover:bg-rose-500/10 hover:text-rose-400 rounded-lg transition-all cursor-pointer"
                                  title="Delete"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {filteredRialEntries.length > 0 && (
                      <tfoot className="bg-white/5 font-black text-white/90 border-t border-white/10">
                        <tr>
                          <td colSpan={5} className="p-5 text-right uppercase tracking-wider text-xs text-white/45 font-black">
                            {lang === 'fa' ? 'جمع تراکنش‌های فیلتر شده ریالی:' : 'Filtered Rial Sum:'}
                          </td>
                          <td className="p-5 text-left font-mono tracking-wider text-emerald-400 text-sm whitespace-nowrap" style={{ textAlign: lang === 'fa' ? 'left' : 'right' }}>
                            {formatToman(filteredRialEntries.reduce((sum, item) => sum + item.amount, 0))} <span className="text-xs font-sans text-white/50 mr-1">{t.tomanUnit}</span>
                          </td>
                          <td className="p-5 no-print"></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB CONTENT 2: CRYPTO LEDGER MODULE */}
          {activeTab === 'crypto' && (
            <div className="space-y-6" style={{ direction: lang === 'fa' ? 'rtl' : 'ltr' }}>
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
                <div className="bg-[#14161A] p-6 rounded-2xl border border-white/5 relative overflow-hidden flex items-center justify-between">
                  <div className="absolute left-6 -bottom-5 text-7xl font-sans font-black text-white/[0.012] select-none italic tracking-tighter uppercase pointer-events-none">CRYPTO</div>
                  <div className="z-10 text-right w-full">
                    <div className="flex flex-col gap-1 z-10">
                      <p className="text-[10px] font-black uppercase text-white/40 tracking-widest mb-0.5">{t.cryptoSummary}</p>
                      <p className={`text-2xl sm:text-3xl font-black font-mono tracking-tight ${netCryptoUsdVal >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {netCryptoUsdVal < 0 ? '-' : ''}${Math.abs(netCryptoUsdVal).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </p>
                      <div className="flex items-center gap-3 text-[10px] font-bold mt-1 text-slate-400 flex-wrap justify-start">
                        <span className="flex items-center gap-1 text-emerald-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                          <span>{lang === 'fa' ? 'دریافتی:' : 'In:'}</span>
                          <span className="font-mono">${cryptoStats.incomingUsd.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
                        </span>
                        <span className="flex items-center gap-1 text-rose-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                          <span>{lang === 'fa' ? 'ارسالی:' : 'Out:'}</span>
                          <span className="font-mono">${cryptoStats.outgoingUsd.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="p-3 bg-white/5 rounded-xl border border-white/10 text-emerald-400 z-10 shrink-0 self-start mt-2">
                    <Coins className="h-6 w-6" />
                  </div>
                </div>

                <div className="space-y-3 relative lg:col-span-2">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <span className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-white/35">
                        <Search className="h-4 w-4" />
                      </span>
                      <input
                        type="text"
                        placeholder={t.searchCryptoPlaceholder}
                        value={cryptoSearch}
                        onChange={(e) => setCryptoSearch(e.target.value)}
                        className="w-full pr-10 pl-4 py-4 bg-[#14161A] border border-white/10 focus:border-emerald-400 focus:outline-none rounded-xl text-sm transition-all text-right placeholder-white/20 text-white font-medium"
                        style={{ textAlign: lang === 'fa' ? 'right' : 'left', paddingRight: lang === 'fa' ? '2.5rem' : '1rem', paddingLeft: lang === 'fa' ? '1rem' : '2.5rem' }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowCryptoAdvanced(!showCryptoAdvanced)}
                      className={`px-4 py-3 rounded-xl border font-bold text-xs flex items-center gap-2 cursor-pointer transition-all shrink-0 ${
                        showCryptoAdvanced 
                          ? 'bg-emerald-400 border-emerald-400 text-black shadow-[0_0_15px_rgba(52,211,153,0.3)]' 
                          : 'bg-[#14161A] border-white/10 text-white/85 hover:border-white/25 hover:bg-[#1C1F24]'
                      }`}
                    >
                      <SlidersHorizontal className="h-4 w-4" />
                      <span className="hidden sm:inline">{lang === 'fa' ? 'فیلتر پیشرفته و مرتب‌سازی' : 'Advanced Filters & Sort'}</span>
                      {(cryptoFilterType !== 'all' || cryptoFilterStartDate || cryptoFilterEndDate || cryptoFilterMinAmount || cryptoFilterMaxAmount) && (
                        <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse"></span>
                      )}
                    </button>
                  </div>

                  {/* Advanced Filters Panel */}
                  {showCryptoAdvanced && (
                    <div className="bg-[#14161A] border border-white/10 rounded-xl p-5 space-y-4 shadow-2xl animate-fadeIn text-right relative z-30" style={{ direction: lang === 'fa' ? 'rtl' : 'ltr' }}>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        
                        {/* Ledger Type Transfer (to satisfy: transaction type (Rial or crypto)) */}
                        <div className="space-y-1.5 text-right">
                          <label className="block text-xs text-white/50 font-black uppercase tracking-wider">{lang === 'fa' ? 'نوع دفتر مالی' : 'Ledger Unit'}</label>
                          <select
                            value="crypto"
                            onChange={(e) => {
                              if (e.target.value === 'rial') {
                                setActiveTab('rial');
                                setShowRialAdvanced(true);
                              }
                            }}
                            className="w-full px-3 py-2.5 bg-[#0A0B0D] border border-white/10 rounded-lg text-xs text-emerald-400 font-bold focus:border-emerald-400 focus:outline-none"
                          >
                            <option value="crypto">{lang === 'fa' ? '🪙 فقط تراکنش‌های کریپتو' : '🪙 Crypto Transactions Only'}</option>
                            <option value="rial">{lang === 'fa' ? '🇮🇷 فقط تراکنش‌های ریالی (سوییچ)' : '🇮🇷 Rial Transactions Only (Switch)'}</option>
                          </select>
                        </div>

                        {/* Transaction Sub-Type (In vs Out) */}
                        <div className="space-y-1.5 text-right">
                          <label className="block text-xs text-white/50 font-black uppercase tracking-wider">{lang === 'fa' ? 'جهت و نوع تراکنش' : 'Transaction Direction'}</label>
                          <select
                            value={cryptoFilterType}
                            onChange={(e) => setCryptoFilterType(e.target.value as any)}
                            className="w-full px-3 py-2.5 bg-[#0A0B0D] border border-white/10 rounded-lg text-xs text-white focus:border-emerald-400 focus:outline-none"
                          >
                            <option value="all">{lang === 'fa' ? 'همه (واریزی و برداشتی)' : 'All (In & Out)'}</option>
                            <option value="in">{lang === 'fa' ? 'واریزی‌ها / وارده 📥' : 'Crypto Inflow 📥'}</option>
                            <option value="out">{lang === 'fa' ? 'برداشتی‌ها / صادره 📤' : 'Crypto Outflow 📤'}</option>
                          </select>
                        </div>

                        {/* Date Filters: Start Date */}
                        <div className="space-y-1.5 text-right">
                          <label className="block text-xs text-white/50 font-black uppercase tracking-wider">{lang === 'fa' ? 'از تاریخ' : 'Start Date'}</label>
                          <input
                            type="date"
                            value={cryptoFilterStartDate}
                            onChange={(e) => setCryptoFilterStartDate(e.target.value)}
                            className="w-full px-3 py-2.5 bg-[#0A0B0D] border border-white/10 rounded-lg text-xs text-white focus:border-emerald-400 focus:outline-none"
                          />
                        </div>

                        {/* Date Filters: End Date */}
                        <div className="space-y-1.5 text-right">
                          <label className="block text-xs text-white/50 font-black uppercase tracking-wider">{lang === 'fa' ? 'تا تاریخ' : 'End Date'}</label>
                          <input
                            type="date"
                            value={cryptoFilterEndDate}
                            onChange={(e) => setCryptoFilterEndDate(e.target.value)}
                            className="w-full px-3 py-2.5 bg-[#0A0B0D] border border-white/10 rounded-lg text-xs text-white focus:border-emerald-400 focus:outline-none"
                          />
                        </div>

                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
                        
                        {/* Min Amount */}
                        <div className="space-y-1.5 text-right">
                          <label className="block text-xs text-white/50 font-black uppercase tracking-wider">{lang === 'fa' ? 'حداقل مقدار کوین' : 'Min Coin Amount'}</label>
                          <input
                            type="number"
                            step="any"
                            placeholder="0"
                            value={cryptoFilterMinAmount}
                            onChange={(e) => setCryptoFilterMinAmount(e.target.value)}
                            className="w-full px-3 py-2.5 bg-[#0A0B0D] border border-white/10 rounded-lg text-xs text-white focus:border-emerald-400 focus:outline-none font-mono"
                          />
                        </div>

                        {/* Max Amount */}
                        <div className="space-y-1.5 text-right">
                          <label className="block text-xs text-white/50 font-black uppercase tracking-wider">{lang === 'fa' ? 'حداکثر مقدار کوین' : 'Max Coin Amount'}</label>
                          <input
                            type="number"
                            step="any"
                            placeholder="مثلا: 100"
                            value={cryptoFilterMaxAmount}
                            onChange={(e) => setCryptoFilterMaxAmount(e.target.value)}
                            className="w-full px-3 py-2.5 bg-[#0A0B0D] border border-[#fffff]/10 border-white/10 rounded-lg text-xs text-white focus:border-emerald-400 focus:outline-none font-mono"
                          />
                        </div>

                        {/* Sorting options */}
                        <div className="space-y-1.5 text-right col-span-1 sm:col-span-2">
                          <label className="block text-xs text-white/50 font-black uppercase tracking-wider">{lang === 'fa' ? 'مرتب‌سازی بر اساس' : 'Sort Results By'}</label>
                          <select
                            value={cryptoSortBy}
                            onChange={(e) => setCryptoSortBy(e.target.value as any)}
                            className="w-full px-3 py-2.5 bg-[#0A0B0D] border border-white/10 rounded-lg text-xs text-emerald-300 font-bold focus:border-emerald-400 focus:outline-none"
                          >
                            <option value="date-desc">{lang === 'fa' ? '📅 تاریخ تراکنش (جدیدترین به قدیمی‌ترین)' : '📅 Date: Newest First'}</option>
                            <option value="date-asc">{lang === 'fa' ? '📅 تاریخ تراکنش (قدیمی‌ترین به جدیدترین)' : '📅 Date: Oldest First'}</option>
                            <option value="amount-desc">{lang === 'fa' ? '💎 مقدار تراکنش (بیشترین نخست)' : '💎 Amount: Highest First'}</option>
                            <option value="amount-asc">{lang === 'fa' ? '💎 مقدار تراکنش (کم‌ترین نخست)' : '💎 Amount: Lowest First'}</option>
                            <option value="coin-asc">{lang === 'fa' ? '🪙 نام رمزارز (A-Z)' : '🪙 Coin Symbol: A to Z'}</option>
                            <option value="coin-desc">{lang === 'fa' ? '🪙 نام رمزارز (Z-A)' : '🪙 Coin Symbol: Z to A'}</option>
                          </select>
                        </div>

                      </div>

                      {/* Clear/Reset Advanced Filters */}
                      <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
                        <button
                          type="button"
                          onClick={() => {
                            setCryptoFilterType('all');
                            setCryptoFilterStartDate('');
                            setCryptoFilterEndDate('');
                            setCryptoFilterMinAmount('');
                            setCryptoFilterMaxAmount('');
                            setCryptoSearch('');
                            setCryptoSortBy('date-desc');
                          }}
                          className="px-3.5 py-1.5 bg-[#1F2228] hover:bg-[#282B33] text-[#f2f2f2]/70 hover:text-white rounded-lg text-xs transition-colors cursor-pointer"
                        >
                          {lang === 'fa' ? 'پاک کردن همه فیلترها' : 'Reset Filters'}
                        </button>
                      </div>

                    </div>
                  )}
                </div>
              </div>

              {/* Quick Add Crypto Transaction */}
              <div className="no-print">
                {!showCryptoForm ? (
                  <button
                    onClick={() => {
                      setEditingCryptoId(null);
                      setCryptoFormCoin('USDT');
                      setCryptoFormAmount('');
                      setCryptoFormNetwork('TRC-20');
                      setCryptoFormTxHash('');
                      setCryptoFormNotes('');
                      setShowCryptoForm(true);
                    }}
                    className="w-full py-4 border-2 border-dashed border-white/10 hover:border-emerald-400/40 bg-[#14161A]/30 hover:bg-[#14161A]/55 rounded-xl text-emerald-400 hover:text-emerald-300 text-sm font-black transition-all flex items-center justify-center gap-2 cursor-pointer uppercase"
                  >
                    <PlusCircle className="h-5 w-5 animate-bounce" />
                    <span>{t.newCryptoButton}</span>
                  </button>
                ) : (
                  <form
                    onSubmit={handleSaveCrypto}
                    className="bg-[#14161A] border border-emerald-400/30 rounded-2xl p-6 shadow-2xl space-y-4 text-right"
                  >
                    <div className="flex items-center justify-between border-b border-white/10 pb-3">
                      <h3 className="font-black text-sm text-emerald-400 flex items-center gap-1.5 uppercase">
                        <Plus className="h-4 w-4" />
                        {editingCryptoId ? `${t.cryptoFormTitleEdit} ${editingCryptoId}` : t.cryptoFormTitleAdd}
                      </h3>
                      <button
                        type="button"
                        onClick={() => setShowCryptoForm(false)}
                        className="p-1 text-white/40 hover:text-white rounded-lg hover:bg-white/5 cursor-pointer"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Transaction Status Selector (Incoming / Outgoing) */}
                    <div className="flex justify-end pt-1 pb-1" style={{ direction: lang === 'fa' ? 'rtl' : 'ltr' }}>
                      <div className="flex items-center gap-1.5 bg-[#090A0C] p-1 rounded-xl border border-white/5">
                        <button
                          type="button"
                          onClick={() => setCryptoFormType('in')}
                          className={`px-4 py-2 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                            cryptoFormType === 'in'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'text-white/40 hover:text-white/70 border border-transparent'
                          }`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                          <span>{t.typeIncoming}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setCryptoFormType('out')}
                          className={`px-4 py-2 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                            cryptoFormType === 'out'
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              : 'text-white/40 hover:text-white/70 border border-transparent'
                          }`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                          <span>{t.typeOutgoing}</span>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {/* Date */}
                      <div className="space-y-1.5 col-span-1">
                        <div className="flex items-center justify-between">
                          <label className="block text-xs text-white/50 font-black uppercase tracking-wider">{t.date} *</label>
                          <button
                            type="button"
                            onClick={() => setCryptoCalendarMode(p => p === 'jalali' ? 'gregorian' : 'jalali')}
                            className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold underline cursor-pointer transition-colors"
                          >
                            {cryptoCalendarMode === 'jalali' 
                              ? (lang === 'fa' ? '🔄 ورود میلادی' : '🔄 Switch to Gregorian')
                              : (lang === 'fa' ? '🔄 ورود شمسی' : '🔄 Switch to Jalali')}
                          </button>
                        </div>

                        {cryptoCalendarMode === 'jalali' ? (
                          <div className="space-y-1.5">
                            {/* Jalali selects layout */}
                            <div className="grid grid-cols-3 gap-1.5" style={{ direction: 'rtl' }}>
                              {/* Day Select */}
                              <div>
                                <select
                                  value={cryptoJalaliParts.jd}
                                  onChange={(e) => updateCryptoJalaliValue('d', parseInt(e.target.value, 10))}
                                  className="w-full px-1 py-1.5 bg-[#0A0B0D] border border-white/10 rounded-lg text-xs text-white focus:border-emerald-400 focus:outline-none"
                                >
                                  {Array.from({ length: getJalaliLimits(cryptoJalaliParts.jy, cryptoJalaliParts.jm) }, (_, i) => 1 + i).map(num => (
                                    <option key={num} value={num}>{num}</option>
                                  ))}
                                </select>
                                <span className="block text-[8px] text-center text-white/30 font-bold mt-0.5">{lang === 'fa' ? 'روز' : 'Day'}</span>
                              </div>

                              {/* Month Select */}
                              <div>
                                <select
                                  value={cryptoJalaliParts.jm}
                                  onChange={(e) => updateCryptoJalaliValue('m', parseInt(e.target.value, 10))}
                                  className="w-full px-1 py-1.5 bg-[#0A0B0D] border border-white/10 rounded-lg text-xs text-white focus:border-emerald-400 focus:outline-none"
                                >
                                  {jalaliMonthsList.map(m => (
                                    <option key={m.val} value={m.val}>
                                      {lang === 'fa' ? m.name.split(' (')[0] : m.name}
                                    </option>
                                  ))}
                                </select>
                                <span className="block text-[8px] text-center text-white/30 font-bold mt-0.5">{lang === 'fa' ? 'ماه' : 'Month'}</span>
                              </div>

                              {/* Year Select */}
                              <div>
                                <select
                                  value={cryptoJalaliParts.jy}
                                  onChange={(e) => updateCryptoJalaliValue('y', parseInt(e.target.value, 10))}
                                  className="w-full px-1 py-1.5 bg-[#0A0B0D] border border-white/10 rounded-lg text-xs text-[#10B981] font-bold focus:border-emerald-400 focus:outline-none"
                                >
                                  {Array.from({ length: 26 }, (_, i) => 1390 + i).map(y => (
                                    <option key={y} value={y}>{y}</option>
                                  ))}
                                </select>
                                <span className="block text-[8px] text-center text-white/30 font-bold mt-0.5">{lang === 'fa' ? 'سال' : 'Year'}</span>
                              </div>
                            </div>
                            
                            {/* Standard value preview */}
                            <div className="text-[10px] text-white/40 font-mono mt-1" style={{ direction: lang === 'fa' ? 'rtl' : 'ltr' }}>
                              <span>📅 {lang === 'fa' ? 'معادل میلادی: ' : 'Gregorian: '}</span>
                              <span className="font-bold text-slate-300">{cryptoFormDate}</span>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <input
                              type="date"
                              required
                              value={cryptoFormDate}
                              onChange={(e) => setCryptoFormDate(e.target.value)}
                              className="w-full px-3 py-2 bg-[#0A0B0D] border border-white/10 rounded-lg text-sm text-white focus:border-emerald-400 focus:outline-none"
                            />
                            {cryptoFormDate && (
                              <div className="text-[10px] text-emerald-400 font-bold flex items-center gap-1.5 px-1 mt-1 select-none" style={{ direction: lang === 'fa' ? 'rtl' : 'ltr' }}>
                                <span>📅 {lang === 'fa' ? 'معادل شمسی:' : 'Jalali:'}</span>
                                <span className="font-mono text-xs text-emerald-300 font-black">{toJalali(cryptoFormDate, lang)}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Coin Symbol */}
                      <div className="space-y-1.5">
                        <label className="block text-xs text-white/50 font-black uppercase tracking-wider">{t.coinName} *</label>
                        <input
                          type="text"
                          placeholder="USDT, BTC, ETH"
                          required
                          value={cryptoFormCoin}
                          onChange={(e) => setCryptoFormCoin(e.target.value)}
                          className="w-full px-3 py-2.5 bg-[#0A0B0D] border border-white/10 rounded-lg text-sm font-bold text-white focus:border-emerald-400 text-left"
                        />
                        {cryptoFormCoin.trim() && (
                          <div className="flex items-center gap-1.5 text-[10px] pt-0.5" style={{ direction: lang === 'fa' ? 'rtl' : 'ltr' }}>
                            {isFetchingPrice ? (
                              <span className="text-amber-400 animate-pulse flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
                                {lang === 'fa' ? 'در حال دریافت آنلاین قیمت...' : 'Fetching live price...'}
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleFetchPrice(cryptoFormCoin)}
                                className="text-emerald-400 hover:text-emerald-300 underline font-extrabold cursor-pointer transition-colors"
                              >
                                {lang === 'fa' ? '🔄 دریافت قیمت زنده آنلاین' : '🔄 Fetch Live Price'}
                              </button>
                            )}
                            {priceFetchStatus === 'success' && !isFetchingPrice && (
                              <span className="text-emerald-400 font-bold bg-emerald-500/10 px-1 rounded">
                                ✓ {lang === 'fa' ? 'بروزرسانی شد' : 'Updated'}
                              </span>
                            )}
                            {priceFetchStatus === 'error' && !isFetchingPrice && (
                              <span className="text-rose-400 font-medium">
                                ⚠️ {lang === 'fa' ? 'نامشخص (دستی وارد کنید)' : 'Unknown (enter manually)'}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Quantity */}
                      <div className="space-y-1.5">
                        <label className="block text-xs text-white/50 font-black uppercase tracking-wider">{t.cryptoTableAmount} *</label>
                        <input
                          type="number"
                          step="any"
                          placeholder="0.00"
                          required
                          value={cryptoFormAmount}
                          onChange={(e) => setCryptoFormAmount(e.target.value)}
                          className="w-full px-3 py-2.5 bg-[#0A0B0D] border border-white/10 rounded-lg text-sm font-mono text-white focus:border-emerald-400 text-left"
                        />
                      </div>

                      {/* Network */}
                      <div className="space-y-1.5">
                        <label className="block text-xs text-white/50 font-black uppercase tracking-wider">{t.network} *</label>
                        <input
                          type="text"
                          placeholder="TRC-20, ERC-20, TON"
                          required
                          value={cryptoFormNetwork}
                          onChange={(e) => setCryptoFormNetwork(e.target.value)}
                          className="w-full px-3 py-2.5 bg-[#0A0B0D] border border-white/10 rounded-lg text-sm text-white focus:border-emerald-400 text-left"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Price per unit */}
                      <div className="space-y-1.5">
                        <label className="block text-xs text-white/50 font-black uppercase tracking-wider">{t.coinPriceLabel}</label>
                        <input
                          type="number"
                          step="any"
                          placeholder={lang === 'fa' ? 'مثلا: 1.00 یا 65000' : 'e.g. 1.00 or 65000'}
                          value={cryptoFormPrice}
                          onChange={(e) => setCryptoFormPrice(e.target.value)}
                          className="w-full px-3 py-2.5 bg-[#0A0B0D] border border-white/10 rounded-lg text-sm font-mono text-white focus:border-emerald-400 text-left"
                        />
                      </div>

                      {/* Wallet address */}
                      <div className="space-y-1.5">
                        <label className="block text-xs text-white/50 font-black uppercase tracking-wider">{t.walletAddressLabel}</label>
                        <input
                          type="text"
                          placeholder={lang === 'fa' ? 'آدرس ولت مقصد واریز' : 'Destination wallet address'}
                          value={cryptoFormWallet}
                          onChange={(e) => setCryptoFormWallet(e.target.value)}
                          className="w-full px-3 py-2.5 bg-[#0A0B0D] border border-white/10 rounded-lg text-sm text-white focus:border-emerald-400 text-left font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Hash */}
                      <div className="space-y-1.5">
                        <label className="block text-xs text-white/50 font-black uppercase tracking-wider">{t.txHash}</label>
                        <input
                          type="text"
                          placeholder="0x93cffba35..."
                          value={cryptoFormTxHash}
                          onChange={(e) => setCryptoFormTxHash(e.target.value)}
                          className="w-full px-3 py-2.5 bg-[#0A0B0D] border border-white/10 rounded-lg text-xs font-mono text-white focus:border-emerald-400 text-left"
                        />
                      </div>

                      {/* Crypto Notes */}
                      <div className="space-y-1.5">
                        <label className="block text-xs text-white/50 font-black uppercase tracking-wider">{t.description}</label>
                        <input
                          type="text"
                          placeholder={lang === 'fa' ? 'مثلا: بابت شارژ صرافی' : 'Transaction notes'}
                          value={cryptoFormNotes}
                          onChange={(e) => setCryptoFormNotes(e.target.value)}
                          className="w-full px-3 py-2.5 bg-[#0A0B0D] border border-white/10 rounded-lg text-sm text-white focus:border-emerald-400 text-right font-semibold"
                          style={{ textAlign: lang === 'fa' ? 'right' : 'left' }}
                        />
                      </div>
                    </div>

                    {cryptoFormAmount && cryptoFormPrice && !isNaN(parseFloat(cryptoFormAmount)) && !isNaN(parseFloat(cryptoFormPrice)) && (
                      <div className="bg-emerald-400/10 border border-emerald-400/25 p-3.5 rounded-xl text-center text-xs text-emerald-300 font-bold" style={{ direction: lang === 'fa' ? 'rtl' : 'ltr' }}>
                        {lang === 'fa' ? 'ارزش مجموع تراکنش:' : 'Total Transaction Value:'}{' '}
                        <span className="text-sm font-mono text-emerald-400 mx-1">
                          {(parseFloat(cryptoFormAmount) * parseFloat(cryptoFormPrice)).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                        </span>{' '}
                        {lang === 'fa' ? 'دلار (USD)' : 'USD'}
                      </div>
                    )}

                    <div className="flex justify-end gap-2.5 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowCryptoForm(false)}
                        className="px-4 py-2.5 border border-white/10 hover:bg-white/5 rounded-xl text-xs font-bold text-white/50 hover:text-white transition-colors cursor-pointer"
                      >
                        {t.cancel}
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2.5 bg-emerald-400 hover:bg-emerald-350 text-black font-black text-xs rounded-xl shadow-lg hover:shadow-[0_0_15px_rgba(52,211,153,0.5)] active:scale-95 transition-all uppercase cursor-pointer"
                      >
                        {t.saveCrypto}
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* Dynamic Sum & Classification System (Crypto) */}
              <div className="bg-[#14161A] border border-white/5 rounded-2xl p-6 shadow-2xl space-y-6 no-print">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <div className="flex items-center gap-2.5">
                    <span className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/15">
                      <TrendingUp className="h-5 w-5" />
                    </span>
                    <div className="text-right">
                      <h3 className="font-black text-sm text-white">
                        {lang === 'fa' ? '📊 محاسبات و طبقه‌بندی خودکار فیلترها (کریپتو)' : '📊 Crypto Filter Analytics & Auto Sum'}
                      </h3>
                      <p className="text-[10px] text-white/40 mt-0.5">
                        {lang === 'fa' ? 'محاسبات زنده دریافتی‌ها و تفکیک بر اساس کوین فیلتر شده' : 'Real-time inflows & coin categorization for filtered criteria'}
                      </p>
                    </div>
                  </div>
                  <div className="text-[10px] font-mono bg-white/5 text-emerald-400 border border-white/10 px-2.5 py-1 rounded-lg">
                    {lang === 'fa' ? `تعداد کل: ${filteredCryptoEntries.length} تراکنش` : `Total: ${filteredCryptoEntries.length} transactions`}
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Column 1: Core sums stats */}
                  <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Inflow Box */}
                    <div className="bg-[#090A0C] border border-emerald-500/15 p-4 rounded-xl flex flex-col justify-between" style={{ direction: lang === 'fa' ? 'rtl' : 'ltr' }}>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-white/50 font-black uppercase">
                          {lang === 'fa' ? 'جمع کل دریافتی‌ها' : 'Total Deposits'}
                        </span>
                        <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded text-[9px] font-bold">
                          {lang === 'fa' ? `${filteredCryptoStats.inflowCount} تراکنش` : `${filteredCryptoStats.inflowCount} In`}
                        </span>
                      </div>
                      <div className="mt-3 text-right" style={{ textAlign: lang === 'fa' ? 'right' : 'left' }}>
                        <span className="text-lg font-black font-mono text-emerald-400 block tracking-tight">
                          ${filteredCryptoStats.inflowTotalUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </span>
                        <span className="text-[9px] text-white/30 font-sans block mt-0.5">USD</span>
                      </div>
                    </div>

                    {/* Outflow Box */}
                    <div className="bg-[#090A0C] border border-rose-500/15 p-4 rounded-xl flex flex-col justify-between" style={{ direction: lang === 'fa' ? 'rtl' : 'ltr' }}>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-white/50 font-black uppercase">
                          {lang === 'fa' ? 'جمع کل پرداختی‌ها' : 'Total Withdrawals'}
                        </span>
                        <span className="px-1.5 py-0.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded text-[9px] font-bold">
                          {lang === 'fa' ? `${filteredCryptoStats.outflowCount} تراکنش` : `${filteredCryptoStats.outflowCount} Out`}
                        </span>
                      </div>
                      <div className="mt-3 text-right" style={{ textAlign: lang === 'fa' ? 'right' : 'left' }}>
                        <span className="text-lg font-black font-mono text-rose-400 block tracking-tight">
                          ${filteredCryptoStats.outflowTotalUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </span>
                        <span className="text-[9px] text-white/30 font-sans block mt-0.5">USD</span>
                      </div>
                    </div>

                    {/* Net Box */}
                    <div className="bg-[#090A0C] border border-white/5 p-4 rounded-xl flex flex-col justify-between" style={{ direction: lang === 'fa' ? 'rtl' : 'ltr' }}>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-white/50 font-black uppercase">
                          {lang === 'fa' ? 'مانده خالص نهایی' : 'Net Surplus'}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          filteredCryptoStats.netTotalUsd >= 0 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}>
                          {filteredCryptoStats.netTotalUsd >= 0 ? '+' : '-'}
                        </span>
                      </div>
                      <div className="mt-3 text-right" style={{ textAlign: lang === 'fa' ? 'right' : 'left' }}>
                        <span className={`text-lg font-black font-mono block tracking-tight ${
                          filteredCryptoStats.netTotalUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}>
                          {filteredCryptoStats.netTotalUsd < 0 ? '-' : ''}${Math.abs(filteredCryptoStats.netTotalUsd).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </span>
                        <span className="text-[9px] text-white/30 font-sans block mt-0.5">USD</span>
                      </div>
                    </div>
                  </div>

                  {/* Column 2: Coin Breakdown classification */}
                  <div className="lg:col-span-5 bg-[#090A0C] border border-white/5 rounded-xl p-4 flex flex-col justify-between text-right" style={{ direction: lang === 'fa' ? 'rtl' : 'ltr' }}>
                    <div>
                      <span className="text-[10px] text-white/40 font-black uppercase tracking-widest block mb-3 text-right">
                        {lang === 'fa' ? '🪙 طبقه‌بندی ارزش بر اساس رمزارزها' : '🪙 Coin Classification breakdown'}
                      </span>
                      {filteredCryptoStats.sortedCoins.length === 0 ? (
                        <div className="text-center py-4 text-xs text-white/20 font-bold">
                          {lang === 'fa' ? 'داده‌ای برای تفکیک یافت نشد' : 'No breakdown data available'}
                        </div>
                      ) : (
                        <div className="space-y-3 max-h-[120px] overflow-y-auto pl-1 pr-1">
                          {filteredCryptoStats.sortedCoins.slice(0, 4).map((coin) => {
                            const totalValUsd = filteredCryptoStats.inflowTotalUsd || 1;
                            const percentage = (coin.usd / totalValUsd) * 100;
                            return (
                              <div key={coin.name} className="space-y-1">
                                <div className="flex items-center justify-between text-xs font-semibold">
                                  <span className="text-white/80">{coin.name}</span>
                                  <span className="font-mono text-emerald-400 font-bold">
                                    {coin.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })}{' '}
                                    <span className="text-[9px] font-sans text-white/40">(${coin.usd.toLocaleString(undefined, { maximumFractionDigits: 1 })})</span>
                                  </span>
                                </div>
                                <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-emerald-400 transition-all duration-500 rounded-full"
                                    style={{ width: `${Math.min(100, percentage)}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Grid Table representation */}
              <div className="bg-[#14161A] border-2 border-black rounded-2xl overflow-hidden shadow-2xl print-card">
                <div className="overflow-x-auto min-h-[250px]">
                  <table className="w-full text-right border-collapse">
                    <thead className="bg-[#14161A] border-b border-white/10 text-white/40 text-[10px] font-black uppercase tracking-widest text-right whitespace-nowrap">
                      <tr>
                        <th className="p-3.5 font-bold" style={{ textAlign: lang === 'fa' ? 'right' : 'left' }}>{t.cryptoTableId}</th>
                        <th className="p-3.5 font-bold" style={{ textAlign: lang === 'fa' ? 'right' : 'left' }}>{t.cryptoTableDate}</th>
                        <th className="p-3.5 font-bold" style={{ textAlign: lang === 'fa' ? 'right' : 'left' }}>{t.cryptoTableCoin}</th>
                        <th className="p-3.5 font-bold text-left" style={{ textAlign: lang === 'fa' ? 'left' : 'right' }}>{t.cryptoTableAmount}</th>
                        <th className="p-3.5 font-bold text-left" style={{ textAlign: lang === 'fa' ? 'left' : 'right' }}>{t.coinPriceLabel}</th>
                        <th className="p-3.5 font-bold text-left" style={{ textAlign: lang === 'fa' ? 'left' : 'right' }}>{t.equivalentUsdLabel}</th>
                        <th className="p-3.5 font-bold" style={{ textAlign: lang === 'fa' ? 'right' : 'left' }}>{t.walletAddressLabel}</th>
                        <th className="p-3.5 font-bold" style={{ textAlign: lang === 'fa' ? 'right' : 'left' }}>{t.cryptoTableNetwork}</th>
                        <th className="p-3.5 font-bold" style={{ textAlign: lang === 'fa' ? 'right' : 'left' }}>{t.cryptoTableTxHash}</th>
                        <th className="p-3.5 font-bold" style={{ textAlign: lang === 'fa' ? 'right' : 'left' }}>{t.cryptoTableNotes}</th>
                        <th className="p-3.5 font-bold text-center no-print">عملیات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-sm text-white/90">
                      {filteredCryptoEntries.length === 0 ? (
                        <tr>
                          <td colSpan={11} className="p-12 text-center text-white/30 text-xs">
                            {t.noCryptoEntries}
                          </td>
                        </tr>
                      ) : (
                        filteredCryptoEntries.map((item) => (
                          <tr key={item.id} className="hover:bg-white/5 transition-colors">
                            <td className="p-3.5 font-mono text-xs font-black text-emerald-400" style={{ textAlign: lang === 'fa' ? 'right' : 'left' }}>
                              {item.id}
                            </td>
                            <td className="p-3.5 whitespace-nowrap text-xs font-mono" style={{ textAlign: lang === 'fa' ? 'right' : 'left' }}>
                              <div className="flex flex-col gap-0.5">
                                <span className="text-white font-bold">{toJalali(item.date, lang)}</span>
                                <span className="text-[10px] text-white/30">{item.date}</span>
                              </div>
                            </td>
                            <td className="p-3.5 font-black text-white font-mono" style={{ textAlign: lang === 'fa' ? 'right' : 'left' }}>
                              <div className="flex flex-col gap-1.5" style={{ alignItems: lang === 'fa' ? 'flex-start' : 'flex-end' }}>
                                <div className="flex items-center gap-1.5 flex-wrap" style={{ justifyContent: 'start' }}>
                                  {item.type === 'out' ? (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-black tracking-tighter bg-rose-500/10 text-rose-400 border border-rose-500/15">
                                      {lang === 'fa' ? 'صادره 📤' : 'OUT 📤'}
                                    </span>
                                  ) : (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-black tracking-tighter bg-emerald-500/10 text-emerald-400 border border-emerald-500/15">
                                      {lang === 'fa' ? 'وارده 📥' : 'IN 📥'}
                                    </span>
                                  )}
                                  <span className="px-2 py-0.5 rounded bg-emerald-400/10 text-emerald-400 text-xs font-black border border-emerald-400/15">
                                    {item.coinName}
                                  </span>
                                </div>
                                {/* Conversion details list */}
                                {item.convertedAmount !== undefined && item.convertedAmount > 0 && (
                                  <div className="flex flex-col gap-1 w-full text-right" style={{ direction: 'rtl' }}>
                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold text-center inline-block w-max ${
                                      item.convertedAmount >= item.amount 
                                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/35 font-extrabold' 
                                        : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                                    }`}>
                                      {item.convertedAmount >= item.amount 
                                        ? (lang === 'fa' ? '✓ ۱۰۰٪ نقد شده' : '✓ 100% SOLD')
                                        : (lang === 'fa' ? `نقد شده: ${item.convertedAmount} / ${item.amount} ${item.coinName}` : `Cashed: ${item.convertedAmount} / ${item.amount} ${item.coinName}`)
                                      }
                                    </span>
                                    {item.linkedRialEntries && item.linkedRialEntries.length > 0 && (
                                      <div className="flex flex-col gap-1 mt-1 border-t border-white/5 pt-1.5 w-full text-right" style={{ direction: 'rtl' }}>
                                        <span className="text-[8px] text-white/40 font-black tracking-wider uppercase">{lang === 'fa' ? 'فیش‌های بانکی متصل:' : 'Linked Rial Receipts:'}</span>
                                        {item.linkedRialEntries.map((l, index) => (
                                          <div key={index} className="flex justify-between items-center text-[9px] text-[#A5B4FC] font-mono gap-2 bg-[#0A0B0D] p-1 rounded-md border border-white/5">
                                            <span className="text-[8px] bg-indigo-500/20 text-indigo-300 rounded px-1 select-all font-black">{l.rialId}</span>
                                            <span>{l.convertedCryptoAmount} {item.coinName} ➔ {l.rialAmount.toLocaleString()} {lang === 'fa' ? 'تومان' : 'Tomans'} ({l.exchangeName})</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="p-3.5 text-left font-black font-mono tracking-wide whitespace-nowrap" style={{ textAlign: lang === 'fa' ? 'left' : 'right' }}>
                              <span className={item.type === 'out' ? 'text-rose-400' : 'text-slate-100'}>
                                {item.type === 'out' ? '-' : ''}{item.amount.toLocaleString()}
                              </span>{' '}
                              <span className="text-[10px] font-sans text-emerald-400 mr-0.5">{item.coinName}</span>
                            </td>
                            <td className="p-3.5 text-left font-mono text-xs text-white" style={{ textAlign: lang === 'fa' ? 'left' : 'right' }}>
                              {item.coinPrice !== undefined ? `$${item.coinPrice.toLocaleString(undefined, { maximumFractionDigits: 4 })}` : '---'}
                            </td>
                            <td className="p-3.5 text-left font-mono tracking-wide" style={{ textAlign: lang === 'fa' ? 'left' : 'right' }}>
                              <div className="flex flex-col gap-1 items-end" style={{ alignItems: lang === 'fa' ? 'flex-end' : 'flex-start' }}>
                                <span className={`font-black text-sm ${item.type === 'out' ? 'text-rose-400' : 'text-emerald-400'}`}>
                                  {item.type === 'out' ? '-' : ''}${((item.equivalentUsd !== undefined) ? item.equivalentUsd : (item.amount * (item.coinPrice || 1))).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                </span>
                                {/* Mini progress bar for Crypto */}
                                {(() => {
                                  const percentage = getCryptoPercentage(item);
                                  return (
                                    <div className="flex items-center gap-1.5 select-none" style={{ direction: 'ltr' }}>
                                      <span className="text-[9px] text-white/30 font-bold">{percentage.toFixed(1)}%</span>
                                      <div className="w-16 bg-white/5 h-1 rounded-full overflow-hidden shrink-0">
                                        <div
                                          style={{ width: `${percentage}%` }}
                                          className={`h-full transition-all duration-500 ${
                                            item.type === 'out' ? 'bg-rose-500' : 'bg-emerald-500'
                                          }`}
                                        />
                                      </div>
                                    </div>
                                  );
                                })()}
                              </div>
                            </td>
                            <td className="p-3.5 font-mono text-xs text-emerald-300 max-w-[150px] truncate select-all" style={{ textAlign: lang === 'fa' ? 'right' : 'left' }} title={item.walletAddress}>
                              {item.walletAddress || '---'}
                            </td>
                            <td className="p-3.5 font-mono text-xs text-emerald-300" style={{ textAlign: lang === 'fa' ? 'right' : 'left' }}>
                              {item.network}
                            </td>
                            <td className="p-3.5 max-w-[180px] font-mono text-white/40 text-xs truncate select-all cursor-all-scroll" style={{ textAlign: lang === 'fa' ? 'right' : 'left' }} title={item.txHash}>
                              {item.txHash || '---'}
                            </td>
                            <td className="p-3.5 max-w-[200px] text-white/45 text-xs truncate" style={{ textAlign: lang === 'fa' ? 'right' : 'left' }}>
                              {item.notes || '---'}
                            </td>
                            <td className="p-3.5 no-print whitespace-nowrap text-center text-xs">
                              <div className="inline-flex items-center gap-1">
                                {item.type !== 'out' && (item.convertedAmount || 0) < item.amount && (
                                  <button
                                    onClick={() => handleOpenConvertModal(item)}
                                    className="p-1.5 text-emerald-400 hover:bg-emerald-400/15 hover:text-emerald-300 rounded-lg transition-all cursor-pointer flex items-center gap-1 font-sans text-[10px] font-black tracking-tighter uppercase mr-1 border border-emerald-500/10 hover:border-emerald-500/30 bg-emerald-500/5"
                                    title={lang === 'fa' ? 'تبدیل رمزارز و ثبت دریافت ریالی' : 'Convert part to Rial & Link'}
                                  >
                                    <RefreshCw className="h-3.5 w-3.5 text-emerald-400 hover:rotate-45 transition-transform" />
                                    <span>{lang === 'fa' ? 'ریالی کردن' : 'LINK RIAL'}</span>
                                  </button>
                                )}
                                <button
                                  onClick={() => handleStartEditCrypto(item)}
                                  className="p-1.5 text-indigo-400 hover:bg-emerald-400/10 hover:text-emerald-400 rounded-lg transition-all cursor-pointer"
                                  title="Edit"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteCrypto(item.id)}
                                  className="p-1.5 text-rose-500 hover:bg-rose-500/10 hover:text-rose-400 rounded-lg transition-all cursor-pointer"
                                  title="Delete"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB CONTENT 3: CALCULATED AND AGGREGATED REPORT STATS */}
          {activeTab === 'analytics' && (
            <div className="space-y-6" style={{ direction: lang === 'fa' ? 'rtl' : 'ltr' }}>
              <div className="bg-[#14161A] border border-white/10 p-6 rounded-2xl">
                <h2 className="text-lg font-black text-white flex items-center gap-2 uppercase tracking-tight">
                  <TrendingUp className="h-5 w-5 text-emerald-400 animate-pulse" />
                  <span>{t.analyticsTitle}</span>
                </h2>
                <p className="text-white/50 text-xs mt-1 leading-relaxed">
                  {t.analyticsSubtitle}
                </p>
              </div>

              {/* Rial Trend Line Chart Card */}
              <div className="bg-[#14161A] border border-white/10 p-6 rounded-2xl shadow-2xl space-y-4 print-card">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl">
                      <TrendingUp className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-sm sm:text-base text-white">
                        {lang === 'fa' ? 'نمودار روند ورودی و خروجی جریان ریالی' : 'Rial Inflow vs Outflow Trend Analysis'}
                      </h3>
                      <p className="text-xs text-white/40 mt-0.5">
                        {lang === 'fa' ? 'بررسی زمانی فیش‌های وارده و صادره نقدی معادل تومان' : 'Chronological overview of verified bank deposit receipts over time'}
                      </p>
                    </div>
                  </div>

                  {/* Timeframe selector controls */}
                  <div className="flex items-center gap-1.5 self-stretch sm:self-auto justify-end">
                    <span className="text-[10px] text-white/40 uppercase font-mono tracking-wider mr-1 hidden sm:inline">
                      {lang === 'fa' ? 'بازه زمانی:' : 'Timeframe:'}
                    </span>
                    <div className="bg-black/40 p-1 border border-white/5 rounded-xl flex items-center gap-1 text-[11px] font-bold">
                      {[
                        { label: lang === 'fa' ? '۷ روزه' : '7 Days', val: 7 },
                        { label: lang === 'fa' ? '۱۵ روزه' : '15 Days', val: 15 },
                        { label: lang === 'fa' ? '۳۰ روزه' : '30 Days', val: 30 },
                        { label: lang === 'fa' ? 'دیتا کل' : 'All', val: 0 }
                      ].map((tf) => (
                        <button
                          key={tf.val}
                          onClick={() => setTrendTimeframe(tf.val)}
                          className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                            trendTimeframe === tf.val 
                              ? 'bg-indigo-500 text-white shadow-lg' 
                              : 'text-white/60 hover:text-white hover:bg-white/5'
                          }`}
                        >
                          {tf.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {filteredTrendData.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center space-y-2">
                    <TrendingUp className="h-10 w-10 text-white/10" />
                    <p className="text-xs text-white/30">{t.noAnalyticsData}</p>
                  </div>
                ) : (
                  <motion.div 
                    key={trendTimeframe + '_' + filteredTrendData.length}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    className="w-full h-[320px] pt-4 pr-1"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={filteredTrendData}
                        margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
                      >
                        <defs>
                          <g id="tooltip-glow">
                            <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                              <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#000" floodOpacity="0.4" />
                            </filter>
                          </g>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2D3139" vertical={false} opacity={0.6} />
                        <XAxis 
                          dataKey="date" 
                          stroke="#71717a" 
                          fontSize={11}
                          fontFamily="JetBrains Mono, Courier New, monospace animate-fade-in"
                          tickLine={false}
                          dy={10}
                        />
                        <YAxis 
                          stroke="#71717a" 
                          fontSize={10}
                          fontFamily="JetBrains Mono, Courier New, monospace"
                          tickLine={false}
                          dx={-10}
                          tickFormatter={(v) => formatChartYAxis(v)}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#0F172A',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '12px',
                            padding: '10px 14px',
                            textAlign: lang === 'fa' ? 'right' : 'left'
                          }}
                          labelStyle={{
                            color: '#94A3B8',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            fontFamily: 'JetBrains Mono, monospace',
                            marginBottom: '4px'
                          }}
                          itemStyle={{
                            fontSize: '11px',
                            padding: '2px 0'
                          }}
                          formatter={(value: number, name: string) => {
                            const formatted = value.toLocaleString();
                            const unitText = lang === 'fa' ? 'تومان' : 'Tomans';
                            const label = name === 'inflow' 
                              ? (lang === 'fa' ? 'ورودی (واریز)' : 'Inflow (Deposit)') 
                              : name === 'outflow'
                                ? (lang === 'fa' ? 'خروجی (برداشت)' : 'Outflow (Withdrawn)')
                                : (lang === 'fa' ? 'خالص عملکرد' : 'Net Cashflow');
                            return [`${formatted} ${unitText}`, label];
                          }}
                        />
                        <Legend 
                          verticalAlign="top" 
                          height={36} 
                          iconSize={8}
                          iconType="circle"
                          wrapperStyle={{ fontSize: '11px', fontWeight: '600' }}
                          formatter={(value: string) => {
                            if (value === 'inflow') return lang === 'fa' ? 'ورودی (واریز شده) 📥' : 'Inflow (Deposits) 📥';
                            if (value === 'outflow') return lang === 'fa' ? 'خروجی (ارسالی) 📤' : 'Outflow (Payments) 📤';
                            if (value === 'net') return lang === 'fa' ? 'خالص جریان نقدینگی ⚖️' : 'Net Balance ⚖️';
                            return value;
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="inflow"
                          name="inflow"
                          stroke="#10B981"
                          strokeWidth={3}
                          dot={{ r: 3, fill: '#10B981', strokeWidth: 0 }}
                          activeDot={{ r: 6, strokeWidth: 0 }}
                          isAnimationActive={true}
                          animationDuration={1500}
                          animationEasing="ease-in-out"
                        />
                        <Line
                          type="monotone"
                          dataKey="outflow"
                          name="outflow"
                          stroke="#EF4444"
                          strokeWidth={3}
                          dot={{ r: 3, fill: '#EF4444', strokeWidth: 0 }}
                          activeDot={{ r: 6, strokeWidth: 0 }}
                          isAnimationActive={true}
                          animationDuration={1500}
                          animationEasing="ease-in-out"
                        />
                        <Line
                          type="monotone"
                          dataKey="net"
                          name="net"
                          stroke="#6366F1"
                          strokeWidth={2}
                          strokeDasharray="4 4"
                          dot={false}
                          activeDot={{ r: 5, strokeWidth: 0 }}
                          isAnimationActive={true}
                          animationDuration={1500}
                          animationEasing="ease-in-out"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </motion.div>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* A. Group by incoming sender */}
                <div className="bg-[#14161A] border border-white/15 rounded-2xl p-6 shadow-2xl space-y-4 print-card">
                  <div className="flex items-center gap-2 border-b border-white/10 pb-3">
                    <div className="p-1.5 bg-white/5 text-emerald-400 border border-white/10 rounded-xl">
                      <DollarSign className="h-4 w-4" />
                    </div>
                    <h3 className="font-extrabold text-sm text-white">{t.rialsBySender}</h3>
                  </div>
                  <div className="space-y-3">
                    {rialsBySender.length === 0 ? (
                      <p className="text-xs text-white/30 text-center py-6">{t.noAnalyticsData}</p>
                    ) : (
                      rialsBySender.map((group) => (
                        <div key={group.name} className="flex items-center justify-between p-3.5 bg-[#0A0B0D]/50 rounded-xl border border-white/5 hover:border-emerald-400/20 transition-all select-all">
                          <div className="text-right">
                            <span className="font-black text-sm text-white">{group.name}</span>
                            <span className="text-[10px] text-white/40 font-mono block mt-0.5">{group.count} {t.timesDeposited}</span>
                          </div>
                          <div className="text-left font-mono font-black text-emerald-400 text-sm">
                            {formatToman(group.total)} <span className="text-[10px] font-sans text-white/40 mr-0.5">{t.tomanUnit}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* B. Group by destination bank */}
                <div className="bg-[#14161A] border border-white/15 rounded-2xl p-6 shadow-2xl space-y-4 print-card">
                  <div className="flex items-center gap-2 border-b border-white/10 pb-3">
                    <div className="p-1.5 bg-white/5 text-emerald-400 border border-white/10 rounded-xl">
                      <PiggyBank className="h-4 w-4" />
                    </div>
                    <h3 className="font-extrabold text-sm text-white">{t.rialsByBank}</h3>
                  </div>
                  <div className="space-y-3">
                    {rialsByBank.length === 0 ? (
                      <p className="text-xs text-white/30 text-center py-6">{t.noAnalyticsData}</p>
                    ) : (
                      rialsByBank.map((group) => (
                        <div key={group.bank} className="flex items-center justify-between p-3.5 bg-[#0A0B0D]/50 rounded-xl border border-white/5 hover:border-emerald-400/20 transition-all select-all">
                          <div>
                            <span className="font-black text-sm text-white">{group.bank}</span>
                          </div>
                          <div className="text-left font-mono font-black text-emerald-450 text-sm">
                            {formatToman(group.total)} <span className="text-[10px] font-sans text-white/40 mr-0.5">{t.tomanUnit}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* C. Crypto grouped blockchain cards */}
              <div className="bg-[#14161A] border-2 border-black rounded-2xl p-6 shadow-2xl space-y-4 print-card">
                <div className="flex items-center gap-2 border-b border-white/10 pb-3">
                  <div className="p-1.5 bg-white/5 text-emerald-400 border border-white/10 rounded-xl">
                    <Coins className="h-4 w-4" />
                  </div>
                  <h3 className="font-extrabold text-sm text-white">{t.cryptoTotalsTitle}</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.keys(cryptoBreakdown.coinTotals).length === 0 ? (
                    <p className="text-xs text-white/30 col-span-3 text-center py-6">{t.noAnalyticsData}</p>
                  ) : (
                    Object.entries(cryptoBreakdown.coinTotals).map(([coin, total]) => (
                      <div key={coin} className="bg-[#0A0B0D] rounded-2xl p-5 border border-white/10 space-y-3 shadow-lg hover:border-emerald-400/20 transition-all select-all">
                        <div className="flex items-center justify-between">
                          <span className="px-3 py-1 text-[10px] font-black bg-emerald-400 text-black rounded-lg uppercase tracking-wider">{coin}</span>
                          <span className="font-mono text-[10px] font-black uppercase text-white/40 tracking-wider">{t.cryptoTotalsSubtitle}</span>
                        </div>
                        <div className="text-2xl font-mono font-black text-emerald-400 pt-1">
                          {total.toLocaleString()} <span className="text-xs font-sans text-white/40 mr-1">{coin}</span>
                        </div>
                        
                        <div className="border-t border-white/10 pt-3 space-y-2">
                          <span className="text-[10px] text-white/40 block font-black uppercase tracking-wider">{t.cryptoNetworkDeposits}</span>
                          {Object.entries(cryptoBreakdown.groups[coin] || {}).map(([network, amount]) => (
                            <div key={network} className="flex justify-between text-xs font-mono text-white/50 border-b border-white/[0.03] pb-1">
                              <span>{network}:</span>
                              <span className="text-emerald-400 font-black">{amount.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* D. INTERACTIVE LIVE P2P ARBITRAGE & TETHER CONVERTER CONSOLE */}
              <div className="bg-[#14161A] border-2 border-indigo-500/15 rounded-2xl p-6 shadow-2xl space-y-4 print-none hover:border-indigo-500/30 transition-all">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/5 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-xl">
                      <TrendingUp className="h-4 w-4" />
                    </span>
                    <h3 className="font-extrabold text-sm text-white">
                      {lang === 'fa' ? 'کنسول پیشرفته محاسبه سود آربیتراژ و مبدل تتر/ریال تریدرز هاب پرو' : 'Traders Hub Pro P2P Arbitrage & Tether Calculator'}
                    </h3>
                  </div>
                  <span className="text-[10px] bg-indigo-500/20 text-indigo-300 font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider font-mono">
                    {lang === 'fa' ? 'ابزار معاملاتی زنده' : 'Live Trading Tool'}
                  </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-1">
                  
                  {/* Form entries */}
                  <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5 text-right">
                      <label className="text-[10px] uppercase font-bold text-white/40">
                        {lang === 'fa' ? 'نرخ هر تتر (تومان):' : 'USDT Quote Price (Toman):'}
                      </label>
                      <input
                        type="number"
                        value={arbitrageUsdtPrice}
                        onChange={(e) => setArbitrageUsdtPrice(e.target.value)}
                        className="w-full bg-[#0A0B0D] border border-white/10 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs font-mono text-white text-left"
                      />
                    </div>

                    <div className="space-y-1.5 text-right">
                      <label className="text-[10px] uppercase font-bold text-white/40">
                        {lang === 'fa' ? 'حجم کل تراکنش (تتر):' : 'Total Volume (USDT):'}
                      </label>
                      <input
                        type="number"
                        value={arbitrageVolume}
                        onChange={(e) => setArbitrageVolume(e.target.value)}
                        className="w-full bg-[#0A0B0D] border border-white/10 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs font-mono text-white text-left"
                      />
                    </div>

                    <div className="space-y-1.5 text-right">
                      <label className="text-[10px] uppercase font-bold text-white/40">
                        {lang === 'fa' ? 'کارمزد گاز شبکه انتقال (USDT):' : 'Gas/Network Fee (USDT):'}
                      </label>
                      <input
                        type="number"
                        value={arbitrageGasFee}
                        onChange={(e) => setArbitrageGasFee(e.target.value)}
                        className="w-full bg-[#0A0B0D] border border-white/10 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs font-mono text-white text-left"
                      />
                    </div>

                    <div className="space-y-1.5 text-right">
                      <label className="text-[10px] uppercase font-bold text-white/40">
                        {lang === 'fa' ? 'تفاوت اسپرد هدف مارکت پریموم (%):' : 'Target Premium Spread (%):'}
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={arbitrageProfitPercent}
                        onChange={(e) => setArbitrageProfitPercent(e.target.value)}
                        className="w-full bg-[#0A0B0D] border border-white/10 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs font-mono text-white text-left"
                      />
                    </div>
                  </div>

                  {/* Profit Calculations & Analysis */}
                  <div className="lg:col-span-5 bg-[#090A0C] border border-white/5 rounded-2xl p-4 flex flex-col justify-between">
                    {(() => {
                      const quote = Number(arbitrageUsdtPrice) || 64500;
                      const vol = Number(arbitrageVolume) || 0;
                      const gas = Number(arbitrageGasFee) || 0;
                      const premium = Number(arbitrageProfitPercent) || 0;

                      // Math
                      const totalCapitalToman = vol * quote;
                      const netUsVolume = Math.max(0, vol - gas);
                      const arbitragePremiumQuote = quote * (1 + premium / 100);
                      const totalReceiveToman = netUsVolume * arbitragePremiumQuote;
                      const netProfitToman = Math.max(0, totalReceiveToman - totalCapitalToman);
                      const netProfitUsdt = netProfitToman / quote;

                      const isGoodArbitrage = premium >= 1.0;

                      return (
                        <div className="space-y-4 text-right">
                          <span className="text-[9px] font-black tracking-widest uppercase text-indigo-400 block">
                            {lang === 'fa' ? '🎯 برآیند محاسباتی و تست حساسیت:' : '🎯 MATH OUTCOMES & SENSITIVITY:'}
                          </span>

                          <div className="space-y-2 text-xs">
                            <div className="flex items-center justify-between border-b border-white/[0.04] pb-1.5">
                              <span className="text-white/40">{lang === 'fa' ? 'سرمایه کل ریالی:' : 'Total Rial Capital:'}</span>
                              <span className="font-mono text-white font-bold">{totalCapitalToman.toLocaleString()} <span className="text-[9px] font-sans text-white/50">{lang === 'fa' ? 'تومان' : 'Toman'}</span></span>
                            </div>

                            <div className="flex items-center justify-between border-b border-white/[0.04] pb-1.5">
                              <span className="text-white/40">{lang === 'fa' ? 'حق‌العمل خالص هدف:' : 'Arbitrage Premium Price:'}</span>
                              <span className="font-mono text-emerald-400 font-bold">{Math.round(arbitragePremiumQuote).toLocaleString()} <span className="text-[9px] font-sans text-white/50">{lang === 'fa' ? 'تومان' : 'Toman'}</span></span>
                            </div>

                            <div className="flex items-center justify-between border-b border-white/[0.04] pb-1.5">
                              <span className="text-white/40">{lang === 'fa' ? 'حجم دریافت خالص (منهای گاز):' : 'Net Received (Post Gas):'}</span>
                              <span className="font-mono text-amber-300 font-bold">{netUsVolume.toLocaleString()} <span className="text-[9px] text-white/40 font-mono">USDT</span></span>
                            </div>

                            <div className="flex items-center justify-between border-b border-white/[0.04] pb-1.5">
                              <span className="text-white/40">{lang === 'fa' ? 'سود خالص تخمینی تتر:' : 'Estimated Profit USDT:'}</span>
                              <span className="font-mono text-indigo-400 font-bold">+{netProfitUsdt.toFixed(2)} <span className="text-[9px] text-white/40 font-mono">USDT</span></span>
                            </div>

                            <div className="flex items-center justify-between pt-1 font-sans">
                              <span className="text-white/85 font-black">{lang === 'fa' ? 'سود خالص دریافتی (تومان):' : 'Net Received Profit (Toman):'}</span>
                              <span className="font-mono text-emerald-400 font-black text-sm">+{Math.round(netProfitToman).toLocaleString()} <span className="text-[10px] font-sans text-white/80">{lang === 'fa' ? 'تومان' : 'Toman'}</span></span>
                            </div>
                          </div>

                          {/* Quick Rating Visual */}
                          <div className="pt-2">
                            <div className="bg-[#14161A] border border-white/5 rounded-xl p-2.5 flex items-center justify-between gap-2.5">
                              <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase shrink-0 ${
                                isGoodArbitrage ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                              }`}>
                                {isGoodArbitrage 
                                  ? (lang === 'fa' ? 'پیشنهاد مشارکت بالا 🔥' : 'HIGHLY VIABLE 🔥') 
                                  : (lang === 'fa' ? 'بازده ضعیف / اسپرد کم ⚠️' : 'LOW MARGIN ⚠️')}
                              </span>
                              <p className="text-[9px] text-white/50 leading-relaxed text-right">
                                {lang === 'fa' 
                                  ? 'محاسبات اسپرد بر پایه آخرین داده‌های مالی زیرساخت امن تریدرز هاب پرو بهینه‌سازی شده است.' 
                                  : 'Calculated using core system variables of Traders Hub Pro.'}
                              </p>
                            </div>
                          </div>

                        </div>
                      );
                    })()}
                  </div>

                </div>
              </div>

            </div>
          )}

          {/* TAB CONTENT 5: SHARED EXPENSES / SPLIT LEDGER */}
          {activeTab === 'split' && (() => {
            const totalCount = linkedSplitPurchases.length;
            const splitCount = linkedSplitPurchases.filter(i => i.type === 'split').length;
            const personalCount = linkedSplitPurchases.filter(i => i.type === 'personal').length;
            
            const totalCryptoSpent = linkedSplitPurchases.reduce((sum, item) => sum + item.cryptoAmount, 0);
            const personalCryptoSpent = linkedSplitPurchases.filter(i => i.type === 'personal').reduce((sum, item) => sum + item.cryptoAmount, 0);
            const splitCryptoSpent = linkedSplitPurchases.filter(i => i.type === 'split').reduce((sum, item) => sum + item.cryptoAmount, 0);
            
            const totalRialReceived = linkedSplitPurchases.reduce((sum, item) => sum + (item.rialAmount || 0), 0);
            
            // Calculate average exchange rate for settles
            const splitCryptoTotal = linkedSplitPurchases.filter(i => i.type === 'split').reduce((sum, item) => sum + item.cryptoAmount, 0);
            const averageRate = splitCryptoTotal > 0 ? Math.round(totalRialReceived / splitCryptoTotal) : 0;

            return (
              <div className="space-y-6 animate-fade-in" style={{ direction: lang === 'fa' ? 'rtl' : 'ltr' }}>
                {/* Main Introduction Card */}
                <div className="bg-[#14161A] p-6 rounded-2xl border border-white/10 relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="z-10 text-right max-w-2xl">
                    <h2 className="text-lg font-black text-indigo-400 flex items-center gap-1.5 uppercase tracking-tight">
                      <Users className="h-6 w-6 text-emerald-400 animate-pulse" />
                      <span>{lang === 'fa' ? 'دفتر ثبت مخارج شخصی، دونگی و خریدهای اشتراکی' : 'Expenses & Shared Purchases Log'}</span>
                    </h2>
                    <p className="text-xs text-white/50 mt-1 leading-relaxed font-semibold">
                      {lang === 'fa' 
                        ? 'در این بخش می‌توانید خریدهای شخصی یا مشترک بین‌المللی ارزی خود (مانند فیلترشکن VPN، سرور اختصاصی و غیره) را ثبت کنید. برای خریدهای مشترک، سیستم به صورت همزمان تراکنش برداشت ارزی شما و تراکنش دریافت سهم ریالی از شریک را ایجاد و پیوند خواهد داد.'
                        : 'Register private expenses or joint/shared purchases (such as VPNs, servers, subscriptions). For shared items, the system automatically creates both your crypto expense entry and your partner\'s Rial reimbursement entry in perfect sync.'}
                    </p>
                  </div>
                  <div className="p-3 bg-white/5 border border-white/10 text-emerald-400 rounded-xl shrink-0 hidden md:block">
                    <Users className="h-7 w-7" />
                  </div>
                </div>

                {/* Dynamic Analytics / Stats Row for Split & Personal purchases */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-[#14161A] border border-white/10 p-5 rounded-2xl flex items-center justify-between">
                    <div>
                      <p className="text-[10px] uppercase font-mono tracking-wider text-white/40">{lang === 'fa' ? 'کل ردیف‌های مخارج ثبت شده' : 'Total Expense Records'}</p>
                      <h4 className="text-xl font-extrabold text-white mt-1">{totalCount} {lang === 'fa' ? 'مورد' : 'Items'}</h4>
                      <span className="text-[9px] text-white/40 flex items-center gap-1 mt-1">
                        <span>{lang === 'fa' ? `دنگی: ${splitCount}` : `Split: ${splitCount}`}</span>
                        <span>•</span>
                        <span>{lang === 'fa' ? `شخصی: ${personalCount}` : `Personal: ${personalCount}`}</span>
                      </span>
                    </div>
                    <div className="p-2.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-xl">
                      <SlidersHorizontal className="h-5 w-5" />
                    </div>
                  </div>

                  <div className="bg-[#14161A] border border-white/10 p-5 rounded-2xl flex items-center justify-between">
                    <div>
                      <p className="text-[10px] uppercase font-mono tracking-wider text-white/40">{lang === 'fa' ? 'مجموع سهم ریالی دریافتی' : 'Total Reimbursements (Rials)'}</p>
                      <h4 className="text-xl font-extrabold text-[#10B981] mt-1">
                        {totalRialReceived.toLocaleString()} {lang === 'fa' ? 'تومان' : 'Tomans'}
                      </h4>
                      {splitCount > 0 && (
                        <span className="text-[9px] text-[#10B981]/80 font-mono block mt-1 leading-none">
                          {lang === 'fa' ? `میانگین هر سهم: ${Math.round(totalRialReceived / splitCount).toLocaleString()} ت` : `Avg Share: ${Math.round(totalRialReceived / splitCount).toLocaleString()} T`}
                        </span>
                      )}
                    </div>
                    <div className="p-2.5 bg-emerald-500/10 text-[#10B981] border border-emerald-500/20 rounded-xl">
                      <PiggyBank className="h-5 w-5" />
                    </div>
                  </div>

                  <div className="bg-[#14161A] border border-white/10 p-5 rounded-2xl flex items-center justify-between">
                    <div>
                      <p className="text-[10px] uppercase font-mono tracking-wider text-white/40">{lang === 'fa' ? 'مجموع خروجی ارزی' : 'Total Crypto Spent'}</p>
                      <h4 className="text-xl font-extrabold text-[#F5A623] mt-1 font-mono">
                        {totalCryptoSpent.toFixed(2)} USDT
                      </h4>
                      <span className="text-[9px] text-[#F5A623]/80 flex items-center gap-1 mt-1 leading-none">
                        <span>{lang === 'fa' ? `شخصی: ${personalCryptoSpent.toFixed(1)}` : `Pers: ${personalCryptoSpent.toFixed(1)}`}</span>
                        <span>•</span>
                        <span>{lang === 'fa' ? `دونگی: ${splitCryptoSpent.toFixed(1)}` : `Spl: ${splitCryptoSpent.toFixed(1)}`}</span>
                      </span>
                    </div>
                    <div className="p-2.5 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-xl">
                      <Coins className="h-5 w-5" />
                    </div>
                  </div>
                </div>

                {/* Aggregated Balance Sheet Box (برایند نهایی مخارج) */}
                <div className="p-5 bg-gradient-to-r from-slate-900/40 to-indigo-950/25 border border-indigo-500/15 rounded-2xl space-y-3 relative overflow-hidden">
                  <div className="absolute right-0 top-0 bottom-0 w-1 bg-indigo-500/30" />
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-2.5 w-2.5 rounded-full bg-indigo-400 animate-pulse" />
                      <h4 className="text-xs sm:text-sm font-black text-white">
                        {lang === 'fa' ? '📊 خلاصه تراز و سرجمع برایند مخارج تجمعی' : '📊 Consolidated Cumulative Outflow Summary'}
                      </h4>
                    </div>
                    {averageRate > 0 && (
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/25 px-2.5 py-1 rounded-xl font-mono font-bold">
                        {lang === 'fa' ? `میانگین نرخ تسویه دونگ‌ها: ${averageRate.toLocaleString()} تومان/دلار` : `Weighted Settlement Rate: ${averageRate.toLocaleString()} T/USD`}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 bg-black/40 p-4 rounded-xl border border-white/5">
                    <div className="space-y-1">
                      <span className="text-[10px] text-white/40 block font-bold leading-none">{lang === 'fa' ? 'سهم مخارج کاملاً شخصی' : 'Pure Private Spent'}</span>
                      <span className="text-sm font-extrabold text-indigo-400 font-mono tracking-tight">{personalCryptoSpent.toFixed(2)} <span className="text-[9px] text-white/50">USDT</span></span>
                      <span className="text-[9px] text-white/30 block leading-tight">{lang === 'fa' ? 'تماماً عهده شخص خودم' : 'Entirely paid by myself'}</span>
                    </div>

                    <div className="space-y-1 border-r border-white/5 pr-3">
                      <span className="text-[10px] text-white/40 block font-bold leading-none">{lang === 'fa' ? 'مخارج اشتراکی و دونگی' : 'Total Joint Purchases'}</span>
                      <span className="text-sm font-extrabold text-[#F5A623] font-mono tracking-tight">{splitCryptoSpent.toFixed(2)} <span className="text-[9px] text-white/50">USDT</span></span>
                      <span className="text-[9px] text-white/30 block leading-tight">{lang === 'fa' ? 'خرید اشتراکی با همکاران' : 'Joint bills split with partners'}</span>
                    </div>

                    <div className="space-y-1 border-r border-white/5 pr-3">
                      <span className="text-[10px] text-white/40 block font-bold leading-none">{lang === 'fa' ? 'حاصلِ دریافت‌های ریالی' : 'Total Rials Recovered'}</span>
                      <span className="text-sm font-extrabold text-[#10B981] font-mono tracking-tight">{totalRialReceived.toLocaleString()} <span className="text-[9px] text-white/50">{lang === 'fa' ? 'تومان' : 'Toman'}</span></span>
                      <span className="text-[9px] text-white/30 block leading-tight">{lang === 'fa' ? 'معادل دونگ دریافتی' : 'Cashed back through partners'}</span>
                    </div>

                    <div className="space-y-1 border-r border-white/5 pr-3">
                      <span className="text-[10px] text-white/40 block font-bold leading-none">{lang === 'fa' ? 'برایند مصارف ارزی مستقل' : 'Dynamic Settle Outlay'}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-extrabold text-[#E0E7FF] font-mono tracking-tight">
                          {totalCryptoSpent.toFixed(2)} <span className="text-[9px] text-white/50">USDT</span>
                        </span>
                      </div>
                      <span className="text-[9px] bg-indigo-500/10 text-indigo-300 font-semibold border border-indigo-500/20 px-1 py-0.2 rounded inline-block mt-0.5 leading-none">
                        {lang === 'fa' ? 'تفکیک کامل از حساب اصلی' : 'Fully Separated Form Main Wallet'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Collapsible/Interactive AI Deals section */}
                <div className="bg-[#14161A]/60 border border-white/10 p-5 rounded-2xl space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-white/10 pb-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-indigo-400 animate-pulse" />
                      <div>
                        <h3 className="font-extrabold text-sm text-white">
                          {lang === 'fa' ? '🔥 تخفیف‌های آنی و پیشنهادات فیلترشکن و سرویس‌های دیجیتال با AI' : '🔥 Live Digital Subscription & VPN Deals with AI'}
                        </h3>
                        <p className="text-[10px] text-white/50 mt-0.5">
                          {lang === 'fa' ? 'کدهای تخفیف معتبر فیلترشکن، سرویس‌های فیلم، موسیقی و هاستینگ استخراج‌شده با هوش مصنوعی جمینای.' : 'Real-time discount coupons and cheapest packages fetched directly from the web via Gemini Search Grounding.'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={fetchLiveOffers}
                      disabled={loadingOffers}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 active:bg-indigo-500/30 text-indigo-300 border border-indigo-500/20 rounded-xl text-xs font-bold leading-none disabled:opacity-50 transition-all cursor-pointer shrink-0"
                    >
                      <RefreshCw className={`h-3 w-3 ${loadingOffers ? 'animate-spin' : ''}`} />
                      <span>{lang === 'fa' ? 'به‌روزرسانی آنی با جمینای' : 'Live Sync With Gemini'}</span>
                    </button>
                  </div>

                  {/* Filter Pills */}
                  <div className="flex flex-wrap gap-2">
                    {(['all', 'vpn', 'streaming', 'hosting'] as const).map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setDealFilter(cat)}
                        className={`px-3 py-1 text-[11px] font-bold rounded-xl border transition-all cursor-pointer ${
                          dealFilter === cat
                            ? 'bg-indigo-500 text-white border-indigo-500 shadow-md'
                            : 'bg-black/30 text-white/60 border-white/5 hover:text-white hover:bg-black/50'
                        }`}
                      >
                        {cat === 'all' && (lang === 'fa' ? '🌐 همه پیشنهادات' : '🌐 All Deals')}
                        {cat === 'vpn' && (lang === 'fa' ? '🛡️ فیلترشکن (VPN)' : '🛡️ VPNs')}
                        {cat === 'streaming' && (lang === 'fa' ? '🎬 فیلم و موسیقی' : '🎬 Streaming')}
                        {cat === 'hosting' && (lang === 'fa' ? '🖥️ هاستینگ و سرور (VPS)' : '🖥️ VPS & Cloud')}
                      </button>
                    ))}
                  </div>

                  {loadingOffers ? (
                    <div className="py-8 flex flex-col items-center justify-center space-y-3">
                      <div className="relative flex items-center justify-center">
                        <div className="absolute animate-ping h-8 w-8 rounded-full bg-indigo-500/30 opacity-75"></div>
                        <div className="relative animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                      </div>
                      <p className="text-xs text-white/50 animate-pulse font-semibold text-center">
                        {lang === 'fa' ? 'جمینای با جستجوی وب زنده در حال استخراج آخرین تخفیف‌های معتبر است...' : 'Gemini is scanning the live web for active promo deals...'}
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {liveOffers
                        .filter(offer => dealFilter === 'all' || offer.category === dealFilter)
                        .map((offer, idx) => {
                          let priceWhole = '5';
                          let priceFrac = '00';
                          if (offer.priceInfo) {
                            const matched = offer.priceInfo.match(/(\d+)\.(\d+)/);
                            if (matched) {
                              priceWhole = matched[1];
                              priceFrac = matched[2];
                            } else {
                              const numMatched = offer.priceInfo.match(/(\d+)/);
                              if (numMatched) priceWhole = numMatched[1];
                            }
                          }
                          return (
                            <div
                              key={idx}
                              className="bg-black/40 border border-white/5 hover:border-indigo-500/20 p-4 rounded-xl transition-all flex flex-col justify-between space-y-3 relative overflow-hidden"
                            >
                              {offer.discountPercent && (
                                <div className="absolute top-0 left-0 bg-[#FF4757] text-white text-[9px] font-black px-2 py-0.5 rounded-br-lg font-mono">
                                  {offer.discountPercent}% OFF
                                </div>
                              )}
                              
                              <div className="space-y-1.5" style={{ direction: lang === 'fa' ? 'rtl' : 'ltr' }}>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[9px] uppercase font-bold tracking-wider text-indigo-400 bg-indigo-500/10 border border-indigo-500/15 px-1.5 py-0.2 rounded-md">
                                    {offer.category}
                                  </span>
                                  <span className="text-[9px] font-mono text-white/30">{offer.lastVerified || 'June 2026'}</span>
                                </div>

                                <h4 className="text-xs sm:text-sm font-black text-white">{offer.serviceName}</h4>
                                <p className="text-xs font-bold text-emerald-400">{offer.dealTitle}</p>
                                <p className="text-[10px] text-white/60 leading-relaxed max-w-full leading-normal line-clamp-3">{offer.details}</p>
                              </div>

                              <div className="space-y-2 border-t border-white/5 pt-2 mt-auto" style={{ direction: lang === 'fa' ? 'rtl' : 'ltr' }}>
                                <div className="flex items-center justify-between text-[11px] font-mono">
                                  <span className="text-white/40">{lang === 'fa' ? '💳 قیمت تقریبی:' : 'Price:'}</span>
                                  <span className="text-white/80 font-bold">{offer.priceInfo || '$3.00/mo'}</span>
                                </div>

                                <div className="flex items-center gap-1.5">
                                  {offer.promoCode && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        navigator.clipboard.writeText(offer.promoCode);
                                        alert(lang === 'fa' ? '✅ کد تخفیف کپی شد!' : '✅ Coupon Code copied!');
                                      }}
                                      className="bg-white/5 hover:bg-white/10 active:bg-white/15 text-white/80 px-2 py-1.5 rounded-lg text-[9px] font-mono font-bold flex items-center gap-1 border border-white/10 flex-1 truncate cursor-pointer justify-center"
                                      title={lang === 'fa' ? 'کپی کد تخفیف' : 'Copy Coupon Code'}
                                    >
                                      🎟️ {offer.promoCode}
                                    </button>
                                  )}

                                  {offer.sourceUrl && (
                                    <a
                                      href={offer.sourceUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="bg-indigo-500/15 hover:bg-indigo-500/25 active:bg-indigo-500/35 border border-indigo-500/20 text-indigo-300 p-1.5 rounded-lg text-center flex items-center justify-center shrink-0 cursor-pointer"
                                      title={lang === 'fa' ? 'مشاهده سایت ارائه‌دهنده' : 'View Source'}
                                    >
                                      <ExternalLink className="h-3 w-3" />
                                    </a>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSplitTitle(`${offer.serviceName}`);
                                      setSplitCryptoWhole(priceWhole);
                                      setSplitCryptoFraction(priceFrac);
                                      setSplitCoinName('USDT');
                                      setSplitNotes(
                                        lang === 'fa'
                                          ? `کد تخفیف معتبر: ${offer.promoCode || 'ندارد'}. ${offer.details}`
                                          : `Promo code: ${offer.promoCode || 'None'}. ${offer.details}`
                                      );
                                      alert(
                                        lang === 'fa'
                                          ? `✅ اطلاعات تخفیف ${offer.serviceName} در فرم ثبت وارد شد. کافی است فرم را تکمیل نموده و ثبت مخرجه را کلیک کنید!`
                                          : `✅ Successfully imported ${offer.serviceName} bargain coordinates. Fill out rest and save!`
                                      );
                                    }}
                                    className="bg-[#10B981]/10 hover:bg-[#10B981]/25 active:bg-[#10B981]/35 border border-[#10B981]/20 text-[#10B981] text-[9px] font-bold px-2.5 py-1.5 rounded-lg flex items-center justify-center gap-1 flex-1 cursor-pointer"
                                  >
                                    🚀 {lang === 'fa' ? 'اعمال سریع' : 'Apply'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>

                {/* Split & Personal purchase form grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* Form column (5 cols on lg) */}
                <form id="split-expense-form" onSubmit={handleSaveSplitExpense} className="lg:col-span-12 xl:col-span-5 bg-[#14161A] border border-white/10 p-6 rounded-2xl space-y-4">
                  <div className="border-b border-white/10 pb-3 mb-2 flex items-center justify-between">
                    <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
                      <PlusCircle className="h-4.5 w-4.5 text-indigo-400" />
                      <span>{splitType === 'split' ? (lang === 'fa' ? 'ثبت فیش دونگی و خرید مشترک' : 'Add Shared/Split Expense') : (lang === 'fa' ? 'ثبت مخارج شخصی من' : 'Add My Personal Expense')}</span>
                    </h3>
                    <span className="text-[10px] uppercase font-mono bg-indigo-500/15 text-indigo-400 border border-indigo-500/25 px-2 py-0.5 rounded-lg font-bold animate-pulse">
                      {splitType === 'split' ? 'Coupled 2-Way' : 'Exclusive 1-Way'}
                    </span>
                  </div>

                  {/* Dynamic Mode Switcher */}
                  <div className="grid grid-cols-2 gap-2 bg-[#0A0B0D] p-1 rounded-xl border border-white/5">
                    <button
                      type="button"
                      onClick={() => setSplitType('personal')}
                      className={`py-2 text-[11px] font-bold rounded-lg transition-all cursor-pointer text-center ${
                        splitType === 'personal'
                          ? 'bg-indigo-500 text-white shadow-md'
                          : 'text-white/40 hover:text-white'
                      }`}
                    >
                      👤 {lang === 'fa' ? 'مخارج شخصی من' : 'My Personal Expense'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSplitType('split')}
                      className={`py-2 text-[11px] font-bold rounded-lg transition-all cursor-pointer text-center ${
                        splitType === 'split'
                          ? 'bg-[#10B981] text-black shadow-md font-extrabold'
                          : 'text-white/40 hover:text-white'
                      }`}
                    >
                      👥 {lang === 'fa' ? 'خرید اشتراکی / دونگی' : 'Split/Shared Expense'}
                    </button>
                  </div>

                  <div className="space-y-3">
                    {/* Item Name */}
                    <div>
                      <label className="block text-[11px] font-bold text-white/70 mb-1">
                        {lang === 'fa' ? 'موضوع / بابت خرید *' : 'Purchase Subject / Item Name *'}
                      </label>
                      <input
                        type="text"
                        value={splitTitle}
                        onChange={(e) => setSplitTitle(e.target.value)}
                        placeholder={lang === 'fa' ? 'مثال: خرید اکانت ExpressVPN شش ماهه' : 'e.g. ExpressVPN 6-Month Account'}
                        className="w-full bg-[#0A0B0D] border border-white/10 focus:border-indigo-500 outline-none rounded-xl px-3 py-2 text-xs text-white"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {/* Double Crypto/USD amount input: Whole and Fraction */}
                      <div>
                        <label className="block text-[11px] font-bold text-white/70 mb-1">
                          {lang === 'fa' ? 'کل پرداخت ارزی (کل . خرد) *' : 'Total Crypto Paid (Whole . Cents) *'}
                        </label>
                        <div className="flex bg-[#0A0B0D] border border-white/10 rounded-xl focus-within:border-indigo-500 transition-all overflow-hidden">
                          {/* Whole part (Integer) */}
                          <input
                            type="text"
                            inputMode="numeric"
                            value={splitCryptoWhole}
                            onChange={(e) => {
                              const clean = e.target.value.replace(/[^0-9]/g, '');
                              setSplitCryptoWhole(clean);
                            }}
                            placeholder={lang === 'fa' ? 'کل (دلار)' : 'Whole (USD)'}
                            className="w-full bg-transparent outline-none text-xs text-white font-mono py-2 text-center border-0"
                          />
                          <span className="text-white/30 font-black self-center">.</span>
                          {/* Fractional/Cents part */}
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            value={splitCryptoFraction}
                            onChange={(e) => {
                              const clean = e.target.value.replace(/[^0-9]/g, '');
                              setSplitCryptoFraction(clean);
                            }}
                            placeholder={lang === 'fa' ? 'سنت (خرد)' : 'Cents'}
                            className="w-full bg-transparent outline-none text-xs text-white/60 font-mono py-2 text-center border-0"
                          />
                        </div>
                      </div>

                      {/* Coin Symbol selection */}
                      <div>
                        <label className="block text-[11px] font-bold text-white/70 mb-1">
                          {lang === 'fa' ? 'نوع ارز *' : 'Coin Symbol *'}
                        </label>
                        <select
                          value={splitCoinName}
                          onChange={(e) => setSplitCoinName(e.target.value)}
                          className="w-full bg-[#0A0B0D] border border-white/10 focus:border-indigo-500 outline-none rounded-xl px-3 py-2 text-xs text-white"
                        >
                          <option value="USDT">USDT</option>
                          <option value="TRX">TRX</option>
                          <option value="BTC">BTC</option>
                          <option value="ETH">ETH</option>
                          <option value="SOL">SOL</option>
                          <option value="USDC">USDC</option>
                          <option value="TON">TON</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {/* Network */}
                      <div>
                        <label className="block text-[11px] font-bold text-white/70 mb-1">
                          {lang === 'fa' ? 'شبکه پرداخت' : 'Blockchain Network'}
                        </label>
                        <select
                          value={splitNetwork}
                          onChange={(e) => setSplitNetwork(e.target.value)}
                          className="w-full bg-[#0A0B0D] border border-white/10 focus:border-indigo-500 outline-none rounded-xl px-3 py-2 text-xs text-white"
                        >
                          <option value="TRC-20">TRC-20</option>
                          <option value="BSC (BEP-20)">BSC (BEP-20)</option>
                          <option value="ERC-20">ERC-20</option>
                          <option value="SOLANA">SOLANA</option>
                          <option value="TON-NETWORK">TON</option>
                          <option value="MASTERCARD">{lang === 'fa' ? 'مستر کارت (Mastercard)' : 'Mastercard'}</option>
                        </select>
                      </div>

                      {/* Date */}
                      <div>
                        <label className="block text-[11px] font-bold text-white/70 mb-1">
                          {lang === 'fa' ? 'تاریخ تراکنش *' : 'Transaction Date *'}
                        </label>
                        <input
                          type="date"
                          value={splitDate}
                          onChange={(e) => setSplitDate(e.target.value)}
                          className="w-full bg-[#0A0B0D] border border-white/10 focus:border-indigo-500 outline-none rounded-xl px-3 py-2 text-xs text-white"
                        />
                      </div>
                    </div>

                    {/* Partner Name - Only when split */}
                    {splitType === 'split' && (
                      <div className="border-t border-white/5 pt-3 animate-fade-in">
                        <label className="block text-[11px] font-bold text-[#10B981] mb-1">
                          {lang === 'fa' ? 'شخص شریک هزینه (نام متعهد/مودی) *' : 'Shared Partner Name *'}
                        </label>
                        <input
                          type="text"
                          value={splitPartnerName}
                          onChange={(e) => setSplitPartnerName(e.target.value)}
                          placeholder={lang === 'fa' ? 'مثال: پسر عمه' : 'e.g. Cousin'}
                          className="w-full bg-[#0A0B0D] border border-[#10B981]/25 focus:border-[#10B981] outline-none rounded-xl px-3 py-2 text-xs text-white"
                        />
                      </div>
                    )}

                    {/* Settle Type Toggle (Rial vs Crypto) */}
                    {splitType === 'split' && (
                      <div className="border-t border-white/5 pt-3 animate-fade-in space-y-2">
                        <label className="block text-[11px] font-bold text-[#10B981]">
                          {lang === 'fa' ? 'نوع تسویه سهم شریک (چگونه دونگ خود را برمی‌گرداند؟) *' : 'Partner Share Settle Form *'}
                        </label>
                        <div className="grid grid-cols-2 gap-2 bg-[#0A0B0D] p-1 rounded-xl border border-white/10">
                          <button
                            type="button"
                            onClick={() => setSplitSettleType('rial')}
                            className={`py-1.5 text-[11px] font-semibold rounded-lg transition-all cursor-pointer text-center ${
                              splitSettleType === 'rial'
                                ? 'bg-emerald-500/15 text-[#10B981] border border-[#10B981]/20 font-black'
                                : 'text-white/40 hover:text-white'
                            }`}
                          >
                            🇮🇷 {lang === 'fa' ? 'تسویه ریالی (تومان)' : 'Rial (Toman)'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setSplitSettleType('crypto')}
                            className={`py-1.5 text-[11px] font-semibold rounded-lg transition-all cursor-pointer text-center ${
                              splitSettleType === 'crypto'
                                ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 font-black'
                                : 'text-white/40 hover:text-white'
                            }`}
                          >
                            🪙 {lang === 'fa' ? 'تسویه ارزی (کریپتو)' : 'Crypto/USDT'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Rial Reimbursement Amount - Only when split & settled in Rial */}
                    {splitType === 'split' && splitSettleType === 'rial' && (
                      <div className="grid grid-cols-2 gap-3 animate-fade-in">
                        <div>
                          <label className="block text-[11px] font-bold text-[#10B981] mb-1">
                            {lang === 'fa' ? 'سهم دریافتی ریالی (تومان) *' : 'Rial Share Received (Toman) *'}
                          </label>
                          <input
                            type="text"
                            value={splitRialAmount}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/,/g, '');
                              if (!isNaN(Number(raw)) || raw === '') {
                                setSplitRialAmount(raw ? Number(raw).toLocaleString() : '');
                              }
                            }}
                            placeholder={lang === 'fa' ? 'مثال: ۳۰۰,۰۰۰' : 'e.g. 300,000'}
                            className="w-full bg-[#0A0B0D] border border-[#10B981]/25 focus:border-[#10B981] outline-none rounded-xl px-3 py-2 text-xs text-white font-[#10B981] font-mono"
                          />
                        </div>

                        {/* Rial Bank Account */}
                        <div>
                          <label className="block text-[11px] font-bold text-[#10B981] mb-1">
                            {lang === 'fa' ? 'به حساب کدام بانک؟ *' : 'Target Bank Account *'}
                          </label>
                          <input
                            type="text"
                            value={splitBank}
                            onChange={(e) => setSplitBank(e.target.value)}
                            placeholder={lang === 'fa' ? 'مثال: سامان، ملی، بلوبانک' : 'e.g. Saman Bank'}
                            className="w-full bg-[#0A0B0D] border border-[#10B981]/25 focus:border-[#10B981] outline-none rounded-xl px-3 py-2 text-xs text-white"
                          />
                        </div>
                      </div>
                    )}

                    {/* Crypto Reimbursement Amount - Only when split & settled in Crypto */}
                    {splitType === 'split' && splitSettleType === 'crypto' && (
                      <div className="grid grid-cols-2 gap-3 animate-fade-in">
                        <div>
                          <label className="block text-[11px] font-bold text-indigo-400 mb-1">
                            {lang === 'fa' ? 'سهم دریافتی ارزی (کریپتو) *' : 'Crypto Share Received *'}
                          </label>
                          <input
                            type="text"
                            value={splitSettleCryptoAmount}
                            onChange={(e) => {
                              const clean = e.target.value.replace(/[^0-9\.]/g, '');
                              setSplitSettleCryptoAmount(clean);
                            }}
                            placeholder="e.g. 5.50"
                            className="w-full bg-[#0A0B0D] border border-indigo-500/25 focus:border-indigo-500 outline-none rounded-xl px-3 py-2 text-xs text-white font-mono"
                          />
                        </div>

                        {/* Crypto Reimbursed Coin Symbol */}
                        <div>
                          <label className="block text-[11px] font-bold text-indigo-400 mb-1">
                            {lang === 'fa' ? 'نوع ارز دریافتی *' : 'Refund Coin Symbol *'}
                          </label>
                          <select
                            value={splitSettleCoinName}
                            onChange={(e) => setSplitSettleCoinName(e.target.value)}
                            className="w-full bg-[#0A0B0D] border border-indigo-500/25 focus:border-indigo-500 outline-none rounded-xl px-3 py-2 text-xs text-white"
                          >
                            <option value="USDT">USDT</option>
                            <option value="USDC">USDC</option>
                            <option value="TRX">TRX</option>
                            <option value="TON">TON</option>
                            <option value="BTC">BTC</option>
                          </select>
                        </div>
                      </div>
                    )}

                    {/* Installment details - Only when personal */}
                    {splitType === 'personal' && (
                      <div className="border border-indigo-500/15 bg-indigo-500/[0.03] p-4.5 rounded-xl space-y-3.5 animate-fade-in">
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-2.5 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={splitIsInstallment}
                              onChange={(e) => setSplitIsInstallment(e.target.checked)}
                              className="accent-indigo-500 rounded border-white/20 bg-black h-4 w-4"
                            />
                            <span className="text-[11px] font-extrabold text-indigo-300">
                              {lang === 'fa' ? '💳 این خرید به صورت اقساطی است' : '💳 This is an installment purchase'}
                            </span>
                          </label>
                        </div>
                        
                        {splitIsInstallment && (
                          <div className="grid grid-cols-2 gap-3 pt-2.5 border-t border-white/5 animate-fade-in">
                            <div>
                              <label className="block text-[10px] text-white/60 mb-1">
                                {lang === 'fa' ? 'تعداد کل اقساط (ماه)' : 'Total Months / Installments'}
                              </label>
                              <select
                                value={splitInstallmentTotal}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setSplitInstallmentTotal(val);
                                  if (parseInt(splitInstallmentPaid) > parseInt(val)) {
                                    setSplitInstallmentPaid(val);
                                  }
                                }}
                                className="w-full bg-[#0A0B0D] border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white text-center font-mono"
                              >
                                <option value="3">3</option>
                                <option value="6">6</option>
                                <option value="12">12</option>
                                <option value="24">24</option>
                                <option value="36">36</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-[10px] text-white/60 mb-1">
                                {lang === 'fa' ? 'اقساط پرداخت شده' : 'Already Paid Installments'}
                              </label>
                              <select
                                value={splitInstallmentPaid}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (parseInt(val) <= parseInt(splitInstallmentTotal)) {
                                    setSplitInstallmentPaid(val);
                                  }
                                }}
                                className="w-full bg-[#0A0B0D] border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white text-center font-mono"
                              >
                                {Array.from({ length: parseInt(splitInstallmentTotal) || 3 }, (_, i) => String(i + 1)).map((val) => (
                                  <option key={val} value={val}>
                                    {val}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Target Wallet & Tx Hash */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-white/70 mb-1">
                          {lang === 'fa' ? 'آدرس ولت مبدا / مقصد' : 'Wallet Address'}
                        </label>
                        <input
                          type="text"
                          value={splitWallet}
                          onChange={(e) => setSplitWallet(e.target.value)}
                          placeholder="0x... or T..."
                          className="w-full bg-[#0A0B0D] border border-white/10 focus:border-indigo-500 outline-none rounded-xl px-3 py-2 text-xs text-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-white/70 mb-1">
                          {lang === 'fa' ? 'شناسه تراکنش پرداخت (TxHash)' : 'Tx Hash'}
                        </label>
                        <input
                          type="text"
                          value={splitTxHash}
                          onChange={(e) => setSplitTxHash(e.target.value)}
                          placeholder="e.g. hash tx"
                          className="w-full bg-[#0A0B0D] border border-white/10 focus:border-indigo-500 outline-none rounded-xl px-3 py-2 text-xs text-white font-mono"
                        />
                      </div>
                    </div>

                    {/* Additional Notes */}
                    <div>
                      <label className="block text-[11px] font-bold text-white/70 mb-1">
                        {lang === 'fa' ? 'توضیحات و جزئیات بیشتر' : 'Additional Notes / Details'}
                      </label>
                      <textarea
                        value={splitNotes}
                        onChange={(e) => setSplitNotes(e.target.value)}
                        placeholder="..."
                        className="w-full bg-[#0A0B0D] border border-white/10 focus:border-[#10B981] outline-none rounded-xl px-3 py-2 text-xs text-white h-16 resize-none"
                      />
                    </div>
                  </div>

                  {editingSplitId ? (
                    <div className="space-y-2 mt-2 font-black">
                      <button
                        type="submit"
                        className="w-full py-3 bg-gradient-to-r from-indigo-500 to-[#10B981] text-black font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg hover:shadow-indigo-500/20 active:scale-[0.98] cursor-pointer"
                      >
                        ✏️ {lang === 'fa' ? 'بروزرسانی تغییرات تراکنش جفت‌شده' : 'Update Coupled Transaction'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingSplitId(null);
                          setEditingSplitRialId(null);
                          setEditingSplitCryptoRefundId(null);

                          setSplitTitle('');
                          setSplitCryptoWhole('');
                          setSplitCryptoFraction('');
                          setSplitRialAmount('');
                          setSplitBank('');
                          setSplitSettleCryptoAmount('');
                          setSplitNotes('');
                          setSplitWallet('');
                          setSplitTxHash('');
                          setSplitPartnerName('');
                          setSplitIsInstallment(false);
                          setSplitInstallmentTotal('3');
                          setSplitInstallmentPaid('1');
                        }}
                        className="w-full py-2 bg-white/5 border border-white/5 text-white/70 font-semibold text-xs rounded-xl hover:bg-white/10 active:scale-[0.98] transition-all cursor-pointer text-center"
                      >
                        ❌ {lang === 'fa' ? 'انصراف' : 'Cancel Edit'}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="submit"
                      className="w-full py-3 bg-gradient-to-r from-indigo-500 to-[#10B981] text-black font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg hover:shadow-indigo-500/20 active:scale-[0.98] cursor-pointer mt-2"
                    >
                      🚀 {splitType === 'split' ? (lang === 'fa' ? 'تولید و ثبت معاملات جفت‌شده' : 'Generate Coupled Split Expense') : (lang === 'fa' ? 'ثبت هزینه شخصی من' : 'Save Personal Expense')}
                    </button>
                  )}
                </form>

                {/* Ledger display column (7 cols on lg) */}
                <div className="lg:col-span-7 bg-[#14161A] border border-white/10 p-6 rounded-2xl space-y-4 min-h-[400px]">
                  <div className="border-b border-white/10 pb-3 flex items-center justify-between">
                    <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
                      <SlidersHorizontal className="h-4.5 w-4.5 text-emerald-400" />
                      <span>{lang === 'fa' ? 'سوابق مخارج دونگی و هزینه‌های شخصی فعال' : 'Active Personal & Shared Expenses'}</span>
                    </h3>
                    <span className="font-mono text-xs text-white/40 font-semibold select-all">
                      {linkedSplitPurchases.length} {lang === 'fa' ? 'رکورد معتبر' : 'Records'}
                    </span>
                  </div>

                  {linkedSplitPurchases.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
                      <Users className="h-12 w-12 text-white/10" />
                      <p className="text-xs text-white/40">
                        {lang === 'fa' 
                          ? 'هنوز هیچ هزینه شخصی یا خرید اشتراکی ثبت نشده است. از فرم بغل استفاده کنید تا اولین فیش هزینه را بسازید!'
                          : 'No expenses or team splits logged yet. Fill out the entry form to log your first slip.'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4 max-h-[580px] overflow-y-auto pr-1">
                      {linkedSplitPurchases.map((item) => (
                        <div 
                          key={item.id} 
                          className="bg-black/40 border border-white/5 hover:border-indigo-500/40 p-4.5 rounded-xl transition-all space-y-3 relative overflow-hidden"
                        >
                          {/* Accent bar */}
                          <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${item.type === 'personal' ? 'from-indigo-600 to-indigo-400' : 'from-indigo-500 to-[#10B981]'}`} style={{ direction: lang === 'fa' ? 'rtl' : 'ltr' }} />

                          {/* Detail Header */}
                          <div className="flex items-start justify-between gap-2 pl-3">
                            <div>
                              <h4 className="font-black text-xs sm:text-sm text-white pr-2 flex items-center gap-2">
                                <span className={`w-1.5 h-1.5 rounded-full inline-block animate-pulse ${item.type === 'personal' ? 'bg-indigo-400' : 'bg-emerald-400'}`} />
                                {item.title}
                                <span className={`text-[9px] px-1.5 py-0.5 rounded font-extrabold border uppercase ${
                                  item.type === 'personal'
                                    ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                                    : 'bg-emerald-500/10 text-[#10B981] border-emerald-500/20'
                                }`}>
                                  {item.type === 'personal' ? (lang === 'fa' ? 'شخصی' : 'Personal') : (lang === 'fa' ? 'دونگی' : 'Split')}
                                </span>
                                {item.isInstallment && (
                                  <span className="text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded font-black flex items-center gap-1 uppercase animate-pulse">
                                    💳 {lang === 'fa' ? `قسطی: ${item.installmentPaid} از ${item.installmentTotal}` : `Installment: ${item.installmentPaid} of ${item.installmentTotal}`}
                                  </span>
                                )}
                              </h4>
                              <p className="text-[10px] text-white/40 mt-1 flex items-center gap-2 font-mono">
                                <span>{lang === 'fa' ? 'تاریخ ثبت:' : 'Logged Date:'} <strong>{item.date}</strong></span>
                                <span>•</span>
                                <span className="bg-white/5 border border-white/5 text-[9px] px-1.5 py-0.2 rounded font-semibold uppercase">{item.id}</span>
                              </p>
                            </div>

                            <div className="flex items-center gap-1">
                              {/* Edit Button */}
                              <button
                                type="button"
                                onClick={() => handleStartEditSplit(item)}
                                className="p-1.5 text-white/40 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-all cursor-pointer"
                                title={lang === 'fa' ? 'ویرایش این فیش هزینه' : 'Edit this expense slip'}
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteSplitPair(item.rialId, item.cryptoId, item.cryptoRefundId)}
                                className="p-1.5 text-white/40 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all cursor-pointer"
                                title={lang === 'fa' ? 'حذف این فیش هزینه' : 'Delete this expense slip'}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Dual flows cards (The Split or Personal single outline) */}
                          {item.type === 'personal' ? (
                            <div className="pt-1 pl-3 animate-fade-in">
                              <div className="bg-white/[0.02] border border-white/5 p-3 rounded-lg flex flex-col justify-between">
                                <span className="text-[9px] uppercase font-mono tracking-wider text-indigo-400 font-extrabold flex items-center gap-1">
                                  👤 {lang === 'fa' ? 'کل هزینه پرداخت‌شده شخصی' : 'My Personal Crypto Outflow'}
                                </span>
                                <div className="mt-2 flex items-baseline gap-2">
                                  <span className="text-base font-black text-white font-mono">{item.cryptoAmount}</span>{' '}
                                  <span className="text-xs text-[#F5A623] font-bold">{item.coinName}</span>
                                  <span className="text-[10px] text-white/30 font-mono">
                                    ({lang === 'fa' ? `شبکه: ${item.network}` : `Net: ${item.network}`})
                                  </span>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 pl-3 animate-fade-in">
                              {/* Left flow: User payment outgoing crypto */}
                              <div className="bg-white/[0.02] border border-white/5 p-3 rounded-lg flex flex-col justify-between">
                                <span className="text-[9px] uppercase font-mono tracking-wider text-rose-400 font-extrabold flex items-center gap-1">
                                  📤 {lang === 'fa' ? 'پرداخت فاکتور ارزی توسط من' : 'My Crypto Outflow'}
                                </span>
                                <div className="mt-2">
                                  <span className="text-sm font-black text-white font-mono">{item.cryptoAmount}</span>{' '}
                                  <span className="text-[10px] text-[#F5A623] font-bold">{item.coinName}</span>
                                  <p className="text-[9px] text-white/30 mt-0.5 uppercase font-mono tracking-wide">
                                    {lang === 'fa' ? `بستر شبکه: ${item.network}` : `Network: ${item.network}`}
                                  </p>
                                </div>
                              </div>

                              {/* Right flow: Partner reimbursement receipt in Rial */}
                              <div className="bg-white/[0.02] border border-white/5 p-3 rounded-lg flex flex-col justify-between">
                                <span className="text-[9px] uppercase font-mono tracking-wider text-emerald-400 font-extrabold flex items-center gap-1">
                                  📥 {lang === 'fa' ? 'سهم نقدی برگشتی فرستاده شده' : 'Reimbursed Share Inward'}
                                </span>
                                <div className="mt-2">
                                  <span className="text-sm font-black text-white font-mono">{(item.rialAmount || 0).toLocaleString()}</span>{' '}
                                  <span className="text-[9px] text-[#10B981] font-bold">{lang === 'fa' ? 'تومان' : 'Tomans'}</span>
                                  <p className="text-[9px] text-white/30 mt-0.5">
                                    {lang === 'fa' ? `مودی: ${item.partnerName || '---'} 👥` : `Shareholder: ${item.partnerName || '---'} 👥`}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Additional ledger links/bank labels */}
                          <div className="bg-[#0A0B0D]/60 p-2 rounded-lg text-[9px] text-white/50 flex flex-wrap items-center justify-between gap-2 font-semibold pl-3">
                            {item.type === 'personal' ? (
                              <span>
                                🔐 {lang === 'fa' ? 'هزینه ۱٠٠٪ شخصی من (بدون سهم شریک یا بازپرداخت ریالی)' : '100% Personal Direct cost (No Rial return)'}
                              </span>
                            ) : (
                              <span>
                                🏦 {lang === 'fa' ? 'بانک واسطه مقصد دریافتی ریالی:' : 'Linked Rial Destination Bank:'} <strong className="text-[#10B981]">{item.bankName}</strong>
                              </span>
                            )}
                            
                            <span className="font-mono text-[8px] text-indigo-400">
                              {item.type === 'personal' ? `PERSONAL ID: ${item.id}` : `COUPLED: ${item.cryptoId} 🔗 ${item.rialId}`}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                </div>
              </div>
            </div>
          );
        })()}

        </main>
      )}

      {/* FOOTER NO-PRINT */}
      {!isLocked && (
        <footer className="no-print max-w-7xl mx-auto mt-16 pb-12 pt-8 border-t border-white/5 text-center text-[10px] font-semibold uppercase tracking-widest text-white/30" style={{ direction: lang === 'fa' ? 'rtl' : 'ltr' }}>
          <p>{t.appTitle} • {lang === 'fa' ? 'کلیه حقوق امنیتی محفوظ است.' : 'Secure Accounting Ledger Workspace.'}</p>
        </footer>
      )}

      {/* CONFIGURATION MODAL (no-print) */}
      {showConfigModal && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <div className="bg-[#14161A]/95 border border-white/10 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4" style={{ direction: lang === 'fa' ? 'rtl' : 'ltr' }}>
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-black text-white flex items-center gap-2 text-sm uppercase">
                <FileSpreadsheet className="h-5 w-5 text-emerald-400 animate-bounce" />
                <span>{t.googleSheetsSettings}</span>
              </h3>
              <button
                onClick={() => setShowConfigModal(false)}
                className="p-1 hover:bg-white/5 rounded-lg text-white/40 hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs leading-relaxed text-white/75 text-right">
              <p>
                {lang === 'fa' 
                  ? 'جهت اتصال، می‌توانید لینک مستقیم گوگل شیت اختصاصی خود را وارد نمایید تا دیتابیس به صورت کاملا زنده و دوطرفه سنک شود.' 
                  : 'Specify an existing Google Sheets file URL or unique Spreadsheet ID below.'}
              </p>

              <div className="space-y-2">
                <label className="block text-[11px] font-black uppercase tracking-wider text-white/50 text-right">{t.sheetsUrlInput}</label>
                <input
                  type="text"
                  placeholder="https://docs.google.com/spreadsheets/d/.../edit"
                  value={manualSpreadsheetInput}
                  onChange={(e) => setManualSpreadsheetInput(e.target.value)}
                  className="w-full px-3 py-2.5 bg-[#0A0B0D] border border-[#ff005520] focus:border-emerald-400 rounded-xl text-left font-mono font-medium text-xs text-white outline-none"
                />
              </div>

              {syncState.spreadsheetId && (
                <div className="bg-black/40 border border-white/10 p-3 rounded-lg text-[11px] text-white/45 space-y-1">
                  <span className="block text-white/60 font-black uppercase tracking-wider">{t.activeSheet}</span>
                  <span className="font-mono block truncate select-all text-emerald-400">{syncState.spreadsheetId}</span>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="px-4 py-2 hover:bg-white/5 border border-white/10 rounded-xl text-xs font-black text-white/50 hover:text-white transition-all uppercase cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={handleLinkSpreadsheet}
                className="px-4 py-2 bg-emerald-400 hover:bg-emerald-350 text-black font-black text-xs rounded-xl shadow-lg hover:shadow-[0_0_12px_rgba(52,211,153,0.5)] active:scale-95 transition-all uppercase cursor-pointer"
              >
                {t.connectSheet}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONVERT CRYPTO TO RIAL DIALOG */}
      {convertTargetCrypto && (
        <div className="no-print fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md overflow-y-auto">
          <div 
            className="bg-[#14161A] border border-emerald-500/30 rounded-3xl p-6 w-full max-w-md shadow-[0_0_50px_rgba(16,185,129,0.15)] space-y-4 text-right" 
            style={{ direction: lang === 'fa' ? 'rtl' : 'ltr' }}
          >
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
                  <RefreshCw className="h-4 w-4" />
                </span>
                <h3 className="font-extrabold text-white text-sm">
                  {lang === 'fa' ? 'تبدیل رمزارز و ثبت دریافت ریالی نقد شده' : 'Convert Crypto & Link to Receipt'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setConvertTargetCrypto(null)}
                className="p-1.5 text-white/40 hover:text-white rounded-lg hover:bg-white/5 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-white/40">{lang === 'fa' ? 'تراکنش مبدا:' : 'Source TX:'}</span>
                <span className="font-mono font-bold text-emerald-400">{convertTargetCrypto.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">{lang === 'fa' ? 'دارایی رمزارز:' : 'Crypto Asset:'}</span>
                <span className="font-mono font-bold text-white">{convertTargetCrypto.amount} {convertTargetCrypto.coinName}</span>
              </div>
              {convertTargetCrypto.convertedAmount !== undefined && convertTargetCrypto.convertedAmount > 0 && (
                <div className="flex justify-between text-yellow-500">
                  <span>{lang === 'fa' ? 'قبلاً نقد شده:' : 'Already converted:'}</span>
                  <span className="font-mono font-bold">{convertTargetCrypto.convertedAmount} / {convertTargetCrypto.amount} {convertTargetCrypto.coinName}</span>
                </div>
              )}
              <div className="flex justify-between text-emerald-300 font-bold border-t border-white/5 pt-1.5 mt-1.5">
                <span>{lang === 'fa' ? 'وزن باقیمانده کاربری:' : 'Remaining weight:'}</span>
                <span className="font-mono">
                  {(convertTargetCrypto.amount - (convertTargetCrypto.convertedAmount || 0)).toFixed(4)} {convertTargetCrypto.coinName}
                </span>
              </div>
            </div>

            <form onSubmit={handleConfirmConversion} className="space-y-4">
              {convertError && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3 rounded-xl text-xs font-bold leading-relaxed text-center">
                  ⚠️ {convertError}
                </div>
              )}

              {/* Amount of Crypto to convert */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-white/40 uppercase tracking-wider text-right">
                  {lang === 'fa' ? `مقدار ارز جهت فروش/تبدیل (${convertTargetCrypto.coinName}):` : `Amount of Crypto to Sell (${convertTargetCrypto.coinName}):`}
                </label>
                <input
                  type="number"
                  step="any"
                  value={convertCoinAmount}
                  onChange={(e) => setConvertCoinAmount(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#090A0C] border border-white/10 focus:border-emerald-400 focus:outline-none rounded-xl text-sm text-left font-mono"
                  placeholder="e.g. 5"
                  required
                />
              </div>

              {/* Exchange Name */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-white/40 uppercase tracking-wider text-right">
                  {lang === 'fa' ? 'صرافی انجام‌دهنده تبدیل:' : 'Exchange Service Name:'}
                </label>
                <input
                  type="text"
                  value={convertExchange}
                  onChange={(e) => setConvertExchange(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#090A0C] border border-white/10 focus:border-emerald-400 focus:outline-none rounded-xl text-sm"
                  placeholder={lang === 'fa' ? 'مثلا نوبیتکس، والکس، صرافی مستقیم' : 'e.g. Nobitex, Wallex'}
                  required
                />
              </div>

              {/* Rial Amount Received */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-white/40 uppercase tracking-wider text-right">
                  {lang === 'fa' ? 'مبلغ ریال دریافتی پایا/واریزی (تومان):' : 'Estimated Tomans Received:'}
                </label>
                <div className="relative font-mono" style={{ direction: 'ltr' }}>
                  <input
                    type="text"
                    value={convertRialAmount}
                    onChange={(e) => {
                      // Apply thousands separator formatting
                      const raw = e.target.value.replace(/,/g, '');
                      if (!isNaN(Number(raw)) || raw === '') {
                        setConvertRialAmount(raw ? Number(raw).toLocaleString() : '');
                      }
                    }}
                    className="w-full pl-4 pr-16 py-2.5 bg-[#090A0C] border border-white/10 focus:border-emerald-400 focus:outline-none rounded-xl text-sm font-mono"
                    placeholder="15,000,000"
                    required
                  />
                  {convertRialAmount && (
                    <span className="absolute right-3 top-2.5 text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-md">
                      {lang === 'fa' ? 'تومان' : 'Toman'}
                    </span>
                  )}
                </div>
                {/* AUTO CALCULATED RATE PER DOLLAR / COIN UNIT */}
                {(() => {
                  const numCoin = parseFloat(convertCoinAmount);
                  const numRial = parseFloat(convertRialAmount.replace(/,/g, ''));
                  if (numCoin > 0 && numRial > 0) {
                    const rate = numRial / numCoin;
                    return (
                      <div className="text-right text-[11px] text-emerald-400/90 font-medium pt-1 pr-1 animate-fade-in flex items-center justify-end gap-1">
                        {lang === 'fa' ? (
                          <>
                            <span>نرخ کل محاسبه‌شده: هر ۱ {convertTargetCrypto.coinName} =</span>
                            <strong className="font-mono text-xs text-white px-1.5 py-0.5 bg-white/5 rounded-md border border-white/10">
                              {rate.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </strong>
                            <span>تومان</span>
                          </>
                        ) : (
                          <>
                            <span>Calculated rate: 1 {convertTargetCrypto.coinName} =</span>
                            <strong className="font-mono text-xs text-white px-1.5 py-0.5 bg-white/5 rounded-md border border-white/10">
                              {rate.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </strong>
                            <span>Tomans</span>
                          </>
                        )}
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>

              {/* Destination Bank Name */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-white/40 uppercase tracking-wider text-right">
                  {lang === 'fa' ? 'نام بانک مقصد دریافت ریالی:' : 'Target Bank Account Destination:'}
                </label>
                <input
                  type="text"
                  value={convertBank}
                  onChange={(e) => setConvertBank(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#090A0C] border border-white/10 focus:border-emerald-400 focus:outline-none rounded-xl text-sm"
                  placeholder={lang === 'fa' ? 'مانند سامان، پاسارگاد، ملی' : 'e.g. Saman Bank, Pasargad'}
                  required
                />
              </div>

              {/* Conversion Date */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-white/40 uppercase tracking-wider text-right">
                  {lang === 'fa' ? 'تاریخ واریز و تبدیل فیش:' : 'Conversion/Receipt Date:'}
                </label>
                <input
                  type="date"
                  value={convertDate}
                  onChange={(e) => setConvertDate(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#090A0C] border border-white/10 focus:border-emerald-400 focus:outline-none rounded-xl text-sm font-mono text-left"
                  required
                />
              </div>

              {/* Custom Notes */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-white/40 uppercase tracking-wider text-right">
                  {lang === 'fa' ? 'توضیحات و بابت تراکنش:' : 'Conversion Notes:'}
                </label>
                <textarea
                  value={convertNotes}
                  onChange={(e) => setConvertNotes(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-2.5 bg-[#090A0C] border border-white/10 focus:border-emerald-400 focus:outline-none rounded-xl text-sm"
                  placeholder={lang === 'fa' ? 'توضیحات اختیاری...' : 'Optional notes...'}
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setConvertTargetCrypto(null)}
                  className="px-4 py-2.5 hover:bg-white/5 border border-white/10 rounded-xl text-xs font-black text-white/50 hover:text-white transition-all uppercase cursor-pointer"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-400 hover:bg-emerald-300 text-black font-black text-xs rounded-xl shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20 transition-all uppercase cursor-pointer"
                >
                  {lang === 'fa' ? 'تایید و ثبت فیش بانکی متصل' : 'Register & Link Bank Receipt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI BULK IMPORT MODAL */}
      {showAiBulkModal && (
        <div className="no-print fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in">
          <div 
            className="bg-[#14161A] border-2 border-[#1E293B] rounded-3xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-[0_0_50px_rgba(99,102,241,0.15)] space-y-5"
            style={{ direction: lang === 'fa' ? 'rtl' : 'ltr' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div className="flex items-center gap-3">
                <span className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
                  <Sparkles className="h-5 w-5 animate-pulse" />
                </span>
                <div className="text-right">
                  <h3 className="font-black text-white text-base">
                    {lang === 'fa' ? 'ثبت گروهی فیش‌ها و تراکنش‌ها با هوش مصنوعی' : 'Bulk Transaction Import with Gemini AI'}
                  </h3>
                  <p className="text-[11px] text-white/45 mt-0.5">
                    {lang === 'fa' 
                      ? 'فایل اکسل (XLSX, CSV) خود را آپلود کنید یا متن دلخواه (شامل جدول یا کپی فیش بانکی) را پیست کنید.' 
                      : 'Upload an Excel/CSV spreadsheet or paste unstructured transaction texts to let Gemini extract lists.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAiBulkModal(false)}
                className="p-1.5 hover:bg-white/5 text-white/40 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Main Split Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Input Area */}
              <div className="space-y-4">
                <div className="space-y-3 text-right">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-black text-white/80">
                      {lang === 'fa' ? '۱. انتخاب فایل اکسل یا نمونه قالب:' : '1. Select Excel File or Standard Template:'}
                    </label>
                    <button
                      type="button"
                      onClick={handleDownloadStandardExcelTemplate}
                      className="px-2.5 py-1 bg- emerald-500/10 hover:bg-emerald-500/25 border border-emerald-400/20 hover:border-emerald-400/40 text-emerald-400 text-[10px] font-black rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <Download className="h-3 w-3 animate-pulse" />
                      <span>{lang === 'fa' ? 'دانلود نمونه اکسل استاندارد 📥' : 'Download Sample Spreadsheet 📥'}</span>
                    </button>
                  </div>
                  
                  {uploadedFileName ? (
                    <div className="p-4 bg-emerald-500/5 border border-emerald-400/20 rounded-xl flex items-center justify-between gap-3 text-right animate-fade-in">
                      <div className="flex items-center gap-2">
                        <span className="p-1.5 bg-emerald-400/10 text-emerald-400 rounded-lg">
                          <CheckCircle className="h-4 w-4" />
                        </span>
                        <div>
                          <p className="text-xs font-bold text-white truncate max-w-[170px]">{uploadedFileName}</p>
                          <p className="text-[10px] text-emerald-400 font-extrabold uppercase tracking-wide">
                            {lang === 'fa' ? 'محتوا آماده تحلیل است' : 'Ready for extraction'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <label className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 text-[10px] font-black rounded-lg cursor-pointer text-white/75 transition-colors">
                          {lang === 'fa' ? 'تعویض فایل 🔄' : 'Replace File 🔄'}
                          <input 
                            type="file" 
                            accept=".xlsx,.xls,.csv" 
                            className="hidden" 
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              setUploadedFileName(file.name);

                              const reader = new FileReader();
                              reader.onload = (evt) => {
                                try {
                                  const bstr = evt.target?.result;
                                  const wb = XLSX.read(bstr, { type: 'binary' });
                                  let combinedText = '';
                                  wb.SheetNames.forEach((sheetName) => {
                                    const worksheet = wb.Sheets[sheetName];
                                    const csv = XLSX.utils.sheet_to_csv(worksheet);
                                    combinedText += `Sheet: ${sheetName}\n${csv}\n\n`;
                                  });
                                  setPastedText(combinedText);
                                } catch (err: any) {
                                  setParseError(lang === 'fa' ? `خطا در خواندن فایل اکسل: ${err.message}` : `Excel read error: ${err.message}`);
                                }
                              };
                              reader.readAsBinaryString(file);
                            }} 
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setUploadedFileName(null);
                            setPastedText('');
                          }}
                          className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center px-4 py-6 bg-[#090A0C]/90 border border-dashed border-[#1E293B] hover:border-indigo-500/50 rounded-xl cursor-pointer transition-all text-center group">
                      <FileSpreadsheet className="h-8 w-8 text-indigo-400 group-hover:scale-110 transition-transform mb-2" />
                      <span className="text-xs text-white/80 font-black">
                        {lang === 'fa' ? 'کلیک کنید تا فایل اکسل آپلود شود' : 'Click to Upload Excel / CSV'}
                      </span>
                      <span className="text-[10px] text-white/40 mt-1">
                        {lang === 'fa' ? 'پشتیبانی از فرمت‌های .xlsx, .xls, .csv' : 'Supports formats: .xlsx, .xls, .csv'}
                      </span>
                      <input 
                        type="file" 
                        accept=".xlsx,.xls,.csv" 
                        className="hidden" 
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setUploadedFileName(file.name);

                          const reader = new FileReader();
                          reader.onload = (evt) => {
                            try {
                              const bstr = evt.target?.result;
                              const wb = XLSX.read(bstr, { type: 'binary' });
                              let combinedText = '';
                              wb.SheetNames.forEach((sheetName) => {
                                const worksheet = wb.Sheets[sheetName];
                                const csv = XLSX.utils.sheet_to_csv(worksheet);
                                combinedText += `Sheet: ${sheetName}\n${csv}\n\n`;
                              });
                              setPastedText(combinedText);
                            } catch (err: any) {
                              setParseError(lang === 'fa' ? `خطا در خواندن فایل اکسل: ${err.message}` : `Excel read error: ${err.message}`);
                            }
                          };
                          reader.readAsBinaryString(file);
                        }} 
                      />
                    </label>
                  )}
                </div>

                <div className="space-y-2 text-right">
                  <label className="block text-xs font-bold text-white/70">
                    {lang === 'fa' ? '۲. چسباندن متن کپی شده یا ویرایش داده کپی شده:' : '2. Paste / Edit Input Raw Ledger Data:'}
                  </label>
                  <textarea
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    rows={8}
                    className="w-full px-4 py-3 bg-[#090A0C] border border-white/10 focus:border-indigo-500 rounded-xl text-xs text-left font-mono focus:outline-none placeholder:text-white/20 text-white/90"
                    placeholder={lang === 'fa' 
                      ? "ستون‌های تفکیک شده، اس ام اس های واریز، متن کپی شده از تلگرام یا اکسل..."
                      : "Paste raw spreadsheet content, text rows..."}
                  />
                </div>

                <button
                  type="button"
                  disabled={isParsingText}
                  onClick={handleParseBulkAI}
                  className="w-full py-3 bg-gradient-to-r from-indigo-500 to-emerald-500 hover:opacity-90 disabled:opacity-50 text-white font-black text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/10 cursor-pointer transition-all uppercase"
                >
                  {isParsingText ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin text-white" />
                      <span>{lang === 'fa' ? 'هوشیار مصنوعی در حال خواندن داده...' : 'Gemini AI Extracting...'}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 text-emerald-300 animate-bounce" />
                      <span>{lang === 'fa' ? 'شروع استخراج هوشمند با هوش مصنوعی' : 'Start Processing with Gemini AI'}</span>
                    </>
                  )}
                </button>

                {parseError && (
                  <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 p-3.5 rounded-xl text-xs font-bold leading-relaxed text-right">
                    ⚠️ {parseError}
                  </div>
                )}
              </div>

              {/* Output / Extraction Results Preview */}
              <div className="space-y-4">
                <h4 className="text-xs font-black uppercase text-indigo-400 tracking-wider text-right">
                  {lang === 'fa' ? '۳. نتیجه استخراج و پیش‌نمایش:' : '3. Extracted Preview:'}
                </h4>

                {parsedRialResults.length === 0 && parsedCryptoResults.length === 0 ? (
                  <div className="h-[300px] border border-white/5 bg-[#090A0C]/50 rounded-2xl flex flex-col items-center justify-center text-center p-6">
                    <BrainCircuit className="h-10 w-10 text-white/25 mb-3 animate-pulse" />
                    <p className="text-xs text-white/40 leading-relaxed max-w-xs text-center">
                      {lang === 'fa' 
                        ? 'منتظر شروع پردازش فیش‌ها... لیست موارد کشف شده در این قسمت به نمایش در خواهد آمد.' 
                        : 'Waiting for parser... The extracted records list will be rendered here for verification before writing.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
                    
                    {/* Rial Extracted Table */}
                    {parsedRialResults.length > 0 && (
                      <div className="space-y-2 text-right">
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase">
                          {lang === 'fa' ? `${parsedRialResults.length} ردیف فیش ریالی` : `${parsedRialResults.length} Rial Receipts`}
                        </span>
                        <div className="bg-[#090A0C] border border-white/5 rounded-xl overflow-hidden overflow-x-auto text-[10px]">
                          <table className="w-full text-right border-collapse">
                            <thead>
                              <tr className="bg-white/5 text-white/50 text-[9px] font-bold border-b border-white/5">
                                <th className="p-2 text-right">{lang === 'fa' ? 'تاریخ' : 'Date'}</th>
                                <th className="p-2 text-right">{lang === 'fa' ? 'نام واریز کننده' : 'Sender'}</th>
                                <th className="p-2 text-left">{lang === 'fa' ? 'مبلغ ریالی (تومان)' : 'Amount (Toman)'}</th>
                                <th className="p-2 text-right">{lang === 'fa' ? 'بانک' : 'Bank'}</th>
                                <th className="p-2 text-center">حذف</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 text-white/80 font-mono">
                              {parsedRialResults.map((e) => (
                                <tr key={e.id} className="hover:bg-white/5">
                                  <td className="p-2 text-right">{e.date}</td>
                                  <td className="p-2 text-right font-sans truncate max-w-[100px]">{e.receivedFrom}</td>
                                  <td className="p-2 text-left text-emerald-400 font-bold">{e.amount.toLocaleString()}</td>
                                  <td className="p-2 text-right font-sans">{e.bankName}</td>
                                  <td className="p-2 text-center">
                                    <button 
                                      type="button" 
                                      onClick={() => setParsedRialResults(prev => prev.filter(r => r.id !== e.id))}
                                      className="text-rose-500 hover:text-rose-400 p-1 rounded transition-colors"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Crypto Extracted Table */}
                    {parsedCryptoResults.length > 0 && (
                      <div className="space-y-2 text-right">
                        <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] font-black uppercase">
                          {lang === 'fa' ? `${parsedCryptoResults.length} ردیف تراکنش کریپتو` : `${parsedCryptoResults.length} Crypto Transactions`}
                        </span>
                        <div className="bg-[#090A0C] border border-white/5 rounded-xl overflow-hidden overflow-x-auto text-[10px]">
                          <table className="w-full text-right border-collapse">
                            <thead>
                              <tr className="bg-white/5 text-white/50 text-[9px] font-bold border-b border-white/5">
                                <th className="p-2 text-right">{lang === 'fa' ? 'تاریخ' : 'Date'}</th>
                                <th className="p-2 text-right">{lang === 'fa' ? 'ارز' : 'Coin'}</th>
                                <th className="p-2 text-left">{lang === 'fa' ? 'وزن ارزی' : 'Amount'}</th>
                                <th className="p-2 text-left">{lang === 'fa' ? 'ارزش کل' : 'Total'}</th>
                                <th className="p-2 text-center">حذف</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 text-white/80 font-mono">
                              {parsedCryptoResults.map((e) => (
                                <tr key={e.id} className="hover:bg-white/5">
                                  <td className="p-2 text-right">{e.date}</td>
                                  <td className="p-2 text-right"><span className="bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded font-bold">{e.coinName}</span></td>
                                  <td className="p-2 text-left font-bold">{e.amount}</td>
                                  <td className="p-2 text-left text-amber-300">${e.equivalentUsd?.toLocaleString()}</td>
                                  <td className="p-2 text-center">
                                    <button 
                                      type="button" 
                                      onClick={() => setParsedCryptoResults(prev => prev.filter(c => c.id !== e.id))}
                                      className="text-rose-500 hover:text-rose-400 p-1 rounded transition-colors"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Save confirmation */}
                    <div className="pt-4 border-t border-white/5">
                      <button
                        type="button"
                        onClick={handleSaveBulkImported}
                        className="w-full py-3 bg-emerald-400 hover:bg-emerald-300 text-black font-black text-xs rounded-xl shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20 active:scale-95 cursor-pointer transition-all uppercase"
                      >
                        ✅ {lang === 'fa' ? 'تایید نهایی و اضافه کردن به دفترچه ثبت' : 'Confirm Bulk Import & Save Records'}
                      </button>
                    </div>

                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}

      {/* CUSTOM SECURE CONFIRMATION MODAL */}
      {confirmModal.isOpen && (
        <div className="no-print fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md animate-fade-in">
          <div 
            className="bg-[#14161A] border-2 border-amber-500/20 rounded-3xl p-6 w-full max-w-sm shadow-[0_0_50px_rgba(245,158,11,0.15)] space-y-5" 
            style={{ direction: lang === 'fa' ? 'rtl' : 'ltr' }}
          >
            <div className="flex items-center gap-3 border-b border-white/5 pb-3">
              <span className="p-2 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
                <AlertCircle className="h-5 w-5 animate-pulse" />
              </span>
              <h3 className="font-black text-white text-sm select-none">
                {confirmModal.title}
              </h3>
            </div>

            <p className="text-xs text-white/75 leading-relaxed text-right font-medium">
              {confirmModal.message}
            </p>

            <div className="flex justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 hover:bg-white/5 border border-white/10 rounded-xl text-xs font-black text-white/50 hover:text-white transition-all uppercase cursor-pointer"
              >
                {confirmModal.cancelText || t.cancel}
              </button>
              <button
                type="button"
                onClick={confirmModal.onConfirm}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs rounded-xl shadow-lg hover:shadow-[0_0_15px_rgba(245,158,11,0.4)] active:scale-95 transition-all uppercase cursor-pointer"
              >
                {confirmModal.confirmText || (lang === 'fa' ? 'تایید' : 'Confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DYNAMIC MOBILE BOTTOM NAVIGATION BAR (Sticky/Fixed) */}
      {isMobileDevice && !isLocked && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="fixed bottom-0 inset-x-0 z-[49] no-print bg-[#14161A]/95 border-t border-white/10 backdrop-blur-md px-1 py-2 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] flex items-center justify-around select-none"
          style={{ direction: lang === 'fa' ? 'rtl' : 'ltr' }}
        >
          <button
            onClick={() => setActiveTab('rial')}
            className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 text-[10px] font-black uppercase tracking-tight transition-all cursor-pointer ${
              activeTab === 'rial' ? 'text-emerald-400 scale-105' : 'text-white/40 hover:text-white/75'
            }`}
          >
            <PiggyBank className="h-5 w-5" />
            <span>{t.rialLedger}</span>
          </button>
          
          <button
            onClick={() => setActiveTab('crypto')}
            className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 text-[10px] font-black uppercase tracking-tight transition-all cursor-pointer ${
              activeTab === 'crypto' ? 'text-emerald-400 scale-105' : 'text-white/40 hover:text-white/75'
            }`}
          >
            <Coins className="h-5 w-5" />
            <span>{t.cryptoLedger}</span>
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 text-[10px] font-black uppercase tracking-tight transition-all cursor-pointer ${
              activeTab === 'analytics' ? 'text-emerald-400 scale-105' : 'text-white/40 hover:text-white/75'
            }`}
          >
            <TrendingUp className="h-5 w-5" />
            <span>{t.analytics}</span>
          </button>

          <button
            onClick={() => setActiveTab('split')}
            className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 text-[10px] font-black uppercase tracking-tight transition-all cursor-pointer ${
              activeTab === 'split' ? 'text-indigo-400 scale-105' : 'text-white/40 hover:text-white/75'
            }`}
          >
            <Users className="h-5 w-5" />
            <span>{lang === 'fa' ? 'دونگی' : 'Split'}</span>
          </button>

          <button
            onClick={() => setActiveTab('ai')}
            className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 text-[10px] font-black uppercase tracking-tight transition-all cursor-pointer ${
              activeTab === 'ai' ? 'text-emerald-400 scale-105 bg-emerald-400/10 rounded-lg px-2 border border-emerald-400/20' : 'text-white/40 hover:text-white/75'
            }`}
          >
            <BrainCircuit className="h-5 w-5 text-indigo-400" />
            <span>{t.aiAccountant}</span>
          </button>
        </motion.div>
      )}
    </div>
  );
}
