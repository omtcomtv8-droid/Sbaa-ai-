import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Header } from './components/Header';
import { NavigationTabs } from './components/NavigationTabs';
import { AssetSelector } from './components/AssetSelector';
import { CandlestickChart } from './components/CandlestickChart';
import { SignalPanel } from './components/SignalPanel';
import { TechnicalGauges } from './components/TechnicalGauges';
import { SignalHistoryTable } from './components/SignalHistoryTable';
import { DiagnosticsPanel } from './components/DiagnosticsPanel';
import { SettingsModal } from './components/SettingsModal';
import { AppUpdateDialog } from './components/AppUpdateDialog';
import { AndroidInstallModal } from './components/AndroidInstallModal';
import { MobileInstallBanner } from './components/MobileInstallBanner';
import { appUpdateService, AppVersionInfo } from './services/AppUpdateService';
import { useAndroidLifecycle } from './hooks/useAndroidLifecycle';
import { MarketRegimeCard } from './components/MarketRegimeCard';
import { MarketDirectionPanel } from './components/MarketDirectionPanel';
import { StrategyScoreTable } from './components/StrategyScoreTable';
import { PerformancePanel } from './components/PerformancePanel';
import { StrategiesConfigPanel } from './components/StrategiesConfigPanel';
import { StrategiesView } from './components/StrategiesView';
import { MarketBrowser } from './components/MarketBrowser';
import { SignalDetailModal } from './components/SignalDetailModal';
import { LandingPage } from './components/LandingPage';
import { VisionAnalysisView } from './components/VisionAnalysisView';
import { AIAnalysisView } from './components/AIAnalysisView';
import { AiApiKeySection } from './components/AiApiKeySection';
import { RiskManagementView } from './components/RiskManagementView';
import { MarketScannerView } from './components/MarketScannerView';
import { AdminPanel } from './components/AdminPanel';
import { AutoTraderView } from './components/AutoTraderView';
import { SbaaStrategyView } from './components/SbaaStrategyView';
import { IndicatorsView } from './components/IndicatorsView';
import { usePersistentSignal } from './hooks/usePersistentSignal';
import { LoginPage } from './components/LoginPage';
import { ActivationScreen } from './components/ActivationScreen';
import { AdminLoginModal } from './components/admin/AdminLoginModal';
import { AdminChangePasswordModal } from './components/admin/AdminChangePasswordModal';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { KeyGenerationRoomModal } from './components/admin/KeyGenerationRoomModal';
import { TelegramSettingsModal } from './components/TelegramSettingsModal';
import { useAuth } from './hooks/useAuth';
import { safeStorage } from './lib/safeStorage';
import {
  auth,
  signInWithGoogle,
  logOut,
  saveUserConnectionConfig,
  getUserConnectionConfig,
  saveTradeOrderToFirestore,
} from './lib/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { tradeHistoryStorage } from './services/TradeHistoryStorage';

import {
  AssetInfo,
  Candle,
  DiagnosticsInfo,
  Signal,
  StrategyName,
  StrategySettings,
  ViewTab,
  IndicatorMetrics,
  PerformanceMetrics,
  Position,
  TradeOrder,
  MarketTick,
  VolatilityAlertState,
  buildCandleId,
} from './types';
import { candleStore } from './services/CandleStore';
import { accountStore } from './services/AccountStore';
import { pocketOptionConnectionService } from './services/PocketOptionConnectionService';
import { pocketOptionSessionStore, PocketOptionSessionSnapshot } from './services/PocketOptionSessionStore';
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Cpu,
  Eye,
  Key,
  Radio,
  RefreshCw,
  Server,
  ShieldAlert,
  ShieldCheck,
  User,
  TrendingUp,
  Wifi,
  X,
  Zap,
} from 'lucide-react';
import { useLanguage } from './i18n/LanguageContext';

// Local candle persistence helpers backed by authoritative candleStore
const loadStoredCandles = (asset: string, timeframe: number): Candle[] => {
  return candleStore.getCandles(asset, timeframe);
};

const saveStoredCandles = (asset: string, timeframe: number, candles: Candle[]) => {
  if (Array.isArray(candles) && candles.length > 0) {
    candleStore.upsertCandles(candles, false);
  }
};

const mergeCandles = (existingList: Candle[], incomingList: Candle[]): Candle[] => {
  if (!incomingList || incomingList.length === 0) return existingList;
  return candleStore.upsertCandles(incomingList, false);
};

