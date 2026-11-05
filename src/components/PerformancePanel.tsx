import React from 'react';
import { PerformanceMetrics } from '../types';
import { Award, CheckCircle2, XCircle, AlertCircle, BarChart2, ShieldCheck } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

interface PerformancePanelProps {
  metrics?: PerformanceMetrics | null;
  performance?: PerformanceMetrics | null;
  history?: any[];
}

const DEFAULT_METRICS: PerformanceMetrics = {
  totalSignals: 0,
  evaluatedSignals: 0,
  wonSignals: 0,
  lostSignals: 0,
  accuracyRate: 0,
  sampleSize: 0,
  upSignals: 0,
  downSignals: 0,
  waitSignals: 0,
  lastUpdated: Date.now(),
};

export const PerformancePanel: React.FC<PerformancePanelProps> = ({
  metrics: propMetrics,
  performance: propPerformance,
}) => {
  const { t, tTerm } = useLanguage();
  const metrics = propPerformance || propMetrics || DEFAULT_METRICS;
  const hasSample = (metrics?.sampleSize ?? 0) > 0;
  const isSampleSignificant = (metrics?.sampleSize ?? 0) >= 10;

  return (
    <div id="performance-panel" className="space-y-6">
      {/* Integrity Notice */}
      <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-950/20 flex items-start space-x-3 text-xs text-blue-200">
        <ShieldCheck className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
        <div>
          <h4 className="font-semibold text-blue-300">
            {t('performance.guaranteeTitle', 'Audited Mathematical Transparency Guarantee')}
          </h4>
          <p className="mt-1 leading-relaxed text-slate-300">
            {t(
              'performance.accuracyNote',
              'All win-rate statistics are strictly calculated from real subsequent candle close prices evaluated against past generated signals. Zero simulation, zero fake win rates.'
            )}
          </p>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Win Rate */}
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>{t('performance.winRate', 'Accuracy Rate')}</span>
            <Award className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="my-2">
            {hasSample ? (
              <div className="text-2xl font-bold font-mono text-emerald-400">
                {metrics.accuracyRate}%
              </div>
            ) : (
              <div className="text-lg font-mono text-slate-500">{t('performance.awaitingData', 'Awaiting Data')}</div>
            )}
          </div>
          <div className="text-[11px] text-slate-400">
            {isSampleSignificant
              ? `${t('performance.calculatedOn', 'Calculated on')} ${metrics.sampleSize} ${t('performance.verifiedSignals', 'verified signals')}`
              : `${t('performance.sampleSize', 'Sample size')}: ${metrics.sampleSize}`}
          </div>
        </div>

        {/* Won Signals */}
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>{t('performance.won', 'Verified Won')}</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="my-2">
            <div className="text-2xl font-bold font-mono text-slate-200">
              {metrics.wonSignals}
            </div>
          </div>
          <div className="text-[11px] text-slate-400">
            {t('performance.wonDesc', 'Price expired in predicted direction')}
          </div>
        </div>

        {/* Lost Signals */}
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>{t('performance.lost', 'Verified Lost')}</span>
            <XCircle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="my-2">
            <div className="text-2xl font-bold font-mono text-slate-200">
              {metrics.lostSignals}
            </div>
          </div>
          <div className="text-[11px] text-slate-400">
            {t('performance.lostDesc', 'Price failed predicted threshold')}
          </div>
        </div>

        {/* Total Evaluated */}
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>{t('performance.evaluated', 'Evaluated Signals')}</span>
            <BarChart2 className="w-4 h-4 text-blue-400" />
          </div>
          <div className="my-2">
            <div className="text-2xl font-bold font-mono text-slate-200">
              {metrics.evaluatedSignals} <span className="text-xs font-normal text-slate-500">/ {metrics.totalSignals} {t('performance.totalSignals', 'total')}</span>
            </div>
          </div>
          <div className="text-[11px] text-slate-400">
            {metrics.totalSignals - metrics.evaluatedSignals} {t('performance.pendingCandleClose', 'pending candle close')}
          </div>
        </div>
      </div>

      {/* Signal Distribution Breakdown */}
      <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/40">
        <h3 className="text-sm font-semibold text-slate-200 mb-4">
          {t('performance.generationBreakdown', 'Signal Generation Breakdown')}
        </h3>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="p-3 rounded-lg border border-emerald-500/20 bg-emerald-950/20">
            <div className="text-xs text-emerald-400 font-medium mb-1">{tTerm('BUY')} {t('signals.signals', 'Signals')}</div>
            <div className="text-xl font-bold font-mono text-emerald-300">{metrics.upSignals}</div>
          </div>
          <div className="p-3 rounded-lg border border-rose-500/20 bg-rose-950/20">
            <div className="text-xs text-rose-400 font-medium mb-1">{tTerm('SELL')} {t('signals.signals', 'Signals')}</div>
            <div className="text-xl font-bold font-mono text-rose-300">{metrics.downSignals}</div>
          </div>
          <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-950/20">
            <div className="text-xs text-amber-400 font-medium mb-1">{tTerm('WAIT')} {t('signals.events', 'Events')}</div>
            <div className="text-xl font-bold font-mono text-amber-300">{metrics.waitSignals}</div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-800/80 text-xs text-slate-400 flex items-center justify-between">
          <span className="flex items-center space-x-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>{t('performance.riskWarning', 'Risk Warning: Trading involves financial risk. Signals are decision-support tools without automated execution.')}</span>
          </span>
          <span className="font-mono text-slate-500 text-[11px] shrink-0">
            {t('common.updated', 'Updated')}: {new Date(metrics.lastUpdated).toLocaleTimeString()}
          </span>
        </div>
      </div>
    </div>
  );
};
