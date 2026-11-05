import React, { useState, useEffect } from 'react';
import {
  Bot,
  Play,
  Square,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Clock,
  Coffee,
  RotateCcw,
  Zap,
  Activity,
  CheckCircle2,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  Sliders,
  Cpu,
  Layers,
  Sparkles,
  RefreshCw,
  BarChart3,
  Wifi,
  WifiOff,
  Flame,
  Radio,
  FileText,
  Save,
  Check,
  XCircle,
  ExternalLink,
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { TradeDetailModal, DetailedTradeRecord } from './TradeDetailModal';

interface AutoTraderStatus {
  isRunning: boolean;
  isEmergencyStopped: boolean;
  config: {
    strategyId: string;
    baseAmount: number;
    maxAmount: number;
    stopLoss: number;
    takeProfit: number;
    asset: string;
    timeframe: number;
    isDemo: boolean;
    enableMartingale: boolean;
    martingaleMultiplier: number;
    maxMartingaleDepth: number;
    tradesBeforeRest: number;
    maxConcurrentTrades?: number;
    cooldownBetweenTradesSec?: number;
  };
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  drawTrades?: number;
  acceptedTradesCount: number;
  rejectedTradesCount: number;
  winRate: number;
  dailyPnL: number;
  circuitBreakerTripped: boolean;
  circuitBreakerReason: string;
  isInRestBreak: boolean;
  restRemainingSec: number;
  consecutiveTradesCount: number;
  tradesBeforeRest: number;
  isExecutingTrade: boolean;
  brokerStatus?: {
    websocket: string;
    auth: string;
    isConnected: boolean;
    endpoint?: string;
    latencyMs: number;
    mode: string;
    balance: number | null;
    isDemo: boolean;
  };
  recentTrades: Array<{
    id: string;
    timestamp: number;
    ticketId?: string;
    asset: string;
    action: 'call' | 'put';
    amount: number;
    openPrice?: number;
    closePrice?: number;
    profit?: number;
    lifecycle?: string;
    status: 'PENDING' | 'WON' | 'LOST' | 'DRAW' | 'FAILED';
    strategy: string;
    rejectionReason?: string;
  }>;
  recentLogs: Array<{
    id: string;
    timestamp: number;
    level: 'info' | 'warn' | 'error' | 'success';
    message: string;
    category: string;
  }>;
}

interface BacktestReport {
  strategyId: string;
  strategyName: string;
  asset: string;
  timeframe: number;
  totalCandles: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  netProfit: number;
  profitFactor: number;
  maxDrawdownPercent: number;
  maxDrawdownUsd: number;
  avgWin: number;
  avgLoss: number;
  disclaimer: string;
  trades?: Array<{
    entryTime: number;
    exitTime: number;
    action: string;
    entryPrice: number;
    exitPrice: number;
    stake: number;
    pnl: number;
    isWin: boolean;
  }>;
}

const STRATEGIES_LIST = [
  {
    id: 'sbaa',
    nameAr: 'SBAA – استراتيجية سبع الذكية المطورة (المحرك الشامل المدمج)',
    nameEn: 'SBAA Smart Strategy Pro Engine',
    descAr: 'دمج شامل لجميع محاور واستراتيجيات سبع الـ 6: نماذج الشموع اليابانية المركبة، سحب السيولة (Sweeps)، كسر الهيكل (BOS/CHOCH)، انضغاط وانفجار بولينجر، ارتداد المتوسطات EMA 20/50/200، وانفراجات RSI. دخول مشروط بمصفوفة 100 نقطة (80+ للتأهيل) بدون أي دخول عشوائي.',
    descEn: 'Full synthesis of all SBAA strategy modules: Pin Bar, Engulfing, Stars, Harami, Liquidity Sweeps, Structure BOS/CHOCH, and 100-point scoring',
    tag: 'SBAA PRO',
  },
  {
    id: 'auto',
    nameAr: 'الانتقاء الذكي التلقائي لأفضل استراتيجية (Auto-Select Engine)',
    nameEn: 'Intelligent Auto-Select Strategy',
    descAr: 'محرك يختار تلقائياً وبشكل ديناميكي أقوى استراتيجية مؤهلة للسوق الحالي بدون تعارض اتجاهي',
    descEn: 'Dynamically selects the highest probability qualified strategy fitting the current market regime',
    tag: 'AI Auto',
  },
  {
    id: 'confluence',
    nameAr: 'توافق الاستراتيجيات الشامل (Confluence Matrix)',
    nameEn: 'Strategy Confluence Matrix',
    descAr: 'تحليل إجماع متعدد الخوارزميات يجمع كافة المؤشرات والاستراتيجيات مع حماية التعارض',
    descEn: 'Multi-algorithm consensus combining quantitative strategies with conflict protection',
    tag: 'Consensus',
  },
  {
    id: 'ema_trend',
    nameAr: 'متابعة اتجاه المتوسطات (EMA 9 / 21 / 200)',
    nameEn: 'EMA Trend Following',
    descAr: 'فلترة الاتجاه العام عبر EMA 200 والتداول مع تقاطعات وزخم EMA 9 و 21',
    descEn: 'Trend filter via EMA 200 with momentum crossovers and choppiness rejection',
    tag: 'Trend',
  },
  {
    id: 'macd',
    nameAr: 'مؤشر الماكد والزخم (MACD Crossover & Histogram)',
    nameEn: 'MACD Momentum',
    descAr: 'تقاطع خط الماكد مع خط الإشارة وتوسع أعمدة الهيستوجرام مع الاتجاه',
    descEn: 'MACD signal line cross with histogram expansion momentum',
    tag: 'Momentum',
  },
  {
    id: 'rsi_momentum',
    nameAr: 'زخم مؤشر القوة النسبية (RSI Momentum)',
    nameEn: 'RSI Momentum',
    descAr: 'تأكيد قوة الاتجاه واختراق مستويات الزخم 50 / 60 مع ترند قوي',
    descEn: 'RSI momentum trend continuation confirmation',
    tag: 'Momentum',
  },
  {
    id: 'rsi_reversal',
    nameAr: 'انعكاس تشبعات القوة النسبية (RSI Reversal)',
    nameEn: 'RSI Overbought/Oversold Reversal',
    descAr: 'اقتناص الارتداد من مناطق التشبع البيعي (<30) والشرائي (>70)',
    descEn: 'Mean reversion from extreme oversold/overbought conditions',
    tag: 'Reversal',
  },
  {
    id: 'bollinger_bounce',
    nameAr: 'ارتداد وانفجار بولينجر باند (Bollinger Bands Bounce)',
    nameEn: 'Bollinger Bands Mean Reversion',
    descAr: 'اقتناص الارتداد من الحواف مع كشف الانضغاط (Squeeze) وتأكيد اتجاه الشموع',
    descEn: 'Band boundary rejection with volatility squeeze detection and candle verification',
    tag: 'Volatility',
  },
  {
    id: 'support_resistance',
    nameAr: 'الدعوم والمقاومات الأفقية (S/R Clustering)',
    nameEn: 'Support & Resistance Key Levels',
    descAr: 'تجميع القمم والقيعان في مناطق ارتداد رئيسية وتأكيد ملامسة المستويات',
    descEn: 'Swing clustering into high-probability zones with touch count validation',
    tag: 'Key Levels',
  },
  {
    id: 'breakout',
    nameAr: 'استراتيجية الاختراق السعري (Donchian Breakout)',
    nameEn: 'Range Breakout with ATR Momentum',
    descAr: 'اقتناص كسر القمم والقيعان مع إغلاق شمعة زخم كاملة وتأكيد ATR',
    descEn: 'Boundary breakout with candle body ratio >= 60% and ATR momentum expansion',
    tag: 'Breakout',
  },
  {
    id: 'candlestick_pattern',
    nameAr: 'نماذج الشموع اليابانية المتقدمة (Candlestick Patterns Engine)',
    nameEn: 'Candlestick Pattern Engine',
    descAr: 'كشف دقيق لنماذج Pin Bar, Engulfing, Morning/Evening Star, Doji',
    descEn: 'High-precision algorithmic detection of Japanese candlestick reversal formations',
    tag: 'Patterns',
  },
  {
    id: 'price_action',
    nameAr: 'سلوك البرايس أكشن النقي (Pure Price Action)',
    nameEn: 'Pure Price Action Action',
    descAr: 'تحليل سلوك الذيول والأجسام والتصريف والتجميع عند مستويات الدعم والمقاومة',
    descEn: 'Wick rejection, body ratio analysis, and accumulation/distribution price action',
    tag: 'Price Action',
  },
  {
    id: 'market_structure',
    nameAr: 'هيكل السوق ومفاهيم الأموال الذكية (Market Structure / SMC)',
    nameEn: 'Market Structure & Smart Money (SMC)',
    descAr: 'كشف كسر الهيكل (BOS)، وتغير الطابع (CHoCH)، ومناطق كتل الأوامر المؤسسية (Order Blocks)',
    descEn: 'Break of Structure (BOS), Change of Character (CHoCH), Order Blocks, and FVG',
    tag: 'Institutional',
  },
  {
    id: 'adx_trend',
    nameAr: 'قوة واتجاه الترند (ADX Trend Direction)',
    nameEn: 'ADX Trend Direction',
    descAr: 'قياس قوة الترند مع تقاطع مؤشرات الاتجاه الموجب والسالب (+DI / -DI)',
    descEn: 'Quantifies trend strength when ADX > 25 with directional index alignment',
    tag: 'Trend',
  },
  {
    id: 'supertrend',
    nameAr: 'مؤشر سوبر تريند المطور (SuperTrend 10, 3)',
    nameEn: 'SuperTrend Trend Filter',
    descAr: 'متابعة اتجاه السعر فوق وتحت خط السوبر تريند المستند لتقلبات ATR',
    descEn: 'Dynamic ATR-based trailing trend stop confirming bullish or bearish regime',
    tag: 'Trend',
  },
  {
    id: 'stochastic',
    nameAr: 'مذبذب ستوكاستيك للتشبع (Stochastic 14, 3, 3)',
    nameEn: 'Stochastic Oscillator',
    descAr: 'تقاطع خطوط %K و %D في مناطق التشبع الشرائي والبيعي',
    descEn: 'Stochastic crossover in oversold/overbought extremes with trend confluence',
    tag: 'Oscillator',
  },
  {
    id: 'cci_strategy',
    nameAr: 'مؤشر قناة السلع (Commodity Channel Index - CCI)',
    nameEn: 'Commodity Channel Index',
    descAr: 'رصد الانحرافات المعيارية واختراق مستويات +/- 100 لتحديد بداية الموجات',
    descEn: 'Statistical mean deviation tracking with +/-100 threshold triggers',
    tag: 'Momentum',
  },
  {
    id: 'parabolic_sar',
    nameAr: 'سار المكافئ لنقاط الانعكاس (Parabolic SAR)',
    nameEn: 'Parabolic SAR Acceleration',
    descAr: 'تحديد نقاط تحول وتسارع الاتجاه عبر تنقل نقاط SAR أعلى أو أسفل الشموع',
    descEn: 'Trailing stop-and-reverse acceleration points tracking active trends',
    tag: 'Trend',
  },
  {
    id: 'ichimoku_cloud',
    nameAr: 'سحابة إيشيموكو كينكو هيو (Ichimoku Cloud)',
    nameEn: 'Ichimoku Kinko Hyo',
    descAr: 'توافق خط التحول (Tenkan) وخط الأساس (Kijun) مع موقع السعر فوق أو تحت السحابة (Kumo)',
    descEn: 'Tenkan/Kijun cross with Kumo cloud sentiment alignment',
    tag: 'Cloud',
  },
  {
    id: 'pivot_point',
    nameAr: 'نقاط الارتكاز والمحاور الكلاسيكية (Pivot Points)',
    nameEn: 'Classic Floor Pivot Points',
    descAr: 'مستويات الدعم والمقاومة اليومية والمحورية (P, R1, R2, S1, S2)',
    descEn: 'Daily mathematical equilibrium and institutional bounce zones',
    tag: 'Levels',
  },
  {
    id: 'fibonacci',
    nameAr: 'تصحيحات فيبوناتشي الذهبية (Fibonacci Retracement 61.8%)',
    nameEn: 'Fibonacci Golden Ratio',
    descAr: 'اقتناص الارتداد من النسبة الذهبية 61.8% و 50% بعد الموجات الدافعة',
    descEn: 'High-probability golden pocket (50% - 61.8%) pullback entries',
    tag: 'Fibonacci',
  },
  {
    id: 'atr_volatility',
    nameAr: 'توسع النطاق وتقلبات ATR (ATR Volatility Expansion)',
    nameEn: 'ATR Volatility Expansion',
    descAr: 'رصد انفجارات السيولة وتوسع المدى السعري الحقيقي فوق المتوسط',
    descEn: 'Explosive volatility breakouts confirming strong directional thrust',
    tag: 'Volatility',
  },
  {
    id: 'volume_flow',
    nameAr: 'تدفق الأحجام والسيولة (Volume Flow Analysis)',
    nameEn: 'Volume Flow Analysis',
    descAr: 'تأكيد حركة السعر بواسطة صعود أو هبوط حجم التداول الفعلي',
    descEn: 'Tick volume impulse confirming true institutional participation',
    tag: 'Volume',
  },
  {
    id: 'darvas_box',
    nameAr: 'نظرية صناديق دارفاس (Darvas Box Breakout)',
    nameEn: 'Darvas Box Breakout',
    descAr: 'تحديد قنوات التجميع المغلقة والدخول عند اختراق سقف أو أرضية الصندوق',
    descEn: 'Box boundary breakout catching fresh continuation runs',
    tag: 'Breakout',
  },
  {
    id: 'elliott_wave',
    nameAr: 'موجات إليوت السعرية (Elliott Wave Principle)',
    nameEn: 'Elliott Wave Count',
    descAr: 'التعرف على الموجات الدافعة 1-2-3-4-5 والموجات التصحيحية A-B-C',
    descEn: 'Fractal wave count recognizing structural impulsive expansions',
    tag: 'Waves',
  },
  {
    id: 'gann_price_time',
    nameAr: 'هندسة جان للسعر والزمن (Gann Price & Time Geometry)',
    nameEn: 'Gann Angles & Time Geometry',
    descAr: 'زوايا جان الهندسية 1x1 و 2x1 وتوافق دورات الزمن مع مستويات السعر',
    descEn: 'Gann square and angle geometry finding hidden harmonious turning points',
    tag: 'Geometry',
  },
  {
    id: 'multi_confluence',
    nameAr: 'التوافق المتعدد والمؤشرات المركبة (Multi-Confluence Engine)',
    nameEn: 'Multi-Confluence Engine',
    descAr: 'توليفة رياضية مركبة تفحص اتجاه ومومنتوم وتذبذب 7 مؤشرات في آن واحد',
    descEn: 'Multi-indicator scoring matrix requiring multi-layer agreement',
    tag: 'Composite',
  },
  {
    id: 'sma_crossover',
    nameAr: 'التقاطع الذهبي للمتوسطات (SMA Golden / Death Cross)',
    nameEn: 'SMA Golden & Death Cross',
    descAr: 'تقاطع المتوسط البسيط 20 مع 50 للاتجاه متوسط المدى',
    descEn: 'Classic SMA 20 / 50 trend confirmation',
    tag: 'Trend',
  },
  {
    id: 'ma_alignment',
    nameAr: 'اصطفاف المتوسطات المتحركة (Moving Average Alignment)',
    nameEn: 'Moving Average Alignment',
    descAr: 'اصطفاف متتالي لمتوسطات 10 > 20 > 50 > 200 لتأكيد أقوى اتجاه صاعد أو هابط',
    descEn: 'Sequential MA stacking confirming strongest directional momentum',
    tag: 'Trend',
  },
];

interface AutoTraderViewProps {
  currentAsset: string;
  currentTimeframe: number;
  accountBalance: number | null;
  isDemoAccount: boolean;
}

export const AutoTraderView: React.FC<AutoTraderViewProps> = ({
  currentAsset,
  currentTimeframe,
  accountBalance,
  isDemoAccount,
}) => {
  const { isRTL } = useLanguage();

  const [activeTab, setActiveTab] = useState<'dashboard' | 'lab' | 'logs'>('dashboard');
  const [status, setStatus] = useState<AutoTraderStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Form Controls
  const [selectedStrategy, setSelectedStrategy] = useState<string>('sbaa');
  const [baseAmount, setBaseAmount] = useState<number>(5);
  const [stopLoss, setStopLoss] = useState<number>(20);
  const [takeProfit, setTakeProfit] = useState<number>(40);
  const [enableMartingale, setEnableMartingale] = useState<boolean>(false);
  const [martingaleMultiplier, setMartingaleMultiplier] = useState<number>(2.0);
  const [useDemo, setUseDemo] = useState<boolean>(isDemoAccount);

  // Test Connection Modal
  const [showConnModal, setShowConnModal] = useState<boolean>(false);
  const [connTestResult, setConnTestResult] = useState<any>(null);
  const [testingConn, setTestingConn] = useState<boolean>(false);

  // Backtest Controls
  const [backtestStake, setBacktestStake] = useState<number>(10);
  const [backtestPayout, setBacktestPayout] = useState<number>(88);
  const [backtestLoading, setBacktestLoading] = useState<boolean>(false);
  const [backtestReport, setBacktestReport] = useState<BacktestReport | null>(null);

  // Detailed Trade Inspection Modal (Problem 4)
  const [selectedTradeDetail, setSelectedTradeDetail] = useState<DetailedTradeRecord | null>(null);

  const showToast = (type: 'success' | 'error' | 'info', text: string) => {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg(null), 5000);
  };

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/autotrader/status');
      if (res.ok) {
        const data = await res.json();
        if (data && data.success) {
          setStatus(data);
          if (data.config) {
            setSelectedStrategy((prev) => prev || data.config.strategyId || 'sbaa');
            setBaseAmount((prev) => prev || data.config.baseAmount || 5);
            setStopLoss((prev) => prev || data.config.stopLoss || 20);
            setTakeProfit((prev) => prev || data.config.takeProfit || 40);
            if (data.config.enableMartingale !== undefined) {
              setEnableMartingale(data.config.enableMartingale);
            }
            if (data.config.martingaleMultiplier) {
              setMartingaleMultiplier(data.config.martingaleMultiplier);
            }
          }
        }
      }
    } catch {
      // Gracefully handle transient network drop/reload
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  // Automatically sync timeframe & asset changes from chart/header with autotrader
  useEffect(() => {
    if (currentTimeframe) {
      fetch('/api/autotrader/save-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timeframe: currentTimeframe,
          asset: currentAsset,
        }),
      }).catch(() => {});
    }
  }, [currentTimeframe, currentAsset]);

  const handleStart = async () => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/autotrader/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategyId: selectedStrategy,
          baseAmount,
          maxAmount: 1000.0,
          stopLoss,
          takeProfit,
          asset: currentAsset,
          timeframe: currentTimeframe || 60,
          isDemo: useDemo,
          enableMartingale,
          martingaleMultiplier,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        showToast('error', data.message || (isRTL ? 'فشل تشغيل البوت' : 'Failed to start bot'));
      } else {
        if (data.status) setStatus(data.status);
        showToast('success', isRTL ? 'تم بدء تشغيل البوت الآلي بنجاح!' : 'Auto-trader started successfully!');
      }
    } catch (err: any) {
      showToast('error', err?.message || (isRTL ? 'خطأ في الاتصال بالخادم' : 'Server connection error'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleStop = async () => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/autotrader/stop', { method: 'POST' });
      const data = await res.json();
      if (data.status) setStatus(data.status);
      showToast('info', isRTL ? 'تم إيقاف البوت الآلي' : 'Auto-trader stopped');
    } catch (err: any) {
      showToast('error', err?.message || (isRTL ? 'خطأ في إيقاف البوت' : 'Error stopping bot'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleEmergencyStop = async () => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/autotrader/emergency-stop', { method: 'POST' });
      const data = await res.json();
      if (data.status) setStatus(data.status);
      showToast('error', isRTL ? '🚨 تم تفعيل الإيقاف الطارئ! حظر كافة الأوامر فوراً.' : '🚨 Emergency stop triggered! Orders halted.');
    } catch (err: any) {
      showToast('error', err?.message || 'Emergency stop error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleClearEmergency = async () => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/autotrader/clear-emergency', { method: 'POST' });
      const data = await res.json();
      if (data.status) setStatus(data.status);
      showToast('success', isRTL ? 'تم إلغاء حالة الإيقاف الطارئ بنجاح' : 'Emergency stop state cleared');
    } catch (err: any) {
      showToast('error', err?.message || 'Error clearing emergency');
    } finally {
      setActionLoading(false);
    }
  };

  const handleTestConnection = async () => {
    setTestingConn(true);
    setShowConnModal(true);
    try {
      const res = await fetch('/api/autotrader/test-connection', { method: 'POST' });
      const data = await res.json();
      setConnTestResult(data);
    } catch (err: any) {
      setConnTestResult({ ok: false, message: err?.message || 'Connection test failed' });
    } finally {
      setTestingConn(false);
    }
  };

  const handleSaveSettings = async () => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/autotrader/save-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategyId: selectedStrategy,
          baseAmount,
          maxAmount: 1000.0,
          stopLoss,
          takeProfit,
          asset: currentAsset,
          timeframe: currentTimeframe || 60,
          isDemo: useDemo,
          enableMartingale,
          martingaleMultiplier,
        }),
      });
      const data = await res.json();
      if (data.status) setStatus(data.status);
      showToast('success', isRTL ? 'تم حفظ إعدادات البوت بنجاح' : 'Settings saved successfully');
    } catch (err: any) {
      showToast('error', err?.message || 'Error saving settings');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetPnL = async () => {
    try {
      const res = await fetch('/api/autotrader/reset-pnl', { method: 'POST' });
      const data = await res.json();
      if (data.status) setStatus(data.status);
      showToast('info', isRTL ? 'تم تصفير إحصاءات اليوم وقاطع الدائرة' : 'Daily stats and circuit breaker reset');
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleRunBacktest = async (strategyId?: string) => {
    setBacktestLoading(true);
    try {
      const targetStrat = strategyId || selectedStrategy;
      const res = await fetch('/api/autotrader/backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategyId: targetStrat,
          asset: currentAsset,
          timeframe: currentTimeframe || 60,
          stake: backtestStake,
          payoutRatio: backtestPayout / 100,
        }),
      });
      const data = await res.json();
      if (data.success && data.report) {
        setBacktestReport(data.report);
        showToast('success', isRTL ? 'اكتمل الاختبار التاريخي بنجاح!' : 'Backtest completed successfully!');
      } else {
        showToast('error', data.error || (isRTL ? 'فشل تنفيذ الاختبار التاريخي' : 'Backtest execution failed'));
      }
    } catch (err: any) {
      showToast('error', err?.message || 'Backtest error');
    } finally {
      setBacktestLoading(false);
    }
  };

  const isRunning = status?.isRunning ?? false;
  const isEmergency = status?.isEmergencyStopped ?? false;
  const isBreakerTripped = status?.circuitBreakerTripped ?? false;
  const inRest = status?.isInRestBreak ?? false;
  const brokerConnected = status?.brokerStatus?.isConnected ?? false;

  return (
    <div className="space-y-6 max-w-7xl mx-auto text-slate-100">
      {/* 1. Header Banner & Action Center */}
      <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900/95 to-indigo-950/40 border border-indigo-500/30 shadow-2xl relative overflow-hidden backdrop-blur-md">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5 relative z-10">
          <div className="flex items-center gap-3.5">
            <div
              className={`p-3.5 rounded-2xl border shadow-inner transition-all ${
                isEmergency
                  ? 'bg-rose-500/20 border-rose-500/50 text-rose-400 animate-pulse'
                  : isRunning
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400 animate-pulse'
                  : 'bg-indigo-500/20 border-indigo-500/40 text-indigo-400'
              }`}
            >
              <Bot className="w-8 h-8" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-wide">
                  {isRTL ? '🤖 بوت التداول الآلي (AI Auto Trading Bot)' : '🤖 AI Auto Trading Bot'}
                </h2>
                <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-bold">
                  v2.5 PRO
                </span>
                {isEmergency && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-500/30 text-rose-300 border border-rose-500/60 font-bold animate-pulse">
                    🚨 EMERGENCY STOP
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                {isRTL
                  ? 'نظام تداول آلي حقيقي متصل بمنصة Pocket Option مع حماية التعارض، إدارة المخاطر، ومحاكاة السلوك البشري'
                  : 'Autonomous trading system connected to Pocket Option with conflict protection, risk management, and human evasion.'}
              </p>
            </div>
          </div>

          {/* Action Trigger Buttons */}
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            {/* Start / Stop Button */}
            {isRunning ? (
              <button
                onClick={handleStop}
                disabled={actionLoading}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-amber-950/40 cursor-pointer disabled:opacity-50"
              >
                <Square className="w-4 h-4 fill-white" />
                <span>{isRTL ? 'إيقاف البوت' : 'Stop Bot'}</span>
              </button>
            ) : (
              <button
                onClick={handleStart}
                disabled={actionLoading || isEmergency || isBreakerTripped}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-emerald-950/60 cursor-pointer disabled:opacity-50"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>{isRTL ? 'تشغيل البوت' : 'Start Bot'}</span>
              </button>
            )}

            {/* Emergency Stop Button */}
            {isEmergency ? (
              <button
                onClick={handleClearEmergency}
                disabled={actionLoading}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 font-bold text-xs uppercase cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>{isRTL ? 'إلغاء الإيقاف الطارئ' : 'Clear Emergency'}</span>
              </button>
            ) : (
              <button
                onClick={handleEmergencyStop}
                disabled={actionLoading}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-rose-950/60 cursor-pointer"
              >
                <ShieldAlert className="w-4 h-4" />
                <span>{isRTL ? 'إيقاف طارئ' : 'Emergency Stop'}</span>
              </button>
            )}

            {/* Test Connection Button */}
            <button
              onClick={handleTestConnection}
              disabled={actionLoading || testingConn}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-sky-300 border border-sky-500/30 font-bold text-xs cursor-pointer transition-all"
            >
              <Wifi className="w-4 h-4 text-sky-400" />
              <span>{isRTL ? 'اختبار الاتصال' : 'Test Connection'}</span>
            </button>

            {/* Save Settings Button */}
            <button
              onClick={handleSaveSettings}
              disabled={actionLoading}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs cursor-pointer transition-all"
              title={isRTL ? 'حفظ إعدادات البوت' : 'Save Bot Settings'}
            >
              <Save className="w-4 h-4 text-indigo-400" />
              <span>{isRTL ? 'حفظ الإعدادات' : 'Save'}</span>
            </button>

            {/* Reset Stats */}
            <button
              onClick={handleResetPnL}
              title={isRTL ? 'تصفير إحصاءات اليوم' : 'Reset Daily Stats'}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Live Bot Indicators Bar */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-400 text-[11px] font-semibold">{isRTL ? 'حالة البوت:' : 'Status:'}</span>
            {isEmergency ? (
              <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                <span>{isRTL ? 'إيقاف طارئ نشط' : 'Emergency Stop Active'}</span>
              </span>
            ) : isBreakerTripped ? (
              <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/40 font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{isRTL ? 'قاطع الدائرة مفعل' : 'Circuit Breaker Active'}</span>
              </span>
            ) : inRest ? (
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold flex items-center gap-1.5">
                <Coffee className="w-3.5 h-3.5" />
                <span>{isRTL ? `استراحة شاي (${status?.restRemainingSec}s)` : `Fatigue Break (${status?.restRemainingSec}s)`}</span>
              </span>
            ) : isRunning ? (
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>{isRTL ? '🟢 نشط يراقب الإشارات' : '🟢 Active & Scanning'}</span>
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 font-semibold">
                {isRTL ? '🔴 متوقف' : '🔴 Standby'}
              </span>
            )}

            {/* Broker Status Indicator */}
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 ${
                brokerConnected
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
              }`}
            >
              {brokerConnected ? <Wifi className="w-3 h-3 text-emerald-400" /> : <WifiOff className="w-3 h-3 text-rose-400" />}
              <span>{brokerConnected ? (isRTL ? 'الوسيط متصل' : 'Broker Connected') : (isRTL ? 'الوسيط غير متصل' : 'Broker Offline')}</span>
            </span>

            {/* Account Mode */}
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                useDemo
                  ? 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                  : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
              }`}
            >
              {useDemo ? '🔵 DEMO' : '🟢 REAL'}
            </span>
          </div>

          <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono">
            <span>{isRTL ? 'الزوج:' : 'Asset:'} <strong className="text-slate-200">{currentAsset}</strong></span>
            <span>•</span>
            <span>{isRTL ? 'الفريم:' : 'TF:'} <strong className="text-slate-200">{currentTimeframe}s</strong></span>
            <span>•</span>
            <span>{isRTL ? 'المقبولة:' : 'Accepted:'} <strong className="text-emerald-400">{status?.acceptedTradesCount ?? 0}</strong></span>
            <span>•</span>
            <span>{isRTL ? 'المرفوضة:' : 'Rejected:'} <strong className="text-rose-400">{status?.rejectedTradesCount ?? 0}</strong></span>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMsg && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 transition-all ${
            toastMsg.type === 'success'
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
              : toastMsg.type === 'error'
              ? 'bg-rose-500/15 border-rose-500/40 text-rose-300'
              : 'bg-sky-500/15 border-sky-500/40 text-sky-300'
          }`}
        >
          {toastMsg.type === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />}
          {toastMsg.type === 'error' && <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />}
          {toastMsg.type === 'info' && <Radio className="w-4 h-4 shrink-0 text-sky-400" />}
          <span className="font-semibold">{toastMsg.text}</span>
        </div>
      )}

      {/* Sub-Navigation Tabs */}
      <div className="flex border-b border-slate-800 text-xs font-bold">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex items-center gap-1.5 px-4 py-2.5 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'dashboard'
              ? 'border-indigo-500 text-white bg-indigo-500/10'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>{isRTL ? 'لوحة المراقبة والتحكم' : 'Live Dashboard'}</span>
        </button>

        <button
          onClick={() => setActiveTab('lab')}
          className={`flex items-center gap-1.5 px-4 py-2.5 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'lab'
              ? 'border-indigo-500 text-white bg-indigo-500/10'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>{isRTL ? 'مختبر الاستراتيجيات والاختبار التاريخي' : 'Strategy Lab & Backtest'}</span>
        </button>

        <button
          onClick={() => setActiveTab('logs')}
          className={`flex items-center gap-1.5 px-4 py-2.5 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'logs'
              ? 'border-indigo-500 text-white bg-indigo-500/10'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>{isRTL ? 'سجل العمليات والتدقيق' : 'Audit Logs & Evasion'}</span>
        </button>
      </div>

      {/* ==================== TAB 1: LIVE DASHBOARD ==================== */}
      {activeTab === 'dashboard' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column (5 Cols): Settings & Parameters */}
          <div className="lg:col-span-5 space-y-5">
            <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 space-y-4 backdrop-blur-sm">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-indigo-400" />
                  <h3 className="font-bold text-sm text-slate-200 uppercase tracking-wider">
                    {isRTL ? 'إعدادات الاستراتيجية وإدارة المخاطر' : 'Strategy & Risk Config'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={handleSaveSettings}
                  className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isRTL ? 'حفظ' : 'Save'}</span>
                </button>
              </div>

              {/* Strategy Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>{isRTL ? 'الاستراتيجية المعتمدة' : 'Active Strategy'}</span>
                  <span className="text-[10px] text-indigo-400 font-mono">Real Signal Engine</span>
                </label>
                <select
                  value={selectedStrategy}
                  onChange={(e) => setSelectedStrategy(e.target.value)}
                  disabled={isRunning}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs font-semibold focus:outline-hidden focus:border-indigo-500 transition-colors disabled:opacity-60 cursor-pointer"
                >
                  {STRATEGIES_LIST.map((strat) => (
                    <option key={strat.id} value={strat.id}>
                      {isRTL ? strat.nameAr : strat.nameEn}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  {STRATEGIES_LIST.find((s) => s.id === selectedStrategy)?.[isRTL ? 'descAr' : 'descEn']}
                </p>
              </div>

              {/* Base Amount - Upgraded with exact cent support up to $1,000 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{isRTL ? 'مبلغ الصفقة المحدد ($)' : 'Exact Trade Stake ($)'}</span>
                  </label>
                  <span className="text-[10px] text-emerald-400 font-mono">
                    {isRTL ? 'من 1.00$ حتى 1,000.00$ (دعم السنتات)' : '$1.00 - $1,000.00 (Exact Cents)'}
                  </span>
                </div>

                {/* Input field with step="0.01" & direct cent support */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">$</span>
                    <input
                      type="number"
                      min="1.00"
                      max="1000.00"
                      step="0.01"
                      value={baseAmount}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val)) {
                          const clamped = Math.min(1000.00, Math.max(1.00, val));
                          setBaseAmount(Number(clamped.toFixed(2)));
                        } else {
                          setBaseAmount(1.00);
                        }
                      }}
                      disabled={isRunning}
                      className={`w-full pl-7 pr-3 py-2 rounded-xl bg-slate-950 border text-slate-100 text-xs font-mono font-bold focus:outline-hidden transition-colors disabled:opacity-60 ${
                        baseAmount > 1000.00 || baseAmount < 1.00
                          ? 'border-rose-500 text-rose-300'
                          : 'border-slate-700 focus:border-indigo-500'
                      }`}
                      placeholder="1.00 - 1000.00"
                    />
                  </div>

                  {/* Standard & Custom Amount Dropdown Selector (1 to 1,000) */}
                  <select
                    value={baseAmount}
                    onChange={(e) => {
                      const num = Number(e.target.value);
                      if (!isNaN(num) && num >= 1.00 && num <= 1000.00) {
                        setBaseAmount(Number(num.toFixed(2)));
                      }
                    }}
                    disabled={isRunning}
                    className="px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-xs font-mono font-semibold focus:outline-hidden focus:border-indigo-500 disabled:opacity-60 cursor-pointer"
                    title={isRTL ? 'اختر مبلغاً قياسياً من 1$ إلى 1,000$' : 'Select standard amount $1 - $1,000'}
                  >
                    {/* If current value is custom/cents not in standard list, show it at top */}
                    {![1, 2, 5, 10, 15, 20, 25, 50, 75, 100, 150, 200, 250, 500, 750, 1000].includes(baseAmount) && (
                      <option value={baseAmount}>
                        {isRTL ? `مخصص: $${baseAmount.toFixed(2)}` : `Custom: $${baseAmount.toFixed(2)}`}
                      </option>
                    )}
                    {[1, 2, 5, 10, 15, 20, 25, 50, 75, 100, 150, 200, 250, 500, 750, 1000].map((val) => (
                      <option key={val} value={val}>
                        ${val}.00
                      </option>
                    ))}
                  </select>
                </div>

                {/* Preset Buttons: Cents Quick Presets */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
                    <span>{isRTL ? 'مبالغ سريعة بالسنتات:' : 'Exact Cents Presets:'}</span>
                  </div>
                  <div className="grid grid-cols-6 gap-1.5">
                    {[1.00, 5.25, 10.50, 15.75, 20.40, 25.00].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        disabled={isRunning}
                        onClick={() => setBaseAmount(amt)}
                        className={`py-1.5 px-1 rounded-lg text-[10px] font-mono font-bold cursor-pointer transition-colors border text-center ${
                          baseAmount === amt
                            ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm shadow-emerald-950'
                            : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white'
                        }`}
                      >
                        ${amt.toFixed(2)}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium pt-1">
                    <span>{isRTL ? 'مبالغ المستويات ($25 - $1,000):' : 'Tier Stakes ($25 - $1,000):'}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {[25, 50, 75, 100, 150, 200, 250, 500, 750, 1000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        disabled={isRunning}
                        onClick={() => setBaseAmount(amt)}
                        className={`flex-1 min-w-[42px] py-1 px-1.5 rounded-lg text-[10px] font-mono font-bold cursor-pointer transition-colors border text-center ${
                          baseAmount === amt
                            ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm shadow-indigo-950'
                            : 'bg-slate-900/90 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-slate-200'
                        }`}
                      >
                        ${amt}
                      </button>
                    ))}
                  </div>
                </div>

                {baseAmount > 1000.00 && (
                  <p className="text-[10px] text-rose-400 font-medium">
                    ⚠️ {isRTL ? 'تم تجاوز الحد الأقصى المسموح به (1,000.00$). تم ضبط المبلغ.' : 'Maximum stake limit exceeded ($1,000.00 max). Adjusted.'}
                  </p>
                )}
              </div>

              {/* Stop-Loss & Take-Profit */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-rose-400 flex items-center gap-1">
                    <TrendingDown className="w-3.5 h-3.5" />
                    <span>{isRTL ? 'حد الخسارة ($)' : 'Stop-Loss ($)'}</span>
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="500"
                    value={stopLoss}
                    onChange={(e) => setStopLoss(Math.max(5, Number(e.target.value)))}
                    disabled={isRunning}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-rose-500/30 text-rose-300 text-xs font-mono font-bold focus:outline-hidden focus:border-rose-500 disabled:opacity-60"
                  />
                  <span className="text-[10px] text-slate-500 block leading-tight">
                    {isRTL ? 'قاطع الدائرة يوقف البوت عند بلوغها' : 'Halts bot on hitting threshold'}
                  </span>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>{isRTL ? 'هدف الربح ($)' : 'Take-Profit ($)'}</span>
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="1000"
                    value={takeProfit}
                    onChange={(e) => setTakeProfit(Math.max(5, Number(e.target.value)))}
                    disabled={isRunning}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-emerald-500/30 text-emerald-300 text-xs font-mono font-bold focus:outline-hidden focus:border-emerald-500 disabled:opacity-60"
                  />
                  <span className="text-[10px] text-slate-500 block leading-tight">
                    {isRTL ? 'تأمين الأرباح وإيقاف الصفقات' : 'Locks profit and halts trading'}
                  </span>
                </div>
              </div>

              {/* Martingale Multiplier Option */}
              <div className="pt-2 border-t border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300">
                    {isRTL ? 'مضاعفة المارتنجيل (Martingale Recovery)' : 'Martingale Multiplier'}
                  </label>
                  <input
                    type="checkbox"
                    checked={enableMartingale}
                    onChange={(e) => setEnableMartingale(e.target.checked)}
                    disabled={isRunning}
                    className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                  />
                </div>
                {enableMartingale && (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400">{isRTL ? 'معامل المضاعفة:' : 'Multiplier:'}</span>
                    <input
                      type="number"
                      step="0.1"
                      min="1.5"
                      max="3.0"
                      value={martingaleMultiplier}
                      onChange={(e) => setMartingaleMultiplier(Number(e.target.value))}
                      disabled={isRunning}
                      className="w-20 px-2 py-1 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono font-bold text-slate-200"
                    />
                    <span className="text-[10px] text-amber-400">
                      {isRTL ? '(أقصى عمق 3 مضاعفات)' : '(Max depth: 3)'}
                    </span>
                  </div>
                )}
              </div>

              {/* Account Mode Toggle */}
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-300 block">
                    {isRTL ? 'وضع الحساب المستهدف' : 'Target Account Mode'}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {useDemo ? (isRTL ? 'وضع تجريبي آمن' : 'Safe Demo Account') : (isRTL ? 'أموال حقيقية' : 'Live Real Account')}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={isRunning}
                  onClick={() => setUseDemo(!useDemo)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono font-black border transition-all cursor-pointer ${
                    useDemo
                      ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  }`}
                >
                  {useDemo ? 'DEMO MODE' : 'REAL LIVE'}
                </button>
              </div>

              {/* Stop-Loss Disclosure Note */}
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-[10px] text-slate-400 space-y-1">
                <span className="font-bold text-slate-300 block">
                  {isRTL ? 'ℹ️ توضيح هام حول وقف الخسارة في الخيارات الرقمية:' : 'ℹ️ Critical Stop-Loss Disclosure:'}
                </span>
                <p className="leading-relaxed">
                  {isRTL
                    ? 'تنتهي صفقات الخيارات الثنائية في Pocket Option عند مدد ثابتة (30s، 60s، إلخ). لا يدعم وسيط الخيارات أمر وقف خسارة سعري أثناء سريان الصفقة؛ وإنما "وقف الخسارة" هنا هو حد حماية داخلي صارم يقوم قاطع الدائرة بتفعيله لإيقاف البوت عند بلوغ إجمالي الخسائر اليومية المبلغ المحدد لحماية رأس المال.'
                    : 'Pocket Option binary contracts expire at fixed durations. The broker API does not provide intra-trade price stop-loss orders. Instead, our Stop-Loss acts as an internal risk-guard circuit breaker that automatically halts all bot operations once daily losses reach this threshold.'}
                </p>
              </div>
            </div>
          </div>

          {/* Right Column (7 Cols): Live Telemetry, PnL & Order Stream */}
          <div className="lg:col-span-7 space-y-5">
            {/* PnL & Performance Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1 backdrop-blur-sm">
                <span className="text-[11px] text-slate-400 block">{isRTL ? 'صافي أرباح اليوم' : 'Daily Net PnL'}</span>
                <span
                  className={`text-lg font-black font-mono ${
                    (status?.dailyPnL ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {(status?.dailyPnL ?? 0) >= 0 ? '+' : ''}${status?.dailyPnL?.toFixed(2) ?? '0.00'}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1 backdrop-blur-sm">
                <span className="text-[11px] text-slate-400 block">{isRTL ? 'نسبة الفوز' : 'Win Rate'}</span>
                <span className="text-lg font-black font-mono text-indigo-400">
                  {status?.winRate ?? 0}%
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1 backdrop-blur-sm">
                <span className="text-[11px] text-slate-400 block">{isRTL ? 'الرابحة / الخاسرة / التعادل' : 'Wins / Losses / Draws'}</span>
                <span className="text-sm font-black font-mono text-slate-200 flex items-center gap-1">
                  <span className="text-emerald-400" title={isRTL ? 'صفقات رابحة' : 'Won'}>{status?.winningTrades ?? 0}W</span>
                  <span className="text-slate-500">/</span>
                  <span className="text-rose-400" title={isRTL ? 'صفقات خاسرة' : 'Lost'}>{status?.losingTrades ?? 0}L</span>
                  <span className="text-slate-500">/</span>
                  <span className="text-slate-400" title={isRTL ? 'تعادل (DRAW)' : 'Draw'}>{status?.drawTrades ?? 0}D</span>
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1 backdrop-blur-sm">
                <span className="text-[11px] text-slate-400 block">{isRTL ? 'استراحة الإجهاد' : 'Fatigue Break'}</span>
                <span className="text-sm font-black font-mono text-amber-400">
                  {status?.consecutiveTradesCount ?? 0} / {status?.tradesBeforeRest ?? 10}
                </span>
              </div>
            </div>

            {/* Live Order Lifecycle & Trades */}
            <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3 backdrop-blur-sm">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  <h4 className="font-bold text-xs text-slate-200 uppercase tracking-wider">
                    {isRTL ? 'تدفق الأوامر والصفقات المنفذة (Order Lifecycle)' : 'Real Order Lifecycle & Trades'}
                  </h4>
                </div>
                <span className="text-[10px] font-mono text-slate-400">
                  {status?.recentTrades?.length || 0} {isRTL ? 'صفقة' : 'orders'}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-800 text-[10px] font-mono">
                      <th className="pb-2">{isRTL ? 'التوقيت' : 'Time'}</th>
                      <th className="pb-2">{isRTL ? 'الأصل' : 'Asset'}</th>
                      <th className="pb-2">{isRTL ? 'النوع' : 'Action'}</th>
                      <th className="pb-2">{isRTL ? 'المبلغ' : 'Stake'}</th>
                      <th className="pb-2">{isRTL ? 'دورة الأمر' : 'Lifecycle'}</th>
                      <th className="pb-2 text-right">{isRTL ? 'النتيجة' : 'Result'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {status?.recentTrades && status.recentTrades.length > 0 ? (
                      status.recentTrades.map((trade) => (
                        <tr
                          key={trade.id}
                          onClick={() => {
                            setSelectedTradeDetail({
                              id: trade.id,
                              ticketId: trade.ticketId || trade.id,
                              asset: trade.asset,
                              accountMode: useDemo ? 'DEMO' : 'REAL',
                              timeframe: currentTimeframe || 60,
                              strategyName: trade.strategy || 'توافق الاستراتيجيات (Confluence Matrix)',
                              action: trade.action,
                              amount: trade.amount,
                              openTime: Math.floor(trade.timestamp / 1000),
                              closeTime: Math.floor(trade.timestamp / 1000) + (currentTimeframe || 60),
                              openPrice: trade.openPrice || 0,
                              entryPrice: trade.openPrice || 0,
                              closePrice: trade.closePrice || trade.openPrice || 0,
                              exitPrice: trade.closePrice || trade.openPrice || 0,
                              profit: trade.profit,
                              result: trade.status === 'WON' ? 'WIN' : trade.status === 'LOST' ? 'LOSS' : trade.status === 'DRAW' ? 'DRAW' : 'PENDING',
                              durationSec: currentTimeframe || 60,
                              reasons: [
                                `إشارة مؤكدة من استراتيجية ${trade.strategy || 'توافق الاستراتيجيات'}`,
                                `فريم التنفيذ: ${currentTimeframe || 60} ثانية`,
                                trade.action === 'call' ? 'توافق مؤشرات الزخم والاتجاه للصعود' : 'توافق مؤشرات الزخم والاتجاه للهبوط',
                              ],
                              confluenceScore: 88,
                            });
                          }}
                          className="hover:bg-slate-800/40 cursor-pointer transition-colors group"
                          title={isRTL ? 'اضغط لعرض تفاصيل الصفقة والشارت' : 'Click to inspect deal & trajectory chart'}
                        >
                          <td className="py-2 text-slate-400 text-[11px] flex items-center gap-1">
                            <span>{new Date(trade.timestamp).toLocaleTimeString()}</span>
                            <ExternalLink className="w-3 h-3 text-slate-600 group-hover:text-indigo-400 transition-colors" />
                          </td>
                          <td className="py-2 text-slate-200 font-semibold">{trade.asset}</td>
                          <td className="py-2">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 w-max ${
                                trade.action === 'call'
                                    ? 'bg-emerald-500/20 text-emerald-400'
                                  : 'bg-rose-500/20 text-rose-400'
                              }`}
                            >
                              {trade.action === 'call' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                              {trade.action.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-2 text-slate-200">${trade.amount.toFixed(2)}</td>
                          <td className="py-2">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                                trade.lifecycle === 'COMPLETED'
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : trade.lifecycle === 'ACCEPTED'
                                  ? 'bg-sky-500/20 text-sky-300'
                                  : trade.lifecycle === 'REJECTED' || trade.lifecycle === 'FAILED'
                                  ? 'bg-rose-500/20 text-rose-300'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {trade.lifecycle || 'SUBMITTED'}
                            </span>
                          </td>
                          <td className="py-2 text-right font-bold">
                            {trade.status === 'WON' ? (
                              <span className="text-emerald-400 font-mono">+${trade.profit !== undefined && trade.profit > 0 ? trade.profit.toFixed(2) : (trade.amount * 0.88).toFixed(2)}</span>
                            ) : trade.status === 'LOST' ? (
                              <span className="text-rose-400 font-mono">-${Math.abs(trade.profit !== undefined && trade.profit < 0 ? trade.profit : trade.amount).toFixed(2)}</span>
                            ) : trade.status === 'DRAW' ? (
                              <span className="text-slate-400 font-mono">$0.00 ({isRTL ? 'تعادل' : 'DRAW'})</span>
                            ) : (
                              <span className="text-amber-400 animate-pulse">{isRTL ? 'جارية...' : 'Pending...'}</span>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-slate-500 text-xs font-sans">
                          {isRTL ? 'لم يتم تنفيذ صفقات آلية بعد' : 'No automated orders dispatched yet'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Anti-Bot Protections & Safeguards Summary */}
            <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800 space-y-2.5 text-xs backdrop-blur-sm">
              <h4 className="font-bold text-slate-300 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>{isRTL ? 'طبقات التخفي ومحاكاة السلوك الإنساني المفعلة' : 'Active Stealth & Anti-Detection Layers'}</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-400">
                <div className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>{isRTL ? 'تردد التفكير الإنساني (1.5 - 4.2s قبل الأمر)' : 'Human hesitation delay (1.5 - 4.2s)'}</span>
                </div>
                <div className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>{isRTL ? 'دعم السنتات ومطابقة المبالغ مع سجل الصفقات 100%' : 'Exact cents support (100% record match)'}</span>
                </div>
                <div className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>{isRTL ? 'استراحة شاي كل 10 صفقات (15 - 45 دقيقة)' : 'Fatigue cool-down every 10 trades'}</span>
                </div>
                <div className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>{isRTL ? 'معرفات فريدة لمنع تكرار الصفقات (Idempotency)' : 'Idempotency tokens preventing duplicates'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB 2: STRATEGY LAB & BACKTEST ==================== */}
      {activeTab === 'lab' && (
        <div className="space-y-6">
          {/* Header & Backtest Trigger */}
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 backdrop-blur-sm">
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-indigo-400" />
                <span>{isRTL ? 'مختبر الاستراتيجيات والاختبار التاريخي المتقدم (Backtester)' : 'Strategy Lab & Chronological Backtester'}</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                {isRTL
                  ? 'اختبار الاستراتيجيات الـ 6 المعتمدة خطوة بخطوة عبر الشموع التاريخية دون أي تحيز زمني مستقبلي'
                  : 'Zero look-ahead bias backtesting across verified chronological candles.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 pl-1">{isRTL ? 'مبلغ الصفقة:' : 'Stake:'}</span>
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={backtestStake}
                  onChange={(e) => setBacktestStake(Math.max(1, Number(e.target.value)))}
                  className="w-16 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-xs font-mono font-bold text-center"
                />
              </div>

              <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 pl-1">{isRTL ? 'العائد:' : 'Payout:'}</span>
                <input
                  type="number"
                  min="50"
                  max="98"
                  value={backtestPayout}
                  onChange={(e) => setBacktestPayout(Math.min(98, Math.max(50, Number(e.target.value))))}
                  className="w-16 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-xs font-mono font-bold text-center"
                />
                <span className="text-[11px] text-slate-400">%</span>
              </div>

              <button
                type="button"
                disabled={backtestLoading}
                onClick={() => handleRunBacktest(selectedStrategy)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase cursor-pointer disabled:opacity-50 transition-all shadow-md"
              >
                {backtestLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4 fill-white" />
                )}
                <span>{backtestLoading ? (isRTL ? 'جاري الاختبار...' : 'Running...') : (isRTL ? 'تشغيل الاختبار التاريخي' : 'Run Backtest')}</span>
              </button>
            </div>
          </div>

          {/* Strategy Matrix Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {STRATEGIES_LIST.map((strat) => (
              <div
                key={strat.id}
                className={`p-4 rounded-2xl border transition-all ${
                  selectedStrategy === strat.id
                    ? 'bg-indigo-950/30 border-indigo-500/60 ring-2 ring-indigo-500/20'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-indigo-400 font-bold">
                      {strat.tag}
                    </span>
                    <h4 className="font-bold text-xs text-slate-100 mt-1">
                      {isRTL ? strat.nameAr : strat.nameEn}
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedStrategy(strat.id);
                      handleRunBacktest(strat.id);
                    }}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer"
                  >
                    {isRTL ? 'اختبار' : 'Test'}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed min-h-[44px]">
                  {isRTL ? strat.descAr : strat.descEn}
                </p>
              </div>
            ))}
          </div>

          {/* Backtest Analytics Report */}
          {backtestReport && (
            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4 backdrop-blur-md">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-emerald-400" />
                  <h4 className="font-bold text-sm text-slate-200">
                    {isRTL
                      ? `تقرير نتائج الاختبار التاريخي: ${backtestReport.strategyName}`
                      : `Backtest Performance Report: ${backtestReport.strategyName}`}
                  </h4>
                </div>
                <span className="text-[11px] font-mono text-slate-400">
                  {backtestReport.totalCandles} {isRTL ? 'شمعة تم فحصها' : 'candles analyzed'}
                </span>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 font-mono">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-center">
                  <span className="text-[10px] text-slate-400 block font-sans">{isRTL ? 'نسبة الفوز' : 'Win Rate'}</span>
                  <span className="text-base font-black text-indigo-400">{backtestReport.winRate}%</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-center">
                  <span className="text-[10px] text-slate-400 block font-sans">{isRTL ? 'صافي الربح' : 'Net Profit'}</span>
                  <span
                    className={`text-base font-black ${
                      backtestReport.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {backtestReport.netProfit >= 0 ? '+' : ''}${backtestReport.netProfit}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-center">
                  <span className="text-[10px] text-slate-400 block font-sans">{isRTL ? 'معامل الربح' : 'Profit Factor'}</span>
                  <span className="text-base font-black text-amber-400">{backtestReport.profitFactor}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-center">
                  <span className="text-[10px] text-slate-400 block font-sans">{isRTL ? 'أقصى تراجع' : 'Max Drawdown'}</span>
                  <span className="text-base font-black text-rose-400">{backtestReport.maxDrawdownPercent}%</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-center">
                  <span className="text-[10px] text-slate-400 block font-sans">{isRTL ? 'عدد الصفقات' : 'Total Trades'}</span>
                  <span className="text-base font-black text-slate-200">{backtestReport.totalTrades}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-center">
                  <span className="text-[10px] text-slate-400 block font-sans">{isRTL ? 'رابحة / خاسرة' : 'W / L'}</span>
                  <span className="text-xs font-black text-slate-300">
                    <span className="text-emerald-400">{backtestReport.winningTrades}</span> /{' '}
                    <span className="text-rose-400">{backtestReport.losingTrades}</span>
                  </span>
                </div>
              </div>

              {/* Disclaimer */}
              <div className="p-3 rounded-xl bg-slate-950 border border-amber-500/30 text-[11px] text-amber-300/90 leading-relaxed">
                <span className="font-bold">{isRTL ? 'إخلاء مسؤولية:' : 'Disclaimer:'} </span>
                <span>{backtestReport.disclaimer}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB 3: AUDIT LOGS ==================== */}
      {activeTab === 'logs' && (
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4 backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-400" />
              <h4 className="font-bold text-sm text-slate-200">
                {isRTL ? 'سجل العمليات والتدقيق الأمني المباشر (Audit Log)' : 'Live Operational & Security Audit Trail'}
              </h4>
            </div>
            <span className="text-[10px] font-mono text-slate-400">
              {status?.recentLogs?.length || 0} {isRTL ? 'حدث مسجل' : 'events'}
            </span>
          </div>

          <div className="h-96 overflow-y-auto space-y-2 font-mono text-xs pr-1">
            {status?.recentLogs && status.recentLogs.length > 0 ? (
              status.recentLogs.map((log) => (
                <div
                  key={log.id}
                  className={`p-2.5 rounded-xl text-xs flex items-start gap-2.5 border ${
                    log.level === 'error'
                      ? 'bg-rose-950/30 border-rose-500/30 text-rose-300'
                      : log.level === 'warn'
                      ? 'bg-amber-950/30 border-amber-500/30 text-amber-300'
                      : log.level === 'success'
                      ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                      : 'bg-slate-950/60 border-slate-800/80 text-slate-300'
                  }`}
                >
                  <span className="text-[10px] text-slate-500 shrink-0">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] uppercase font-bold text-slate-300 shrink-0">
                    {log.category}
                  </span>
                  <span className="leading-relaxed break-words">{log.message}</span>
                </div>
              ))
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-xs">
                {isRTL ? 'بانتظار أحداث تشغيل البوت لتسجيل السجلات...' : 'Waiting for bot activity to stream audit logs...'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== MODAL: TEST CONNECTION ==================== */}
      {showConnModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Wifi className="w-5 h-5 text-sky-400" />
                <h3 className="font-bold text-sm text-white">
                  {isRTL ? 'اختبار اتصال منصة Pocket Option' : 'Pocket Option Gateway Diagnostics'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowConnModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {testingConn ? (
              <div className="py-8 text-center space-y-2">
                <RefreshCw className="w-8 h-8 text-sky-400 animate-spin mx-auto" />
                <p className="text-xs text-slate-300">{isRTL ? 'جاري فحص الاتصال والتحقق من الجلسة...' : 'Testing gateway handshake...'}</p>
              </div>
            ) : connTestResult ? (
              <div className="space-y-3 font-mono text-xs">
                <div
                  className={`p-3 rounded-xl border flex items-center gap-2 ${
                    connTestResult.ok
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                  }`}
                >
                  {connTestResult.ok ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                  )}
                  <span className="font-bold font-sans">{connTestResult.message}</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-slate-400">{isRTL ? 'خادم الاتصال:' : 'Endpoint:'}</span>
                    <span className="text-slate-200">{connTestResult.endpoint || 'api-fin.po.market'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">{isRTL ? 'زمن الاستجابة (Latency):' : 'Latency:'}</span>
                    <span className="text-sky-400 font-bold">{connTestResult.latencyMs || 0} ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">{isRTL ? 'نوع الحساب:' : 'Account Mode:'}</span>
                    <span className="text-amber-400">{connTestResult.mode || (connTestResult.isDemo ? 'DEMO' : 'REAL')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">{isRTL ? 'الرصيد المتاح:' : 'Balance:'}</span>
                    <span className="text-emerald-400 font-bold">
                      {connTestResult.accountBalance !== null ? `$${connTestResult.accountBalance}` : '—'}
                    </span>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowConnModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer"
              >
                {isRTL ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Deal Inspection & Trajectory Modal (Problem 4) */}
      <TradeDetailModal
        trade={selectedTradeDetail}
        onClose={() => setSelectedTradeDetail(null)}
      />
    </div>
  );
};
