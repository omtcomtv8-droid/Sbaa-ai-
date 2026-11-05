import React from 'react';
import { MarketRegime } from '../types';
import { Compass, Flame, ShieldAlert, Waves, TrendingUp, TrendingDown } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

interface MarketRegimeCardProps {
  regime: MarketRegime;
  volatilityState?: 'HIGH' | 'NORMAL' | 'LOW';
  adx?: number | null;
  bandwidth?: number | null;
}

export const MarketRegimeCard: React.FC<MarketRegimeCardProps> = ({
  regime,
  volatilityState = 'NORMAL',
  adx,
  bandwidth,
}) => {
  const { t, tTerm } = useLanguage();

  const getRegimeDetails = (regime: MarketRegime) => {
    switch (regime) {
      case 'TRENDING_UP':
        return {
          title: t('regime.trendingUpTitle', 'Trending Up (Bullish)'),
          icon: <TrendingUp className="w-5 h-5 text-emerald-400" />,
          bgColor: 'bg-emerald-950/40 border-emerald-500/30',
          textColor: 'text-emerald-400',
          badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
          description: t(
            'regime.trendingUpDesc',
            'Fast EMA positioned cleanly above Slow EMA with confirmed Higher Highs & Higher Lows sequence.'
          ),
          strategyAdvice: t(
            'regime.trendingUpAdvice',
            'Trend-following strategies (EMA Trend, Pullbacks) favored. Mean-reversion counter-trend trades suppressed.'
          ),
        };
      case 'TRENDING_DOWN':
        return {
          title: t('regime.trendingDownTitle', 'Trending Down (Bearish)'),
          icon: <TrendingDown className="w-5 h-5 text-rose-400" />,
          bgColor: 'bg-rose-950/40 border-rose-500/30',
          textColor: 'text-rose-400',
          badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
          description: t(
            'regime.trendingDownDesc',
            'Fast EMA positioned cleanly below Slow EMA with confirmed Lower Highs & Lower Lows sequence.'
          ),
          strategyAdvice: t(
            'regime.trendingDownAdvice',
            'Trend-following strategies (EMA Trend, Bearish Pullbacks) favored. Counter-trend long trades suppressed.'
          ),
        };
      case 'RANGING':
        return {
          title: t('regime.rangingTitle', 'Range-Bound / Consolidating'),
          icon: <Waves className="w-5 h-5 text-cyan-400" />,
          bgColor: 'bg-cyan-950/40 border-cyan-500/30',
          textColor: 'text-cyan-400',
          badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
          description: t(
            'regime.rangingDesc',
            'Price oscillating within horizontal boundaries. ADX indicates low directional trend strength.'
          ),
          strategyAdvice: t(
            'regime.rangingAdvice',
            'Mean-reversion strategies (Bollinger Bounce, RSI Overbought/Oversold, S/R Boundaries) favored.'
          ),
        };
      case 'HIGH_VOLATILITY':
        return {
          title: t('regime.highVolTitle', 'High Volatility Regime'),
          icon: <Flame className="w-5 h-5 text-amber-400" />,
          bgColor: 'bg-amber-950/40 border-amber-500/30',
          textColor: 'text-amber-400',
          badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
          description: t(
            'regime.highVolDesc',
            'ATR expanding significantly above baseline. Sharp candle range expansion and elevated momentum.'
          ),
          strategyAdvice: t(
            'regime.highVolAdvice',
            'Strict confirmation required (3+ strategies). Higher noise tolerance; avoid tight mean-reversions.'
          ),
        };
      case 'LOW_VOLATILITY':
        return {
          title: t('regime.lowVolTitle', 'Low Volatility (Squeeze)'),
          icon: <ShieldAlert className="w-5 h-5 text-indigo-400" />,
          bgColor: 'bg-indigo-950/40 border-indigo-500/30',
          textColor: 'text-indigo-400',
          badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
          description: t(
            'regime.lowVolDesc',
            'Bollinger Bandwidth contracted tightly. Price coiling for an impending directional breakout.'
          ),
          strategyAdvice: t(
            'regime.lowVolAdvice',
            'Breakout Strategy monitoring active. Prepare for sharp volatility expansion upon candle close.'
          ),
        };
      default:
        return {
          title: t('regime.indecisionTitle', 'Market Indecision / Transition'),
          icon: <Compass className="w-5 h-5 text-slate-400" />,
          bgColor: 'bg-slate-900/60 border-slate-800',
          textColor: 'text-slate-300',
          badgeColor: 'bg-slate-800 text-slate-400 border-slate-700',
          description: t('regime.indecisionDesc', 'Indicators neutral or divergent. No single regime firmly established.'),
          strategyAdvice: t(
            'regime.indecisionAdvice',
            'Maintain WAIT defensive stance until multi-strategy directional consensus is achieved.'
          ),
        };
    }
  };

  const details = getRegimeDetails(regime);

  return (
    <div id="market-regime-card" className={`p-4 rounded-xl border ${details.bgColor} transition-all duration-200`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          {details.icon}
          <h3 className={`text-sm font-semibold tracking-wide ${details.textColor}`}>
            {details.title}
          </h3>
        </div>
        <div className="flex items-center space-x-2 text-xs">
          {typeof adx === 'number' && !isNaN(adx) && (
            <span className="px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700 text-slate-300 font-mono">
              ADX: {adx.toFixed(1)}
            </span>
          )}
          <span
            className={`px-2 py-0.5 rounded border text-[11px] font-mono font-medium ${
              volatilityState === 'HIGH'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                : volatilityState === 'LOW'
                ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            {tTerm('VOL') || 'VOL'}: {tTerm(volatilityState)}
          </span>
        </div>
      </div>

      <p className="text-xs text-slate-300 mb-2 leading-relaxed">{details.description}</p>

      <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 text-[11px] text-slate-300 flex items-start space-x-2">
        <span className="font-semibold text-amber-400 shrink-0">
          {t('regime.advice', 'Algorithmic Directive')}:
        </span>
        <span className="leading-snug">{details.strategyAdvice}</span>
      </div>
    </div>
  );
};
