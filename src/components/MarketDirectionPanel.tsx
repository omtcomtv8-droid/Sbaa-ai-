import React from 'react';
import { Compass, TrendingUp, TrendingDown, Minus, Clock, ShieldCheck, Activity, Layers, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Candle, SupportResistanceLevel } from '../types';
import { useLanguage } from '../i18n/LanguageContext';

export interface MarketDirectionPanelProps {
  marketDirection: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'WAIT';
  trendValue?: number | string | null;
  momentumValue?: number | string | null;
  structureValue?: string | null;
  volatilityValue?: string | null;
  atrValue?: number | null;
  supportLevel?: number | null;
  resistanceLevel?: number | null;
  lastCandle?: Candle | null;
  dataFreshnessMs?: number;
  source?: string;
  asset?: string;
  timeframe?: number;
  digits?: number;
}

export const MarketDirectionPanel: React.FC<MarketDirectionPanelProps> = ({
  marketDirection = 'WAIT',
  trendValue,
  momentumValue,
  structureValue,
  volatilityValue,
  atrValue,
  supportLevel,
  resistanceLevel,
  lastCandle,
  dataFreshnessMs = 0,
  source = 'Pocket Option OTC Feed',
  asset = 'EURUSD_otc',
  timeframe = 60,
  digits = 5,
}) => {
  const { t, tTerm, tDynamic } = useLanguage();
  const isBull = marketDirection === 'BULLISH';
  const isBear = marketDirection === 'BEARISH';
  const isNeutral = marketDirection === 'NEUTRAL';
  const isWait = marketDirection === 'WAIT';

  const badgeConfig = isBull
    ? {
        border: 'border-emerald-500/50',
        bg: 'bg-emerald-950/20',
        text: 'text-emerald-400',
        badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
        icon: <TrendingUp className="w-5 h-5 text-emerald-400" />,
        label: t('direction.bullishBias', 'BULLISH MARKET BIAS'),
      }
    : isBear
    ? {
        border: 'border-rose-500/50',
        bg: 'bg-rose-950/20',
        text: 'text-rose-400',
        badgeBg: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
        icon: <TrendingDown className="w-5 h-5 text-rose-400" />,
        label: t('direction.bearishBias', 'BEARISH MARKET BIAS'),
      }
    : isNeutral
    ? {
        border: 'border-cyan-500/40',
        bg: 'bg-cyan-950/20',
        text: 'text-cyan-400',
        badgeBg: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
        icon: <Minus className="w-5 h-5 text-cyan-400" />,
        label: t('direction.neutralRanging', 'NEUTRAL / RANGING'),
      }
    : {
        border: 'border-amber-500/40',
        bg: 'bg-amber-950/20',
        text: 'text-amber-400',
        badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        icon: <Compass className="w-5 h-5 text-amber-400 animate-pulse" />,
        label: t('direction.waitForEvidence', 'WAIT FOR EVIDENCE'),
      };

  return (
    <div
      id="market-direction-panel"
      className={`rounded-2xl border p-4 transition-all duration-200 ${badgeConfig.border} ${badgeConfig.bg} bg-slate-900/90 shadow-lg`}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          {badgeConfig.icon}
          <div>
            <div className="text-[10px] font-mono uppercase font-bold tracking-wider text-slate-400">
              {t('direction.authoritativeTitle', 'Authoritative Market Direction')}
            </div>
            <div className={`text-base font-black font-mono tracking-tight ${badgeConfig.text}`}>
              {badgeConfig.label}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap text-[11px] font-mono">
          <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 font-bold">
            {asset} • {timeframe}s
          </span>
          <span
            className={`px-2 py-0.5 rounded border font-bold ${
              dataFreshnessMs < 3000
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : dataFreshnessMs < 8000
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
            }`}
          >
            {t('direction.freshness', 'Freshness')}: {(dataFreshnessMs / 1000).toFixed(1)}s
          </span>
          <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-cyan-300">
            {t('direction.source', 'Source')}: {tTerm(source)}
          </span>
        </div>
      </div>

      {/* Grid of Real Calculated Components */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-3 text-xs font-mono">
        {/* Trend */}
        <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">{t('direction.trend', 'Trend')}</span>
          <span className="text-sm font-bold text-slate-200">
            {trendValue !== null && trendValue !== undefined ? tDynamic(String(trendValue)) : t('direction.calculating', 'Calculating...')}
          </span>
        </div>

        {/* Momentum */}
        <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">{t('direction.momentum', 'Momentum')}</span>
          <span className="text-sm font-bold text-slate-200">
            {momentumValue !== null && momentumValue !== undefined ? tDynamic(String(momentumValue)) : t('direction.calculating', 'Calculating...')}
          </span>
        </div>

        {/* Market Structure */}
        <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">{t('direction.structure', 'Structure')}</span>
          <span className="text-xs font-semibold text-slate-200 truncate block">
            {structureValue ? tDynamic(structureValue) : t('direction.accumulatingSwings', 'Accumulating Swings')}
          </span>
        </div>

        {/* Volatility */}
        <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">{t('direction.volatility', 'Volatility')}</span>
          <span className="text-sm font-bold text-slate-200">
            {tTerm(volatilityValue || 'NORMAL')} {atrValue ? `(ATR: ${atrValue})` : ''}
          </span>
        </div>
      </div>

      {/* Support & Resistance + Last OHLC Candle */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800/80 text-xs font-mono">
        {/* Key S/R Levels */}
        <div className="p-2.5 rounded-xl bg-slate-950/50 border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">{t('direction.supportS1', 'Support (S1)')}</span>
            <span className="text-sm font-bold text-emerald-400">
              {typeof supportLevel === 'number' && !isNaN(supportLevel) ? supportLevel.toFixed(digits) : t('direction.awaitingPivot', 'Awaiting Pivot')}
            </span>
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">{t('direction.resistanceR1', 'Resistance (R1)')}</span>
            <span className="text-sm font-bold text-rose-400">
              {typeof resistanceLevel === 'number' && !isNaN(resistanceLevel) ? resistanceLevel.toFixed(digits) : t('direction.awaitingPivot', 'Awaiting Pivot')}
            </span>
          </div>
        </div>

        {/* Last Confirmed Candle OHLC */}
        <div className="p-2.5 rounded-xl bg-slate-950/50 border border-slate-800">
          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
            {t('direction.lastCandle', 'Last Candle (OHLC)')} • {lastCandle ? (lastCandle.isClosed ? t('direction.confirmed', 'Confirmed') : t('direction.forming', 'Forming')) : 'N/A'}
          </span>
          {lastCandle ? (
            <div className="grid grid-cols-4 gap-1 text-[11px] text-slate-300">
              <div>O: <span className="text-slate-100 font-bold">{typeof lastCandle.open === 'number' ? lastCandle.open.toFixed(digits) : '—'}</span></div>
              <div>H: <span className="text-emerald-400 font-bold">{typeof lastCandle.high === 'number' ? lastCandle.high.toFixed(digits) : '—'}</span></div>
              <div>L: <span className="text-rose-400 font-bold">{typeof lastCandle.low === 'number' ? lastCandle.low.toFixed(digits) : '—'}</span></div>
              <div>C: <span className="text-cyan-300 font-bold">{typeof lastCandle.close === 'number' ? lastCandle.close.toFixed(digits) : '—'}</span></div>
            </div>
          ) : (
            <div className="text-[11px] text-slate-500">{t('direction.waitingFeed', 'Waiting for candle feed...')}</div>
          )}
        </div>
      </div>
    </div>
  );
};
