import React, { useState, useMemo } from 'react';
import {
  Activity,
  Check,
  CheckCircle2,
  ChevronDown,
  Filter,
  Layers,
  Power,
  Search,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  TrendingDown,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';
import { IndicatorMetrics, Signal, StrategyResult, StrategySettings } from '../types';
import { AiApiKeySection } from './AiApiKeySection';
import { useLanguage } from '../i18n/LanguageContext';

interface StrategiesViewProps {
  strategies?: StrategyResult[];
  settings?: StrategySettings;
  activeAsset: string;
  timeframe: number;
  currentPrice: number | null;
  selectedStrategy?: string;
  indicators?: IndicatorMetrics | null;
  activeSignal?: Signal | null;
  onSelectStrategy: (strategyId: string) => void;
  onToggleStrategy?: (strategyId: string, enabled: boolean) => void;
  onUpdateSettings?: (newSettings: StrategySettings) => Promise<void>;
}

// Full catalogue of institutional strategies matching Section 25 & 26
interface StrategyMeta {
  id: string;
  name: string;
  category: 'Trend' | 'Momentum' | 'Volatility' | 'Structure' | 'Oscillator' | 'Multi-Timeframe' | 'Price Action';
  description: string;
  defaultConfigKey?: keyof StrategySettings;
}

const STRATEGY_CATALOG: StrategyMeta[] = [
  {
    id: 'ema_trend',
    name: 'EMA Crossover & Trend',
    category: 'Trend',
    description: 'Fast exponential moving average crossover with 50 SMA baseline filter',
    defaultConfigKey: 'emaTrend',
  },
  {
    id: 'sma_crossover',
    name: 'SMA Crossover',
    category: 'Trend',
    description: 'Golden/Death cross using classical 20 & 50 period simple moving averages',
  },
  {
    id: 'ma_alignment',
    name: 'Moving Average Alignment',
    category: 'Trend',
    description: 'Multi-layer ribbon stacked in perfect numerical ascending/descending order',
  },
  {
    id: 'rsi_momentum',
    name: 'RSI Momentum',
    category: 'Momentum',
    description: 'Relative strength index expansion above 50 with directional velocity',
    defaultConfigKey: 'rsiMomentum',
  },
  {
    id: 'rsi_reversal',
    name: 'RSI Reversal & Reversion',
    category: 'Oscillator',
    description: 'Extreme exhaustion mean reversion from overbought (>70) and oversold (<30)',
  },
  {
    id: 'macd',
    name: 'MACD Crossover',
    category: 'Momentum',
    description: 'Fast MACD line crossing Signal line with zero-line confirmation',
    defaultConfigKey: 'macd',
  },
  {
    id: 'bollinger_bounce',
    name: 'Bollinger Mean Reversion',
    category: 'Volatility',
    description: 'Statistical 2-sigma band containment bounce back towards central SMA 20',
    defaultConfigKey: 'bollingerBounce',
  },
  {
    id: 'stochastic',
    name: 'Stochastic Oscillator',
    category: 'Oscillator',
    description: '%K and %D lines crossing inside extreme 20/80 boundaries',
  },
  {
    id: 'cci',
    name: 'CCI Trend Oscillator',
    category: 'Oscillator',
    description: 'Commodity Channel Index measuring deviation from statistical mean',
  },
  {
    id: 'adx_trend',
    name: 'ADX Trend Strength',
    category: 'Trend',
    description: 'Average Directional Index (>25) verifying true directional trend persistence',
  },
  {
    id: 'parabolic_sar',
    name: 'Parabolic SAR Acceleration',
    category: 'Trend',
    description: 'Stop-and-reverse price trailing dots indicating momentum continuation',
  },
  {
    id: 'ichimoku',
    name: 'Ichimoku Cloud Tenkan/Kijun',
    category: 'Trend',
    description: 'Tenkan-sen crossing Kijun-sen with cloud (Kumo) thickness confirmation',
  },
  {
    id: 'candlestick',
    name: 'Candlestick Patterns',
    category: 'Price Action',
    description: 'High-probability candlestick formations (Engulfing, Pinbars, Morning Stars)',
    defaultConfigKey: 'candlestick',
  },
  {
    id: 'support_resistance',
    name: 'Support & Resistance Zones',
    category: 'Structure',
    description: 'Clustered horizontal liquidity levels derived from multi-swing highs and lows',
    defaultConfigKey: 'supportResistance',
  },
  {
    id: 'breakout',
    name: 'ATR Volatility Breakout',
    category: 'Volatility',
    description: 'Price expansion beyond 20-candle channel with ATR volume expansion',
    defaultConfigKey: 'breakout',
  },
  {
    id: 'market_structure',
    name: 'Market Structure & Swings',
    category: 'Structure',
    description: 'Higher Highs (HH) / Higher Lows (HL) vs Lower Highs (LH) / Lower Lows (LL)',
    defaultConfigKey: 'marketStructure',
  },
  {
    id: 'pivot_point',
    name: 'Pivot Points (Classic Floor)',
    category: 'Structure',
    description: 'Daily/intraday floor trader pivot levels with support and resistance bands',
  },
  {
    id: 'fibonacci',
    name: 'Fibonacci Retracement (61.8%)',
    category: 'Structure',
    description: 'Golden ratio 50% and 61.8% pullback containment across recent swing range',
  },
  {
    id: 'price_action',
    name: 'Institutional Price Action',
    category: 'Price Action',
    description: 'Order block detection, liquidity sweep rejection, and fair value gap fills',
  },
  {
    id: 'atr_volatility',
    name: 'ATR Volatility Expansion',
    category: 'Volatility',
    description: 'Dynamic volatility filtering against excessive consolidation or erratic spreads',
  },
  {
    id: 'gann_price_time',
    name: 'W.D. Gann Price/Time Analysis',
    category: 'Structure',
    description: 'Calculates Gann 8ths, 1x1 geometric angles, and price/time harmonic squaring from real swings',
    defaultConfigKey: 'gannPriceTime',
  },
  {
    id: 'elliott_wave',
    name: 'Ralph Nelson Elliott Wave',
    category: 'Structure',
    description: 'Validates 5-wave impulse and ABC corrective structures with strict Wave 2-4 rule compliance',
    defaultConfigKey: 'elliottWave',
  },
  {
    id: 'darvas_box',
    name: 'Nicolas Darvas Box Strategy',
    category: 'Price Action',
    description: 'Constructs real 3-candle consolidation boxes and detects genuine candle-close breakouts',
    defaultConfigKey: 'darvasBox',
  },
  {
    id: 'multi_confluence',
    name: 'Multi-Timeframe Confluence',
    category: 'Multi-Timeframe',
    description: 'Aggregated synthetic consensus verifying trend agreement across timeframes',
    defaultConfigKey: 'multiConfluence',
  },
];

export const StrategiesView: React.FC<StrategiesViewProps> = ({
  strategies = [],
  settings,
  activeAsset,
  timeframe,
  currentPrice,
  selectedStrategy = 'confluence',
  indicators,
  activeSignal,
  onSelectStrategy,
  onToggleStrategy,
  onUpdateSettings,
}) => {
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [filterDirection, setFilterDirection] = useState<'ALL' | 'UP' | 'DOWN' | 'WAIT'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [settingsModalStrat, setSettingsModalStrat] = useState<StrategyMeta | null>(null);
  const [modalFormValues, setModalFormValues] = useState<Record<string, any>>({});
  const [savingSettings, setSavingSettings] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const { t, tTerm, tDynamic, isRTL } = useLanguage();

  // Map of active strategies by ID
  const strategyMap = useMemo(() => {
    const map = new Map<string, StrategyResult>();
    for (const s of strategies) {
      map.set(s.strategyId, s);
      map.set(s.strategyId.replace(/_/g, ''), s);
    }
    return map;
  }, [strategies]);

  // Filtered strategy list
  const filteredCatalog = useMemo(() => {
    return STRATEGY_CATALOG.filter((item) => {
      // Category filter
      if (filterCategory !== 'ALL' && item.category !== filterCategory) return false;

      // Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchName = item.name.toLowerCase().includes(query);
        const matchDesc = item.description.toLowerCase().includes(query);
        const matchCat = item.category.toLowerCase().includes(query);
        if (!matchName && !matchDesc && !matchCat) return false;
      }

      // Direction filter
      if (filterDirection !== 'ALL') {
        const res = strategyMap.get(item.id) || strategyMap.get(item.id.replace(/_/g, ''));
        const dir = res?.signal || 'WAIT';
        if (dir !== filterDirection) return false;
      }

      return true;
    });
  }, [filterCategory, filterDirection, searchQuery, strategyMap]);

  // Active count
  const upCount = strategies.filter((s) => s.signal === 'UP').length;
  const downCount = strategies.filter((s) => s.signal === 'DOWN').length;
  const waitCount = strategies.filter((s) => s.signal === 'WAIT' || !s.signal).length;

  const handleOpenSettings = (meta: StrategyMeta) => {
    setSettingsModalStrat(meta);
    if (meta.defaultConfigKey && settings && (settings as any)[meta.defaultConfigKey]) {
      setModalFormValues({ ...(settings as any)[meta.defaultConfigKey] });
    } else {
      setModalFormValues({ weight: 1.2, enabled: true });
    }
    setSaveSuccess(false);
  };

  const handleSaveModalSettings = async () => {
    if (!settingsModalStrat || !onUpdateSettings || !settings) return;
    setSavingSettings(true);
    try {
      const updated: any = { ...settings };
      if (settingsModalStrat.defaultConfigKey) {
        updated[settingsModalStrat.defaultConfigKey] = {
          ...(updated[settingsModalStrat.defaultConfigKey] || {}),
          ...modalFormValues,
        };
      }
      await onUpdateSettings(updated);
      setSaveSuccess(true);
      setTimeout(() => {
        setSettingsModalStrat(null);
        setSaveSuccess(false);
      }, 1000);
    } catch (e) {
      console.error('Failed to save strategy settings', e);
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div id="strategies-view" className="space-y-6">
      {/* 1. Header Banner & Confluence Engine Selector */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/95 to-slate-900 border border-slate-800 shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-400" />
              <h1 className="text-xl font-black tracking-tight text-white uppercase">
                {t('strategiesView.title', 'Institutional Strategy Engine')}
              </h1>
              <span className="px-2 py-0.5 text-xs font-mono font-bold rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                {t('strategiesView.badge', '21 Real Strategies')}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              {t(
                'strategiesView.description',
                'Deterministic quantitative models running continuously on real Pocket Option tick and candle streams. Zero simulation, zero mock indicators.'
              )}
            </p>
          </div>

          {/* Master Strategy Execution Mode Selector */}
          <div className="flex flex-wrap items-center gap-2 bg-slate-950 p-2 rounded-xl border border-slate-800">
            <button
              onClick={() => onSelectStrategy('confluence')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selectedStrategy === 'confluence'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700/50'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{tTerm('Multi-Strategy Confluence')}</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-950/40 text-amber-200">
                {t('strategiesView.recommended', 'Recommended')}
              </span>
            </button>

            <div className="text-[11px] font-mono text-slate-400 px-1 hidden sm:block">
              {t('strategiesView.mode', 'Mode')}: <strong className="text-white">{selectedStrategy === 'confluence' ? t('strategiesView.consensus', 'Consensus (21)') : selectedStrategy.toUpperCase()}</strong>
            </div>
          </div>
        </div>

        {/* Aggregate Real-Time Score Pulse */}
        <div className="mt-4 pt-4 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-400">{t('strategiesView.bullishConsensus', 'Bullish Consensus')}</div>
              <div className="text-xl font-black font-mono text-emerald-400">{upCount} {tTerm('UP')}</div>
            </div>
            <TrendingUp className="w-6 h-6 text-emerald-500/60" />
          </div>

          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-400">{t('strategiesView.bearishConsensus', 'Bearish Consensus')}</div>
              <div className="text-xl font-black font-mono text-rose-400">{downCount} {tTerm('DOWN')}</div>
            </div>
            <TrendingDown className="w-6 h-6 text-rose-500/60" />
          </div>

          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-400">{t('strategiesView.neutralConsolidating', 'Neutral / Consolidating')}</div>
              <div className="text-xl font-black font-mono text-amber-400">{waitCount} {tTerm('WAIT')}</div>
            </div>
            <Activity className="w-6 h-6 text-amber-500/60" />
          </div>

          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-400">{t('strategiesView.streamAsset', 'Stream Asset')}</div>
              <div className="text-sm font-black font-mono text-white truncate">{activeAsset} ({timeframe}s)</div>
            </div>
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          </div>
        </div>
      </div>

      {/* 2. Filter & Search Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
        {/* Category Chips */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {['ALL', 'Trend', 'Momentum', 'Oscillator', 'Volatility', 'Structure', 'Price Action'].map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                filterCategory === cat
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                  : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700'
              }`}
            >
              {tTerm(cat)}
            </button>
          ))}
        </div>

        {/* Direction Filter & Search */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => setFilterDirection('ALL')}
              className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                filterDirection === 'ALL' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              {tTerm('ALL')}
            </button>
            <button
              onClick={() => setFilterDirection('UP')}
              className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                filterDirection === 'UP' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'text-slate-400 hover:text-emerald-400'
              }`}
            >
              {tTerm('UP')}
            </button>
            <button
              onClick={() => setFilterDirection('DOWN')}
              className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                filterDirection === 'DOWN' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40' : 'text-slate-400 hover:text-rose-400'
              }`}
            >
              {tTerm('DOWN')}
            </button>
          </div>

          <div className="relative flex-1 sm:w-56">
            <Search className={`w-3.5 h-3.5 text-slate-400 absolute ${isRTL ? 'right-2.5' : 'left-2.5'} top-1/2 -translate-y-1/2`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('strategiesView.searchPlaceholder', 'Search strategy...')}
              className={`w-full ${isRTL ? 'pr-8 pl-3' : 'pl-8 pr-3'} py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60`}
            />
          </div>
        </div>
      </div>

      {/* 3. Real Strategy Cards Grid (Section 26) - Fluid Adaptive Scaling */}
      <div className="adaptive-strategy-grid">
        {filteredCatalog.map((meta) => {
          const res = strategyMap.get(meta.id) || strategyMap.get(meta.id.replace(/_/g, ''));
          const isSelected = selectedStrategy === meta.id;
          const signalDir = res?.signal || 'WAIT';
          const isUp = signalDir === 'UP';
          const isDown = signalDir === 'DOWN';
          const isWait = signalDir === 'WAIT';

          const isReady = res?.status === 'READY' && res?.dataValid;
          const bullishScore = res?.bullishScore ?? null;
          const bearishScore = res?.bearishScore ?? null;
          const reasons = res?.reasons && res.reasons.length > 0 ? res.reasons : [meta.description];
          const conditions = res?.conditions || [];
          const evidence = res?.evidence || [];

          // Derive relevant live indicator values for this specific strategy
          const getMetricsPreview = () => {
            if (meta.id === 'ema_trend' && indicators) {
              return [
                { label: 'Fast EMA', val: indicators.emaFast ? indicators.emaFast.toFixed(5) : '—' },
                { label: 'Slow EMA', val: indicators.emaSlow ? indicators.emaSlow.toFixed(5) : '—' },
              ];
            }
            if ((meta.id === 'rsi_momentum' || meta.id === 'rsi_reversal') && indicators) {
              return [
                { label: 'RSI (14)', val: indicators.rsi ? indicators.rsi.toFixed(1) : '—' },
                { label: 'Threshold', val: '70 / 30' },
              ];
            }
            if (meta.id === 'macd' && indicators?.macd) {
              return [
                { label: 'MACD', val: indicators.macd.macd.toFixed(5) },
                { label: 'Signal', val: indicators.macd.signal.toFixed(5) },
              ];
            }
            if (meta.id === 'bollinger_bounce' && indicators?.bollinger) {
              return [
                { label: 'Upper Band', val: indicators.bollinger.upper.toFixed(5) },
                { label: 'Lower Band', val: indicators.bollinger.lower.toFixed(5) },
              ];
            }
            if (meta.id === 'stochastic' && indicators?.stochastic) {
              return [
                { label: '%K', val: indicators.stochastic.k.toFixed(1) },
                { label: '%D', val: indicators.stochastic.d.toFixed(1) },
              ];
            }
            if (meta.id === 'adx_trend' && indicators?.adx) {
              return [
                { label: 'ADX', val: indicators.adx.adx.toFixed(1) },
                { label: '+DI / -DI', val: `${indicators.adx.plusDI.toFixed(0)} / ${indicators.adx.minusDI.toFixed(0)}` },
              ];
            }
            if (meta.id === 'atr_volatility' && indicators?.atr) {
              return [
                { label: 'ATR (14)', val: indicators.atr.toFixed(5) },
                { label: 'Regime', val: indicators.volatilityState },
              ];
            }
            if (meta.id === 'gann_price_time') {
              const gd = res?.gannData || activeSignal?.gannData;
              const anchorPrice = gd?.anchorHigh?.price ?? gd?.angles?.[0]?.anchorPrice ?? (gd as any)?.anchorPrice;
              return [
                { label: 'Trend / Time Square', val: gd ? `${gd.dominantTrend} (${gd.isPriceTimeSquared ? 'Squared' : ((gd as any).timeSquareStatus || 'Active')})` : 'Awaiting data' },
                { label: 'Gann Anchor / 1x1 Angle', val: gd && typeof anchorPrice === 'number' ? `${anchorPrice.toFixed(4)} (Bars: ${gd.elapsedBars ?? 0})` : '—' },
              ];
            }
            if (meta.id === 'elliott_wave') {
              const ed = res?.elliottData || activeSignal?.elliottData;
              return [
                { label: 'Wave Pos / Status', val: ed ? `W${ed.currentWave ?? '—'} (${ed.structureStatus || 'Forming'})` : 'Awaiting data' },
                { label: 'Wave Confidence', val: ed ? `${ed.confidenceScore ?? 0}% (${ed.dominantTrend || '—'})` : '—' },
              ];
            }
            if (meta.id === 'darvas_box') {
              const dd = res?.darvasData || activeSignal?.darvasData;
              return [
                { label: 'Active Box', val: dd?.activeBox && typeof dd.activeBox.lower === 'number' && typeof dd.activeBox.upper === 'number' ? `${dd.activeBox.lower.toFixed(4)} - ${dd.activeBox.upper.toFixed(4)}` : 'Forming' },
                { label: 'Breakout / Bars', val: dd?.activeBox ? `${dd.activeBox.breakoutStatus || 'INSIDE'} (${dd.activeBox.candlesInside ?? (dd.activeBox as any).candleCount ?? 0} bars)` : '—' },
              ];
            }
            return [
              { label: 'Timeframe', val: `${timeframe}s` },
              { label: 'Current Price', val: currentPrice ? currentPrice.toFixed(5) : '—' },
            ];
          };

          const metrics = getMetricsPreview();

          return (
            <div
              key={meta.id}
              className={`rounded-2xl border transition-all duration-200 flex flex-col justify-between overflow-hidden bg-slate-900/90 ${
                isSelected
                  ? 'border-amber-500/80 shadow-[0_0_25px_rgba(245,158,11,0.2)] ring-1 ring-amber-500/40'
                  : isUp
                  ? 'border-emerald-500/40 shadow-sm'
                  : isDown
                  ? 'border-rose-500/40 shadow-sm'
                  : 'border-slate-800'
              }`}
            >
              {/* Card Header */}
              <div className="p-4 border-b border-slate-800/80">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded bg-slate-800 text-slate-300 border border-slate-700">
                        {tTerm(meta.category)}
                      </span>
                      {isSelected && (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          ⭐ {t('strategies.primaryDriver', 'PRIMARY DRIVER')}
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-bold text-white mt-1.5 uppercase tracking-wide">
                      {tTerm(meta.name)}
                    </h3>
                  </div>

                  <div className="flex flex-col items-end gap-1 text-[11px] font-mono">
                    <div className="flex items-center gap-1">
                      <span className={`w-2 h-2 rounded-full ${res?.qualified ? 'bg-emerald-400 animate-pulse' : isReady ? 'bg-amber-400' : 'bg-slate-500'}`} />
                      <span className={`font-bold ${res?.qualified ? 'text-emerald-400' : isReady ? 'text-amber-400' : 'text-slate-400'}`}>
                        {res?.qualified ? tTerm('CONFIRMED') : (res?.status === 'INSUFFICIENT_DATA' ? tTerm('Insufficient candles') : tTerm('WAIT'))}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500">
                      {res?.symbol || activeAsset} • {timeframe}s
                    </span>
                  </div>
                </div>
              </div>

              {/* Direction & Bullish/Bearish Score Gauges (Section 26) */}
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">{t('strategies.direction', 'Current Direction')}:</span>
                  <div className="flex items-center gap-1.5">
                    {res?.qualified && isUp && (
                      <span className="px-3 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-black font-mono text-sm flex items-center gap-1">
                        <TrendingUp className="w-3.5 h-3.5" />
                        {tTerm('UP')}
                      </span>
                    )}
                    {res?.qualified && isDown && (
                      <span className="px-3 py-1 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-400 font-black font-mono text-sm flex items-center gap-1">
                        <TrendingDown className="w-3.5 h-3.5" />
                        {tTerm('DOWN')}
                      </span>
                    )}
                    {(!res?.qualified || isWait) && (
                      <span className="px-3 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 font-black font-mono text-sm flex items-center gap-1">
                        {tTerm('WAIT')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Bullish vs Bearish Dual Score or True Status */}
                {res?.qualified && bullishScore !== null && bearishScore !== null ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-emerald-400 font-bold">{tTerm('Bullish')}: {bullishScore}%</span>
                      <span className="text-rose-400 font-bold">{tTerm('Bearish')}: {bearishScore}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden flex">
                      <div
                        className="h-full bg-emerald-500 transition-all duration-500"
                        style={{ width: `${bullishScore}%` }}
                      />
                      <div
                        className="h-full bg-rose-500 transition-all duration-500"
                        style={{ width: `${bearishScore}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-0.5">
                      <span>{t('strategies.score', 'Strategy Score')}:</span>
                      <span className="font-bold text-emerald-400">{res.normalizedScore ?? bullishScore}%</span>
                    </div>
                  </div>
                ) : (
                  <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800 text-[11px] font-mono text-slate-400 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">{t('strategies.status', 'Strategy Status')}:</span>
                      <span className="font-bold text-amber-400">
                        {res?.status === 'INSUFFICIENT_DATA' ? tTerm('Waiting for data') : tTerm('No valid setup')}
                      </span>
                    </div>
                    {res?.normalizedScore !== undefined && res?.normalizedScore !== null && (
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500">{t('scoreTable.score', 'Score')}:</span>
                        <span className="font-bold text-slate-300">{res.normalizedScore}% ({tTerm('WAIT')})</span>
                      </div>
                    )}
                    {res?.blockerReasons && res.blockerReasons.length > 0 && (
                      <div className="text-[10px] text-amber-300/80 truncate pt-0.5" title={res.blockerReasons[0]}>
                        Blocker: {res.blockerReasons[0]}
                      </div>
                    )}
                    {res?.mandatoryConditionsTotal !== undefined && (
                      <div className="text-[10px] text-slate-500 flex justify-between pt-0.5">
                        <span>Mandatory Conditions:</span>
                        <span>{res.mandatoryConditionsPassed ?? 0}/{res.mandatoryConditionsTotal} passed</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Indicator Metric Values */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/60 font-mono text-xs">
                  {metrics.map((m, idx) => (
                    <div key={idx} className="p-2 rounded-lg bg-slate-950/60 border border-slate-800">
                      <div className="text-[10px] text-slate-400 uppercase">{m.label}</div>
                      <div className="font-bold text-slate-200 truncate">{m.val}</div>
                    </div>
                  ))}
                </div>

                {/* Verifiable Conditions / Evidence */}
                {evidence.length > 0 ? (
                  <div className="pt-2 border-t border-slate-800/60 space-y-1">
                    <div className="text-[11px] font-bold text-slate-400 uppercase">Verifiable Evidence:</div>
                    {evidence.slice(0, 2).map((ev: any, idx) => (
                      <div key={idx} className="text-xs bg-slate-950/50 p-1.5 rounded border border-slate-800/80 flex items-start gap-1.5">
                        <CheckCircle2
                          className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${
                            ev.result ? 'text-emerald-400' : 'text-slate-500'
                          }`}
                        />
                        <div className="leading-tight">
                          <span className="font-mono text-[11px] text-slate-200 font-semibold">
                            {typeof ev.condition === 'object' ? (ev.condition?.signal ? `${ev.condition.signal}: ${ev.condition.value || ''}` : JSON.stringify(ev.condition)) : String(ev.condition || '')}
                          </span>
                          <span className="text-[10px] text-slate-400 block">
                            {typeof ev.actual === 'object' ? (ev.actual?.signal ? `${ev.actual.signal}: ${ev.actual.value || ''}` : JSON.stringify(ev.actual)) : String(ev.actual || '')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="pt-2 border-t border-slate-800/60 space-y-1">
                    <div className="text-[11px] font-bold text-slate-400 uppercase">Reason:</div>
                    {reasons.slice(0, 2).map((r: any, idx) => {
                      const displayReason = typeof r === 'object' && r !== null
                        ? (r.signal && r.value ? `${r.signal} (${r.value})` : Array.isArray(r.evidence) ? r.evidence.join('; ') : JSON.stringify(r))
                        : String(r);
                      return (
                        <div key={idx} className="text-xs text-slate-300 flex items-start gap-1.5 leading-snug">
                          <CheckCircle2
                            className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${
                              isUp ? 'text-emerald-400' : isDown ? 'text-rose-400' : 'text-amber-400'
                            }`}
                          />
                          <span>{displayReason}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Detailed Structural Breakdown for Gann, Elliott, Darvas */}
                {meta.id === 'gann_price_time' && (res?.gannData || activeSignal?.gannData) && (
                  <div className="pt-2 border-t border-slate-800/60 space-y-1.5 text-[11px] font-mono">
                    {(() => {
                      const gd = (res?.gannData || activeSignal?.gannData)!;
                      const anchorVal = gd.anchorHigh?.price ?? gd.angles?.[0]?.anchorPrice ?? (gd as any).anchorPrice;
                      const anchorType = (gd as any).anchorType || 'Swing High';
                      const priceRange = typeof gd.range === 'number' ? gd.range : (gd as any).priceRange;
                      const cycleBars = gd.nearestTimeCycle ?? (gd as any).nearestCycle ?? 'N/A';
                      const cycleDist = (gd as any).cycleDistance ?? gd.barsToCycle ?? 0;
                      const isSquared = gd.isPriceTimeSquared ?? ((gd as any).timeSquareStatus?.includes('SQUARED') || false);

                      return (
                        <div className="bg-slate-950/80 p-2 rounded-lg border border-amber-500/20 space-y-1">
                          <div className="flex items-center justify-between text-amber-300 font-bold">
                            <span>GANN PRICE/TIME EVIDENCE</span>
                            <span>{gd.dominantTrend}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-400">
                            <div>Anchor: <span className="text-slate-200">{typeof anchorVal === 'number' ? anchorVal.toFixed(4) : 'N/A'} ({anchorType})</span></div>
                            <div>Range (H-L): <span className="text-slate-200">{typeof priceRange === 'number' ? priceRange.toFixed(4) : 'N/A'}</span></div>
                            <div>Cycle: <span className="text-slate-200">{cycleBars} bars (Dist: {cycleDist})</span></div>
                            <div>Elapsed: <span className="text-slate-200">{gd.elapsedBars ?? 0} bars</span></div>
                          </div>
                          <div className="pt-1 text-[10px] flex items-center justify-between">
                            <span className="text-slate-400">Time-Square:</span>
                            <span className={`font-bold ${isSquared ? 'text-amber-400' : 'text-slate-300'}`}>
                              {isSquared ? `SQUARED (${gd.priceTimeSquareRatio ?? 1}x)` : 'IN PROGRESS'}
                            </span>
                          </div>
                          {gd.gannLevels && gd.gannLevels.length > 0 && (
                            <div className="pt-1 border-t border-slate-800/80 flex flex-wrap gap-1 text-[9px]">
                              {gd.gannLevels.filter(l => l.type === 'EQUILIBRIUM' || l.fraction.includes('4/8') || l.fraction.includes('2/8') || l.fraction.includes('6/8')).slice(0, 3).map((l, i) => (
                                <span key={i} className="px-1 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                                  {l.fraction}: {typeof l.price === 'number' ? l.price.toFixed(4) : l.price}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {meta.id === 'elliott_wave' && (res?.elliottData || activeSignal?.elliottData) && (
                  <div className="pt-2 border-t border-slate-800/60 space-y-1.5 text-[11px] font-mono">
                    {(() => {
                      const ed = (res?.elliottData || activeSignal?.elliottData)!;
                      return (
                        <div className="bg-slate-950/80 p-2 rounded-lg border border-sky-500/20 space-y-1">
                          <div className="flex items-center justify-between text-sky-300 font-bold">
                            <span>ELLIOTT WAVE STRUCTURE</span>
                            <span>W{ed.currentWave ?? '—'} ({ed.dominantTrend || 'ACTIVE'})</span>
                          </div>
                          <div className="text-[10px] text-slate-300">
                            Status: <span className="text-sky-400 font-bold">{ed.structureStatus || 'Forming'}</span> • Confidence: <span className="text-emerald-400 font-bold">{ed.confidenceScore ?? 0}%</span>
                          </div>
                          {ed.lastConfirmedStructure && (
                            <div className="text-[10px] text-slate-400">
                              Confirmed: <span className="text-slate-200">{ed.lastConfirmedStructure}</span>
                            </div>
                          )}
                          {ed.alternativeCount && (
                            <div className="text-[10px] text-purple-300">
                              Alt Count: <span className="text-slate-300">{ed.alternativeCount}</span>
                            </div>
                          )}
                          {Array.isArray(ed.rulesChecked) && ed.rulesChecked.length > 0 && (
                            <div className="pt-1 border-t border-slate-800/80 space-y-0.5 text-[10px]">
                              {ed.rulesChecked.map((rc, i) => (
                                <div key={i} className="flex items-center gap-1.5">
                                  <span className={rc.passed ? 'text-emerald-400 font-bold' : 'text-slate-500 font-bold'}>
                                    {rc.passed ? '✓' : '✗'}
                                  </span>
                                  <span className="text-slate-300">{rc.rule}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {meta.id === 'darvas_box' && (res?.darvasData || activeSignal?.darvasData) && (
                  <div className="pt-2 border-t border-slate-800/60 space-y-1.5 text-[11px] font-mono">
                    {(() => {
                      const dd = (res?.darvasData || activeSignal?.darvasData)!;
                      const box = dd.activeBox;
                      const candlesCount = box?.candlesInside ?? (box as any)?.candleCount ?? 0;
                      const heightPercent = typeof (box as any)?.boxHeightPct === 'number'
                        ? (box as any).boxHeightPct
                        : (typeof box?.spreadPercent === 'number' ? box.spreadPercent : 0);

                      return (
                        <div className="bg-slate-950/80 p-2 rounded-lg border border-rose-500/20 space-y-1">
                          <div className="flex items-center justify-between text-rose-300 font-bold">
                            <span>DARVAS BOX METHODOLOGY</span>
                            <span>{box?.isConfirmed ? 'BOX CONFIRMED' : 'FORMING'}</span>
                          </div>
                          {box ? (
                            <div className="space-y-1 text-[10px]">
                              <div className="flex items-center justify-between">
                                <span className="text-slate-400">Top Resistance:</span>
                                <span className="text-rose-400 font-bold">{typeof box.upper === 'number' ? box.upper.toFixed(4) : 'N/A'}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-slate-400">Bottom Support:</span>
                                <span className="text-emerald-400 font-bold">{typeof box.lower === 'number' ? box.lower.toFixed(4) : 'N/A'}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-slate-400">Consolidation:</span>
                                <span className="text-slate-300">{candlesCount} bars ({heightPercent.toFixed(2)}% height)</span>
                              </div>
                              <div className="flex items-center justify-between pt-0.5 border-t border-slate-800">
                                <span className="text-slate-400">Breakout State:</span>
                                <span className={`font-bold ${
                                  box.breakoutStatus === 'BREAKOUT_UP'
                                    ? 'text-emerald-400'
                                    : box.breakoutStatus === 'BREAKDOWN_DOWN'
                                    ? 'text-rose-400'
                                    : 'text-amber-400'
                                }`}>
                                  {box.breakoutStatus || 'INSIDE'}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="text-[10px] text-slate-500">
                              Searching for confirmed 3-candle consolidation peak and trough.
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Trigger Candle Info */}
                {res?.triggerCandle && (
                  <div className="pt-1 text-[10px] font-mono text-slate-500 flex items-center justify-between">
                    <span>Trigger: {new Date(res.triggerCandle.time * 1000).toLocaleTimeString([], { hour12: false })}</span>
                    <span>Close: {typeof res.triggerCandle.close === 'number' ? res.triggerCandle.close.toFixed(5) : res.triggerCandle.close}</span>
                  </div>
                )}
              </div>

              {/* Action Buttons: Select as Primary Driver & Settings */}
              <div className="p-3 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between gap-2">
                <button
                  onClick={() => onSelectStrategy(isSelected ? 'confluence' : meta.id)}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    isSelected
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                  }`}
                >
                  <Power className="w-3.5 h-3.5" />
                  <span>{isSelected ? t('strategies.activeDriver', 'Active Driver') : t('strategies.focusSignal', 'Focus Signal')}</span>
                </button>

                <button
                  onClick={() => handleOpenSettings(meta)}
                  className="py-1.5 px-3 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Settings2 className="w-3.5 h-3.5 text-slate-400" />
                  <span>{t('common.settings', 'Settings')}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. AI API KEY & GOOGLE GEMINI REAL-TIME CHART ANALYSIS */}
      <AiApiKeySection
        activeAsset={activeAsset}
        timeframe={timeframe}
        currentPrice={currentPrice}
        activeSignal={activeSignal}
        indicators={indicators}
      />

      {/* 5. Modal for Parameter Tweaking */}
      {settingsModalStrat && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-2xl border border-slate-800 max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white uppercase">
                  {settingsModalStrat.name}
                </h3>
                <p className="text-xs text-slate-400">{settingsModalStrat.description}</p>
              </div>
              <button
                onClick={() => setSettingsModalStrat(null)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {saveSuccess && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
                <Check className="w-4 h-4" />
                <span>Parameters saved and applied to Strategy Engine!</span>
              </div>
            )}

            <div className="space-y-3 text-xs">
              {Object.entries(modalFormValues).map(([key, val]) => {
                if (typeof val === 'boolean') {
                  return (
                    <label key={key} className="flex items-center justify-between p-2 rounded-lg bg-slate-950 border border-slate-800">
                      <span className="font-semibold text-slate-300 capitalize">{key}</span>
                      <input
                        type="checkbox"
                        checked={val}
                        onChange={(e) => setModalFormValues({ ...modalFormValues, [key]: e.target.checked })}
                        className="rounded border-slate-700 text-amber-500 focus:ring-amber-400"
                      />
                    </label>
                  );
                }
                if (typeof val === 'number') {
                  return (
                    <div key={key} className="p-2 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
                      <span className="font-semibold text-slate-300 capitalize">{key}</span>
                      <input
                        type="number"
                        value={val}
                        onChange={(e) => setModalFormValues({ ...modalFormValues, [key]: parseFloat(e.target.value) || 0 })}
                        className="w-24 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-right font-mono text-white text-xs"
                      />
                    </div>
                  );
                }
                return null;
              })}
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
              <button
                onClick={() => setSettingsModalStrat(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveModalSettings}
                disabled={savingSettings}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors flex items-center gap-1.5 shadow-md shadow-amber-500/20"
              >
                {savingSettings ? 'Saving...' : 'Apply Parameters'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