export default function App() {
  const [activeTab, setActiveTab] = useState<ViewTab>('landing');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [diagnostics, setDiagnostics] = useState<DiagnosticsInfo | null>(null);
  const [assets, setAssets] = useState<AssetInfo[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<string>('EURUSD_otc');
  const [selectedTimeframe, setSelectedTimeframe] = useState<number>(60);
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyName>('confluence');

  const selectedAssetRef = useRef(selectedAsset);
  selectedAssetRef.current = selectedAsset;

  const selectedTimeframeRef = useRef(selectedTimeframe);
  selectedTimeframeRef.current = selectedTimeframe;

  const [strategySettings, setStrategySettings] = useState<StrategySettings>({
    strategy: 'confluence',
    rsiPeriod: 14,
    rsiOverbought: 70,
    rsiOversold: 30,
    emaFastPeriod: 9,
    emaSlowPeriod: 21,
    bollingerPeriod: 20,
    bollingerStdDev: 2,
    confluenceThreshold: 3,
    minConfirmations: 3,
    minNetScore: 2.0,
    allowCounterTrend: false,
    minPayout: 70,
  });

  const authInfo = useAuth();
  const { authState, activation, user: authUser, firebaseUser: authFirebaseUser, enterDemoGuest } = authInfo;

  // Administrator State
  const [adminToken, setAdminToken] = useState<string | null>(() => {
    return safeStorage.getSessionItem('sabaa_admin_token') || null;
  });
  const [isAdminLoginOpen, setIsAdminLoginOpen] = useState(false);
  const [isAdminChangePasswordOpen, setIsAdminChangePasswordOpen] = useState(false);
  const [isAdminDashboardOpen, setIsAdminDashboardOpen] = useState(false);
  const [isKeyRoomOpen, setIsKeyRoomOpen] = useState(false);
  const [isTelegramModalOpen, setIsTelegramModalOpen] = useState(false);

  useEffect(() => {
    const stored = safeStorage.getSessionItem('sabaa_admin_token');
    if (stored && stored !== adminToken) {
      setAdminToken(stored);
    }
  }, [authState, authUser, adminToken]);

  const [candles, setCandles] = useState<Candle[]>(() => loadStoredCandles('EURUSD_otc', 60));
  const [activeSignal, setActiveSignal] = usePersistentSignal(null);
  const [signalHistory, setSignalHistory] = useState<Signal[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [latestTick, setLatestTick] = useState<MarketTick | null>(null);
  const [indicators, setIndicators] = useState<IndicatorMetrics | null>(null);
  const [performance, setPerformance] = useState<PerformanceMetrics | null>(null);

  const [selectedModalSignal, setSelectedModalSignal] = useState<Signal | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [configuredSession, setConfiguredSession] = useState<string>(() => pocketOptionSessionStore.getState().cachedSessionToken || '');
  const [configuredIsDemo, setConfiguredIsDemo] = useState<boolean>(true);
  const [configuredUid, setConfiguredUid] = useState<string | number | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const firebaseUserRef = useRef<FirebaseUser | null>(firebaseUser);
  firebaseUserRef.current = firebaseUser;
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(true);
  const { t, tTerm, isRTL } = useLanguage();

  // Backtest Historical Chart Overlay State
  const [backtestOverlayTrades, setBacktestOverlayTrades] = useState<any[] | null>(null);
  const [backtestOverlayActive, setBacktestOverlayActive] = useState<boolean>(false);

  // Authoritative Pocket Option Session Store Subscription
  const [poSession, setPoSession] = useState<PocketOptionSessionSnapshot>(() => pocketOptionSessionStore.getState());

  useEffect(() => {
    const unsub = pocketOptionSessionStore.subscribe((snap) => {
      setPoSession(snap);
      if (snap.diagnostics) {
        setDiagnostics(snap.diagnostics);
      }
      if (snap.cachedSessionToken && !configuredSession) {
        setConfiguredSession(snap.cachedSessionToken);
      }
    });
    return unsub;
  }, [configuredSession]);

  const [signalToast, setSignalToast] = useState<{
    id: string;
    asset: string;
    timeframe: string;
    type: 'UP' | 'DOWN';
    confidence: number;
    timestamp: number;
  } | null>(null);
  const lastNotifiedSignalId = useRef<string | null>(null);

  // Android & Direct In-App Install States
  const [updateInfo, setUpdateInfo] = useState<AppVersionInfo | null>(null);
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState<boolean>(false);
  const [isAndroidInstallOpen, setIsAndroidInstallOpen] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const search = window.location.search || '';
      return search.includes('install=true') || search.includes('install=open');
    }
    return false;
  });

  // Native Android System UI & Hardware Back Button Handling
  useAndroidLifecycle({
    onBackPress: () => {
      if (isAndroidInstallOpen) {
        setIsAndroidInstallOpen(false);
        return true;
      }
      if (isUpdateDialogOpen && !updateInfo?.mandatory) {
        setIsUpdateDialogOpen(false);
        return true;
      }
      if (selectedModalSignal) {
        setSelectedModalSignal(null);
        return true;
      }
      if (isSettingsOpen) {
        setIsSettingsOpen(false);
        return true;
      }
      if (activeTab !== 'dashboard') {
        setActiveTab('dashboard');
        return true;
      }
      return false;
    },
  });

  // Automated In-App Update Checker on Startup
  useEffect(() => {
    const unsub = appUpdateService.onUpdateAvailable((info) => {
      setUpdateInfo(info);
      setIsUpdateDialogOpen(true);
    });

    appUpdateService.checkForUpdates().catch(console.warn);

    return () => {
      unsub();
    };
  }, []);

  // Monitor active signal for in-app alert notification
  useEffect(() => {
    if (
      activeSignal &&
      (activeSignal.type === 'UP' || activeSignal.type === 'DOWN') &&
      activeSignal.id !== lastNotifiedSignalId.current
    ) {
      lastNotifiedSignalId.current = activeSignal.id;

      const tfStr = activeSignal.timeframe < 60 ? `${activeSignal.timeframe}s` : `${Math.round(activeSignal.timeframe / 60)}m`;
      setSignalToast({
        id: activeSignal.id,
        asset: (activeSignal.asset || selectedAsset || 'EURUSD').toUpperCase().replace('_OTC', ''),
        timeframe: tfStr,
        type: activeSignal.type,
        confidence: activeSignal.confidence ?? Math.round(activeSignal.strength * 100),
        timestamp: Date.now(),
      });
      const timer = setTimeout(() => {
        setSignalToast((prev) => (prev?.id === activeSignal.id ? null : prev));
      }, 9000);
      return () => clearTimeout(timer);
    }
  }, [activeSignal, selectedAsset]);

  const sseRef = useRef<EventSource | null>(null);

  // 0. Firebase Authentication Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        try {
          const savedConfig = await getUserConnectionConfig(user.uid);
          if (savedConfig && savedConfig.endpoint) {
            if (savedConfig.isDemo !== undefined) setConfiguredIsDemo(savedConfig.isDemo);
            if (savedConfig.accountUid) setConfiguredUid(savedConfig.accountUid);
          }
          // Sync persistent trade records from Firestore (Problem 4 Requirement)
          await tradeHistoryStorage.loadFromFirestore(user.uid);
        } catch (err) {
          console.warn('Could not load user data from Firestore:', err);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // 1. Initial Status Fetch
  const fetchStatus = useCallback(async () => {
    try {
      const statusRes = await fetch('/api/status');

      if (
        statusRes.ok &&
        statusRes.headers.get('content-type')?.includes('application/json')
      ) {
        const data = await statusRes.json();
        if (data.diagnostics) {
          setDiagnostics(data.diagnostics);
          pocketOptionSessionStore.updateFromDiagnostics(data.diagnostics);
          accountStore.updateFromDiagnostics(data.diagnostics);
        }
        if (data.activeAsset && !selectedAsset) setSelectedAsset(data.activeAsset);
        if (data.timeframe && !selectedTimeframe) setSelectedTimeframe(data.timeframe);
        if (data.isAnalyzing !== undefined) {
          setIsAnalyzing(data.isAnalyzing);
        }
        if (data.strategySettings) {
          setStrategySettings(data.strategySettings);
          setSelectedStrategy(data.strategySettings.strategy);
        }
        if (data.activeSignal) {
          setActiveSignal(data.activeSignal);
          if (data.activeSignal.indicators) {
            setIndicators(data.activeSignal.indicators);
          }
        }
        if (data.performance) {
          setPerformance(data.performance);
        }
      }
    } catch (err) {
      console.warn('Status fetch retry in progress:', err);
    }
  }, [selectedAsset, selectedTimeframe]);

  // START Real-Time Analysis Engine (Bug 108)
  const handleStartAnalysis = useCallback(async () => {
    try {
      setIsAnalyzing(true);
      const res = await fetch('/api/analysis/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: selectedAsset,
          timeframe: selectedTimeframe,
          strategy: selectedStrategy,
        }),
      });
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json();
        if (data.signal) setActiveSignal(data.signal);
        if (data.indicators) setIndicators(data.indicators);
        if (data.performance) setPerformance(data.performance);
      }
    } catch (err) {
      console.warn('Notice starting analysis engine:', err);
    }
  }, [selectedAsset, selectedTimeframe, selectedStrategy]);

  // STOP Real-Time Analysis Engine (Bug 108)
  const handleStopAnalysis = useCallback(async () => {
    try {
      setIsAnalyzing(false);
      const res = await fetch('/api/analysis/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json();
        if (data.signal) setActiveSignal(data.signal);
      }
    } catch (err) {
      console.warn('Notice stopping analysis engine:', err);
    }
  }, []);

  // 2. Fetch Assets Catalog
  const fetchAssets = useCallback(async () => {
    try {
      const res = await fetch('/api/assets');
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json();
        if (Array.isArray(data)) setAssets(data);
      }
    } catch (err) {
      console.warn('Assets catalog fetch standby:', err);
    }
  }, []);

  // 3. Fetch Candles
  const fetchCandles = useCallback(async (asset: string, tf: number) => {
    try {
      const res = await fetch(`/api/candles?asset=${encodeURIComponent(asset)}&timeframe=${tf}`);
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const stampedData = data.map((c: Candle) => ({ ...c, asset, timeframe: tf }));
          candleStore.upsertCandles(stampedData);
          const all = candleStore.getCandles(asset, tf);
          setCandles(all);
          if (all.length > 0) {
            setCurrentPrice(all[all.length - 1].close);
          }
        }
      }
    } catch (err) {
      console.warn('Candle fetch standby:', err);
    }
  }, []);

  // 4. Fetch Signals & History
  const fetchSignals = useCallback(async () => {
    try {
      const res = await fetch('/api/signals');
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json();
        if (data.activeSignal) {
          setActiveSignal(data.activeSignal);
          if (data.activeSignal.indicators) {
            setIndicators(data.activeSignal.indicators);
          }
        }
        if (data.history) setSignalHistory(data.history);
        if (data.performance) setPerformance(data.performance);
      }
    } catch (err) {
      console.warn('Signal update standby:', err);
    }
  }, []);

  // 5. Initial Lifecycle Mount
  useEffect(() => {
    fetchStatus();
    fetchAssets();
    fetchSignals();

    // Polling fallback when SSE is idle
    const interval = setInterval(() => {
      fetchStatus();
      fetchSignals();
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchStatus, fetchAssets, fetchSignals]);

  // 5b. Fetch candles specifically on asset / timeframe change
  useEffect(() => {
    // 1. Immediately hydrate from IndexedDB/memory so user never sees empty chart
    candleStore.loadFromPersistence(selectedAsset, selectedTimeframe).then((stored) => {
      if (stored.length > 0) {
        setCandles(stored);
        setCurrentPrice(stored[stored.length - 1].close);
      } else {
        setCandles([]);
      }
    });

    // 2. Fetch latest historical candles from server to merge into store
    fetchCandles(selectedAsset, selectedTimeframe);
  }, [selectedAsset, selectedTimeframe, fetchCandles]);

  // 6. SSE Real-Time Stream
  useEffect(() => {
    if (sseRef.current) {
      sseRef.current.close();
    }

    const sse = new EventSource('/api/live');
    sseRef.current = sse;

    sse.addEventListener('init', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        const currentAsset = selectedAssetRef.current;
        const currentTf = selectedTimeframeRef.current;
        if (data.diagnostics) {
          setDiagnostics(data.diagnostics);
          pocketOptionSessionStore.updateFromDiagnostics(data.diagnostics);
        }
        if (Array.isArray(data.candles) && data.candles.length > 0) {
          const initAsset = data.activeAsset || currentAsset;
          const initTf = data.timeframe || currentTf;
          if (initAsset.toLowerCase() === currentAsset.toLowerCase() && Number(initTf) === Number(currentTf)) {
            const stampedData = data.candles.map((c: Candle) => ({ ...c, asset: currentAsset, timeframe: currentTf }));
            candleStore.upsertCandles(stampedData);
            const all = candleStore.getCandles(currentAsset, currentTf);
            setCandles(all);
            if (all.length > 0) {
              setCurrentPrice(all[all.length - 1].close);
            }
          }
        }
        if (data.signal) {
          setActiveSignal(data.signal);
          if (data.signal.indicators) setIndicators(data.signal.indicators);
        }
      } catch (err) {
        console.error('SSE init error:', err);
      }
    });

    sse.addEventListener('candles_loaded', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        const currentAsset = selectedAssetRef.current;
        const currentTf = selectedTimeframeRef.current;
        if (data.asset && data.asset.toLowerCase() !== currentAsset.toLowerCase()) return;
        if (data.timeframe && Number(data.timeframe) !== Number(currentTf)) return;
        if (Array.isArray(data.candles) && data.candles.length > 0) {
          const stampedData = data.candles.map((c: Candle) => ({ ...c, asset: currentAsset, timeframe: currentTf }));
          candleStore.upsertCandles(stampedData);
          const all = candleStore.getCandles(currentAsset, currentTf);
          setCandles(all);
          if (all.length > 0) {
            setCurrentPrice(all[all.length - 1].close);
          }
        }
      } catch (err) {
        console.error('SSE candles_loaded error:', err);
      }
    });

    sse.addEventListener('assets', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        if (Array.isArray(data) && data.length > 0) {
          setAssets(data);
        }
      } catch (err) {
        console.error('SSE assets error:', err);
      }
    });

    sse.addEventListener('candle_closed', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        const currentAsset = selectedAssetRef.current;
        const currentTf = selectedTimeframeRef.current;
        if (data.candle && typeof data.candle.time === 'number') {
          if (data.candle.asset && data.candle.asset.toLowerCase() !== currentAsset.toLowerCase()) return;
          const closedCandle = { ...data.candle, asset: currentAsset, timeframe: currentTf, isClosed: true };
          candleStore.upsertCandle(closedCandle);
          setCandles(candleStore.getCandles(currentAsset, currentTf));
        }
        if (data.signal) setActiveSignal(data.signal);
        if (data.indicators) setIndicators(data.indicators);
        if (data.performance) setPerformance(data.performance);
      } catch (err) {
        console.error('SSE candle_closed error:', err);
      }
    });

    sse.addEventListener('tick', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        if (data.tick) {
          const currentAsset = selectedAssetRef.current;
          const currentTf = selectedTimeframeRef.current;
          const tick = data.tick;

          if (tick.asset && tick.asset.toLowerCase() !== currentAsset.toLowerCase()) {
            return;
          }

          setCurrentPrice(tick.price);
          setLatestTick(tick);

          // Update forming candle or finalize previous in candleStore
          candleStore.ingestTick(tick, currentTf);

          // If server sent authoritative bulk candles, merge without overwriting
          if (Array.isArray(data.candles) && data.candles.length > 0) {
            const stampedData = data.candles.map((c: Candle) => ({ ...c, asset: currentAsset, timeframe: currentTf }));
            candleStore.upsertCandles(stampedData, false);
          }

          const currentCandles = candleStore.getCandles(currentAsset, currentTf);
          setCandles(currentCandles);
        }
        if (data.signal) {
          setActiveSignal(data.signal);
          if (data.signal.indicators) setIndicators(data.signal.indicators);
          if (data.signal.type !== 'WAIT') {
            setSignalHistory((prev) => {
              const exists = prev.some((s) => s.id === data.signal.id);
              if (!exists) return [data.signal, ...prev.slice(0, 49)];
              return prev;
            });
          }
        }
        setDiagnostics((prev) =>
          prev
            ? {
                ...prev,
                freshnessSeconds: data.freshness,
                isStale: data.isStale,
                ticksCount: prev.ticksCount + 1,
              }
            : null
        );
      } catch (err) {
        console.error('SSE tick error:', err);
      }
    });

    sse.addEventListener('balance', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        if (data && data.balance !== null && data.balance !== undefined) {
          const bal = Number(data.balance);
          const currentMode =
            data.accountMode ||
            pocketOptionSessionStore.getState().accountMode ||
            (diagnostics?.account?.isDemo ? 'DEMO' : 'REAL') ||
            'DEMO';

          pocketOptionSessionStore.setVerifiedBalance({
            generation: data.generation || pocketOptionSessionStore.getState().generation,
            balance: bal,
            accountMode: currentMode,
            currency: data.currency || 'USD',
          });

          accountStore.setVerifiedAccountData({
            accountId: data.accountId || null,
            accountMode: currentMode,
            balance: bal,
            currency: data.currency || 'USD',
            connectionId: data.connectionId || null,
            generation: data.generation,
          });

          setDiagnostics((prev) => {
            if (!prev) {
              return {
                endpoint: '',
                status: 'connected',
                isStale: false,
                freshnessSeconds: 0,
                connectedSince: Date.now(),
                authVerified: true,
                subsystems: {
                  websocket: 'connected',
                  auth: 'success',
                  marketData: 'receiving',
                  account: 'LIVE',
                  overall: 'READY',
                },
                account: {
                  balance: bal,
                  isDemo: currentMode === 'DEMO',
                  currency: data.currency || 'USD',
                  uidMasked: data.accountId || null,
                  uid: null,
                },
                marketStore: null,
              } as any;
            }
            return {
              ...prev,
              account: {
                ...prev.account,
                balance: bal,
                isDemo: currentMode === 'DEMO',
                uidMasked: data.accountId || prev.account?.uidMasked,
                currency: data.currency || prev.account?.currency || 'USD',
              },
              subsystems: {
                ...prev.subsystems,
                account: 'LIVE',
              },
            };
          });
        }
      } catch (err) {
        console.error('SSE balance error:', err);
      }
    });

    sse.addEventListener('status', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        if (data.diagnostics) {
          setDiagnostics(data.diagnostics);
          pocketOptionSessionStore.updateFromDiagnostics(data.diagnostics);
          accountStore.updateFromDiagnostics(data.diagnostics);
        }
      } catch (err) {
        console.error('SSE status error:', err);
      }
    });

    sse.addEventListener('analysis', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        if (data.isAnalyzing !== undefined) setIsAnalyzing(data.isAnalyzing);
        if (data.signal) setActiveSignal(data.signal);
        if (data.indicators) setIndicators(data.indicators);
      } catch (err) {
        console.error('SSE analysis error:', err);
      }
    });

    // Real-time Deal Tracking (Problem 4 Requirement)
    sse.addEventListener('deal_opened', (e: MessageEvent) => {
      try {
        const deal = JSON.parse(e.data);
        if (deal) {
          tradeHistoryStorage.addOrUpdateTrade(deal, firebaseUserRef.current?.uid);
        }
      } catch (err) {
        console.error('SSE deal_opened error:', err);
      }
    });

    sse.addEventListener('deal_closed', (e: MessageEvent) => {
      try {
        const deal = JSON.parse(e.data);
        if (deal) {
          tradeHistoryStorage.addOrUpdateTrade(deal, firebaseUserRef.current?.uid);
        }
      } catch (err) {
        console.error('SSE deal_closed error:', err);
      }
    });

    // Initial batch fetch of broker orders
    fetch('/api/orders')
      .then((r) => r.json())
      .then((data) => {
        if (data && data.success) {
          const allDeals = [
            ...(Array.isArray(data.history) ? data.history : []),
            ...(Array.isArray(data.activeDeals) ? data.activeDeals : []),
          ];
          if (allDeals.length > 0) {
            tradeHistoryStorage.addOrUpdateBulkTrades(allDeals, firebaseUserRef.current?.uid);
          }
        }
      })
      .catch(() => {});

    return () => {
      sse.close();
    };
  }, []);

  // Asset switch
  const handleSelectAsset = async (asset: string) => {
    setSelectedAsset(asset);
    setLatestTick(null);
    const saved = await candleStore.loadFromPersistence(asset, selectedTimeframe);
    if (saved.length > 0) {
      setCandles(saved);
      setCurrentPrice(saved[saved.length - 1].close);
    } else {
      setCandles([]);
    }
    try {
      await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asset, timeframe: selectedTimeframe }),
      });
      fetchCandles(asset, selectedTimeframe);
    } catch (err) {
      console.error('Error switching asset:', err);
    }
  };

  // Timeframe switch (strictly synchronized: 1M=60s, 5M=300s, 15M=900s)
  const handleSelectTimeframe = async (tf: number) => {
    setSelectedTimeframe(tf);
    setLatestTick(null);
    const saved = await candleStore.loadFromPersistence(selectedAsset, tf);
    if (saved.length > 0) {
      setCandles(saved);
      setCurrentPrice(saved[saved.length - 1].close);
    } else {
      setCandles([]);
    }
    try {
      await fetch('/api/timeframe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asset: selectedAsset, timeframe: tf }),
      });
      fetchCandles(selectedAsset, tf);
    } catch (err) {
      console.error('Error switching timeframe:', err);
    }
  };

  // Strategy switch
  const handleSelectStrategy = async (strat: StrategyName) => {
    setSelectedStrategy(strat);
    const updated = { ...strategySettings, strategy: strat, selectedStrategy: strat };
    setStrategySettings(updated);
    try {
      const res = await fetch('/api/strategy/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategy: strat }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.signal) {
          setActiveSignal(data.signal);
          if (data.signal.type === 'UP' || data.signal.type === 'DOWN') {
            setSignalHistory((prev) => {
              const exists = prev.some((s) => s.id === data.signal.id);
              if (!exists) return [data.signal, ...prev.slice(0, 49)];
              return prev;
            });
          }
        }
      }
      fetchSignals();
    } catch (err) {
      console.error('Error updating strategy:', err);
    }
  };

  // Strategy toggle
  const handleToggleStrategy = async (strategyId: string, enabled: boolean) => {
    try {
      await fetch('/api/strategies/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategyId, enabled }),
      });
      fetchSignals();
    } catch (err) {
      console.error('Error toggling strategy:', err);
    }
  };

  // Update complete strategy settings from Config Panel or Settings Modal
  const handleSaveSettings = async (
    endpoint: string,
    session: string,
    isDemo: boolean,
    settings: StrategySettings,
    uid?: string | number | null
  ) => {
    try {
      setIsReconnecting(true);
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint,
          sessionToken: session,
          isDemo,
          uid,
          settings,
        }),
      });
      setStrategySettings(settings);
      setSelectedStrategy(settings.strategy);
      setConfiguredSession(session);
      if (session) {
        pocketOptionSessionStore.setCachedSession(session);
      }
      setConfiguredIsDemo(isDemo);
      if (uid) setConfiguredUid(uid);

      // Sync user connection configuration to Firestore if signed in
      if (firebaseUser) {
        saveUserConnectionConfig(firebaseUser.uid, {
          endpoint,
          isDemo,
          status: 'connected',
          accountUid: String(uid || ''),
        }).catch((err) => console.warn('Could not sync connection config to Firestore:', err));
      }

      setTimeout(() => {
        setIsReconnecting(false);
        fetchStatus();
        fetchAssets();
        fetchCandles(selectedAsset, selectedTimeframe);
      }, 1200);

      setTimeout(() => {
        fetchCandles(selectedAsset, selectedTimeframe);
        fetchAssets();
      }, 3000);
    } catch (err) {
      setIsReconnecting(false);
      console.error('Error saving settings:', err);
    }
  };

  const handleUpdateConfigSettings = async (settings: StrategySettings) => {
    setStrategySettings(settings);
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      });
      fetchSignals();
    } catch (err) {
      console.error('Error updating strategy settings:', err);
    }
  };

  const handleUpdateThreshold = async (threshold: number) => {
    const updated = {
      ...strategySettings,
      selectedThreshold: threshold,
      global: {
        ...strategySettings.global,
        selectedThreshold: threshold,
        minimumSignalConfidence: threshold,
      },
    };
    setStrategySettings(updated);
    try {
      const res = await fetch('/api/strategy/threshold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threshold }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.signal) setActiveSignal(data.signal);
        if (data.settings) setStrategySettings(data.settings);
      }
    } catch (err) {
      console.error('Error updating strategy threshold:', err);
    }
  };

  // Manual reconnect
  const handleReconnect = async () => {
    setIsReconnecting(true);
    try {
      await fetch('/api/reconnect', { method: 'POST' });
      setTimeout(() => {
        setIsReconnecting(false);
        fetchStatus();
        fetchAssets();
        fetchCandles(selectedAsset, selectedTimeframe);
      }, 1200);

      setTimeout(() => {
        fetchCandles(selectedAsset, selectedTimeframe);
        fetchAssets();
      }, 3000);
    } catch (err) {
      setIsReconnecting(false);
      console.error('Error reconnecting:', err);
    }
  };

  // Disconnect
  const handleDisconnect = async () => {
    try {
      await pocketOptionConnectionService.disconnect();
      setConfiguredSession('');
      fetchStatus();
    } catch (err) {
      console.error('Error disconnecting:', err);
    }
  };

  // Connect & Verify from Gateway Onboarding Card
  const handleConnectAccount = async (params: {
    endpoint?: string;
    sessionToken: string;
    isDemo: boolean;
    uid?: number | null;
  }) => {
    try {
      setIsReconnecting(true);
      const targetEndpoint =
        params.endpoint ||
        diagnostics?.endpoint ||
        'wss://api-eu.po.market/socket.io/?EIO=4&transport=websocket';

      const res = await pocketOptionConnectionService.connect({
        endpoint: targetEndpoint,
        sessionToken: params.sessionToken,
        isDemo: params.isDemo,
        uid: params.uid,
      });

      if (res.ok) {
        setConfiguredSession(params.sessionToken);
        setConfiguredIsDemo(params.isDemo);
        if (params.uid) {
          setConfiguredUid(params.uid);
        } else if (res.accountId) {
          setConfiguredUid(res.accountId);
        }

        const snap = pocketOptionSessionStore.getState();
        if (snap.diagnostics) setDiagnostics(snap.diagnostics);

        if (firebaseUser) {
          saveUserConnectionConfig(firebaseUser.uid, {
            endpoint: targetEndpoint,
            isDemo: params.isDemo,
            status: 'connected',
            accountUid: String(params.uid || ''),
          }).catch(console.warn);
        }

        setTimeout(() => {
          fetchStatus();
          fetchAssets();
          fetchCandles(selectedAsset, selectedTimeframe);
          setIsReconnecting(false);
        }, 800);

        setTimeout(() => {
          fetchCandles(selectedAsset, selectedTimeframe);
          fetchAssets();
        }, 2500);

        return { success: true, diagnostics: snap.diagnostics || undefined };
      } else {
        setConfiguredSession(params.sessionToken);
        setIsReconnecting(false);
        return { success: false, error: res.errorMessage || 'فشل الاتصال بالبوابة' };
      }
    } catch (err: any) {
      setIsReconnecting(false);
      return { success: false, error: err.message || 'خطأ في شبكة الاتصال' };
    }
  };

  const isConnected = diagnostics?.subsystems.websocket === 'connected';
  const signalType = activeSignal?.type ?? 'WAIT';

  // 1. If Administrator Dashboard is open, render Full Admin Command Center
  if (isAdminDashboardOpen && adminToken) {
    return (
      <AdminDashboard
        adminToken={adminToken}
        onLogout={() => {
          setAdminToken(null);
          safeStorage.removeSessionItem('sabaa_admin_token');
          setIsAdminDashboardOpen(false);
        }}
        onClose={() => setIsAdminDashboardOpen(false)}
      />
    );
  }

  // 2. VIEW 0: INSTITUTIONAL LANDING PAGE & PRE-ENTRY GATEWAY
  // Landing page is accessible immediately to eliminate black screen and provide direct entry
  if (activeTab === 'landing') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
        <LandingPage
          onEnterTerminal={() => {
            if (authState === 'UNAUTHENTICATED') {
              enterDemoGuest();
            }
            setActiveTab('dashboard');
          }}
          onLaunchTerminal={() => {
            if (authState === 'UNAUTHENTICATED') {
              enterDemoGuest();
            }
            setActiveTab('dashboard');
          }}
          onOpenVision={() => setActiveTab('vision')}
          onOpenScanner={() => setActiveTab('scanner')}
          onOpenSettings={() => setIsSettingsOpen(true)}
          firebaseUser={firebaseUser}
          onSignInGoogle={signInWithGoogle}
          onSignOut={logOut}
          diagnostics={diagnostics}
          onConnectAccount={handleConnectAccount}
          onDisconnectAccount={handleDisconnect}
          configuredSession={configuredSession}
          configuredIsDemo={configuredIsDemo}
          configuredUid={configuredUid}
          isReconnecting={isReconnecting}
          onOpenAndroidInstall={() => setIsAndroidInstallOpen(true)}
          onOpenTelegram={() => setIsTelegramModalOpen(true)}
          onOpenAdmin={() => {
            if (adminToken) setIsAdminDashboardOpen(true);
            else setIsAdminLoginOpen(true);
          }}
          onOpenKeyRoom={() => setIsKeyRoomOpen(true)}
        />

        {/* Telegram Bot Settings Modal */}
        <TelegramSettingsModal
          isOpen={isTelegramModalOpen}
          onClose={() => setIsTelegramModalOpen(false)}
          adminToken={adminToken}
        />

        {/* Key Generation Room Modal */}
        <KeyGenerationRoomModal
          isOpen={isKeyRoomOpen}
          onClose={() => setIsKeyRoomOpen(false)}
          adminToken={adminToken}
          onAdminAuthenticated={(tok) => setAdminToken(tok)}
        />

        {/* Admin Login Modal */}
        <AdminLoginModal
          isOpen={isAdminLoginOpen}
          onClose={() => setIsAdminLoginOpen(false)}
          onSuccess={(token, mustChange) => {
            setAdminToken(token);
            safeStorage.setSessionItem('sabaa_admin_token', token);
            setIsAdminLoginOpen(false);
            if (mustChange) setIsAdminChangePasswordOpen(true);
            else setIsAdminDashboardOpen(true);
          }}
        />

        {/* Admin Change Password Modal */}
        <AdminChangePasswordModal
          isOpen={isAdminChangePasswordOpen}
          adminToken={adminToken || ''}
          onSuccess={() => {
            setIsAdminChangePasswordOpen(false);
            setIsAdminDashboardOpen(true);
          }}
        />

        {/* Settings Modal (Configurable from Landing if needed) */}
        {isSettingsOpen && (
          <SettingsModal
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            onSave={handleSaveSettings}
            currentEndpoint={diagnostics?.endpoint || 'wss://api-eu.po.market/socket.io/?EIO=4&transport=websocket'}
            currentSession={configuredSession}
            currentUid={configuredUid || diagnostics?.account.uid || diagnostics?.authUid}
            isDemo={configuredIsDemo}
            strategySettings={strategySettings}
            diagnostics={diagnostics}
            onDisconnect={handleDisconnect}
          />
        )}

        {/* Android & Mobile App Direct Installation Wizard */}
        <AndroidInstallModal
          isOpen={isAndroidInstallOpen}
          onClose={() => setIsAndroidInstallOpen(false)}
        />

        {/* Mobile Install Sticky Banner */}
        <MobileInstallBanner onOpenModal={() => setIsAndroidInstallOpen(true)} />
      </div>
    );
  }

  // 3. If Logged in with Google but License Expired or Revoked -> render Activation Screen
  if (
    authState === 'EXPIRED' ||
    authState === 'REVOKED' ||
    authState === 'DEVICE_LIMIT_REACHED'
  ) {
    return (
      <>
        <ActivationScreen
          onOpenAdminLogin={() => {
            if (adminToken) setIsAdminDashboardOpen(true);
            else setIsAdminLoginOpen(true);
          }}
          onOpenKeyRoom={() => setIsKeyRoomOpen(true)}
        />
        <KeyGenerationRoomModal
          isOpen={isKeyRoomOpen}
          onClose={() => setIsKeyRoomOpen(false)}
          adminToken={adminToken}
          onAdminAuthenticated={(tok) => setAdminToken(tok)}
        />
        <AdminLoginModal
          isOpen={isAdminLoginOpen}
          onClose={() => setIsAdminLoginOpen(false)}
          onSuccess={(token, mustChange) => {
            setAdminToken(token);
            safeStorage.setSessionItem('sabaa_admin_token', token);
            setIsAdminLoginOpen(false);
            if (mustChange) {
              setIsAdminChangePasswordOpen(true);
            } else {
              setIsAdminDashboardOpen(true);
            }
          }}
        />
        <AdminChangePasswordModal
          isOpen={isAdminChangePasswordOpen}
          adminToken={adminToken || ''}
          onSuccess={() => {
            setIsAdminChangePasswordOpen(false);
            setIsAdminDashboardOpen(true);
          }}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans transition-colors selection:bg-blue-600 selection:text-white">
      {/* 1. Header with Connection, Real Account Pill & Reconnect */}
      <Header
        diagnostics={diagnostics}
        activeSignal={activeSignal}
        onSelectSignal={(sig) => setSelectedModalSignal(sig)}
        selectedAsset={selectedAsset}
        selectedTimeframe={selectedTimeframe}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onReconnect={handleReconnect}
        isReconnecting={isReconnecting}
        firebaseUser={firebaseUser}
        onSignInGoogle={signInWithGoogle}
        onSignOut={logOut}
        onOpenLanding={() => setActiveTab('landing')}
        onOpenAndroidInstall={() => setIsAndroidInstallOpen(true)}
        onOpenAdmin={() => {
          if (adminToken) setIsAdminDashboardOpen(true);
          else setIsAdminLoginOpen(true);
        }}
        onOpenKeyRoom={() => setIsKeyRoomOpen(true)}
        onOpenTelegramSettings={() => setIsTelegramModalOpen(true)}
        activation={activation}
      />

      {/* 2. Main Terminal Layout: Desktop Side Nav (Left) + Content (Center/Right) */}
      <div className="flex-1 flex w-full overflow-hidden">
        {/* NavigationTabs renders Side Nav on desktop (lg:), Top bar on tablet (md:), Bottom bar on mobile */}
        <NavigationTabs
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          signalType={signalType}
          isConnected={isConnected}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />

        {/* Content Viewport */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          {/* 3. Asset & Timeframe Bar (Rendered for analytical views) */}
          {['dashboard', 'chart', 'indicators', 'signals', 'strategies', 'history', 'performance'].includes(activeTab) && (
            <AssetSelector
              assets={assets}
              selectedAsset={selectedAsset}
              selectedTimeframe={selectedTimeframe}
              selectedStrategy={selectedStrategy}
              currentPrice={currentPrice}
              isAnalyzing={isAnalyzing}
              onStartAnalysis={handleStartAnalysis}
              onStopAnalysis={handleStopAnalysis}
              onSelectAsset={handleSelectAsset}
              onSelectTimeframe={handleSelectTimeframe}
              onSelectStrategy={handleSelectStrategy}
            />
          )}

          {/* Active Connection & Authentication In-Progress Banner */}
          {(poSession.connectionState === 'PO_CONNECTION_CONNECTING' || poSession.connectionState === 'PO_CONNECTION_AUTHENTICATING') && (
            <div className="max-w-7xl w-full mx-auto px-3 sm:px-4 lg:px-6 pt-4">
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-3">
                  <RefreshCw className="w-4 h-4 text-amber-400 animate-spin shrink-0" />
                  <div>
                    <h5 className="text-xs font-bold text-amber-300">
                      {poSession.connectionState === 'PO_CONNECTION_AUTHENTICATING'
                        ? (isRTL ? 'جاري التحقق من رمز جلسة Pocket Option...' : 'Authenticating Pocket Option session...')
                        : (isRTL ? 'جاري الاتصال بخادم Pocket Option...' : 'Connecting to Pocket Option broker...')}
                    </h5>
                    <p className="text-[11px] text-amber-400/80">
                      {isRTL ? 'يرجى الانتظار، لا تغلق الصفحة أثناء إتمام الاتصال والتحقق.' : 'Please wait, establishing secure session connection...'}
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                  {poSession.connectionState === 'PO_CONNECTION_AUTHENTICATING' ? 'AUTHENTICATING' : 'CONNECTING'}
                </span>
              </div>
            </div>
          )}

          {/* Authenticated Awaiting Balance Banner */}
          {poSession.connectionState === 'PO_CONNECTION_AUTHENTICATED' && poSession.balanceState === 'BALANCE_LOADING' && (
            <div className="max-w-7xl w-full mx-auto px-3 sm:px-4 lg:px-6 pt-4">
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <h5 className="text-xs font-bold text-emerald-300">
                      {isRTL ? 'تم توثيق الاتصال بنجاح — بانتظار استلام بيانات الرصيد...' : 'Session authenticated — waiting for account balance...'}
                    </h5>
                    <p className="text-[11px] text-emerald-400/80">
                      {isRTL ? 'جلسة التداول نشطة ويتم استقبال الأسعار المباشرة.' : 'Session is active. Live market rates streaming.'}
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                  {poSession.accountMode} ACCOUNT
                </span>
              </div>
            </div>
          )}

          {/* Auth Warning / Token Expired Banner */}
          {(poSession.connectionState === 'PO_CONNECTION_FAILED' || diagnostics?.subsystems.overall === 'AUTH_FAILED' || diagnostics?.subsystems.auth === 'failed') && (
            <div className="max-w-7xl w-full mx-auto px-3 sm:px-4 lg:px-6 pt-4">
              <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400 mt-0.5">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-rose-200">
                      {isRTL
                        ? 'فشل التحقق من جلسة Pocket Option (انتهت صلاحية الجلسة أو الرمز غير صالح)'
                        : 'Pocket Option Authentication Failed (Session Expired / Invalid)'}
                    </h4>
                    <p className="text-xs text-rose-300/80 mt-0.5 leading-relaxed">
                      {isRTL
                        ? 'أعادت بوابة Pocket Option رفض جلسة الاتصال (NotAuthorized). يرجى تحديث رمز الجلسة / SSD أو التبديل الفوري للحساب التجريبي لمتابعة الرسوم البيانية والإشارات الحية فوراً.'
                        : 'The Pocket Option gateway returned an authentication rejection (NotAuthorized). Your session token has expired or is invalid. You can update your session token or switch to Demo mode now to continue real-time charts and signals.'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
                  <button
                    id="btn-switch-demo-banner"
                    type="button"
                    onClick={async () => {
                      try {
                        setIsReconnecting(true);
                        await fetch('/api/account/switch-mode', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ mode: 'DEMO' }),
                        });
                        setConfiguredIsDemo(true);
                        setTimeout(() => {
                          fetchStatus();
                          fetchAssets();
                          fetchCandles(selectedAsset, selectedTimeframe);
                          setIsReconnecting(false);
                        }, 800);
                      } catch (err) {
                        setIsReconnecting(false);
                      }
                    }}
                    className="px-3.5 py-2 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-all cursor-pointer shadow-sm flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>{isRTL ? 'التبديل للتجريبي الفوري' : 'Switch to Demo'}</span>
                  </button>
                  <button
                    id="btn-update-token-banner"
                    type="button"
                    onClick={() => setIsSettingsOpen(true)}
                    className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
                  >
                    <Key className="w-3.5 h-3.5" />
                    <span>{isRTL ? 'تحديث رمز الجلسة' : 'Update Session'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 4. Tab Views Router */}
          <main className="flex-1 max-w-7xl 2xl:max-w-[1700px] w-full mx-auto p-2.5 sm:p-4 lg:p-6 space-y-4 sm:space-y-6 pb-[calc(5.5rem+var(--sab))] md:pb-8">

        {/* VIEW 1: MAIN DASHBOARD */}
        {(activeTab === 'dashboard' || activeTab === 'terminal' || activeTab === 'portfolio' || !['market', 'chart', 'indicators', 'strategies', 'signals', 'history', 'performance', 'connection', 'account', 'diagnostics', 'settings', 'vision', 'ai_analysis', 'scanner', 'risk', 'admin'].includes(activeTab)) && (
          <div className="space-y-4 sm:space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
              {/* Left Column (7-8 cols): Candlestick Chart + Signal Callout */}
              <div className="lg:col-span-7 xl:col-span-8 space-y-4 sm:space-y-6">
                <CandlestickChart
                  candles={candles}
                  activeAsset={selectedAsset}
                  timeframe={selectedTimeframe}
                  currentPrice={currentPrice}
                  digits={selectedAsset.includes('JPY') ? 3 : 5}
                  srLevels={activeSignal?.srLevels}
                  recentSignals={signalHistory}
                  activeSignal={activeSignal}
                  indicators={indicators}
                  dataStatus={diagnostics?.isStale ? 'STALE' : activeSignal?.dataStatus || 'LIVE'}
                  freshnessSeconds={diagnostics?.freshnessSeconds ?? 0}
                  onSelectTimeframe={handleSelectTimeframe}
                  onSelectSignal={(sig) => setSelectedModalSignal(sig)}
                  gannData={activeSignal?.gannData}
                  elliottData={activeSignal?.elliottData}
                  darvasData={activeSignal?.darvasData}
                  selectedStrategy={selectedStrategy}
                  backtestOverlayTrades={backtestOverlayActive ? backtestOverlayTrades : null}
                  onClearBacktestOverlay={() => setBacktestOverlayActive(false)}
                />

                <SignalPanel
                  signal={activeSignal}
                  isStale={diagnostics?.isStale ?? false}
                  freshnessSeconds={diagnostics?.freshnessSeconds ?? 0}
                  isAnalyzing={isAnalyzing}
                  onStartAnalysis={handleStartAnalysis}
                  onStopAnalysis={handleStopAnalysis}
                  onOpenDetail={() => activeSignal && setSelectedModalSignal(activeSignal)}
                />
              </div>

              {/* Right Column (4-5 cols): Authoritative Market Direction, Regime, Technical Gauges, Strategy Scores */}
              <div className="lg:col-span-5 xl:col-span-4 space-y-4 sm:space-y-6">
                <MarketDirectionPanel
                  marketDirection={
                    (activeSignal as any)?.marketDirection ??
                    (activeSignal?.type === 'UP' ? 'BULLISH' : activeSignal?.type === 'DOWN' ? 'BEARISH' : 'WAIT')
                  }
                  trendValue={activeSignal?.indicators?.adx?.trendStrength ?? (activeSignal?.type === 'UP' ? 'BULLISH' : activeSignal?.type === 'DOWN' ? 'BEARISH' : 'WAIT')}
                  momentumValue={
                    activeSignal?.indicators?.rsi != null && typeof activeSignal.indicators.rsi === 'number'
                      ? activeSignal.indicators.rsi > 55
                        ? `BULLISH (${activeSignal.indicators.rsi.toFixed(1)})`
                        : activeSignal.indicators.rsi < 45
                        ? `BEARISH (${activeSignal.indicators.rsi.toFixed(1)})`
                        : `NEUTRAL (${activeSignal.indicators.rsi.toFixed(1)})`
                      : null
                  }
                  structureValue={activeSignal?.candle?.pattern || (activeSignal?.type === 'UP' ? 'Higher Highs Sequence' : activeSignal?.type === 'DOWN' ? 'Lower Lows Sequence' : 'Consolidation')}
                  volatilityValue={activeSignal?.indicators?.volatilityState || 'NORMAL'}
                  atrValue={typeof activeSignal?.indicators?.atr === 'number' ? activeSignal.indicators.atr : null}
                  supportLevel={
                    activeSignal?.srLevels?.find((l) => l.type === 'SUPPORT')?.price ??
                    (activeSignal?.srLevels as any)?.supports?.[0]?.price ??
                    null
                  }
                  resistanceLevel={
                    activeSignal?.srLevels?.find((l) => l.type === 'RESISTANCE')?.price ??
                    (activeSignal?.srLevels as any)?.resistances?.[0]?.price ??
                    null
                  }
                  lastCandle={candles && candles.length > 0 ? candles[candles.length - 1] : null}
                  dataFreshnessMs={(diagnostics?.freshnessSeconds ?? 0) * 1000}
                  source={candles && candles.length > 0 && (candles[0] as any).source ? (candles[0] as any).source : (selectedAsset.includes('_otc') ? 'Pocket Option OTC Feed' : 'Pocket Option Real Feed')}
                  asset={selectedAsset}
                  timeframe={selectedTimeframe}
                  digits={selectedAsset.includes('JPY') ? 3 : 5}
                />
                <MarketRegimeCard regime={activeSignal?.regime ?? null} />
                <TechnicalGauges indicators={indicators} candles={candles} />
                <StrategyScoreTable
                  strategies={activeSignal?.strategies}
                  conflictProtectionActive={activeSignal?.conflictProtectionActive}
                  asset={selectedAsset}
                  timeframe={selectedTimeframe}
                  candles={candles}
                  onBacktestOverlayChange={(trades, _info, active) => {
                    setBacktestOverlayTrades(trades);
                    setBacktestOverlayActive(active);
                  }}
                  isOverlayActive={backtestOverlayActive}
                  currentBacktestTrades={backtestOverlayTrades}
                  onClearBacktestOverlay={() => {
                    setBacktestOverlayActive(false);
                    setBacktestOverlayTrades(null);
                  }}
                />
              </div>
            </div>

            {/* Bottom: Audited Signal History */}
            <SignalHistoryTable
              history={signalHistory}
              onSelectSignal={(sig) => setSelectedModalSignal(sig)}
            />
          </div>
        )}

        {/* VIEW 2: FULL ASSET CATALOG BROWSER */}
        {activeTab === 'market' && (
          <MarketBrowser
            assets={assets}
            selectedAsset={selectedAsset}
            currentPrice={currentPrice}
            onSelectAsset={(asset) => {
              handleSelectAsset(asset);
              setActiveTab('dashboard');
            }}
          />
        )}

        {/* VIEW 3: FULL CANDLESTICK CHART */}
        {activeTab === 'chart' && (
          <div className="space-y-6">
            <CandlestickChart
              candles={candles}
              activeAsset={selectedAsset}
              timeframe={selectedTimeframe}
              currentPrice={currentPrice}
              digits={selectedAsset.includes('JPY') ? 3 : 5}
              srLevels={activeSignal?.srLevels}
              recentSignals={signalHistory}
              activeSignal={activeSignal}
              indicators={indicators}
              dataStatus={diagnostics?.isStale ? 'STALE' : activeSignal?.dataStatus || 'LIVE'}
              freshnessSeconds={diagnostics?.freshnessSeconds ?? 0}
              onSelectTimeframe={handleSelectTimeframe}
              onSelectSignal={(sig) => setSelectedModalSignal(sig)}
              gannData={activeSignal?.gannData}
              elliottData={activeSignal?.elliottData}
              darvasData={activeSignal?.darvasData}
              selectedStrategy={selectedStrategy}
              backtestOverlayTrades={backtestOverlayActive ? backtestOverlayTrades : null}
              onClearBacktestOverlay={() => setBacktestOverlayActive(false)}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <MarketRegimeCard regime={activeSignal?.regime ?? null} />
              <TechnicalGauges indicators={indicators} candles={candles} />
            </div>
          </div>
        )}

        {/* VIEW 3.5: INDICATORS & MOVING AVERAGES DASHBOARD */}
        {activeTab === 'indicators' && (
          <IndicatorsView
            indicators={indicators}
            candles={candles}
            activeAsset={selectedAsset}
            timeframe={selectedTimeframe}
            currentPrice={currentPrice}
            srLevels={activeSignal?.srLevels}
          />
        )}

        {/* VIEW 4: STRATEGY LIST & REAL STRATEGY CARDS */}
        {activeTab === 'strategies' && (
          <StrategiesView
            strategies={activeSignal?.strategies}
            settings={strategySettings}
            activeAsset={selectedAsset}
            timeframe={selectedTimeframe}
            currentPrice={currentPrice}
            selectedStrategy={selectedStrategy}
            indicators={indicators}
            activeSignal={activeSignal}
            onSelectStrategy={handleSelectStrategy}
            onToggleStrategy={handleToggleStrategy}
            onUpdateSettings={handleUpdateConfigSettings}
          />
        )}

        {/* VIEW 5: LIVE SIGNALS DEEP DIVE */}
        {activeTab === 'signals' && (
          <div className="space-y-6">
            <SignalPanel
              signal={activeSignal}
              isStale={diagnostics?.isStale ?? false}
              freshnessSeconds={diagnostics?.freshnessSeconds ?? 0}
              isAnalyzing={isAnalyzing}
              onStartAnalysis={handleStartAnalysis}
              onStopAnalysis={handleStopAnalysis}
              onOpenDetail={() => activeSignal && setSelectedModalSignal(activeSignal)}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <StrategyScoreTable
                strategies={activeSignal?.strategies}
                conflictProtectionActive={activeSignal?.conflictProtectionActive}
                asset={selectedAsset}
                timeframe={selectedTimeframe}
                candles={candles}
                onBacktestOverlayChange={(trades, _info, active) => {
                  setBacktestOverlayTrades(trades);
                  setBacktestOverlayActive(active);
                }}
                isOverlayActive={backtestOverlayActive}
                currentBacktestTrades={backtestOverlayTrades}
                onClearBacktestOverlay={() => {
                  setBacktestOverlayActive(false);
                  setBacktestOverlayTrades(null);
                }}
              />
              <MarketRegimeCard regime={activeSignal?.regime ?? null} />
            </div>
          </div>
        )}

        {/* VIEW 6: AUDITED SIGNAL HISTORY */}
        {activeTab === 'history' && (
          <div className="space-y-6">
            <SignalHistoryTable
              history={signalHistory}
              onSelectSignal={(sig) => setSelectedModalSignal(sig)}
            />
          </div>
        )}

        {/* VIEW 7: PERFORMANCE METRICS */}
        {activeTab === 'performance' && (
          <PerformancePanel performance={performance} history={signalHistory} />
        )}

        {/* VIEW 8: CONNECTION & WEBSOCKET TELEMETRY */}
        {activeTab === 'connection' && (
          <div className="space-y-6">
            <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-blue-400" />
                  <h3 className="font-bold text-sm text-slate-200 uppercase tracking-wider">
                    Pocket Option WebSocket Protocol Stream
                  </h3>
                </div>
                <button
                  onClick={handleReconnect}
                  disabled={isReconnecting}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isReconnecting ? 'animate-spin' : ''}`} />
                  <span>Reconnect WebSocket</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                  <div className="text-slate-500 text-[11px] font-sans">Endpoint Host</div>
                  <div className="text-slate-200 font-bold break-all">
                    {diagnostics?.endpoint || 'demo-api-eu.po.market'}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                  <div className="text-slate-500 text-[11px] font-sans">Transport Status</div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
                      }`}
                    />
                    <span className="font-bold uppercase text-slate-200">
                      {diagnostics?.subsystems.websocket || 'DISCONNECTED'}
                    </span>
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                  <div className="text-slate-500 text-[11px] font-sans">Packet Counter</div>
                  <div className="text-slate-200 font-bold">
                    {diagnostics?.packetCount ?? 0} packets received
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                  <div className="text-slate-500 text-[11px] font-sans">Tick Ingestion</div>
                  <div className="text-slate-200 font-bold">
                    {diagnostics?.ticksCount ?? 0} ticks ({diagnostics?.freshnessSeconds ?? 0}s freshness)
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                  <div className="text-slate-500 text-[11px] font-sans">Latency / Ping</div>
                  <div className="text-slate-200 font-bold">
                    {diagnostics?.latencyMs ?? 0} ms
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                  <div className="text-slate-500 text-[11px] font-sans">Active Candle Buffer</div>
                  <div className="text-slate-200 font-bold">
                    {candles.length} bars ({selectedTimeframe}s timeframe)
                  </div>
                </div>
              </div>
            </div>

            <DiagnosticsPanel
              diagnostics={diagnostics}
              onOpenSettings={() => setIsSettingsOpen(true)}
            />
          </div>
        )}

        {/* VIEW 9: ACCOUNT OVERVIEW */}
        {activeTab === 'account' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <User className="w-5 h-5 text-blue-400" />
                  <h3 className="font-bold text-sm text-slate-200 uppercase tracking-wider">
                    Pocket Option Account Session Status
                  </h3>
                </div>
                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white transition-colors"
                >
                  Configure SSD
                </button>
              </div>

              <div className="space-y-3 text-xs">
                {/* 1. Connection State */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-400">Connection:</span>
                  <span className="font-bold font-mono">
                    {diagnostics?.subsystems.websocket === 'connected' ? (
                      <span className="text-emerald-400 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        CONNECTED
                      </span>
                    ) : diagnostics?.subsystems.websocket === 'connecting' ? (
                      <span className="text-amber-400 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                        CONNECTING...
                      </span>
                    ) : diagnostics?.subsystems.overall === 'AUTH_FAILED' || (diagnostics?.subsystems.overall as string) === 'TIMEOUT' ? (
                      <span className="text-rose-400 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-rose-500" />
                        FAILED ({diagnostics.subsystems.overall})
                      </span>
                    ) : (
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-slate-600" />
                        DISCONNECTED
                      </span>
                    )}
                  </span>
                </div>

                {/* 2. Authentication State */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-400">Authentication:</span>
                  <span className="font-bold">
                    {diagnostics?.authVerified ? (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> AUTHENTICATED
                      </span>
                    ) : (
                      <span className="text-amber-400 flex items-center gap-1">
                        <AlertTriangle className="w-4 h-4" /> NOT AUTHENTICATED
                      </span>
                    )}
                  </span>
                </div>

                {/* 3. Account Data State */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-400">Account:</span>
                  <span className="font-mono font-bold">
                    {diagnostics?.account.status === 'LIVE' ? (
                      <span className="text-emerald-400">READY</span>
                    ) : diagnostics?.subsystems.account === 'LOADING' ? (
                      <span className="text-amber-400 animate-pulse">LOADING...</span>
                    ) : (
                      <span className="text-slate-400">UNAVAILABLE</span>
                    )}
                  </span>
                </div>

                {/* 4. Mode */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-400">Mode:</span>
                  <span className="font-mono font-bold">
                    {diagnostics?.account.isDemo ? (
                      <span className="text-amber-400">DEMO</span>
                    ) : diagnostics?.authVerified ? (
                      <span className="text-emerald-400">REAL</span>
                    ) : (
                      <span className="text-slate-400">UNKNOWN</span>
                    )}
                  </span>
                </div>

                {/* 5. Balance */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-400">Balance:</span>
                  <span className="font-mono font-bold text-base">
                    {diagnostics?.account.balance !== null && diagnostics?.account.balance !== undefined ? (
                      <span className={diagnostics.account.isDemo ? 'text-amber-400' : 'text-emerald-400'}>
                        ${diagnostics.account.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    ) : diagnostics?.subsystems.account === 'LOADING' ? (
                      <span className="text-xs text-amber-400 font-sans animate-pulse">Loading balance...</span>
                    ) : (
                      <span className="text-xs text-slate-500 font-sans">Unavailable</span>
                    )}
                  </span>
                </div>

                {/* 6. Last Update */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-400">Last update:</span>
                  <span className="font-mono text-slate-300">
                    {diagnostics?.account.lastUpdated
                      ? new Date(diagnostics.account.lastUpdated).toLocaleTimeString()
                      : diagnostics?.lastTickTime
                      ? new Date(diagnostics.lastTickTime).toLocaleTimeString()
                      : 'None recorded'}
                  </span>
                </div>

                {/* 7. Masked Account UID */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-400">Masked Account UID:</span>
                  <span className="font-mono text-slate-300">
                    {diagnostics?.account.uidMasked || 'N/A'}
                  </span>
                </div>

                {/* 8. Active SSD Session */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-400">Active SSD Session:</span>
                  <span className="font-mono text-slate-300">
                    {diagnostics?.sessionMasked || 'None configured'}
                  </span>
                </div>
              </div>

              {diagnostics?.hasSession && (
                <div className="pt-2 flex justify-end">
                  <button
                    onClick={handleDisconnect}
                    className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold transition-colors"
                  >
                    Disconnect Account Session
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* VIEW 10: SUBSYSTEM DIAGNOSTICS & LOGS */}
        {activeTab === 'diagnostics' && (
          <DiagnosticsPanel
            diagnostics={diagnostics}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />
        )}

        {/* VIEW 11: SETTINGS */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            <StrategiesConfigPanel
              settings={strategySettings}
              onUpdateSettings={handleUpdateConfigSettings}
            />
            <AiApiKeySection
              activeAsset={selectedAsset}
              timeframe={selectedTimeframe}
              currentPrice={currentPrice}
              activeSignal={activeSignal}
              indicators={indicators}
            />
          </div>
        )}

        {/* VIEW 12: VISION ANALYSIS VIEW */}
        {activeTab === 'vision' && (
          <VisionAnalysisView
            currentSymbol={selectedAsset}
            currentPrice={currentPrice || 0}
            onApplySetup={(setup) => {
              if (setup.symbol) handleSelectAsset(setup.symbol);
              setActiveTab('chart');
            }}
          />
        )}

        {/* VIEW 13: AI ANALYSIS VIEW */}
        {activeTab === 'ai_analysis' && (
          <div className="space-y-6">
            <AiApiKeySection
              activeAsset={selectedAsset}
              timeframe={selectedTimeframe}
              currentPrice={currentPrice}
              activeSignal={activeSignal}
              indicators={indicators}
            />
            <AIAnalysisView
              currentSymbol={selectedAsset}
              currentPrice={currentPrice || 0}
              onApplySetup={(setup) => {
                if (setup.symbol) handleSelectAsset(setup.symbol);
                setActiveTab('chart');
              }}
            />
          </div>
        )}

        {/* VIEW 14: MARKET SCANNER */}
        {activeTab === 'scanner' && (
          <MarketScannerView
            onSelectAsset={(sym) => {
              handleSelectAsset(sym);
              setActiveTab('dashboard');
            }}
          />
        )}

        {/* VIEW: SBAA SMART STRATEGY ENGINE */}
        {activeTab === 'sbaa' && (
          <SbaaStrategyView
            activeAsset={selectedAsset}
            timeframe={selectedTimeframe}
            currentPrice={currentPrice || 0}
          />
        )}

        {/* VIEW 16: STEALTH AUTO-TRADER */}
        {activeTab === 'autotrader' && (
          <AutoTraderView
            currentAsset={selectedAsset}
            currentTimeframe={selectedTimeframe}
            accountBalance={diagnostics?.account?.balance ?? null}
            isDemoAccount={diagnostics?.account?.isDemo ?? true}
          />
        )}

        {/* VIEW 17: RISK MANAGEMENT GUARDIAN */}
        {activeTab === 'risk' && (
          <RiskManagementView
            initialBalance={diagnostics?.account?.balance}
            isDemo={diagnostics?.account?.isDemo}
          />
        )}

        {/* VIEW 18: ADMIN & TELEMETRY */}
        {activeTab === 'admin' && <AdminPanel />}
      </main>
    </div>
  </div>

      {/* 5. Account & SSD Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentEndpoint={diagnostics?.endpoint || 'wss://api-eu.po.market/socket.io/?EIO=4&transport=websocket'}
        currentSession={configuredSession}
        currentUid={configuredUid || diagnostics?.account.uid || diagnostics?.authUid}
        isDemo={configuredIsDemo}
        strategySettings={strategySettings}
        diagnostics={diagnostics}
        onSave={handleSaveSettings}
        onDisconnect={handleDisconnect}
      />

      {/* 6. Audited Signal Detail Modal */}
      <SignalDetailModal
        signal={selectedModalSignal}
        onClose={() => setSelectedModalSignal(null)}
      />

      {/* 7. Android In-App Direct Update Dialog */}
      <AppUpdateDialog
        versionInfo={updateInfo}
        isOpen={isUpdateDialogOpen}
        onClose={() => setIsUpdateDialogOpen(false)}
      />

      {/* 8. Android APK & Mobile PWA Install Modal */}
      <AndroidInstallModal
        isOpen={isAndroidInstallOpen}
        onClose={() => setIsAndroidInstallOpen(false)}
      />

      {/* Mobile Install Sticky Banner */}
      <MobileInstallBanner onOpenModal={() => setIsAndroidInstallOpen(true)} />

      {/* Admin Portals */}
      <AdminLoginModal
        isOpen={isAdminLoginOpen}
        onClose={() => setIsAdminLoginOpen(false)}
        onSuccess={(token, mustChange) => {
          setAdminToken(token);
          safeStorage.setSessionItem('sabaa_admin_token', token);
          setIsAdminLoginOpen(false);
          if (mustChange) {
            setIsAdminChangePasswordOpen(true);
          } else {
            setIsAdminDashboardOpen(true);
          }
        }}
      />
      <AdminChangePasswordModal
        isOpen={isAdminChangePasswordOpen}
        adminToken={adminToken || ''}
        onSuccess={() => {
          setIsAdminChangePasswordOpen(false);
          setIsAdminDashboardOpen(true);
        }}
      />

      {/* Telegram Bot Settings Modal */}
      <TelegramSettingsModal
        isOpen={isTelegramModalOpen}
        onClose={() => setIsTelegramModalOpen(false)}
        adminToken={adminToken}
      />

      {/* Key Generation Room Modal */}
      <KeyGenerationRoomModal
        isOpen={isKeyRoomOpen}
        onClose={() => setIsKeyRoomOpen(false)}
        adminToken={adminToken}
        onAdminAuthenticated={(tok) => setAdminToken(tok)}
      />

      {/* SECTION 43: REAL IN-APP SIGNAL NOTIFICATION */}
      {signalToast && (
        <div
          id="toast-new-signal"
          onClick={() => {
            if (activeSignal) setSelectedModalSignal(activeSignal);
            setSignalToast(null);
          }}
          className={`fixed bottom-6 right-6 z-50 max-w-sm p-4 rounded-xl border shadow-2xl backdrop-blur-md cursor-pointer transition-all duration-300 animate-in fade-in slide-in-from-bottom-5 ${
            signalToast.type === 'UP'
              ? 'bg-slate-950/95 border-emerald-500/60 shadow-emerald-950/50 text-emerald-400'
              : 'bg-slate-950/95 border-rose-500/60 shadow-rose-950/50 text-rose-400'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div
                className={`p-2 rounded-lg ${
                  signalToast.type === 'UP' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                }`}
              >
                {signalToast.type === 'UP' ? <ArrowUp className="w-5 h-5 stroke-[3]" /> : <ArrowDown className="w-5 h-5 stroke-[3]" />}
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {t('signals.newSignalNotification', 'NEW CONFIRMED SIGNAL')}
                </div>
                <div className="text-sm font-black text-slate-100 flex items-center gap-1.5 font-mono">
                  <span>{signalToast.asset}</span>
                  <span>•</span>
                  <span>{signalToast.timeframe}</span>
                  <span>•</span>
                  <span className={signalToast.type === 'UP' ? 'text-emerald-400' : 'text-rose-400'}>
                    {tTerm(signalToast.type)}
                  </span>
                  <span>•</span>
                  <span className="text-amber-400">{signalToast.confidence}%</span>
                </div>
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSignalToast(null);
              }}
              className="text-slate-500 hover:text-slate-300 p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">{t('signals.clickToInspectEvidence', 'Tap to inspect 21-strategy evidence')}</span>
            <span className="text-amber-400 font-bold flex items-center gap-0.5">
              {t('signals.inspect', 'Inspect')} →
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
