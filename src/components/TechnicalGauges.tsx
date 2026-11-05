import React from 'react';
import { Compass, Gauge, Layers, Sparkles, TrendingDown, TrendingUp, Activity, BarChart2 } from 'lucide-react';
import { IndicatorMetrics, Candle } from '../types';
import { useLanguage } from '../i18n/LanguageContext';

interface TechnicalGaugesProps {
  indicators: IndicatorMetrics | null;
  candles: Candle[];
}

export const TechnicalGauges: React.FC<TechnicalGaugesProps> = ({ indicators, candles }) => {
  const { t, tTerm } = useLanguage();

  const rsi = indicators?.rsi ?? null;
  const emaFast = indicators?.emaFast ?? null;
  const emaSlow = indicators?.emaSlow ?? null;
  const bollinger = indicators?.bollinger ?? null;
  const pattern = indicators?.pattern ?? null;
  const adx = indicators?.adx ?? null;
  const atr = indicators?.atr ?? null;
  const macd = indicators?.macd ?? null;
  const volState = indicators?.volatilityState ?? 'NORMAL';

  const isEmaBullish = emaFast !== null && emaSlow !== null ? emaFast > emaSlow : null;

  return (
    <div id="technical-gauges" className="w-full bg-slate-900/60 rounded-xl border border-slate-800 p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Gauge className="w-4 h-4 text-blue-400" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            {t('gauges.title', 'Real Algorithmic Indicators')}
          </h2>
        </div>
        <span className="text-[11px] text-slate-500 font-medium">
          {candles.length} {t('gauges.barsAnalyzed', 'bars analyzed')}
        </span>
      </div>

      {/* 1. RSI (14) Wilder Smoothing Gauge */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-300 flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 text-slate-400" />
            {t('gauges.rsiTitle', 'RSI (14 Wilder)')}
          </span>
          <span className="font-mono font-bold text-slate-100">
            {typeof rsi === 'number' && !isNaN(rsi) ? rsi.toFixed(1) : t('gauges.calculating', 'Calculating...')}
          </span>
        </div>
        <div className="relative h-2.5 rounded-full bg-slate-800 overflow-hidden">
          {/* Overbought / Oversold zones */}
          <div className="absolute left-0 w-[30%] h-full bg-emerald-500/20" />
          <div className="absolute right-0 w-[30%] h-full bg-rose-500/20" />
          {/* Progress Pin */}
          {typeof rsi === 'number' && !isNaN(rsi) && (
            <div
              className={`absolute top-0 bottom-0 w-2.5 rounded-full transition-all duration-300 ${
                rsi <= 30
                  ? 'bg-emerald-400 shadow-sm shadow-emerald-400'
                  : rsi >= 70
                  ? 'bg-rose-400 shadow-sm shadow-rose-400'
                  : 'bg-blue-400'
              }`}
              style={{ left: `calc(${Math.min(97, Math.max(3, rsi))}% - 5px)` }}
            />
          )}
        </div>
        <div className="flex justify-between text-[10px] text-slate-500 font-mono">
          <span>{t('gauges.oversold', 'Oversold (≤30)')}</span>
          <span>50</span>
          <span>{t('gauges.overbought', 'Overbought (≥70)')}</span>
        </div>
      </div>

      {/* 2. ADX (14) & Trend Strength */}
      <div className="space-y-1.5 pt-2 border-t border-slate-800">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-300 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-slate-400" />
            {t('gauges.adxTrendStrength', 'ADX Trend Strength')}
          </span>
          <span className="font-mono text-xs">
            {adx ? (
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  adx.trendStrength === 'TRENDING'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {tTerm(adx.trendStrength)} ({typeof adx.adx === 'number' ? adx.adx.toFixed(1) : '—'})
              </span>
            ) : (
              <span className="text-slate-500">{t('gauges.calculating', 'Calculating...')}</span>
            )}
          </span>
        </div>
        {adx && (
          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
            <div className="p-1.5 rounded bg-slate-950/60 border border-slate-800 flex justify-between">
              <span className="text-slate-400">+DI:</span>
              <span className="text-emerald-400 font-semibold">{typeof adx.plusDI === 'number' ? adx.plusDI.toFixed(1) : '—'}</span>
            </div>
            <div className="p-1.5 rounded bg-slate-950/60 border border-slate-800 flex justify-between">
              <span className="text-slate-400">-DI:</span>
              <span className="text-rose-400 font-semibold">{typeof adx.minusDI === 'number' ? adx.minusDI.toFixed(1) : '—'}</span>
            </div>
          </div>
        )}
      </div>

      {/* 3. EMA Trend Ribbon */}
      <div className="space-y-1.5 pt-2 border-t border-slate-800">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-300 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            {t('gauges.emaRibbon', 'EMA 9 / 21 Trend')}
          </span>
          {isEmaBullish !== null ? (
            <span
              className={`flex items-center gap-1 font-bold text-xs ${
                isEmaBullish ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {isEmaBullish ? (
                <>
                  <TrendingUp className="w-3.5 h-3.5" /> {tTerm('BULLISH')} (9 &gt; 21)
                </>
              ) : (
                <>
                  <TrendingDown className="w-3.5 h-3.5" /> {tTerm('BEARISH')} (9 &lt; 21)
                </>
              )}
            </span>
          ) : (
            <span className="text-[11px] font-mono text-slate-500">
              {tTerm('WAIT')} ({t('direction.waitingFeed', 'DATA_NOT_READY')})
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
          <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800">
            <span className="text-[10px] text-slate-500 block font-sans">{t('gauges.fastEma', 'Fast EMA 9')}</span>
            <span className="font-semibold text-slate-200">
              {typeof emaFast === 'number' && !isNaN(emaFast) ? emaFast.toFixed(5) : '—'}
            </span>
          </div>
          <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800">
            <span className="text-[10px] text-slate-500 block font-sans">{t('gauges.slowEma', 'Slow EMA 21')}</span>
            <span className="font-semibold text-slate-200">
              {typeof emaSlow === 'number' && !isNaN(emaSlow) ? emaSlow.toFixed(5) : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* 4. MACD & ATR */}
      <div className="space-y-1.5 pt-2 border-t border-slate-800">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-300 flex items-center gap-1.5">
            <BarChart2 className="w-3.5 h-3.5 text-slate-400" />
            {t('gauges.macdAndAtr', 'MACD & ATR Volatility')}
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
            ATR: {typeof atr === 'number' && !isNaN(atr) ? atr.toFixed(5) : '—'} ({tTerm(volState)})
          </span>
        </div>
        {macd ? (
          <div className="grid grid-cols-3 gap-1.5 text-[11px] font-mono text-center">
            <div className="p-1.5 rounded bg-slate-950/60 border border-slate-800">
              <span className="text-[9px] text-slate-500 block font-sans">MACD</span>
              <span className="text-slate-300">{typeof macd.macd === 'number' ? macd.macd.toFixed(5) : '—'}</span>
            </div>
            <div className="p-1.5 rounded bg-slate-950/60 border border-slate-800">
              <span className="text-[9px] text-slate-500 block font-sans">{t('gauges.signal', 'Signal')}</span>
              <span className="text-slate-300">{typeof macd.signal === 'number' ? macd.signal.toFixed(5) : '—'}</span>
            </div>
            <div className="p-1.5 rounded bg-slate-950/60 border border-slate-800">
              <span className="text-[9px] text-slate-500 block font-sans">{t('gauges.histogram', 'Histogram')}</span>
              <span
                className={
                  macd.histogram >= 0 ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'
                }
              >
                {typeof macd.histogram === 'number' ? macd.histogram.toFixed(5) : '—'}
              </span>
            </div>
          </div>
        ) : (
          <div className="p-2 rounded bg-slate-950/60 border border-slate-800 text-[11px] text-slate-500 font-mono text-center">
            {t('gauges.collectingData', 'Status: Collecting Data')} ({indicators?.closedCandlesCount ?? candles.length} / 50 {tTerm('Candles')})
          </div>
        )}
      </div>

      {/* 5. Bollinger Bands & %B */}
      <div className="space-y-1.5 pt-2 border-t border-slate-800">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-300">{t('gauges.bollingerBands', 'Bollinger Bands (20, 2)')}</span>
          <span className="font-mono text-slate-400 text-[11px]">
            {bollinger && typeof bollinger.percentB === 'number' ? `%B: ${(bollinger.percentB * 100).toFixed(0)}%` : '—'}
          </span>
        </div>
        {bollinger ? (
          <div className="grid grid-cols-3 gap-1.5 text-[11px] font-mono text-center">
            <div className="p-1.5 rounded bg-slate-950/60 border border-slate-800">
              <span className="text-[9px] text-slate-500 block font-sans">{t('gauges.lower', 'Lower')}</span>
              <span className="text-slate-300">{typeof bollinger.lower === 'number' ? bollinger.lower.toFixed(5) : '—'}</span>
            </div>
            <div className="p-1.5 rounded bg-slate-950/60 border border-slate-800">
              <span className="text-[9px] text-slate-500 block font-sans">{t('gauges.middle', 'Middle')}</span>
              <span className="text-slate-300">{typeof bollinger.middle === 'number' ? bollinger.middle.toFixed(5) : '—'}</span>
            </div>
            <div className="p-1.5 rounded bg-slate-950/60 border border-slate-800">
              <span className="text-[9px] text-slate-500 block font-sans">{t('gauges.upper', 'Upper')}</span>
              <span className="text-slate-300">{typeof bollinger.upper === 'number' ? bollinger.upper.toFixed(5) : '—'}</span>
            </div>
          </div>
        ) : (
          <div className="p-2 rounded bg-slate-950/60 border border-slate-800 text-[11px] text-slate-500 font-mono text-center">
            {t('gauges.collectingData', 'Status: Collecting Data')} ({indicators?.closedCandlesCount ?? candles.length} / 50 {tTerm('Candles')})
          </div>
        )}
      </div>

      {/* 6. Candlestick Pattern Card */}
      <div className="pt-2 border-t border-slate-800">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="font-semibold text-slate-300 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            {t('gauges.patternCard', 'Detected Candlestick Pattern')}
          </span>
        </div>
        <div className="px-3 py-2 rounded-lg bg-slate-950/60 border border-slate-800 text-xs text-slate-200 flex items-center justify-between">
          <span className="font-semibold">{pattern ? tTerm(pattern.name) : tTerm('No Pattern')}</span>
          {pattern && (
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                pattern.bias === 'BULLISH'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : pattern.bias === 'BEARISH'
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {tTerm(pattern.bias)} ({'★'.repeat(pattern.strength)})
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
