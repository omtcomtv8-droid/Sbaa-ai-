import React, { useState, useEffect } from 'react';
import { StrategySettings } from '../types';
import { Save, Check, ShieldCheck } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

interface StrategiesConfigPanelProps {
  settings?: StrategySettings;
  onSaveSettings?: (newSettings: StrategySettings) => Promise<void>;
  onUpdateSettings?: (newSettings: StrategySettings) => Promise<void>;
}

const DEFAULT_SETTINGS: StrategySettings = {
  global: {
    minConfirmations: 2,
    minScore: 3,
    signalCooldownSeconds: 30,
    requireClosedCandle: true,
    maxDataFreshnessSeconds: 10,
    enableConflictProtection: true,
    enableRegimeFilter: true,
  },
  emaTrend: {
    enabled: true,
    fastPeriod: 9,
    slowPeriod: 21,
    filterPeriod: 50,
    weight: 1.5,
  },
  rsiMomentum: {
    enabled: true,
    period: 14,
    overbought: 70,
    oversold: 30,
    weight: 1.2,
  },
  macd: {
    enabled: true,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    weight: 1.2,
  },
  bollingerBounce: {
    enabled: true,
    period: 20,
    stdDev: 2,
    weight: 1.2,
  },
  candlestick: {
    enabled: true,
    minPatternStrength: 2,
    requireTrendAlignment: false,
    weight: 1.0,
  },
  supportResistance: {
    enabled: true,
    lookback: 50,
    clusterTolerancePercent: 0.08,
    weight: 1.4,
  },
  breakout: {
    enabled: true,
    lookback: 20,
    atrFilterMultiplier: 1.1,
    weight: 1.3,
  },
  marketStructure: {
    enabled: true,
    swingLookback: 5,
    weight: 1.4,
  },
  multiConfluence: {
    enabled: true,
    weight: 2.0,
  },
  gannPriceTime: {
    enabled: true,
    lookback: 60,
    weight: 1.3,
  },
  elliottWave: {
    enabled: true,
    lookback: 80,
    weight: 1.3,
    strictWave4Territory: true,
  },
  darvasBox: {
    enabled: true,
    lookback: 60,
    weight: 1.3,
    consolidationCandlesRequired: 3,
  },
};

function mergeWithDefaults(custom?: Partial<StrategySettings>): StrategySettings {
  if (!custom) return { ...DEFAULT_SETTINGS };
  return {
    ...DEFAULT_SETTINGS,
    ...custom,
    global: { ...DEFAULT_SETTINGS.global, ...custom.global },
    emaTrend: { ...DEFAULT_SETTINGS.emaTrend, ...custom.emaTrend },
    rsiMomentum: { ...DEFAULT_SETTINGS.rsiMomentum, ...custom.rsiMomentum },
    macd: { ...DEFAULT_SETTINGS.macd, ...custom.macd },
    bollingerBounce: { ...DEFAULT_SETTINGS.bollingerBounce, ...custom.bollingerBounce },
    candlestick: { ...DEFAULT_SETTINGS.candlestick, ...custom.candlestick },
    supportResistance: { ...DEFAULT_SETTINGS.supportResistance, ...custom.supportResistance },
    breakout: { ...DEFAULT_SETTINGS.breakout, ...custom.breakout },
    marketStructure: { ...DEFAULT_SETTINGS.marketStructure, ...custom.marketStructure },
    multiConfluence: { ...DEFAULT_SETTINGS.multiConfluence, ...custom.multiConfluence },
    gannPriceTime: { ...DEFAULT_SETTINGS.gannPriceTime, ...custom.gannPriceTime },
    elliottWave: { ...DEFAULT_SETTINGS.elliottWave, ...custom.elliottWave },
    darvasBox: { ...DEFAULT_SETTINGS.darvasBox, ...custom.darvasBox },
  } as StrategySettings;
}

