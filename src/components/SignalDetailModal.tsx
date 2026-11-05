import React, { useState } from 'react';
import { Signal } from '../types';
import { X, CheckCircle2, XCircle, Clock, ShieldAlert, Award, ArrowUpRight, ArrowDownRight, Activity, Send, Bot, RefreshCw } from 'lucide-react';
import { SignalExplanationCard } from './SignalExplanationCard';
import { useLanguage } from '../i18n/LanguageContext';
import { telegramService } from '../services/TelegramService';

interface SignalDetailModalProps {
  signal: Signal | null;
  onClose: () => void;
}

export const SignalDetailModal: React.FC<SignalDetailModalProps> = ({ signal, onClose }) => {
  const { t, tTerm, isRTL, language } = useLanguage();
  const [broadcastStatus, setBroadcastStatus] = useState<string | null>(null);
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  if (!signal) return null;

  const isUp = signal.type === 'UP';
  const isDown = signal.type === 'DOWN';
  const isWait = signal.type === 'WAIT';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center space-x-3 rtl:space-x-reverse">
            <span
              className={`p-2 rounded-xl flex items-center justify-center ${
                isUp
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : isDown
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              }`}
            >
              {isUp ? (
                <ArrowUpRight className="w-6 h-6" />
              ) : isDown ? (
                <ArrowDownRight className="w-6 h-6" />
              ) : (
                <Clock className="w-6 h-6" />
              )}
            </span>
            <div>
              <div className="flex items-center space-x-2 rtl:space-x-reverse">
                <h3 className="text-base font-bold text-slate-100">
                  {signal.asset} — {tTerm(signal.type)} {t('signals.activeSignal', 'Signal Analysis')}
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                  {signal.timeframe}s {t('chart.timeframe', 'Timeframe')}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {language === 'ar' ? 'توقيت التوليد:' : language === 'ru' ? 'Сформирован:' : 'Generated at'}{' '}
                {new Date(signal.timestamp).toLocaleTimeString()} ({t('signals.triggerCandle', 'Candle')}:{' '}
                {new Date(signal.candleTimestamp * 1000).toLocaleTimeString()})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 scrollbar-thin scrollbar-thumb-slate-700">
          {/* Analysis Framework Status & Audit Meta Banner */}
          <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/60 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 font-mono">
              <span className="text-slate-400">{t('strategies.analysisMode', 'Analysis Mode')}:</span>
              <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-400 border border-sky-500/30 font-bold">
                {signal.analysisMode === 'INTRABAR' ? t('strategies.intrabarMode', 'INTRABAR') : t('strategies.closedCandleMode', 'CLOSED CANDLE')}
              </span>
              <span className="text-slate-500">•</span>
              <span className="text-slate-400">{language === 'ar' ? 'آلة الحالة:' : language === 'ru' ? 'Автомат состояний:' : 'State Machine:'}</span>
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold">
                {signal.stateMachineState || 'SIGNAL_GENERATED'}
              </span>
            </div>
            <div className="text-[11px] font-mono text-slate-400">
              {language === 'ar' ? 'إصدار التدقيق:' : language === 'ru' ? 'Версия аудита:' : 'Audit Version:'} <strong className="text-slate-200">v{signal.analysisVersion || 1}</strong>
            </div>
          </div>

          {/* Strategy Confidence & Validation Audit Card */}
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/80 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <ShieldAlert className="w-3.5 h-3.5 text-blue-400" />
                <span>{t('strategies.confluenceEngine', 'Quantitative Strategy Confidence & Audit Gate')}</span>
              </h4>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                  signal.type !== 'WAIT'
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                    : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                }`}
              >
                {signal.type !== 'WAIT'
                  ? (language === 'ar' ? 'إشارة معتمدة ونشطة' : language === 'ru' ? 'СИГНАЛ ПОДТВЕРЖДЕН' : 'SIGNAL CONFIRMED & ACTIVE')
                  : (language === 'ar' ? 'في حالة انتظار دفاعية' : language === 'ru' ? 'РЕЖИМ ОЖИДАНИЯ' : 'HOLDING IN WAIT STATE')}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono text-xs">
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block">{language === 'ar' ? 'محرك الثقة' : language === 'ru' ? 'Движок' : 'Confidence Engine'}</span>
                <span className="text-base font-black text-emerald-400">AUTOMATIC</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block">{t('signals.confidence', 'Calculated Confidence')}</span>
                <span
                  className={`text-base font-black ${
                    signal.type !== 'WAIT'
                      ? 'text-emerald-400'
                      : 'text-amber-400'
                  }`}
                >
                  {signal.actualConfidence ?? signal.confidence ?? 0}%
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block">{t('strategies.status', 'Validation State')}</span>
                <span className="font-bold text-slate-200">
                  {signal.validation?.validationState || (signal.type === 'WAIT' ? 'WAITING' : 'CONFIRMED')}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block">{t('chart.formingCandle', 'Candle Structure')}</span>
                <span
                  className={`font-bold ${
                    signal.candle?.direction === 'BULLISH'
                      ? 'text-emerald-400'
                      : signal.candle?.direction === 'BEARISH'
                      ? 'text-rose-400'
                      : 'text-slate-300'
                  }`}
                >
                  {tTerm(signal.candle?.direction || 'NEUTRAL')} ({signal.candle?.pattern || 'STD'})
                </span>
              </div>
            </div>

            {/* Audit Trail Conditions */}
            {signal.auditTrail && (
              <div className="space-y-1.5 pt-1 text-[11px] font-mono">
                {signal.auditTrail.passedConditions?.map((p, i) => (
                  <div key={`p-${i}`} className="flex items-center gap-1.5 text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>{p}</span>
                  </div>
                ))}
                {signal.auditTrail.failedConditions?.map((f, i) => (
                  <div key={`f-${i}`} className="flex items-center gap-1.5 text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded">
                    <Clock className="w-3.5 h-3.5 shrink-0" />
                    <span>{f}</span>
                  </div>
                ))}
                {signal.auditTrail.conflicts?.map((c, i) => (
                  <div key={`c-${i}`} className="flex items-center gap-1.5 text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded">
                    <XCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>Conflict: {c}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Trigger Candle Exact OHLC */}
          {signal.triggerCandle && (
            <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/70">
              <div className="flex items-center justify-between mb-2.5">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-amber-400" />
                  <span>{t('signals.triggerCandle', 'Exact Trigger Candle OHLC')}</span>
                </h4>
                <span className="text-[10px] font-mono text-slate-400">
                  {t('signals.candleTime', 'Candle Time')}: {new Date((signal.triggerCandle.time || signal.candleTimestamp) * 1000).toLocaleTimeString()}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono text-xs">
                <div className="p-2 rounded bg-slate-900 border border-slate-800/80">
                  <span className="text-[10px] text-slate-500 uppercase block">{tTerm('Open')}</span>
                  <span className="font-bold text-slate-200">{signal.triggerCandle.open?.toFixed(5) ?? 'N/A'}</span>
                </div>
                <div className="p-2 rounded bg-slate-900 border border-slate-800/80">
                  <span className="text-[10px] text-emerald-500 uppercase block">{tTerm('High')}</span>
                  <span className="font-bold text-emerald-400">{signal.triggerCandle.high?.toFixed(5) ?? 'N/A'}</span>
                </div>
                <div className="p-2 rounded bg-slate-900 border border-slate-800/80">
                  <span className="text-[10px] text-rose-500 uppercase block">{tTerm('Low')}</span>
                  <span className="font-bold text-rose-400">{signal.triggerCandle.low?.toFixed(5) ?? 'N/A'}</span>
                </div>
                <div className="p-2 rounded bg-slate-900 border border-slate-800/80">
                  <span className="text-[10px] text-sky-500 uppercase block">{tTerm('Close')}</span>
                  <span className="font-bold text-sky-300">{signal.triggerCandle.close?.toFixed(5) ?? 'N/A'}</span>
                </div>
              </div>
            </div>
          )}

          {/* Indicator Snapshot at Signal Generation */}
          {signal.indicatorSnapshot && (
            <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/70">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center gap-2">
                <Award className="w-3.5 h-3.5 text-sky-400" />
                <span>{language === 'ar' ? 'لقطة المؤشرات الفنية المدققة' : language === 'ru' ? 'Снимок индикаторов' : 'Audited Technical Indicator Snapshot'}</span>
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs">
                {signal.indicatorSnapshot.ema9 !== undefined && (
                  <div className="p-2 rounded bg-slate-900 border border-slate-800/80">
                    <span className="text-[10px] text-slate-500 uppercase block">EMA 9</span>
                    <span className="text-slate-200 font-semibold">{Number(signal.indicatorSnapshot.ema9)?.toFixed(5) ?? 'N/A'}</span>
                  </div>
                )}
                {signal.indicatorSnapshot.ema21 !== undefined && (
                  <div className="p-2 rounded bg-slate-900 border border-slate-800/80">
                    <span className="text-[10px] text-slate-500 uppercase block">EMA 21</span>
                    <span className="text-slate-200 font-semibold">{Number(signal.indicatorSnapshot.ema21)?.toFixed(5) ?? 'N/A'}</span>
                  </div>
                )}
                {signal.indicatorSnapshot.sma50 !== undefined && (
                  <div className="p-2 rounded bg-slate-900 border border-slate-800/80">
                    <span className="text-[10px] text-slate-500 uppercase block">SMA 50</span>
                    <span className="text-slate-200 font-semibold">{Number(signal.indicatorSnapshot.sma50)?.toFixed(5) ?? 'N/A'}</span>
                  </div>
                )}
                {signal.indicatorSnapshot.rsi !== undefined && (
                  <div className="p-2 rounded bg-slate-900 border border-slate-800/80">
                    <span className="text-[10px] text-slate-500 uppercase block">RSI (14)</span>
                    <span className={`font-semibold ${Number(signal.indicatorSnapshot.rsi) >= 70 ? 'text-rose-400' : Number(signal.indicatorSnapshot.rsi) <= 30 ? 'text-emerald-400' : 'text-slate-200'}`}>
                      {Number(signal.indicatorSnapshot.rsi)?.toFixed(1) ?? 'N/A'}
                    </span>
                  </div>
                )}
                {signal.indicatorSnapshot.macd !== undefined && (
                  <div className="p-2 rounded bg-slate-900 border border-slate-800/80">
                    <span className="text-[10px] text-slate-500 uppercase block">MACD</span>
                    <span className="text-slate-200 font-semibold">{Number(signal.indicatorSnapshot.macd)?.toFixed(5) ?? 'N/A'}</span>
                  </div>
                )}
                {signal.indicatorSnapshot.bollingerPercentB !== undefined && (
                  <div className="p-2 rounded bg-slate-900 border border-slate-800/80">
                    <span className="text-[10px] text-slate-500 uppercase block">Bollinger %B</span>
                    <span className="text-slate-200 font-semibold">{Number(signal.indicatorSnapshot.bollingerPercentB)?.toFixed(3) ?? 'N/A'}</span>
                  </div>
                )}
                {signal.indicatorSnapshot.atr !== undefined && (
                  <div className="p-2 rounded bg-slate-900 border border-slate-800/80">
                    <span className="text-[10px] text-slate-500 uppercase block">ATR (14)</span>
                    <span className="text-slate-200 font-semibold">{Number(signal.indicatorSnapshot.atr)?.toFixed(5) ?? 'N/A'}</span>
                  </div>
                )}
                {signal.indicatorSnapshot.adx !== undefined && (
                  <div className="p-2 rounded bg-slate-900 border border-slate-800/80">
                    <span className="text-[10px] text-slate-500 uppercase block">ADX</span>
                    <span className="text-slate-200 font-semibold">{Number(signal.indicatorSnapshot.adx)?.toFixed(1) ?? 'N/A'}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Dedicated Transparent Reasoning Engine Card */}
          <SignalExplanationCard signal={signal} defaultExpanded={true} />

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/40">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block mb-1">
                {t('signals.entryPrice', 'Reference Price')}
              </span>
              <span className="text-sm font-bold font-mono text-slate-200">
                {signal.price ? signal.price.toFixed(5) : 'N/A'}
              </span>
            </div>

            <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/40">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block mb-1">
                {signal.scoreLabel || t('signals.confluenceScore', 'Strategy Score')}
              </span>
              <span className="text-sm font-bold font-mono text-emerald-400">
                {signal.actualConfidence ?? signal.score ?? signal.confidence}%
              </span>
            </div>

            <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/40">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block mb-1">
                {t('signals.confirmations', 'Confirmations')}
              </span>
              <span className="text-sm font-bold font-mono text-slate-200">
                {signal.confirmations} / {signal.totalStrategies || 21} {language === 'ar' ? 'مؤكد' : language === 'ru' ? 'Подтверждено' : 'Agree'}
              </span>
            </div>

            <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/40">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block mb-1">
                {language === 'ar' ? 'نتيجة الصفقة' : language === 'ru' ? 'Результат' : 'Outcome'}
              </span>
              <span
                className={`text-xs font-bold font-mono px-2 py-0.5 rounded inline-block ${
                  signal.status === 'WON'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : signal.status === 'LOST'
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                {signal.status}
              </span>
            </div>
          </div>

          {/* Primary Reason */}
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              {t('signals.verdict', 'Algorithmic Decision Summary')}
            </h4>
            <p className="text-sm font-medium text-slate-200 leading-relaxed mb-3">
              {typeof signal.reason === 'object' && signal.reason !== null ? JSON.stringify(signal.reason) : String(signal.reason || '')}
            </p>
            {signal.details && signal.details.length > 0 && (
              <ul className="space-y-1 text-xs text-slate-300">
                {signal.details.map((d: any, i) => (
                  <li key={i} className="flex items-start space-x-2 rtl:space-x-reverse">
                    <span className="text-blue-400 font-bold">•</span>
                    <span>{typeof d === 'object' && d !== null ? JSON.stringify(d) : String(d)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Specialized Structural Analysis Engines (Gann / Elliott / Darvas) */}
          {(signal.gannData || signal.elliottData || signal.darvasData) && (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <span>⚡ Rule-Based Structural Deep Dive</span>
              </h4>

              {/* 1. Gann Analysis Card */}
              {signal.gannData && (
                <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-950/15 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-amber-300 font-mono">W.D. GANN PRICE/TIME ANALYSIS</span>
                    <span className="text-[10px] font-mono text-slate-400">
                      Anchor: {typeof signal.gannData.anchorHigh?.price === 'number' ? signal.gannData.anchorHigh.price.toFixed(5) : 'N/A'} / {typeof signal.gannData.anchorLow?.price === 'number' ? signal.gannData.anchorLow.price.toFixed(5) : 'N/A'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
                    <div className="p-2 rounded bg-slate-950/60 border border-slate-800">
                      <span className="text-[10px] text-slate-500 block">50% EQUILIBRIUM</span>
                      <span className="font-bold text-amber-400">
                        {signal.gannData.gannLevels?.find((l) => l.type === 'EQUILIBRIUM')?.price?.toFixed(5) ?? 'N/A'}
                      </span>
                    </div>
                    <div className="p-2 rounded bg-slate-950/60 border border-slate-800">
                      <span className="text-[10px] text-slate-500 block">1x1 BALANCE ANGLE</span>
                      <span className="font-bold text-sky-400">
                        {signal.gannData.angles?.[0]?.currentValue?.toFixed(5) ?? 'N/A'}
                      </span>
                    </div>
                    <div className="p-2 rounded bg-slate-950/60 border border-slate-800">
                      <span className="text-[10px] text-slate-500 block">ELAPSED TIME BARS</span>
                      <span className="font-bold text-slate-200">
                        {signal.gannData.elapsedBars ?? 0} (Cycle {signal.gannData.nearestTimeCycle ?? 'N/A'})
                      </span>
                    </div>
                    <div className="p-2 rounded bg-slate-950/60 border border-slate-800">
                      <span className="text-[10px] text-slate-500 block">PRICE/TIME SQUARED</span>
                      <span className={`font-bold ${signal.gannData.isPriceTimeSquared ? 'text-emerald-400' : 'text-slate-400'}`}>
                        {signal.gannData.isPriceTimeSquared ? `YES (${signal.gannData.priceTimeSquareRatio ?? 1}x)` : `NO (${signal.gannData.priceTimeSquareRatio ?? 0}x)`}
                      </span>
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-300 font-mono bg-slate-950/50 p-2 rounded border border-slate-800">
                    {signal.gannData.levelInteraction || signal.gannData.currentStatus}
                  </div>
                </div>
              )}

              {/* 2. Elliott Wave Card */}
              {signal.elliottData && (
                <div className="p-3.5 rounded-xl border border-sky-500/30 bg-sky-950/15 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-sky-300 font-mono">RALPH NELSON ELLIOTT WAVE ANALYSIS</span>
                    <span className="text-[10px] font-mono text-sky-400 font-bold">{signal.elliottData.confidenceScore ?? 0}% Rule Match</span>
                  </div>
                  <div className="p-2 rounded bg-slate-950/60 border border-slate-800 text-[11px] font-mono space-y-1">
                    <div><span className="text-slate-500">PRIMARY: </span><strong className="text-emerald-400">{signal.elliottData.primaryCount || 'Wave Structure Active'}</strong></div>
                    <div><span className="text-slate-500">ALTERNATIVE: </span><strong className="text-slate-400">{signal.elliottData.alternativeCount || '—'}</strong></div>
                  </div>
                  <div className="space-y-1 pt-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Verified Structural Impulse Rules:</span>
                    {Array.isArray(signal.elliottData.rulesChecked) && signal.elliottData.rulesChecked.map((r, idx) => (
                      <div key={idx} className="flex items-start gap-1.5 text-[11px] font-mono bg-slate-950/40 p-1.5 rounded border border-slate-800/60">
                        <span className={r.passed ? 'text-emerald-400' : 'text-rose-400'}>{r.passed ? '✓' : '✗'}</span>
                        <span className="text-slate-300 flex-1">{r.rule} — <span className="text-slate-400">{r.note}</span></span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. Nicolas Darvas Box Card */}
              {signal.darvasData && signal.darvasData.activeBox && (
                <div className="p-3.5 rounded-xl border border-rose-500/30 bg-rose-950/15 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-rose-300 font-mono">NICOLAS DARVAS BOX STRATEGY</span>
                    <span className="text-[10px] font-mono text-amber-300 font-bold">{signal.darvasData.activeBox.isConfirmed ? 'BOX CONFIRMED' : 'BOX FORMING'}</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
                    <div className="p-2 rounded bg-slate-950/60 border border-slate-800">
                      <span className="text-[10px] text-slate-500 block">UPPER BOUNDARY</span>
                      <span className="font-bold text-rose-400">{typeof signal.darvasData.activeBox.upper === 'number' ? signal.darvasData.activeBox.upper.toFixed(5) : 'N/A'}</span>
                    </div>
                    <div className="p-2 rounded bg-slate-950/60 border border-slate-800">
                      <span className="text-[10px] text-slate-500 block">LOWER BOUNDARY</span>
                      <span className="font-bold text-emerald-400">{typeof signal.darvasData.activeBox.lower === 'number' ? signal.darvasData.activeBox.lower.toFixed(5) : 'N/A'}</span>
                    </div>
                    <div className="p-2 rounded bg-slate-950/60 border border-slate-800">
                      <span className="text-[10px] text-slate-500 block">CANDLES IN BOX</span>
                      <span className="font-bold text-slate-200">{signal.darvasData.activeBox.candlesInside ?? 0} candles</span>
                    </div>
                    <div className="p-2 rounded bg-slate-950/60 border border-slate-800">
                      <span className="text-[10px] text-slate-500 block">BREAKOUT STATUS</span>
                      <span className={`font-bold ${signal.darvasData.breakoutStatus?.includes('UP') ? 'text-emerald-400' : signal.darvasData.breakoutStatus?.includes('DOWN') ? 'text-rose-400' : 'text-amber-400'}`}>
                        {signal.darvasData.breakoutStatus || 'INSIDE'}
                      </span>
                    </div>
                  </div>
                  {Array.isArray(signal.darvasData.evidenceNotes) && signal.darvasData.evidenceNotes.length > 0 && (
                    <ul className="text-[10px] text-slate-400 font-mono space-y-0.5 bg-slate-950/40 p-2 rounded border border-slate-800">
                      {signal.darvasData.evidenceNotes.map((note, nIdx) => (
                        <li key={nIdx}>• {note}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Strategy Votes Breakdown */}
          {signal.strategies && signal.strategies.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                {t('strategies.activeModules', 'Full Strategy Voting Breakdown')} ({signal.strategies.length} {language === 'ar' ? 'وحدة' : language === 'ru' ? 'модулей' : 'Modules'})
              </h4>
              <div className="space-y-2">
                {signal.strategies.map((strat) => {
                  const sUp = strat.signal === 'UP';
                  const sDown = strat.signal === 'DOWN';

                  return (
                    <div
                      key={strat.strategyId}
                      className="p-3 rounded-lg border border-slate-800 bg-slate-950/40 flex items-start justify-between text-xs"
                    >
                      <div className="space-y-1 max-w-[75%]">
                        <div className="flex items-center space-x-2 rtl:space-x-reverse">
                          <span className="font-semibold text-slate-200">{strat.strategyName}</span>
                          <span className="text-[10px] font-mono text-slate-500">
                            ({t('strategies.weight', 'Weight')}: {typeof strat.weight === 'number' ? strat.weight.toFixed(1) : '1.0'}x)
                          </span>
                        </div>
                        {Array.isArray(strat.reasons) && strat.reasons.length > 0 && (
                          <p className="text-slate-400 text-[11px] leading-snug">
                            {strat.reasons.map((r: any) => typeof r === 'object' && r !== null ? (r.signal && r.value ? `${r.signal} (${r.value})` : JSON.stringify(r)) : String(r)).join('; ')}
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0 font-mono">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            sUp
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : sDown
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          {strat.signal}
                        </span>
                        <div className="text-[10px] text-slate-500 mt-1">
                          {t('strategies.score', 'Score')}: {typeof strat.score === 'number' ? (strat.score > 0 ? `+${strat.score.toFixed(1)}` : strat.score.toFixed(1)) : '0.0'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Broadcast to Telegram Action */}
          <div className="p-3 rounded-xl border border-blue-500/30 bg-blue-950/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-blue-400" />
              <div>
                <span className="text-xs text-blue-200 font-bold block">
                  {language === 'ar' ? 'بث الإشارة الحية إلى بوت وقناة التلجرام' : 'Broadcast to Telegram Channel'}
                </span>
                {broadcastStatus && (
                  <span className="text-[10px] text-amber-300 font-mono block mt-0.5">
                    {broadcastStatus}
                  </span>
                )}
              </div>
            </div>

            <button
              disabled={signal.type === 'WAIT' || isBroadcasting}
              onClick={async () => {
                if (signal.type === 'WAIT' || isBroadcasting) return;
                setIsBroadcasting(true);
                setBroadcastStatus(language === 'ar' ? 'جاري البث...' : 'Broadcasting...');
                try {
                  const res = await telegramService.broadcastSignal({
                    asset: signal.asset,
                    timeframe: signal.timeframe,
                    type: signal.type,
                    confidence: signal.confidence,
                    price: signal.entryPrice,
                    expirySeconds: signal.expiryDurationSec || (signal as any).expiryDurationSeconds || 120,
                    strategy: signal.strategy,
                    confirmations: signal.confirmations,
                  });
                  setIsBroadcasting(false);
                  if (res.success) {
                    setBroadcastStatus(language === 'ar' ? '✅ تم بث الإشارة بنجاح!' : '✅ Signal broadcasted successfully!');
                  } else {
                    setBroadcastStatus(`⚠️ ${res.error || (language === 'ar' ? 'فشل البث' : 'Broadcast failed')}`);
                  }
                } catch (e: any) {
                  setIsBroadcasting(false);
                  setBroadcastStatus(`❌ ${e?.message || 'Error'}`);
                }
              }}
              className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow transition-all shrink-0"
            >
              {isBroadcasting ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>{isBroadcasting ? (language === 'ar' ? 'جاري الإرسال...' : 'Sending...') : (language === 'ar' ? 'بث الآن' : 'Broadcast Now')}</span>
            </button>
          </div>

          {/* Capital Preservation Notice */}
          <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/80 text-[11px] text-slate-400 flex items-center justify-between">
            <span>{t('signals.expiry', 'Expiry Recommendation')}: {signal.expiryRecommendation}</span>
            <span className="font-mono text-slate-500">ID: {signal.id}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
