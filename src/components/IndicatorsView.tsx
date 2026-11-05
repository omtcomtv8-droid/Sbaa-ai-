import React from 'react';
import {
  TrendingUp,
  Activity,
  BarChart2,
  Sliders,
  Shield,
  Gauge,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
} from 'lucide-react';
import { IndicatorMetrics, Candle, SupportResistanceLevel } from '../types';
import { useLanguage } from '../i18n/LanguageContext';

interface IndicatorsViewProps {
  indicators?: IndicatorMetrics | null;
  candles?: Candle[];
  activeAsset: string;
  timeframe: number;
  currentPrice?: number | null;
  srLevels?: SupportResistanceLevel[];
}

export const IndicatorsView: React.FC<IndicatorsViewProps> = ({
  indicators,
  candles = [],
  activeAsset,
  timeframe,
  currentPrice,
  srLevels = [],
}) => {
  const { isRTL, tTerm } = useLanguage();

  const rsi = indicators?.rsi ?? null;
  const macd = indicators?.macd ?? null;
  const bollinger = indicators?.bollinger ?? null;
  const adx = indicators?.adx ?? null;
  const stoch = indicators?.stochastic ?? null;
  const atr = indicators?.atr ?? null;

  const rsiStatus =
    rsi === null
      ? 'WAIT'
      : rsi >= 70
      ? 'OVERBOUGHT'
      : rsi <= 30
      ? 'OVERSOLD'
      : 'NEUTRAL';

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto font-sans" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-100 tracking-tight">
                {isRTL ? 'لوحة المؤشرات الفنية والكمية المتقدمة' : 'Advanced Quantitative Indicators Terminal'}
              </h2>
              <p className="text-xs text-slate-400">
                {isRTL
                  ? `تحليل حي ومباشر للزوج ${activeAsset} على إطار ${timeframe} ثانية`
                  : `Real-time mathematical analysis for ${activeAsset} (${timeframe}s)`}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3.5 py-2 rounded-2xl bg-slate-950 border border-slate-800/80 text-right">
            <span className="block text-[10px] text-slate-400 uppercase font-mono">
              {isRTL ? 'السعر الحالي' : 'Live Price'}
            </span>
            <span className="font-mono text-sm sm:text-base font-bold text-amber-400">
              {currentPrice !== null && currentPrice !== undefined
                ? currentPrice.toFixed(activeAsset.includes('JPY') ? 3 : 5)
                : '---'}
            </span>
          </div>

          <div className="px-3.5 py-2 rounded-2xl bg-slate-950 border border-slate-800/80 text-right">
            <span className="block text-[10px] text-slate-400 uppercase font-mono">
              {isRTL ? 'عدد الشموع' : 'Candles'}
            </span>
            <span className="font-mono text-sm sm:text-base font-bold text-slate-200">
              {candles.length}
            </span>
          </div>
        </div>
      </div>

      {/* Grid of Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* 1. RSI */}
        <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4 hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-bold text-slate-200">RSI (14) Relative Strength</h3>
            </div>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                rsiStatus === 'OVERBOUGHT'
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                  : rsiStatus === 'OVERSOLD'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : 'bg-slate-800 text-slate-300'
              }`}
            >
              {rsiStatus}
            </span>
          </div>

          <div className="text-center py-2">
            <span className="font-mono text-3xl font-black text-slate-100">
              {rsi !== null ? rsi.toFixed(1) : '--'}
            </span>
            <span className="text-xs text-slate-500 block mt-1">
              {rsi !== null && rsi > 50 ? 'Bullish Dominance' : 'Bearish Pressure'}
            </span>
          </div>

          {/* Meter Bar */}
          <div className="space-y-1.5">
            <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800 flex">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  rsi !== null && rsi >= 70
                    ? 'bg-rose-500'
                    : rsi !== null && rsi <= 30
                    ? 'bg-emerald-500'
                    : 'bg-amber-400'
                }`}
                style={{ width: `${Math.min(Math.max(rsi ?? 50, 0), 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] font-mono text-slate-500">
              <span>0 (Oversold 30)</span>
              <span>50</span>
              <span>100 (Overbought 70)</span>
            </div>
          </div>
        </div>

        {/* 2. MACD */}
        <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4 hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-blue-400" />
              <h3 className="text-xs font-bold text-slate-200">MACD (12, 26, 9)</h3>
            </div>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                (macd?.histogram ?? 0) > 0
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-rose-500/20 text-rose-400'
              }`}
            >
              {(macd?.histogram ?? 0) > 0 ? 'BULLISH' : 'BEARISH'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center py-2">
            <div className="p-2 rounded-xl bg-slate-950 border border-slate-800/80">
              <span className="block text-[10px] text-slate-500 font-mono">MACD</span>
              <span className="text-xs font-mono font-bold text-blue-400">
                {macd ? macd.macd.toFixed(5) : '--'}
              </span>
            </div>
            <div className="p-2 rounded-xl bg-slate-950 border border-slate-800/80">
              <span className="block text-[10px] text-slate-500 font-mono">Signal</span>
              <span className="text-xs font-mono font-bold text-amber-400">
                {macd ? macd.signal.toFixed(5) : '--'}
              </span>
            </div>
            <div className="p-2 rounded-xl bg-slate-950 border border-slate-800/80">
              <span className="block text-[10px] text-slate-500 font-mono">Histogram</span>
              <span
                className={`text-xs font-mono font-bold ${
                  (macd?.histogram ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {macd ? macd.histogram.toFixed(5) : '--'}
              </span>
            </div>
          </div>

          <p className="text-[11px] text-slate-400">
            {isRTL
              ? 'تقاطع الماكد مع خط الإشارة يعطي تأكيداً لزخم الشمعة القادمة'
              : 'MACD line crossing signal denotes momentum acceleration'}
          </p>
        </div>

        {/* 3. Bollinger Bands */}
        <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4 hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gauge className="w-4 h-4 text-purple-400" />
              <h3 className="text-xs font-bold text-slate-200">Bollinger Bands (20, 2)</h3>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-500/20 text-purple-300">
              %B: {bollinger ? (bollinger.percentB * 100).toFixed(0) : '--'}%
            </span>
          </div>

          <div className="space-y-2 py-1">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">{isRTL ? 'الحد العلوي' : 'Upper Band'}:</span>
              <span className="font-mono text-emerald-400 font-bold">
                {bollinger ? bollinger.upper.toFixed(5) : '--'}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">{isRTL ? 'الخط الأوسط (SMA)' : 'Middle Band'}:</span>
              <span className="font-mono text-slate-200 font-bold">
                {bollinger ? bollinger.middle.toFixed(5) : '--'}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">{isRTL ? 'الحد السفلي' : 'Lower Band'}:</span>
              <span className="font-mono text-rose-400 font-bold">
                {bollinger ? bollinger.lower.toFixed(5) : '--'}
              </span>
            </div>
          </div>

          <div className="pt-1 text-[11px] text-slate-400 flex items-center justify-between">
            <span>{isRTL ? 'عرض النطاق (Bandwidth)' : 'Bandwidth'}:</span>
            <span className="font-mono text-slate-300">
              {bollinger ? bollinger.bandwidth.toFixed(4) : '--'}
            </span>
          </div>
        </div>

        {/* 4. ADX & Trend Strength */}
        <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4 hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-bold text-slate-200">ADX (14) Trend Strength</h3>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300">
              {adx?.trendStrength || 'ANALYZING'}
            </span>
          </div>

          <div className="text-center py-1">
            <span className="font-mono text-2xl font-black text-slate-100">
              {adx ? adx.adx.toFixed(1) : '--'}
            </span>
            <span className="text-[11px] text-slate-400 block mt-0.5">
              {adx && adx.adx >= 25 ? 'Strong Directional Movement' : 'Weak / Consolidation'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-center text-xs font-mono">
            <div className="p-2 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-emerald-400">
              <span>+DI: {adx ? adx.plusDI.toFixed(1) : '--'}</span>
            </div>
            <div className="p-2 rounded-xl bg-rose-950/30 border border-rose-500/30 text-rose-400">
              <span>-DI: {adx ? adx.minusDI.toFixed(1) : '--'}</span>
            </div>
          </div>
        </div>

        {/* 5. Stochastic Oscillator */}
        <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4 hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-bold text-slate-200">Stochastic (14, 3, 3)</h3>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300">
              K: {stoch ? stoch.k.toFixed(1) : '--'} | D: {stoch ? stoch.d.toFixed(1) : '--'}
            </span>
          </div>

          <div className="space-y-2 py-2">
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>%K Line:</span>
                <span className="font-mono text-cyan-400">{stoch ? stoch.k.toFixed(1) : '--'}</span>
              </div>
              <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden">
                <div className="h-full bg-cyan-400 rounded-full" style={{ width: `${Math.min(Math.max(stoch?.k ?? 50, 0), 100)}%` }} />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>%D Line:</span>
                <span className="font-mono text-amber-400">{stoch ? stoch.d.toFixed(1) : '--'}</span>
              </div>
              <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden">
                <div className="h-full bg-amber-400 rounded-full" style={{ width: `${Math.min(Math.max(stoch?.d ?? 50, 0), 100)}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* 6. Moving Averages Ribbon */}
        <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4 hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold text-slate-200">MA Alignment Ribbon</h3>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
              EMA 9 / 21 / 50
            </span>
          </div>

          <div className="space-y-2 py-1 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">EMA Fast (9):</span>
              <span className="font-mono text-slate-200 font-bold">
                {indicators?.emaFast ? indicators.emaFast.toFixed(5) : '--'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">EMA Slow (21):</span>
              <span className="font-mono text-slate-200 font-bold">
                {indicators?.emaSlow ? indicators.emaSlow.toFixed(5) : '--'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">SMA (50):</span>
              <span className="font-mono text-slate-200 font-bold">
                {indicators?.sma ? indicators.sma.toFixed(5) : '--'}
              </span>
            </div>
          </div>

          <div className="pt-1 text-[11px] text-slate-400">
            <span>ATR Volatility: </span>
            <span className="font-mono text-amber-400 font-bold">{atr ? atr.toFixed(5) : '--'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