export const StrategiesConfigPanel: React.FC<StrategiesConfigPanelProps> = ({
  settings,
  onSaveSettings,
  onUpdateSettings,
}) => {
  const [localSettings, setLocalSettings] = useState<StrategySettings>(() => mergeWithDefaults(settings));
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (settings) {
      setLocalSettings(mergeWithDefaults(settings));
    }
  }, [settings]);

  const handleGlobalChange = (field: keyof NonNullable<StrategySettings['global']>, value: any) => {
    setLocalSettings((prev) => ({
      ...prev,
      global: {
        ...(prev.global || DEFAULT_SETTINGS.global!),
        [field]: value,
      },
    }));
  };

  const handleStrategyToggle = (strategyKey: keyof Omit<StrategySettings, 'global'>) => {
    setLocalSettings((prev) => {
      const current = (prev[strategyKey] as any) || (DEFAULT_SETTINGS[strategyKey] as any);
      return {
        ...prev,
        [strategyKey]: {
          ...current,
          enabled: !current.enabled,
        },
      };
    });
  };

  const handleStrategyFieldChange = (
    strategyKey: keyof Omit<StrategySettings, 'global'>,
    field: string,
    value: any
  ) => {
    setLocalSettings((prev) => {
      const current = (prev[strategyKey] as any) || (DEFAULT_SETTINGS[strategyKey] as any);
      return {
        ...prev,
        [strategyKey]: {
          ...current,
          [field]: value,
        },
      };
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const saveHandler = onSaveSettings || onUpdateSettings;
      if (saveHandler) {
        await saveHandler(localSettings);
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const { t, tTerm, isRTL } = useLanguage();
  const g = localSettings.global || DEFAULT_SETTINGS.global!;
  const ema = localSettings.emaTrend || DEFAULT_SETTINGS.emaTrend!;
  const rsi = localSettings.rsiMomentum || DEFAULT_SETTINGS.rsiMomentum!;
  const macd = localSettings.macd || DEFAULT_SETTINGS.macd!;
  const bb = localSettings.bollingerBounce || DEFAULT_SETTINGS.bollingerBounce!;
  const sr = localSettings.supportResistance || DEFAULT_SETTINGS.supportResistance!;
  const bo = localSettings.breakout || DEFAULT_SETTINGS.breakout!;
  const gann = localSettings.gannPriceTime || DEFAULT_SETTINGS.gannPriceTime!;
  const elliott = localSettings.elliottWave || DEFAULT_SETTINGS.elliottWave!;
  const darvas = localSettings.darvasBox || DEFAULT_SETTINGS.darvasBox!;

  return (
    <div id="strategies-config-panel" className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex items-center justify-between p-4 rounded-xl border border-slate-800 bg-slate-900/60">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">Algorithmic Strategy Modules & Global Gates</h3>
          <p className="text-xs text-slate-400">Configure independent weights, mathematical thresholds, and anti-repainting gates</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium shadow transition-colors"
          >
            {saveSuccess ? (
              <>
                <Check className="w-4 h-4 text-emerald-300" />
                <span>Saved Successfully</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'Applying...' : 'Apply Changes'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Global Safety Gates */}
      <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/40 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-sm font-semibold text-slate-200">
            <ShieldCheck className="w-4 h-4 text-blue-400" />
            <span>Global Signal & Capital Preservation Gates</span>
          </div>
          <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-800/50 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Automatic Strategy Confidence Active
          </span>
        </div>

        {/* Automatic Quantitative Confidence Engine Banner */}
        <div className="p-4 rounded-xl bg-slate-950/80 border border-emerald-500/30 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
              <span>Automatic Quantitative Confidence Engine</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                Rule-Based Automation
              </span>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Confidence percentages are automatically calculated by quantitative indicator confluence, multi-strategy agreement, and candle structure analysis. Manual thresholds are disabled to preserve strict mathematical integrity.
          </p>
          <div className="flex flex-wrap gap-2 pt-1 text-[10px] font-mono text-slate-400">
            <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
              ✓ Multi-Strategy Confluence Scoring
            </span>
            <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
              ✓ Candlestick Structure Synergy
            </span>
            <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
              ✓ Dynamic Volatility & Conflict Filtering
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block text-slate-400 mb-1">Minimum Confirmations (Voting)</label>
            <input
              type="number"
              min="1"
              max="9"
              value={g.minConfirmations ?? 2}
              onChange={(e) => handleGlobalChange('minConfirmations', parseInt(e.target.value) || 1)}
              className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 font-mono"
            />
            <p className="text-[10px] text-slate-500 mt-1">Number of strategies required to agree</p>
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Minimum Net Score Threshold</label>
            <input
              type="number"
              step="0.5"
              min="1"
              max="15"
              value={g.minScore ?? 3}
              onChange={(e) => handleGlobalChange('minScore', parseFloat(e.target.value) || 1)}
              className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 font-mono"
            />
            <p className="text-[10px] text-slate-500 mt-1">Weighted score required for actionable UP/DOWN</p>
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Signal Cooldown (Seconds)</label>
            <input
              type="number"
              min="5"
              max="300"
              value={g.signalCooldownSeconds ?? 30}
              onChange={(e) => handleGlobalChange('signalCooldownSeconds', parseInt(e.target.value) || 5)}
              className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 font-mono"
            />
            <p className="text-[10px] text-slate-500 mt-1">Minimum duration between alerts</p>
          </div>
        </div>

        {/* Checkbox Safety Toggles */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-800 text-xs">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={Boolean(g.requireClosedCandle)}
              onChange={(e) => handleGlobalChange('requireClosedCandle', e.target.checked)}
              className="rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-0"
            />
            <span className="text-slate-300">Strict Anti-Repainting (Closed Candles Only)</span>
          </label>

          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={Boolean(g.enableConflictProtection)}
              onChange={(e) => handleGlobalChange('enableConflictProtection', e.target.checked)}
              className="rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-0"
            />
            <span className="text-slate-300">Conflict Protection (Force WAIT on Divergence)</span>
          </label>

          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={Boolean(g.enableRegimeFilter)}
              onChange={(e) => handleGlobalChange('enableRegimeFilter', e.target.checked)}
              className="rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-0"
            />
            <span className="text-slate-300">Market Regime Filter (Filter High Volatility)</span>
          </label>
        </div>
      </div>

      {/* Modular Strategy Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 1. EMA Trend */}
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-sm text-slate-200">EMA Trend Strategy</span>
              <input
                type="checkbox"
                checked={Boolean(ema.enabled)}
                onChange={() => handleStrategyToggle('emaTrend')}
                className="rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-0"
              />
            </div>
            <p className="text-[11px] text-slate-400 mb-3">Fast & Slow EMA alignment with SMA filter</p>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Fast Period</span>
                <input
                  type="number"
                  value={ema.fastPeriod ?? 9}
                  onChange={(e) => handleStrategyFieldChange('emaTrend', 'fastPeriod', parseInt(e.target.value) || 9)}
                  className="w-16 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-right font-mono text-slate-200"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Slow Period</span>
                <input
                  type="number"
                  value={ema.slowPeriod ?? 21}
                  onChange={(e) => handleStrategyFieldChange('emaTrend', 'slowPeriod', parseInt(e.target.value) || 21)}
                  className="w-16 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-right font-mono text-slate-200"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Filter SMA</span>
                <input
                  type="number"
                  value={ema.filterPeriod ?? 50}
                  onChange={(e) => handleStrategyFieldChange('emaTrend', 'filterPeriod', parseInt(e.target.value) || 50)}
                  className="w-16 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-right font-mono text-slate-200"
                />
              </div>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <span className="text-slate-400">Vote Weight</span>
            <input
              type="number"
              step="0.1"
              value={ema.weight ?? 1.5}
              onChange={(e) => handleStrategyFieldChange('emaTrend', 'weight', parseFloat(e.target.value) || 1)}
              className="w-16 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-right font-mono text-slate-200"
            />
          </div>
        </div>

        {/* 2. RSI Momentum */}
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-sm text-slate-200">RSI Momentum</span>
              <input
                type="checkbox"
                checked={Boolean(rsi.enabled)}
                onChange={() => handleStrategyToggle('rsiMomentum')}
                className="rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-0"
              />
            </div>
            <p className="text-[11px] text-slate-400 mb-3">Wilder smoothed overbought/oversold & hook recovery</p>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Period</span>
                <input
                  type="number"
                  value={rsi.period ?? 14}
                  onChange={(e) => handleStrategyFieldChange('rsiMomentum', 'period', parseInt(e.target.value) || 14)}
                  className="w-16 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-right font-mono text-slate-200"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Overbought</span>
                <input
                  type="number"
                  value={rsi.overbought ?? 70}
                  onChange={(e) => handleStrategyFieldChange('rsiMomentum', 'overbought', parseInt(e.target.value) || 70)}
                  className="w-16 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-right font-mono text-slate-200"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Oversold</span>
                <input
                  type="number"
                  value={rsi.oversold ?? 30}
                  onChange={(e) => handleStrategyFieldChange('rsiMomentum', 'oversold', parseInt(e.target.value) || 30)}
                  className="w-16 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-right font-mono text-slate-200"
                />
              </div>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <span className="text-slate-400">Vote Weight</span>
            <input
              type="number"
              step="0.1"
              value={rsi.weight ?? 1.2}
              onChange={(e) => handleStrategyFieldChange('rsiMomentum', 'weight', parseFloat(e.target.value) || 1)}
              className="w-16 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-right font-mono text-slate-200"
            />
          </div>
        </div>

        {/* 3. MACD Momentum */}
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-sm text-slate-200">MACD Momentum</span>
              <input
                type="checkbox"
                checked={Boolean(macd.enabled)}
                onChange={() => handleStrategyToggle('macd')}
                className="rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-0"
              />
            </div>
            <p className="text-[11px] text-slate-400 mb-3">Signal line crossover & histogram momentum expansion</p>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Fast EMA</span>
                <input
                  type="number"
                  value={macd.fastPeriod ?? 12}
                  onChange={(e) => handleStrategyFieldChange('macd', 'fastPeriod', parseInt(e.target.value) || 12)}
                  className="w-16 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-right font-mono text-slate-200"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Slow EMA</span>
                <input
                  type="number"
                  value={macd.slowPeriod ?? 26}
                  onChange={(e) => handleStrategyFieldChange('macd', 'slowPeriod', parseInt(e.target.value) || 26)}
                  className="w-16 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-right font-mono text-slate-200"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Signal Line</span>
                <input
                  type="number"
                  value={macd.signalPeriod ?? 9}
                  onChange={(e) => handleStrategyFieldChange('macd', 'signalPeriod', parseInt(e.target.value) || 9)}
                  className="w-16 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-right font-mono text-slate-200"
                />
              </div>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <span className="text-slate-400">Vote Weight</span>
            <input
              type="number"
              step="0.1"
              value={macd.weight ?? 1.2}
              onChange={(e) => handleStrategyFieldChange('macd', 'weight', parseFloat(e.target.value) || 1)}
              className="w-16 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-right font-mono text-slate-200"
            />
          </div>
        </div>

        {/* 4. Bollinger Bounce */}
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-sm text-slate-200">Bollinger Reversion</span>
              <input
                type="checkbox"
                checked={Boolean(bb.enabled)}
                onChange={() => handleStrategyToggle('bollingerBounce')}
                className="rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-0"
              />
            </div>
            <p className="text-[11px] text-slate-400 mb-3">Band rejection with candle confirmation</p>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Period</span>
                <input
                  type="number"
                  value={bb.period ?? 20}
                  onChange={(e) => handleStrategyFieldChange('bollingerBounce', 'period', parseInt(e.target.value) || 20)}
                  className="w-16 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-right font-mono text-slate-200"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Std Deviation</span>
                <input
                  type="number"
                  step="0.1"
                  value={bb.stdDev ?? 2}
                  onChange={(e) => handleStrategyFieldChange('bollingerBounce', 'stdDev', parseFloat(e.target.value) || 2)}
                  className="w-16 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-right font-mono text-slate-200"
                />
              </div>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <span className="text-slate-400">Vote Weight</span>
            <input
              type="number"
              step="0.1"
              value={bb.weight ?? 1.2}
              onChange={(e) => handleStrategyFieldChange('bollingerBounce', 'weight', parseFloat(e.target.value) || 1)}
              className="w-16 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-right font-mono text-slate-200"
            />
          </div>
        </div>

        {/* 5. Support / Resistance */}
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-sm text-slate-200">Support / Resistance</span>
              <input
                type="checkbox"
                checked={Boolean(sr.enabled)}
                onChange={() => handleStrategyToggle('supportResistance')}
                className="rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-0"
              />
            </div>
            <p className="text-[11px] text-slate-400 mb-3">Swing cluster zones with multi-touch confirmation</p>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Lookback Candles</span>
                <input
                  type="number"
                  value={sr.lookback ?? 50}
                  onChange={(e) => handleStrategyFieldChange('supportResistance', 'lookback', parseInt(e.target.value) || 50)}
                  className="w-16 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-right font-mono text-slate-200"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Cluster Tolerance %</span>
                <input
                  type="number"
                  step="0.01"
                  value={sr.clusterTolerancePercent ?? 0.08}
                  onChange={(e) => handleStrategyFieldChange('supportResistance', 'clusterTolerancePercent', parseFloat(e.target.value) || 0.08)}
                  className="w-16 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-right font-mono text-slate-200"
                />
              </div>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <span className="text-slate-400">Vote Weight</span>
            <input
              type="number"
              step="0.1"
              value={sr.weight ?? 1.4}
              onChange={(e) => handleStrategyFieldChange('supportResistance', 'weight', parseFloat(e.target.value) || 1)}
              className="w-16 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-right font-mono text-slate-200"
            />
          </div>
        </div>

        {/* 6. Breakout Strategy */}
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-sm text-slate-200">Volatility Breakout</span>
              <input
                type="checkbox"
                checked={Boolean(bo.enabled)}
                onChange={() => handleStrategyToggle('breakout')}
                className="rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-0"
              />
            </div>
            <p className="text-[11px] text-slate-400 mb-3">High/Low breach confirmed with candle close & ATR</p>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Lookback</span>
                <input
                  type="number"
                  value={bo.lookback ?? 20}
                  onChange={(e) => handleStrategyFieldChange('breakout', 'lookback', parseInt(e.target.value) || 20)}
                  className="w-16 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-right font-mono text-slate-200"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">ATR Expansion Mult</span>
                <input
                  type="number"
                  step="0.1"
                  value={bo.atrFilterMultiplier ?? 1.1}
                  onChange={(e) => handleStrategyFieldChange('breakout', 'atrFilterMultiplier', parseFloat(e.target.value) || 1.1)}
                  className="w-16 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-right font-mono text-slate-200"
                />
              </div>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <span className="text-slate-400">Vote Weight</span>
            <input
              type="number"
              step="0.1"
              value={bo.weight ?? 1.3}
              onChange={(e) => handleStrategyFieldChange('breakout', 'weight', parseFloat(e.target.value) || 1)}
              className="w-16 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-right font-mono text-slate-200"
            />
          </div>
        </div>

        {/* 7. W.D. Gann Price/Time Analysis */}
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-sm text-amber-300">W.D. Gann Price/Time</span>
              <input
                type="checkbox"
                checked={Boolean(gann.enabled)}
                onChange={() => handleStrategyToggle('gannPriceTime')}
                className="rounded border-slate-700 bg-slate-950 text-amber-500 focus:ring-0"
              />
            </div>
            <p className="text-[11px] text-slate-400 mb-3">Mathematical squaring of price and time with 8th divisions & 1x1 angles</p>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Lookback Bars</span>
                <input
                  type="number"
                  value={gann.lookback ?? 60}
                  onChange={(e) => handleStrategyFieldChange('gannPriceTime', 'lookback', parseInt(e.target.value) || 60)}
                  className="w-16 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-right font-mono text-slate-200"
                />
              </div>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <span className="text-slate-400">Vote Weight</span>
            <input
              type="number"
              step="0.1"
              value={gann.weight ?? 1.3}
              onChange={(e) => handleStrategyFieldChange('gannPriceTime', 'weight', parseFloat(e.target.value) || 1)}
              className="w-16 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-right font-mono text-slate-200"
            />
          </div>
        </div>

        {/* 8. Ralph Nelson Elliott Wave Analysis */}
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-sm text-sky-300">R.N. Elliott Wave</span>
              <input
                type="checkbox"
                checked={Boolean(elliott.enabled)}
                onChange={() => handleStrategyToggle('elliottWave')}
                className="rounded border-slate-700 bg-slate-950 text-sky-500 focus:ring-0"
              />
            </div>
            <p className="text-[11px] text-slate-400 mb-3">5-wave impulse & ABC structural validation with Wave 2-4 integrity checks</p>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Lookback Bars</span>
                <input
                  type="number"
                  value={elliott.lookback ?? 80}
                  onChange={(e) => handleStrategyFieldChange('elliottWave', 'lookback', parseInt(e.target.value) || 80)}
                  className="w-16 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-right font-mono text-slate-200"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Strict Wave 4 Overlap</span>
                <input
                  type="checkbox"
                  checked={Boolean(elliott.strictWave4Territory ?? true)}
                  onChange={(e) => handleStrategyFieldChange('elliottWave', 'strictWave4Territory', e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-sky-500 focus:ring-0"
                />
              </div>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <span className="text-slate-400">Vote Weight</span>
            <input
              type="number"
              step="0.1"
              value={elliott.weight ?? 1.3}
              onChange={(e) => handleStrategyFieldChange('elliottWave', 'weight', parseFloat(e.target.value) || 1)}
              className="w-16 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-right font-mono text-slate-200"
            />
          </div>
        </div>

        {/* 9. Nicolas Darvas Box Strategy */}
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-sm text-rose-300">Nicolas Darvas Box</span>
              <input
                type="checkbox"
                checked={Boolean(darvas.enabled)}
                onChange={() => handleStrategyToggle('darvasBox')}
                className="rounded border-slate-700 bg-slate-950 text-rose-500 focus:ring-0"
              />
            </div>
            <p className="text-[11px] text-slate-400 mb-3">Consolidation box formation with candle-close breakout verification</p>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Lookback Bars</span>
                <input
                  type="number"
                  value={darvas.lookback ?? 60}
                  onChange={(e) => handleStrategyFieldChange('darvasBox', 'lookback', parseInt(e.target.value) || 60)}
                  className="w-16 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-right font-mono text-slate-200"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Consolidation Bars</span>
                <input
                  type="number"
                  value={darvas.consolidationCandlesRequired ?? 3}
                  onChange={(e) => handleStrategyFieldChange('darvasBox', 'consolidationCandlesRequired', parseInt(e.target.value) || 3)}
                  className="w-16 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-right font-mono text-slate-200"
                />
              </div>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <span className="text-slate-400">Vote Weight</span>
            <input
              type="number"
              step="0.1"
              value={darvas.weight ?? 1.3}
              onChange={(e) => handleStrategyFieldChange('darvasBox', 'weight', parseFloat(e.target.value) || 1)}
              className="w-16 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-right font-mono text-slate-200"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
