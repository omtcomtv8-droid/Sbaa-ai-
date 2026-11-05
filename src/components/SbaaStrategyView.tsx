import React, { useState, useEffect } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart2,
  CheckCircle2,
  Clock,
  Compass,
  Cpu,
  Eye,
  Filter,
  Layers,
  Play,
  RefreshCw,
  RotateCcw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Square,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { SbaaEngineStatus, SbaaDetectionLogRecord, SbaaScoreBreakdown } from '../../server/sbaa/SbaaTypes';

interface SbaaStrategyViewProps {
  activeAsset: string;
  timeframe: number;
  currentPrice: number;
}

export const SbaaStrategyView: React.FC<SbaaStrategyViewProps> = ({
  activeAsset,
  timeframe,
  currentPrice,
}) => {
  const { isRTL } = useLanguage();
  const [status, setStatus] = useState<SbaaEngineStatus | null>(null);
  const [logs, setLogs] = useState<SbaaDetectionLogRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'BUY' | 'SELL' | 'WAIT' | 'EXECUTED'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLog, setSelectedLog] = useState<SbaaDetectionLogRecord | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/sbaa/status');
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch {}
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/sbaa/logs?limit=100');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setLogs(data);
        }
      }
    } catch {}
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchStatus(), fetchLogs()]).finally(() => setLoading(false));

    const interval = setInterval(() => {
      fetchStatus();
      fetchLogs();
    }, 4000);

    return () => clearInterval(interval);
  }, [activeAsset, timeframe]);

  const handleToggleAutoDemo = async () => {
    if (!status) return;
    setActionLoading(true);
    try {
      await fetch('/api/sbaa/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoDemoExecution: !status.autoDemoEnabled }),
      });
      await fetchStatus();
    } catch {}
    setActionLoading(false);
  };

  const handleTriggerAnalyze = async () => {
    setActionLoading(true);
    try {
      await fetch('/api/sbaa/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asset: activeAsset, timeframe }),
      });
      await fetchStatus();
      await fetchLogs();
    } catch {}
    setActionLoading(false);
  };

  const handleResetStats = async () => {
    if (!window.confirm(isRTL ? 'هل تريد تصفير إحصائيات المحرك وسجل اليوم؟' : 'Reset SBAA Engine daily stats?')) return;
    try {
      await fetch('/api/sbaa/reset-stats', { method: 'POST' });
      await fetchStatus();
      await fetchLogs();
    } catch {}
  };

  const filteredLogs = logs.filter((log) => {
    if (filter === 'BUY' && log.systemDecision !== 'BUY') return false;
    if (filter === 'SELL' && log.systemDecision !== 'SELL') return false;
    if (filter === 'WAIT' && log.systemDecision !== 'WAIT') return false;
    if (filter === 'EXECUTED' && !log.tradeStatus.startsWith('DEMO_')) return false;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchPattern = log.patternNameAr.toLowerCase().includes(term) || log.patternNameEn.toLowerCase().includes(term);
      const matchReason = log.reasonAr.toLowerCase().includes(term);
      const matchAsset = log.asset.toLowerCase().includes(term);
      return matchPattern || matchReason || matchAsset;
    }
    return true;
  });

  const getStatusBadgeColor = (st: string) => {
    switch (st) {
      case 'DEMO_EXECUTED':
      case 'READY_TO_EXECUTE':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 animate-pulse';
      case 'PATTERN_DETECTED':
      case 'CONFIRMATION':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
      case 'TREND_VALIDATION':
      case 'LOCATION_VALIDATION':
      case 'SIGNAL_SCORING':
        return 'bg-sky-500/20 text-sky-400 border-sky-500/40';
      case 'NO_TRADE':
        return 'bg-rose-500/20 text-rose-400 border-rose-500/40';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div id="sbaa-strategy-view" className="space-y-6 animate-fade-in" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* 1. Header Banner & Status Bar */}
      <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 shadow-xl relative overflow-hidden backdrop-blur-md">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl -z-10" />
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500/20 to-indigo-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-sm">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-black text-slate-100 flex items-center gap-2">
                  <span>{isRTL ? 'استراتيجية سبع الذكية المطورة' : 'SBAA Smart Strategy Engine'}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono font-bold">
                    v2.5 PRO
                  </span>
                </h2>
                <p className="text-xs text-slate-400">
                  {isRTL
                    ? 'نظام التحليل السعري المتقدم: نماذج الشموع اليابانية، العرض والطلب، سحب السيولة، BOS، CHOCH، والدخول الآلي التجريبي'
                    : 'Advanced Price Action: Candlestick Patterns, Supply & Demand, Liquidity Sweeps, BOS, CHOCH, and Auto Demo Execution'}
                </p>
              </div>
            </div>
          </div>

          {/* Real-time State Badge & Control Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className={`px-3 py-1.5 rounded-xl border text-xs font-mono font-bold flex items-center gap-2 ${getStatusBadgeColor(status?.state || 'SCANNING')}`}>
              <span className="w-2 h-2 rounded-full bg-current animate-ping" />
              <span>{status?.stateAr || 'جاري الفحص (SCANNING)'}</span>
            </div>

            <button
              onClick={handleTriggerAnalyze}
              disabled={actionLoading}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${actionLoading ? 'animate-spin' : ''}`} />
              <span>{isRTL ? 'تحليل لحظي الآن' : 'Scan Market Now'}</span>
            </button>

            <button
              onClick={handleToggleAutoDemo}
              disabled={actionLoading}
              className={`px-3.5 py-2 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                status?.autoDemoEnabled
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/25'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
              }`}
            >
              {status?.autoDemoEnabled ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Play className="w-3.5 h-3.5" />}
              <span>{status?.autoDemoEnabled ? (isRTL ? 'الدخول التجريبي مفعل' : 'Auto Demo ON') : (isRTL ? 'تشغيل الدخول التجريبي' : 'Enable Auto Demo')}</span>
            </button>

            <button
              onClick={handleResetStats}
              title={isRTL ? 'تصفير الإحصائيات' : 'Reset Stats'}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Circuit Breaker Banner if Tripped */}
        {status?.isCircuitBreakerTripped && (
          <div className="mt-4 p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
            <span>
              <strong>{isRTL ? 'قاطع الدائرة مفعل:' : 'Circuit Breaker Active:'}</strong> {status.circuitBreakerReason || (isRTL ? 'تم بلوغ الحد الأقصى للمخاطر' : 'Risk limits reached')}
            </span>
          </div>
        )}
      </div>

      {/* 2. Key Metrics Grid (Section 12: 1-12) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Metric 1: Patterns Detected */}
        <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm space-y-1">
          <span className="text-[11px] text-slate-400 block flex items-center justify-between">
            <span>{isRTL ? 'النماذج المكتشفة' : 'Patterns Detected'}</span>
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
          </span>
          <span className="text-xl font-black font-mono text-slate-100 block">
            {status?.patternsDetectedCount ?? 0}
          </span>
          <span className="text-[10px] text-slate-500 block">{isRTL ? 'نماذج فنية وسحب سيولة' : 'Technical & sweeps'}</span>
        </div>

        {/* Metric 2: BUY Signals */}
        <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm space-y-1">
          <span className="text-[11px] text-slate-400 block flex items-center justify-between">
            <span>{isRTL ? 'إشارات الشراء BUY' : 'BUY Signals'}</span>
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
          </span>
          <span className="text-xl font-black font-mono text-emerald-400 block">
            {status?.buySignalsCount ?? 0}
          </span>
          <span className="text-[10px] text-emerald-500/80 block">{isRTL ? 'دعم / كسر هيكل صاعد' : 'Demand / Bullish BOS'}</span>
        </div>

        {/* Metric 3: SELL Signals */}
        <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm space-y-1">
          <span className="text-[11px] text-slate-400 block flex items-center justify-between">
            <span>{isRTL ? 'إشارات البيع SELL' : 'SELL Signals'}</span>
            <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
          </span>
          <span className="text-xl font-black font-mono text-rose-400 block">
            {status?.sellSignalsCount ?? 0}
          </span>
          <span className="text-[10px] text-rose-500/80 block">{isRTL ? 'مقاومة / سحب سيولة قمة' : 'Supply / Sweep High'}</span>
        </div>

        {/* Metric 4: WAIT Decisions */}
        <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm space-y-1">
          <span className="text-[11px] text-slate-400 block flex items-center justify-between">
            <span>{isRTL ? 'قرارات الانتظار WAIT' : 'WAIT Decisions'}</span>
            <Clock className="w-3.5 h-3.5 text-amber-400" />
          </span>
          <span className="text-xl font-black font-mono text-amber-400 block">
            {status?.waitDecisionsCount ?? 0}
          </span>
          <span className="text-[10px] text-amber-500/80 block">{isRTL ? 'حماية من التردد والدوجي' : 'Hesitation filter'}</span>
        </div>

        {/* Metric 5: Win Rate */}
        <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm space-y-1">
          <span className="text-[11px] text-slate-400 block flex items-center justify-between">
            <span>{isRTL ? 'نسبة الفوز التجريبية' : 'Demo Win Rate'}</span>
            <Activity className="w-3.5 h-3.5 text-sky-400" />
          </span>
          <span className="text-xl font-black font-mono text-sky-400 block">
            {status?.winRate ?? 0}%
          </span>
          <span className="text-[10px] text-slate-400 font-mono block">
            {status?.wonDemoTrades ?? 0}W / {status?.lostDemoTrades ?? 0}L
          </span>
        </div>

        {/* Metric 6: Daily Demo PnL */}
        <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm space-y-1">
          <span className="text-[11px] text-slate-400 block flex items-center justify-between">
            <span>{isRTL ? 'أرباح المحاكاة اليوم' : 'Daily Demo PnL'}</span>
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          </span>
          <span className={`text-xl font-black font-mono block ${
            (status?.todayDemoPnL ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
          }`}>
            {(status?.todayDemoPnL ?? 0) >= 0 ? '+' : ''}${status?.todayDemoPnL?.toFixed(2) ?? '0.00'}
          </span>
          <span className="text-[10px] text-slate-500 block">{isRTL ? 'حساب تجريبي فقط' : 'Paper / Demo Only'}</span>
        </div>
      </div>

      {/* 3. Latest Setup & 100-Point Confluence Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column (5 cols): Latest Decision & Signal Card */}
        <div className="lg:col-span-5 p-5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-4 backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-amber-400" />
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-200">
                {isRTL ? 'قرار المحرك اللحظي لآخر إشارة' : 'Latest Engine Signal Decision'}
              </h3>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
              {activeAsset} ({timeframe}s)
            </span>
          </div>

          {/* Decision Pill */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-slate-950 border border-slate-800">
            <div>
              <span className="text-[11px] text-slate-400 block">{isRTL ? 'القرار الفني المعتمد' : 'System Decision'}</span>
              <span className={`text-2xl font-black font-mono flex items-center gap-2 ${
                status?.latestDecision === 'BUY'
                  ? 'text-emerald-400'
                  : status?.latestDecision === 'SELL'
                  ? 'text-rose-400'
                  : 'text-amber-400'
              }`}>
                {status?.latestDecision === 'BUY' && <ArrowUpRight className="w-6 h-6" />}
                {status?.latestDecision === 'SELL' && <ArrowDownRight className="w-6 h-6" />}
                {status?.latestDecision || 'WAIT'}
              </span>
            </div>

            <div className="text-right">
              <span className="text-[11px] text-slate-400 block">{isRTL ? 'نقاط التوافق الفني' : 'Confluence Score'}</span>
              <span className={`text-2xl font-black font-mono ${
                (status?.latestScore ?? 0) >= 80
                  ? 'text-emerald-400'
                  : (status?.latestScore ?? 0) >= 70
                  ? 'text-indigo-400'
                  : 'text-slate-400'
              }`}>
                {status?.latestScore ?? 0}<span className="text-xs text-slate-500 font-normal">/100</span>
              </span>
            </div>
          </div>

          {/* Pattern Details */}
          <div className="space-y-2 text-xs">
            <div className="flex justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
              <span className="text-slate-400">{isRTL ? 'النموذج المكتشف:' : 'Detected Pattern:'}</span>
              <span className="font-bold text-slate-200 font-mono">
                {status?.latestPatternName || (isRTL ? 'لا يوجد نموذج نشط' : 'None')}
              </span>
            </div>

            {/* Clear Arabic Rationale Box */}
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                {isRTL ? 'سبب القرار الفني (Technical Rationale):' : 'Technical Rationale:'}
              </span>
              <p className="text-xs text-slate-200 leading-relaxed font-sans">
                {status?.latestReasonAr || (isRTL ? 'جاري فحص الشموع والمستويات الفنية...' : 'Scanning candles...')}
              </p>
            </div>
          </div>
        </div>

        {/* Right Column (7 cols): 100-Point Confluence Scoring Matrix (Section 5) */}
        <div className="lg:col-span-7 p-5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-4 backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-emerald-400" />
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-200">
                {isRTL ? 'مصفوفة نقاط التوافق الفني الـ 100 (Signal Scoring Matrix)' : '100-Point Confluence Matrix'}
              </h3>
            </div>
            <span className="text-[11px] text-emerald-400 font-mono font-bold">
              {isRTL ? 'مؤهل للتنفيذ: 80 - 100 نقطة' : 'Qualified: 80-100 pts'}
            </span>
          </div>

          {/* Breakdown bars */}
          <div className="space-y-2.5 text-xs">
            {[
              {
                labelAr: '1. الاتجاه العام (Trend Analysis)',
                labelEn: 'Trend Analysis',
                max: 15,
                val: status?.latestScoreBreakdown?.trendScore ?? 12,
                color: 'bg-indigo-500',
              },
              {
                labelAr: '2. موقع الدعم والمقاومة (S/R & Zones)',
                labelEn: 'Support / Resistance Location',
                max: 20,
                val: status?.latestScoreBreakdown?.srLocationScore ?? 16,
                color: 'bg-emerald-500',
              },
              {
                labelAr: '3. نموذج الشموع اليابانية (Candlestick Pattern)',
                labelEn: 'Candlestick Pattern',
                max: 15,
                val: status?.latestScoreBreakdown?.patternScore ?? 14,
                color: 'bg-amber-500',
              },
              {
                labelAr: '4. ضغط الفتائل وسحب السيولة (Wick & Liquidity)',
                labelEn: 'Wick & Liquidity Analysis',
                max: 15,
                val: status?.latestScoreBreakdown?.wickLiquidityScore ?? 12,
                color: 'bg-sky-500',
              },
              {
                labelAr: '5. تأكيد الهيكل السعري (BOS / CHOCH)',
                labelEn: 'Market Structure Confirmation',
                max: 15,
                val: status?.latestScoreBreakdown?.structureScore ?? 13,
                color: 'bg-purple-500',
              },
              {
                labelAr: '6. الزخم والمؤشرات (RSI / MACD / ATR)',
                labelEn: 'Momentum & Indicators',
                max: 10,
                val: status?.latestScoreBreakdown?.momentumScore ?? 8,
                color: 'bg-rose-500',
              },
              {
                labelAr: '7. تأكيد الإطار الزمني الأكبر (MTF Alignment)',
                labelEn: 'Higher Timeframe Confirmation',
                max: 10,
                val: status?.latestScoreBreakdown?.mtfScore ?? 8,
                color: 'bg-teal-500',
              },
            ].map((item, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-300">{isRTL ? item.labelAr : item.labelEn}</span>
                  <span className="font-mono font-bold text-slate-200">
                    {item.val} / {item.max}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${item.color}`}
                    style={{ width: `${Math.min(100, (item.val / item.max) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Multi-Timeframe Alignment Matrix (Section 10) */}
      <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3 backdrop-blur-md">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-sky-400" />
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-200">
              {isRTL ? 'تحليل الأطر الزمنية المتعددة (Multi-Timeframe Synthesis)' : 'Multi-Timeframe Matrix (1M - 15M)'}
            </h3>
          </div>
          <span className="text-[10px] text-slate-400">
            {isRTL ? 'الإطار الأكبر يحدد الاتجاه والسياق، والأصغر يحدد النموذج وتوقيت الدخول' : 'Higher TF provides context, lower TF triggers entry'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {['1M', '5M', '15M'].map((tfKey) => {
            const mtf = status?.mtfMatrix?.[tfKey];
            return (
              <div key={tfKey} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-mono font-bold text-xs text-slate-200">{tfKey} Frame</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                    mtf?.trend === 'BULLISH'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : mtf?.trend === 'BEARISH'
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      : 'bg-slate-800 text-slate-400'
                  }`}>
                    {mtf?.trend || 'RANGING'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-400">
                  <div>
                    <span className="block text-[10px] text-slate-500">EMA 20/50:</span>
                    <span className="text-slate-200">{mtf?.ema20?.toFixed(4) || '—'}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-500">RSI 14:</span>
                    <span className="text-slate-200">{mtf?.rsi?.toFixed(1) || '—'}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. SBAA STRATEGY DETECTION LOG Table (Section 11) */}
      <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-4 backdrop-blur-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-400" />
            <div>
              <h3 className="font-bold text-sm text-slate-100 uppercase tracking-wider">
                {isRTL ? 'سجل تحليل نماذج استراتيجية سبع (SBAA STRATEGY DETECTION LOG)' : 'SBAA Strategy Detection Log'}
              </h3>
              <p className="text-[11px] text-slate-400">
                {isRTL ? 'توثيق كل عملية فحص فني سواء نتج عنها دخول تجريبي أم انتظار مع الأسباب الكاملة' : 'Complete record of every analyzed pattern, decision rationale, and demo execution outcome'}
              </p>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={isRTL ? 'بحث في النماذج أو الأسباب...' : 'Search logs...'}
                className="pl-8 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-hidden focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center bg-slate-950 p-0.5 rounded-xl border border-slate-800 text-xs">
              {(['ALL', 'BUY', 'SELL', 'WAIT', 'EXECUTED'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors cursor-pointer ${
                    filter === f ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto max-h-[460px] scrollbar-thin scrollbar-thumb-slate-700">
          {filteredLogs.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">
              {isRTL ? 'لم يتم تسجيل نماذج حتى الآن. المحرك يراقب السوق بصورة مستمرة.' : 'No detection logs found. Engine scanning active.'}
            </div>
          ) : (
            <table className={`w-full text-xs ${isRTL ? 'text-right' : 'text-left'}`}>
              <thead className="sticky top-0 bg-slate-950/90 backdrop-blur-sm z-10">
                <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] font-mono">
                  <th className="py-2.5 px-3">{isRTL ? 'الوقت' : 'Time'}</th>
                  <th className="py-2.5 px-3">{isRTL ? 'الأصل / الفريم' : 'Asset / TF'}</th>
                  <th className="py-2.5 px-3">{isRTL ? 'النموذج المكتشف' : 'Pattern'}</th>
                  <th className="py-2.5 px-3">{isRTL ? 'القرار' : 'Decision'}</th>
                  <th className="py-2.5 px-3">{isRTL ? 'النقاط' : 'Score'}</th>
                  <th className="py-2.5 px-3">{isRTL ? 'السبب الفني' : 'Technical Reason'}</th>
                  <th className="py-2.5 px-3 text-right">{isRTL ? 'حالة الصفقة' : 'Demo Status'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {filteredLogs.map((log) => (
                  <tr
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className="hover:bg-slate-800/40 cursor-pointer transition-colors group"
                  >
                    <td className="py-2.5 px-3 text-slate-400 text-[11px] whitespace-nowrap">
                      {new Date(log.detectionTime).toLocaleTimeString()}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="font-bold text-slate-200">{log.asset}</span>
                      <span className="text-[10px] text-slate-500 ml-1">({log.timeframe}s)</span>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap font-sans font-semibold text-slate-200">
                      {isRTL ? log.patternNameAr : log.patternNameEn}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                        log.systemDecision === 'BUY'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : log.systemDecision === 'SELL'
                          ? 'bg-rose-500/20 text-rose-400'
                          : 'bg-amber-500/20 text-amber-400'
                      }`}>
                        {log.systemDecision}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className={`font-bold ${log.confluenceScore >= 80 ? 'text-emerald-400' : 'text-slate-300'}`}>
                        {log.confluenceScore}/100
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-300 font-sans text-[11px] max-w-xs truncate">
                      {isRTL ? log.reasonAr : log.reasonEn}
                    </td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                        log.tradeStatus === 'DEMO_WON'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : log.tradeStatus === 'DEMO_LOST'
                          ? 'bg-rose-500/20 text-rose-300'
                          : log.tradeStatus === 'DEMO_DRAW'
                          ? 'bg-slate-700 text-slate-300'
                          : log.tradeStatus === 'DEMO_OPEN'
                          ? 'bg-amber-500/20 text-amber-300 animate-pulse'
                          : log.tradeStatus === 'REJECTED'
                          ? 'bg-rose-950 text-rose-400'
                          : 'bg-slate-800 text-slate-400'
                      }`}>
                        {log.tradeStatus.replace('DEMO_', '')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
