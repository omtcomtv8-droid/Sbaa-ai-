import React, { useState } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Layers,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
  XCircle,
  Zap,
} from 'lucide-react';
import { Signal, SignalEvidenceItem } from '../types';
import { useLanguage } from '../i18n/LanguageContext';

interface SignalExplanationCardProps {
  signal: Signal | null;
  className?: string;
  defaultExpanded?: boolean;
}

export const SignalExplanationCard: React.FC<SignalExplanationCardProps> = ({
  signal,
  className = '',
  defaultExpanded = true,
}) => {
  const { t, tTerm, tDynamic, isRTL } = useLanguage();
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  if (!signal) return null;

  const explanation = signal.explanation;
  const isUp = signal.type === 'UP';
  const isDown = signal.type === 'DOWN';
  const isWait = signal.type === 'WAIT';

  // Fallback if explanation not yet generated
  const verdictTitle =
    explanation?.verdictTitle ||
    (isUp
      ? `BULLISH MOMENTUM CONFIRMED (${signal.strength}% CONFIDENCE)`
      : isDown
      ? `BEARISH MOMENTUM CONFIRMED (${signal.strength}% CONFIDENCE)`
      : `FILTER ACTIVE: ${signal.reason.split(':')[0]}`);

  const summary =
    explanation?.summaryRationale ||
    signal.reason ||
    'Evaluating multi-factor technical criteria across 21 institutional strategy modules.';

  const evidence: SignalEvidenceItem[] = explanation?.technicalEvidence || [];
  const supporting = explanation?.supportingStrategies || [];
  const opposing = explanation?.opposingStrategies || [];

  return (
    <div
      id="signal-explanation-card"
      className={`rounded-2xl border bg-slate-900/95 transition-all duration-300 overflow-hidden ${
        isUp
          ? 'border-emerald-500/40 shadow-[0_0_25px_rgba(16,185,129,0.12)]'
          : isDown
          ? 'border-rose-500/40 shadow-[0_0_25px_rgba(244,63,94,0.12)]'
          : 'border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.08)]'
      } ${className}`}
    >
      {/* Top Banner / Accordion Toggle */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="px-5 py-4 flex items-center justify-between cursor-pointer border-b border-slate-800/80 hover:bg-slate-800/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div
            className={`p-2 rounded-xl flex items-center justify-center ${
              isUp
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : isDown
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
            }`}
          >
            {isUp ? (
              <TrendingUp className="w-5 h-5" />
            ) : isDown ? (
              <TrendingDown className="w-5 h-5" />
            ) : (
              <Clock className="w-5 h-5" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {t('signals.whyThisSignal', 'WHY THIS SIGNAL?')}
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                  isUp
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : isDown
                    ? 'bg-rose-500/20 text-rose-400'
                    : 'bg-amber-500/20 text-amber-400'
                }`}
              >
                {tTerm(signal.type)}
              </span>
              <span className="hidden sm:inline text-xs text-slate-500">•</span>
              <span className="hidden sm:inline text-xs font-mono text-slate-400">
                {explanation?.confluenceRatio || `${signal.confirmations} ${t('signals.confirmations', 'Confluences')}`}
              </span>
            </div>
            <h3 className="text-sm sm:text-base font-bold text-slate-100 mt-0.5">
              {tDynamic(verdictTitle)}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2 text-slate-400">
          <span className="text-xs font-medium hidden sm:inline">
            {isExpanded ? t('signals.hideBreakdown', 'Hide Breakdown') : t('signals.viewFullRationale', 'View Full Rationale')}
          </span>
          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </div>
      </div>

      {/* Main Breakdown Content */}
      {isExpanded && (
        <div className="p-5 space-y-5 text-xs text-slate-300">
          {/* Executive Summary */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80">
            <div className="flex items-center gap-1.5 font-semibold text-slate-200 mb-1">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>{tDynamic('Algorithmic Thesis & Market Driver:')}</span>
            </div>
            <p className="text-slate-300 leading-relaxed">{tDynamic(summary)}</p>
          </div>

          {/* Technical Evidence Table */}
          {evidence.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold uppercase tracking-wider text-slate-400 text-[11px] flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-sky-400" />
                  {tDynamic('Quantitative Indicator Evidence')} ({evidence.length})
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {evidence.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-slate-950/50 border border-slate-800/80 space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-200">{item.indicator}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono ${
                          item.status === 'SUPPORTIVE'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : item.status === 'CONTRADICTORY'
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}
                      >
                        {item.status === 'SUPPORTIVE'
                          ? t('strategies.ready', 'SUPPORTIVE')
                          : item.status === 'CONTRADICTORY'
                          ? t('strategies.noSetup', 'OPPOSING')
                          : t('strategies.waitingData', 'NEUTRAL')}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 truncate">
                      {typeof item.value === 'object' && item.value !== null
                        ? ((item.value as any).signal && (item.value as any).value ? `${(item.value as any).signal} (${(item.value as any).value})` : JSON.stringify(item.value))
                        : String(item.value ?? '')}
                    </div>
                    <div className="text-[11px] text-slate-300 leading-snug">
                      {typeof item.interpretation === 'object' && item.interpretation !== null
                        ? JSON.stringify(item.interpretation)
                        : tDynamic(String(item.interpretation ?? ''))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Supporting & Opposing Breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Supporting Factors */}
            <div className="p-3.5 rounded-xl bg-slate-950/50 border border-slate-800/80">
              <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {t('signals.supportingFactors', 'Supporting Strategies')} ({supporting.length})
                </span>
              </div>
              {supporting.length > 0 ? (
                <div className="space-y-1.5">
                  {supporting.slice(0, 6).map((s, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-[11px] bg-slate-900/60 px-2 py-1 rounded border border-slate-800/60"
                    >
                      <span className="font-medium text-slate-200 truncate">{s.name}</span>
                      <span className="font-mono text-emerald-400 font-bold ml-2">
                        {s.percentage}%
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-slate-500 italic text-[11px]">
                  {tDynamic('No directional consensus reached yet.')}
                </div>
              )}
            </div>

            {/* Opposing / Conflicting Factors */}
            <div className="p-3.5 rounded-xl bg-slate-950/50 border border-slate-800/80">
              <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-rose-400">
                <span className="flex items-center gap-1">
                  <XCircle className="w-3.5 h-3.5" />
                  {t('signals.opposingFactors', 'Opposing Factors')} ({opposing.length})
                </span>
              </div>
              {opposing.length > 0 ? (
                <div className="space-y-1.5">
                  {opposing.slice(0, 6).map((o, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-[11px] bg-slate-900/60 px-2 py-1 rounded border border-slate-800/60"
                    >
                      <span className="font-medium text-slate-300 truncate">{o.name}</span>
                      <span className="font-mono text-rose-400 font-bold ml-2">{tTerm(o.signal)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-slate-400 text-[11px] flex items-center gap-1.5 py-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{tDynamic('Zero significant opposing signals detected. High directional clarity.')}</span>
                </div>
              )}
            </div>
          </div>

          {/* If Signal is WAIT: Show Unlock Requirements */}
          {isWait && explanation?.unlockRequirements && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-2">
              <div className="flex items-center gap-1.5 text-amber-400 font-bold uppercase tracking-wider text-[11px]">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{t('signals.unlockRequirements', 'Requirements to Unlock Signal')}:</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] text-amber-200/90">
                {explanation.unlockRequirements.map((req, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                    <span>{tDynamic(req)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Institutional Advanced Structures (Gann, Elliott Wave, Darvas Box) */}
          {(signal.gannData || signal.elliottData || signal.darvasData) && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              {signal.gannData && (
                <div className="p-3 rounded-xl bg-slate-950/60 border border-amber-500/25 space-y-1 text-[11px]">
                  <div className="text-[10px] font-bold text-amber-300 uppercase tracking-wide flex items-center justify-between">
                    <span>GANN PRICE/TIME</span>
                    <span className="font-mono text-slate-400">{signal.gannData.dominantTrend || 'ACTIVE'}</span>
                  </div>
                  <div className="text-slate-300 font-mono text-[10px]">
                    Anchor: <span className="text-amber-200">
                      {typeof signal.gannData.anchorHigh?.price === 'number'
                        ? signal.gannData.anchorHigh.price.toFixed(4)
                        : (typeof (signal.gannData as any).anchorPrice === 'number'
                            ? (signal.gannData as any).anchorPrice.toFixed(4)
                            : (signal.gannData.angles?.[0]?.anchorPrice != null
                                ? signal.gannData.angles[0].anchorPrice.toFixed(4)
                                : '—'))}
                    </span>
                  </div>
                  <div className="text-slate-400 text-[10px]">
                    Square: <span className="text-slate-200">
                      {signal.gannData.isPriceTimeSquared
                        ? `Squared (${signal.gannData.priceTimeSquareRatio ?? 1}x)`
                        : ((signal.gannData as any).timeSquareStatus || 'Cycles Active')}
                    </span>
                  </div>
                </div>
              )}
              {signal.elliottData && (
                <div className="p-3 rounded-xl bg-slate-950/60 border border-sky-500/25 space-y-1 text-[11px]">
                  <div className="text-[10px] font-bold text-sky-300 uppercase tracking-wide flex items-center justify-between">
                    <span>ELLIOTT WAVE</span>
                    <span className="font-mono text-slate-400">W{signal.elliottData.currentWave ?? '—'}</span>
                  </div>
                  <div className="text-slate-300 font-mono text-[10px]">
                    Status: <span className="text-sky-300">{signal.elliottData.structureStatus || 'Forming'}</span>
                  </div>
                  <div className="text-slate-400 text-[10px]">
                    Conf: <span className="text-emerald-400 font-bold">{signal.elliottData.confidenceScore ?? 0}%</span>
                  </div>
                </div>
              )}
              {signal.darvasData?.activeBox && (
                <div className="p-3 rounded-xl bg-slate-950/60 border border-rose-500/25 space-y-1 text-[11px]">
                  <div className="text-[10px] font-bold text-rose-300 uppercase tracking-wide flex items-center justify-between">
                    <span>DARVAS BOX</span>
                    <span className="font-mono text-slate-400">{signal.darvasData.activeBox.isConfirmed ? 'CONFIRMED' : 'FORMING'}</span>
                  </div>
                  <div className="text-slate-300 font-mono text-[10px]">
                    Range: <span className="text-rose-300">
                      {typeof signal.darvasData.activeBox.lower === 'number' ? signal.darvasData.activeBox.lower.toFixed(3) : '—'} - {typeof signal.darvasData.activeBox.upper === 'number' ? signal.darvasData.activeBox.upper.toFixed(3) : '—'}
                    </span>
                  </div>
                  <div className="text-slate-400 text-[10px]">
                    State: <span className="text-slate-200">{signal.darvasData.activeBox.breakoutStatus || 'INSIDE'}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Anti-Repainting & Audit Footer */}
          <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
            <div className="flex items-center gap-1.5 text-emerald-400">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>
                {t('signals.nonRepaintingNotice', 'Audited Non-Repainting: Calculated exclusively from confirmed closed candles.')}
              </span>
            </div>
            <div className="font-mono text-slate-400">
              {tTerm('Market Structure')}:{' '}
              <strong className="text-slate-200">
                {tTerm(explanation?.marketRegime || signal.marketRegime)}
              </strong>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
