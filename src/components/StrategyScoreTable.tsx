import React, { useState, useMemo, useEffect } from 'react';
import {
  ArrowUp,
  ArrowDown,
  Minus,
  ShieldCheck,
  AlertCircle,
  Layers,
  Radio,
  CheckCircle2,
  Zap,
  BarChart3,
  Play,
  Eye,
  EyeOff,
  RotateCcw,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Clock,
  DollarSign,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { StrategyResult, Candle } from '../types';

interface StrategyScoreTableProps {
  strategies?: StrategyResult[] | Record<string, any> | null;
  conflictProtectionActive?: boolean;
  asset?: string;
  timeframe?: number;
  candles?: Candle[];
  onBacktestOverlayChange?: (
    trades: any[] | null,
    info: { strategyName: string; winRate: number; netProfit: number; totalTrades: number } | null,
    active: boolean
  ) => void;
  isOverlayActive?: boolean;
  currentBacktestTrades?: any[] | null;
  onClearBacktestOverlay?: () => void;
}

export interface BacktestTradeItem {
  entryTime: number;
  exitTime: number;
  action: 'call' | 'put';
  entryPrice: number;
  exitPrice: number;
  stake: number;
  pnl: number;
  isWin: boolean;
  reason?: string;
}

export interface BacktestOverlayReport {
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
  trades: BacktestTradeItem[];
}

const SUPPORTED_BACKTEST_STRATEGIES = [
  { id: 'confluence', nameAr: 'توافق الاستراتيجيات الشامل (Confluence Matrix)', nameEn: '21 Strategy Confluence Matrix' },
  { id: 'ema_trend', nameAr: 'متابعة اتجاه المتوسطات (EMA 9 / 21 / 200)', nameEn: 'EMA Trend Following (9 / 21 / 200)' },
  { id: 'rsi_macd', nameAr: 'زخم RSI + تأكيد الماكد (RSI 14 + MACD)', nameEn: 'RSI Momentum + MACD Confirmation' },
  { id: 'bollinger_bands', nameAr: 'ارتداد وانفجار بولينجر باند (20, 2)', nameEn: 'Bollinger Bands Mean Reversion' },
  { id: 'support_resistance', nameAr: 'الدعوم والمقاومات الأفقية (S/R Break & Bounce)', nameEn: 'Support & Resistance Key Levels' },
  { id: 'breakout', nameAr: 'استراتيجية الاختراق السعري (Donchian / ATR)', nameEn: 'Range Breakout with ATR Momentum' },
  { id: 'smc', nameAr: 'مفاهيم الأموال الذكية (SMC / BOS & Order Blocks)', nameEn: 'Smart Money Concepts (SMC / BOS)' },
  { id: 'price_action', nameAr: 'شموع البرايس أكشن (Pinbar / Engulfing)', nameEn: 'Price Action Patterns (Pinbar / Engulfing)' },
  { id: 'supertrend', nameAr: 'مؤشر سوبر تريند المطور (SuperTrend 10, 3)', nameEn: 'SuperTrend Trend Direction' },
  { id: 'stochastic', nameAr: 'مؤشر ستوكاستيك للتشبع (Stochastic 14, 3, 3)', nameEn: 'Stochastic Overbought / Oversold' },
];

export const StrategyScoreTable: React.FC<StrategyScoreTableProps> = ({
  strategies,
  conflictProtectionActive = false,
  asset = 'EURUSD_otc',
  timeframe = 60,
  candles = [],
  onBacktestOverlayChange,
  isOverlayActive = false,
  currentBacktestTrades = null,
  onClearBacktestOverlay,
}) => {
  const { isRTL, tTerm } = useLanguage();

  const strategyList: StrategyResult[] = useMemo(() => {
    if (!strategies) return [];
    if (Array.isArray(strategies)) return strategies;
    return Object.values(strategies);
  }, [strategies]);

  // Robust multi-direction classification
  const isStrategyBull = (s: any) =>
    s?.signal === 'UP' ||
    s?.signal === 'BUY' ||
    s?.type === 'UP' ||
    s?.type === 'BUY' ||
    s?.direction === 'UP' ||
    s?.direction === 'BULLISH' ||
    (typeof s?.score === 'number' && s?.score > 0);

  const isStrategyBear = (s: any) =>
    s?.signal === 'DOWN' ||
    s?.signal === 'SELL' ||
    s?.type === 'DOWN' ||
    s?.type === 'SELL' ||
    s?.direction === 'DOWN' ||
    s?.direction === 'BEARISH' ||
    (typeof s?.score === 'number' && s?.score < 0);

  const bullCount = strategyList.filter(isStrategyBull).length;
  const bearCount = strategyList.filter(isStrategyBear).length;
  const waitCount = strategyList.filter((s: any) => !isStrategyBull(s) && !isStrategyBear(s)).length;

  // Real Trade Dispatcher State (Direct Pocket Option Execution)
  const [tradeAmount, setTradeAmount] = useState<number>(1);
  const [tradeDuration, setTradeDuration] = useState<number>(timeframe || 60);
  const [isSendingTrade, setIsSendingTrade] = useState<boolean>(false);
  const [tradeFeedback, setTradeFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Synchronize trade duration and backtest expiry with active timeframe
  useEffect(() => {
    if (timeframe) {
      setTradeDuration(timeframe);
      setBacktestExpiry(timeframe);
    }
  }, [timeframe]);

  const durationOptions = useMemo(() => {
    const tf = timeframe || 60;
    const opts = [
      { s: tf, l: tf < 60 ? `${tf}s` : tf < 3600 ? `${Math.round(tf / 60)}m` : `${Math.round(tf / 3600)}h` },
    ];
    if (tf <= 1800) {
      const doubleTf = tf * 2;
      opts.push({
        s: doubleTf,
        l: doubleTf < 60 ? `${doubleTf}s` : doubleTf < 3600 ? `${Math.round(doubleTf / 60)}m` : `${Math.round(doubleTf / 3600)}h`,
      });
    }
    return opts;
  }, [timeframe]);

  // Backtesting Overlay State
  const [showBacktestPanel, setShowBacktestPanel] = useState<boolean>(false);
  const [selectedBacktestStrat, setSelectedBacktestStrat] = useState<string>('confluence');
  const [backtestStake, setBacktestStake] = useState<number>(10);
  const [backtestExpiry, setBacktestExpiry] = useState<number>(timeframe || 60);
  const [backtestPayout, setBacktestPayout] = useState<number>(88);
  const [backtestLookback, setBacktestLookback] = useState<number>(100);
  const [isRunningBacktest, setIsRunningBacktest] = useState<boolean>(false);
  const [backtestReport, setBacktestReport] = useState<BacktestOverlayReport | null>(null);
  const [showTradesList, setShowTradesList] = useState<boolean>(false);

  const handleSendTrade = async (action: 'call' | 'put') => {
    setIsSendingTrade(true);
    setTradeFeedback(null);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset,
          amount: tradeAmount,
          action,
          time: tradeDuration,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        const ticket = data.deal?.id || data.requestId;
        setTradeFeedback({
          type: 'success',
          message: isRTL
            ? `تم إرسال الصفقة بنجاح إلى Pocket Option! رقم التذكرة: #${ticket}`
            : `Deal opened successfully on Pocket Option! Ticket: #${ticket}`,
        });
      } else {
        setTradeFeedback({
          type: 'error',
          message: data.error || (isRTL ? 'فشل إرسال الصفقة إلى منصة Pocket Option' : 'Failed to send deal to Pocket Option'),
        });
      }
    } catch (err: any) {
      setTradeFeedback({
        type: 'error',
        message: err?.message || (isRTL ? 'حدث خطأ في الاتصال بالخادم' : 'Server connection error'),
      });
    } finally {
      setIsSendingTrade(false);
    }
  };

  // Run backtesting with fallback to visible candles
  const handleRunBacktest = async (strategyOverride?: string) => {
    const stratId = strategyOverride || selectedBacktestStrat;
    if (strategyOverride) {
      setSelectedBacktestStrat(strategyOverride);
      setShowBacktestPanel(true);
    }
    setIsRunningBacktest(true);

    try {
      // 1. Try server-side backtester first
      const serverRes = await fetch('/api/autotrader/backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategyId: stratId,
          asset,
          timeframe,
          stake: backtestStake,
          payoutRatio: backtestPayout / 100,
        }),
      }).catch(() => null);

      let report: BacktestOverlayReport | null = null;

      if (serverRes && serverRes.ok) {
        const data = await serverRes.json().catch(() => null);
        if (data && data.success && data.report && data.report.trades && data.report.trades.length > 0) {
          report = data.report;
        }
      }

      // 2. If server has insufficient candles or empty, run high-precision client simulation on visible historical candles
      if (!report && candles && candles.length >= 15) {
        report = runClientCandleSimulation(stratId, candles, backtestStake, backtestExpiry, backtestPayout, backtestLookback);
      }

      if (report) {
        setBacktestReport(report);
        // Automatically activate chart overlay
        if (onBacktestOverlayChange) {
          onBacktestOverlayChange(
            report.trades,
            {
              strategyName: report.strategyName,
              winRate: report.winRate,
              netProfit: report.netProfit,
              totalTrades: report.totalTrades,
            },
            true
          );
        }
      }
    } finally {
      setIsRunningBacktest(false);
    }
  };

  // Toggle overlay on/off
  const handleToggleOverlay = () => {
    if (!onBacktestOverlayChange) return;
    if (isOverlayActive) {
      onBacktestOverlayChange(null, null, false);
    } else if (backtestReport && backtestReport.trades.length > 0) {
      onBacktestOverlayChange(
        backtestReport.trades,
        {
          strategyName: backtestReport.strategyName,
          winRate: backtestReport.winRate,
          netProfit: backtestReport.netProfit,
          totalTrades: backtestReport.totalTrades,
        },
        true
      );
    } else {
      handleRunBacktest();
    }
  };

  // Pure deterministic client-side backtesting without lookahead bias
  const runClientCandleSimulation = (
    strategyId: string,
    sourceCandles: Candle[],
    stake: number,
    expirySec: number,
    payoutPct: number,
    lookbackMax: number
  ): BacktestOverlayReport => {
    const rawCandles = sourceCandles.slice(-Math.max(30, lookbackMax));
    const trades: BacktestTradeItem[] = [];
    const payoutRatio = payoutPct / 100;
    const durationCandles = Math.max(1, Math.round(expirySec / timeframe));

    let balance = 1000;
    let peak = balance;
    let maxDdUsd = 0;
    let grossProfit = 0;
    let grossLoss = 0;

    const minLookback = 20;
    let i = minLookback;

    while (i < rawCandles.length - durationCandles) {
      const slice = rawCandles.slice(0, i + 1);
      const curr = rawCandles[i];
      const closes = slice.map((c) => c.close);

      let action: 'call' | 'put' | null = null;
      let reason = '';

      if (strategyId === 'ema_trend' || strategyId === 'confluence') {
        const ema9 = calcEma(closes, 9);
        const ema21 = calcEma(closes, 21);
        if (ema9 > ema21 && curr.close > ema9) {
          action = 'call';
          reason = 'تقاطع إيجابي EMA 9 > 21 مع إغلاق صاعد';
        } else if (ema9 < ema21 && curr.close < ema9) {
          action = 'put';
          reason = 'تقاطع سلبي EMA 9 < 21 مع إغلاق هابط';
        }
      } else if (strategyId === 'rsi_macd') {
        const rsi = calcRsi(closes, 14);
        if (rsi < 36 && curr.close > curr.open) {
          action = 'call';
          reason = `ذروة بيع RSI (${rsi.toFixed(1)}) مع ارتداد شمعة`;
        } else if (rsi > 64 && curr.close < curr.open) {
          action = 'put';
          reason = `ذروة شراء RSI (${rsi.toFixed(1)}) مع هبوط شمعة`;
        }
      } else if (strategyId === 'bollinger_bands') {
        const bb = calcBollinger(closes, 20, 2);
        if (curr.low <= bb.lower && curr.close > curr.open) {
          action = 'call';
          reason = 'ملامسة الحد السفلي لبولينجر مع إغلاق صاعد';
        } else if (curr.high >= bb.upper && curr.close < curr.open) {
          action = 'put';
          reason = 'ملامسة الحد العلوي لبولينجر مع إغلاق هابط';
        }
      } else if (strategyId === 'breakout') {
        const window = slice.slice(-15, -1);
        const hh = Math.max(...window.map((c) => c.high));
        const ll = Math.min(...window.map((c) => c.low));
        if (curr.close > hh) {
          action = 'call';
          reason = 'اختراق قمة 15 شمعة للأعلى مع زخم';
        } else if (curr.close < ll) {
          action = 'put';
          reason = 'كسر قاع 15 شمعة للأسفل مع عزم';
        }
      } else if (strategyId === 'smc') {
        const prev = slice[slice.length - 2];
        const isBullBOS = curr.close > prev.high && curr.close > curr.open;
        const isBearBOS = curr.close < prev.low && curr.close < curr.open;
        if (isBullBOS) {
          action = 'call';
          reason = 'كسر هيكل صاعد (BOS) مع زخم مؤسسي';
        } else if (isBearBOS) {
          action = 'put';
          reason = 'كسر هيكل هابط (CHoCH) مع بيع مؤسسي';
        }
      } else {
        // Price action momentum default
        const prev = slice[slice.length - 2];
        if (curr.close > curr.open && curr.close > prev.close) {
          action = 'call';
          reason = 'شمعة برايس أكشن ابتلاعية صاعدة';
        } else if (curr.close < curr.open && curr.close < prev.close) {
          action = 'put';
          reason = 'شمعة برايس أكشن ابتلاعية هابطة';
        }
      }

      if (action) {
        const exitCandle = rawCandles[i + durationCandles];
        const entryPrice = curr.close;
        const exitPrice = exitCandle.close;
        const isWin = action === 'call' ? exitPrice > entryPrice : exitPrice < entryPrice;
        const pnl = isWin ? stake * payoutRatio : -stake;

        balance += pnl;
        if (isWin) grossProfit += pnl;
        else grossLoss += Math.abs(pnl);

        if (balance > peak) peak = balance;
        const dd = peak - balance;
        if (dd > maxDdUsd) maxDdUsd = dd;

        trades.push({
          entryTime: curr.time,
          exitTime: exitCandle.time,
          action,
          entryPrice,
          exitPrice,
          stake,
          pnl: Number(pnl.toFixed(2)),
          isWin,
          reason,
        });

        // Advance to avoid overlapping trades
        i += durationCandles;
      } else {
        i += 1;
      }
    }

    const totalTrades = trades.length;
    const winningTrades = trades.filter((t) => t.isWin).length;
    const losingTrades = totalTrades - winningTrades;
    const winRate = totalTrades > 0 ? Number(((winningTrades / totalTrades) * 100).toFixed(1)) : 0;
    const netProfit = Number((grossProfit - grossLoss).toFixed(2));
    const profitFactor = grossLoss > 0 ? Number((grossProfit / grossLoss).toFixed(2)) : grossProfit > 0 ? 99 : 0;
    const maxDrawdownPercent = peak > 0 ? Number(((maxDdUsd / peak) * 100).toFixed(1)) : 0;

    const stratName = SUPPORTED_BACKTEST_STRATEGIES.find((s) => s.id === strategyId)?.[isRTL ? 'nameAr' : 'nameEn'] || strategyId;

    return {
      strategyId,
      strategyName: stratName,
      asset,
      timeframe,
      totalCandles: rawCandles.length,
      totalTrades,
      winningTrades,
      losingTrades,
      winRate,
      netProfit,
      profitFactor,
      maxDrawdownPercent,
      trades,
    };
  };

  function calcEma(values: number[], period: number): number {
    if (values.length === 0) return 0;
    const k = 2 / (period + 1);
    let ema = values[0];
    for (let j = 1; j < values.length; j++) {
      ema = values[j] * k + ema * (1 - k);
    }
    return ema;
  }

  function calcRsi(values: number[], period: number): number {
    if (values.length <= period) return 50;
    let gains = 0;
    let losses = 0;
    for (let j = 1; j <= period; j++) {
      const diff = values[j] - values[j - 1];
      if (diff >= 0) gains += diff;
      else losses -= diff;
    }
    let avgGain = gains / period;
    let avgLoss = losses / period;
    for (let j = period + 1; j < values.length; j++) {
      const diff = values[j] - values[j - 1];
      if (diff >= 0) {
        avgGain = (avgGain * (period - 1) + diff) / period;
        avgLoss = (avgLoss * (period - 1)) / period;
      } else {
        avgGain = (avgGain * (period - 1)) / period;
        avgLoss = (avgLoss * (period - 1) - diff) / period;
      }
    }
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
  }

  function calcBollinger(values: number[], period: number, multiplier: number) {
    const slice = values.slice(-period);
    const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
    const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / slice.length;
    const stdDev = Math.sqrt(variance);
    return {
      upper: mean + stdDev * multiplier,
      lower: mean - stdDev * multiplier,
      middle: mean,
    };
  }

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl backdrop-blur-sm space-y-4">
      {/* Title, Badges & Backtest Overlay Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-slate-100 flex items-center gap-2">
              <span>{isRTL ? 'مصفوفة نقاط الاستراتيجيات الـ 21' : '21 Strategy Confluence Matrix'}</span>
              {isOverlayActive && (
                <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 animate-pulse">
                  OVERLAY ON
                </span>
              )}
            </h3>
            <p className="text-[11px] text-slate-400">
              {isRTL ? 'تحليل التوافق متعدد الخوارزميات مع تراكب الاختبار التاريخي' : 'Multi-Algorithmic Breakdown with Backtesting Overlay'}
            </p>
          </div>
        </div>

        {/* Status badges & Backtest Overlay button */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Backtest Overlay Trigger Button */}
          <button
            type="button"
            onClick={() => setShowBacktestPanel(!showBacktestPanel)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer border ${
              isOverlayActive
                ? 'bg-indigo-600 text-white border-indigo-400 shadow-indigo-600/40'
                : showBacktestPanel
                ? 'bg-slate-800 text-indigo-300 border-indigo-500/40'
                : 'bg-slate-800/90 text-slate-300 hover:text-white hover:bg-slate-700 border-slate-700'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 text-indigo-400" />
            <span>{isRTL ? 'تراكب الاختبار التاريخي' : 'Backtest Overlay'}</span>
            {showBacktestPanel ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {conflictProtectionActive ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
              <AlertCircle className="w-3 h-3 text-amber-400" />
              <span>{isRTL ? 'حماية التعارض نشطة' : 'Conflict Protected'}</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              <span>{isRTL ? 'توافق متزن' : 'Harmonized'}</span>
            </span>
          )}

          <div className="flex items-center gap-1 text-[11px] font-mono">
            <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">↑{bullCount}</span>
            <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 font-bold">↓{bearCount}</span>
            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">={waitCount}</span>
          </div>
        </div>
      </div>

      {/* ==================== BACKTEST OVERLAY CONTROL PANEL ==================== */}
      {showBacktestPanel && (
        <div className="p-4 rounded-xl bg-slate-950/90 border border-indigo-500/30 space-y-4 shadow-xl backdrop-blur-md animate-in fade-in duration-200">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <h4 className="font-bold text-xs text-white">
                {isRTL ? 'محاكي وتراكب أداء الاستراتيجيات على الشارت التاريخي' : 'Strategy Historical Backtest & Chart Overlay'}
              </h4>
            </div>

            <div className="flex items-center gap-2">
              {isOverlayActive ? (
                <button
                  type="button"
                  onClick={handleToggleOverlay}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 cursor-pointer"
                >
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>{isRTL ? 'إخفاء التراكب' : 'Hide Overlay'}</span>
                </button>
              ) : backtestReport ? (
                <button
                  type="button"
                  onClick={handleToggleOverlay}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>{isRTL ? 'إظهار التراكب على الشارت' : 'Show Overlay on Chart'}</span>
                </button>
              ) : null}

              {onClearBacktestOverlay && isOverlayActive && (
                <button
                  type="button"
                  onClick={onClearBacktestOverlay}
                  className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-900 border border-slate-800 cursor-pointer"
                  title={isRTL ? 'مسح التراكب' : 'Clear overlay'}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Configuration Inputs Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            {/* Strategy Selection */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-300 block">
                {isRTL ? 'الاستراتيجية:' : 'Strategy:'}
              </label>
              <select
                value={selectedBacktestStrat}
                onChange={(e) => setSelectedBacktestStrat(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-xs focus:outline-hidden focus:border-indigo-500 cursor-pointer"
              >
                {SUPPORTED_BACKTEST_STRATEGIES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {isRTL ? s.nameAr : s.nameEn}
                  </option>
                ))}
              </select>
            </div>

            {/* Stake Input */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-300 block">
                {isRTL ? 'مبلغ الصفقة ($):' : 'Stake ($):'}
              </label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={backtestStake}
                  onChange={(e) => setBacktestStake(Math.max(1, Number(e.target.value)))}
                  className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 font-mono text-xs"
                />
                {[5, 10, 25].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setBacktestStake(amt)}
                    className={`px-1.5 py-1 rounded text-[10px] font-mono cursor-pointer ${
                      backtestStake === amt ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    ${amt}
                  </button>
                ))}
              </div>
            </div>

            {/* Expiry / Timeframe Duration */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-300 block">
                {isRTL ? 'مدة الصفقة:' : 'Duration:'}
              </label>
              <div className="flex items-center gap-1">
                {[
                  { s: 30, l: '30s' },
                  { s: 60, l: '60s' },
                  { s: 300, l: '5m' },
                ].map((d) => (
                  <button
                    key={d.s}
                    type="button"
                    onClick={() => setBacktestExpiry(d.s)}
                    className={`flex-1 py-1.5 rounded-lg text-[11px] font-mono font-bold transition-all cursor-pointer ${
                      backtestExpiry === d.s
                        ? 'bg-sky-500 text-slate-950 font-black'
                        : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {d.l}
                  </button>
                ))}
              </div>
            </div>

            {/* Payout % & Trigger Button */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-300 block">
                {isRTL ? 'نسبة العائد:' : 'Payout %:'}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="50"
                  max="98"
                  value={backtestPayout}
                  onChange={(e) => setBacktestPayout(Math.min(98, Math.max(50, Number(e.target.value))))}
                  className="w-16 px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 font-mono text-xs text-center"
                />
                <button
                  type="button"
                  disabled={isRunningBacktest}
                  onClick={() => handleRunBacktest()}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase cursor-pointer disabled:opacity-50 transition-all shadow-md shadow-indigo-950/50"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>{isRunningBacktest ? (isRTL ? 'جاري الفحص...' : 'Running...') : (isRTL ? 'تشغيل' : 'Run')}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Results Summary & Metrics Display */}
          {backtestReport && (
            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800/90 space-y-3 font-mono">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-center text-xs">
                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-sans">{isRTL ? 'نسبة الفوز' : 'Win Rate'}</span>
                  <span
                    className={`text-sm sm:text-base font-black ${
                      backtestReport.winRate >= 60 ? 'text-emerald-400' : backtestReport.winRate >= 50 ? 'text-amber-400' : 'text-rose-400'
                    }`}
                  >
                    {backtestReport.winRate}%
                  </span>
                </div>

                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-sans">{isRTL ? 'صافي الأرباح' : 'Net Profit'}</span>
                  <span
                    className={`text-sm sm:text-base font-black ${
                      backtestReport.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {backtestReport.netProfit >= 0 ? '+' : ''}${backtestReport.netProfit}
                  </span>
                </div>

                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-sans">{isRTL ? 'معامل الربح' : 'Profit Factor'}</span>
                  <span className="text-sm sm:text-base font-black text-amber-400">{backtestReport.profitFactor}</span>
                </div>

                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-sans">{isRTL ? 'أقصى تراجع' : 'Max DD'}</span>
                  <span className="text-sm sm:text-base font-black text-rose-400">{backtestReport.maxDrawdownPercent}%</span>
                </div>

                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-sans">{isRTL ? 'عدد الصفقات' : 'Trades'}</span>
                  <span className="text-sm sm:text-base font-black text-slate-200">{backtestReport.totalTrades}</span>
                </div>

                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-sans">{isRTL ? 'رابحة / خاسرة' : 'W / L'}</span>
                  <span className="text-xs font-black text-slate-300">
                    <span className="text-emerald-400">{backtestReport.winningTrades}</span> /{' '}
                    <span className="text-rose-400">{backtestReport.losingTrades}</span>
                  </span>
                </div>
              </div>

              {/* Toggle Trades List Details */}
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => setShowTradesList(!showTradesList)}
                  className="text-[11px] font-sans font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
                >
                  <span>{isRTL ? 'عرض تفاصيل الصفقات المنفذة' : 'View Executed Trades Log'} ({backtestReport.trades.length})</span>
                  {showTradesList ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 font-sans">
                    {isOverlayActive
                      ? (isRTL ? '🟢 التراكب معروض على الشارت' : '🟢 Overlay Displayed on Chart')
                      : (isRTL ? '⚪ التراكب غير مفعل' : '⚪ Overlay Hidden')}
                  </span>
                </div>
              </div>

              {/* Detailed Simulated Trades Log */}
              {showTradesList && (
                <div className="max-h-48 overflow-y-auto space-y-1.5 pt-2 border-t border-slate-800 text-[11px]">
                  {backtestReport.trades.map((tr, idx) => (
                    <div
                      key={idx}
                      className={`p-2 rounded-lg border flex items-center justify-between gap-2 ${
                        tr.isWin
                          ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                          : 'bg-rose-950/20 border-rose-500/30 text-rose-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-500">
                          {new Date(tr.entryTime * 1000).toLocaleTimeString()}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            tr.action === 'call' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                          }`}
                        >
                          {tr.action.toUpperCase()}
                        </span>
                        <span className="text-slate-300">
                          {tr.entryPrice.toFixed(5)} ➔ {tr.exitPrice.toFixed(5)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 font-bold">
                        <span>{tr.isWin ? (isRTL ? 'ربح' : 'WIN') : (isRTL ? 'خسارة' : 'LOSS')}</span>
                        <span className={tr.isWin ? 'text-emerald-400' : 'text-rose-400'}>
                          {tr.pnl >= 0 ? '+' : ''}${tr.pnl.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Direct Trade Dispatcher (إرسال الصفقات مباشرة وفق التوافق) */}
      <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/90 shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span>{isRTL ? 'إرسال صفقة تداول مباشرة إلى Pocket Option:' : 'Quick Direct Pocket Option Trade:'}</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] font-mono text-slate-300">
            <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 font-semibold">{asset}</span>
            <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">{tradeDuration}s</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-2.5">
          <div className="flex items-center gap-1.5 bg-slate-900/60 p-1.5 rounded-lg border border-slate-800/70">
            <span className="text-[10px] text-slate-400 font-semibold pl-1">{isRTL ? 'المبلغ ($):' : 'Stake ($):'}</span>
            <div className="relative flex-1 min-w-[60px]">
              <input
                type="number"
                min="1.00"
                max="1000.00"
                step="1"
                value={tradeAmount}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val)) {
                    setTradeAmount(Math.min(1000.00, Math.max(1.00, Number(val.toFixed(2)))));
                  }
                }}
                className="w-full px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-slate-950 border border-slate-700 text-slate-100 focus:outline-hidden focus:border-amber-500"
                placeholder="1 - 1000"
              />
            </div>
            <select
              value={tradeAmount}
              onChange={(e) => {
                const val = Number(e.target.value);
                if (!isNaN(val) && val >= 1 && val <= 1000) {
                  setTradeAmount(val);
                }
              }}
              className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-950 border border-slate-700 text-slate-300 focus:outline-hidden focus:border-amber-500 cursor-pointer"
              title={isRTL ? 'اختر مبلغاً قياسياً ($25 - $1000)' : 'Select standard amount ($25 - $1000)'}
            >
              {![25, 50, 75, 100, 150, 200, 250, 500, 750, 1000].includes(tradeAmount) && (
                <option value={tradeAmount}>${tradeAmount}</option>
              )}
              {[25, 50, 75, 100, 150, 200, 250, 500, 750, 1000].map((amt) => (
                <option key={amt} value={amt}>
                  ${amt}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-900/60 p-1.5 rounded-lg border border-slate-800/70">
            <span className="text-[10px] text-slate-400 font-semibold pl-1">{isRTL ? 'المدة:' : 'Expiry:'}</span>
            {durationOptions.map((d) => (
              <button
                key={d.s}
                type="button"
                onClick={() => setTradeDuration(d.s)}
                className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold transition-all cursor-pointer ${
                  tradeDuration === d.s
                    ? 'bg-sky-500 text-slate-950 shadow-sm'
                    : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
                }`}
              >
                {d.l}
              </button>
            ))}
          </div>
        </div>

        {/* Quick Tier Stake Shortcuts */}
        <div className="flex flex-wrap items-center gap-1 mb-2 px-0.5">
          <span className="text-[10px] text-slate-400 font-semibold">{isRTL ? 'مبالغ سريعة:' : 'Quick:'}</span>
          {[25, 50, 75, 100, 150, 200, 250, 500, 750, 1000].map((amt) => (
            <button
              key={amt}
              type="button"
              disabled={isSendingTrade}
              onClick={() => setTradeAmount(amt)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-all cursor-pointer ${
                tradeAmount === amt
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-800'
              }`}
            >
              ${amt}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={isSendingTrade}
            onClick={() => handleSendTrade('call')}
            className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg font-bold text-xs transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer ${
              bullCount > bearCount
                ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/25 ring-2 ring-emerald-400/50'
                : 'bg-emerald-950/70 hover:bg-emerald-900 text-emerald-300 border border-emerald-800'
            }`}
          >
            <ArrowUp className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>{isSendingTrade ? (isRTL ? 'جاري الإرسال...' : 'Sending...') : (isRTL ? 'إرسال صعود (CALL)' : 'Send CALL')}</span>
          </button>

          <button
            type="button"
            disabled={isSendingTrade}
            onClick={() => handleSendTrade('put')}
            className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg font-bold text-xs transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer ${
              bearCount > bullCount
                ? 'bg-rose-500 hover:bg-rose-400 text-slate-950 shadow-rose-500/25 ring-2 ring-rose-400/50'
                : 'bg-rose-950/70 hover:bg-rose-900 text-rose-300 border border-rose-800'
            }`}
          >
            <ArrowDown className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>{isSendingTrade ? (isRTL ? 'جاري الإرسال...' : 'Sending...') : (isRTL ? 'إرسال هبوط (PUT)' : 'Send PUT')}</span>
          </button>
        </div>

        {tradeFeedback && (
          <div
            className={`mt-2 p-2 rounded-lg text-[11px] font-mono flex items-center gap-2 border ${
              tradeFeedback.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}
          >
            {tradeFeedback.type === 'success' ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            )}
            <span className="truncate">{tradeFeedback.message}</span>
          </div>
        )}
      </div>

      {/* 21 Strategy Grid with 1-Click Backtest Overlay Trigger */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-[380px] overflow-y-auto pr-1">
        {strategyList.length === 0 ? (
          <div className="col-span-full py-8 text-center text-xs text-slate-500">
            {isRTL ? 'بانتظار تدفق بيانات الشموع لحساب التوافق...' : 'Waiting for candle data stream to compute confluence...'}
          </div>
        ) : (
          strategyList.map((strat: any, idx) => {
            const isBull = isStrategyBull(strat);
            const isBear = isStrategyBear(strat);
            const stratKey = strat.strategyId || strat.strategy || `strat_${idx}`;
            const name = strat.strategyName || strat.strategy || strat.strategyId || `Strategy ${idx + 1}`;
            const reason = strat.reasons?.[0] || strat.reason || '';

            return (
              <div
                key={stratKey}
                className={`p-3 rounded-xl border transition-all ${
                  isBull
                    ? 'bg-emerald-950/20 border-emerald-500/30 hover:border-emerald-500/50'
                    : isBear
                    ? 'bg-rose-950/20 border-rose-500/30 hover:border-rose-500/50'
                    : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <span className="text-[11px] font-bold text-slate-200 truncate" title={name}>
                    {tTerm(name)}
                  </span>
                  <div className="flex items-center gap-1">
                    {/* 1-Click Backtest on Strategy */}
                    <button
                      type="button"
                      onClick={() => handleRunBacktest(stratKey)}
                      className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-300 border border-indigo-500/30 cursor-pointer transition-all"
                      title={isRTL ? 'اختبار تراكب هذه الاستراتيجية على الشارت' : 'Backtest overlay this strategy'}
                    >
                      ⚡ {isRTL ? 'اختبار' : 'Test'}
                    </button>

                    {isBull && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400">
                        <ArrowUp className="w-2.5 h-2.5" />
                        {isRTL ? 'صعود' : 'UP'}
                      </span>
                    )}
                    {isBear && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400">
                        <ArrowDown className="w-2.5 h-2.5" />
                        {isRTL ? 'هبوط' : 'DOWN'}
                      </span>
                    )}
                    {!isBull && !isBear && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400">
                        <Minus className="w-2.5 h-2.5" />
                        {isRTL ? 'حياد' : 'WAIT'}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span>{isRTL ? 'الوزن' : 'Weight'}: {strat.weight?.toFixed(1) || '1.0'}</span>
                  <span className="font-mono text-slate-300">
                    {isRTL ? 'النقاط' : 'Score'}: {strat.score !== undefined ? Number(strat.score).toFixed(2) : '0.00'}
                  </span>
                </div>

                {reason && (
                  <p className="mt-1 text-[10px] text-slate-400 truncate" title={reason}>
                    {reason}
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
