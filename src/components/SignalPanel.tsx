import React, { useState, useEffect } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Clock,
  Info,
  Pause,
  Play,
  ShieldAlert,
  ShieldCheck,
  Zap,
  Activity,
  Layers,
  AlertCircle,
  Eye,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Power,
  Volume2,
  VolumeX,
  Copy,
  Check,
  Sparkles,
  Star,
} from 'lucide-react';
import { Signal } from '../types';
import { SignalExplanationCard } from './SignalExplanationCard';
import { useLanguage } from '../i18n/LanguageContext';
import { audioAlerts } from '../lib/audioAlerts';

interface SignalPanelProps {
  signal: Signal | null;
  selectedThreshold?: number;
  onThresholdChange?: (threshold: number) => void;
  isStale?: boolean;
  freshnessSeconds?: number;
  isAnalyzing?: boolean;
  onStartAnalysis?: () => void;
  onStopAnalysis?: () => void;
  onOpenDetail?: () => void;
  onOpenDetails?: () => void;
}

export const SignalPanel: React.FC<SignalPanelProps> = ({
  signal,
  selectedThreshold: propThreshold,
  onThresholdChange,
  isStale = false,
  freshnessSeconds = 0,
  isAnalyzing = true,
  onStartAnalysis,
  onStopAnalysis,
  onOpenDetail,
  onOpenDetails,
}) => {
  const { t, tTerm, tDynamic, isRTL } = useLanguage();

  const handleOpen = onOpenDetail || onOpenDetails;
  const rawType = signal?.type || 'WAIT';
  const engineState = signal?.engineState;
  const isConfirmedUp =
    engineState === 'CONFIRMED_UP' ||
    (signal?.status === 'CONFIRMED' && (rawType === 'UP' || (rawType as any) === 'BUY'));
  const isConfirmedDown =
    engineState === 'CONFIRMED_DOWN' ||
    (signal?.status === 'CONFIRMED' && (rawType === 'DOWN' || (rawType as any) === 'SELL'));

  const signalType: 'UP' | 'DOWN' | 'WAIT' =
    isConfirmedUp || rawType === 'UP' || (rawType as any) === 'BUY'
      ? 'UP'
      : isConfirmedDown || rawType === 'DOWN' || (rawType as any) === 'SELL'
      ? 'DOWN'
      : 'WAIT';

  const candle = signal?.candle;
  const validation = signal?.validation;
  const auditTrail = signal?.auditTrail;

  const isUp = signalType === 'UP';
  const isDown = signalType === 'DOWN';
  const isWait = signalType === 'WAIT';
  const isValidating =
    isWait &&
    (validation?.validationState === 'VALIDATING' ||
      engineState === 'VALIDATING' ||
      signal?.status === 'VALIDATING');

  const actualConfidence = signal?.actualConfidence ?? (signal?.confidence ?? (signal?.strength ?? 0));
  const configuredThreshold = propThreshold ?? signal?.selectedThreshold ?? 70;
  const isThresholdMet = actualConfidence >= configuredThreshold;

  const strength = signal?.strength ?? (isUp || isDown ? actualConfidence : null);
  const score = signal?.score ?? 0;
  const reason = signal?.reason || 'Awaiting closed candle confirmation...';
  const details = signal?.details || [];
  const expiry = signal?.expiryRecommendation || '1 Minute';
  const confirmations = signal?.confirmations ?? 0;
  const totalStrategies = signal?.totalStrategies ?? (signal?.strategies?.length || 21);
  const asset = signal?.asset || 'EURUSD_otc';
  const timeframe = signal?.timeframe || 60;
  const tfLabel = timeframe >= 60 ? `${Math.round(timeframe / 60)} MIN` : `${timeframe} SEC`;
  const dataStatus = isStale ? 'STALE' : signal?.dataStatus || 'LIVE';

  const updateTime = signal?.timestamp
    ? new Date(signal.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

  // Audio Alerts State & Preferences
  const [soundOn, setSoundOn] = useState<boolean>(audioAlerts.isSoundEnabled());
  const [voiceOn, setVoiceOn] = useState<boolean>(audioAlerts.isVoiceEnabled());
  const [copied, setCopied] = useState<boolean>(false);



  // Trigger audio alert when a confirmed UP or DOWN signal is received
  useEffect(() => {
    if (signal && (signalType === 'UP' || signalType === 'DOWN') && signal.status === 'CONFIRMED') {
      audioAlerts.notifySignal({
        id: signal.id,
        type: signalType,
        asset,
        confidence: actualConfidence,
        signalGrade: signal.signalGrade,
      });
    }
  }, [signal?.id, signalType, signal?.status, asset, actualConfidence]);

  const handleToggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    audioAlerts.setSoundEnabled(next);
    if (next) audioAlerts.playBullishChime();
  };

  const handleToggleVoice = () => {
    const next = !voiceOn;
    setVoiceOn(next);
    audioAlerts.setVoiceEnabled(next);
    if (next) audioAlerts.speak('تم تفعيل التنبيه الصوتي بنجاح', 'ar');
  };

  const handleCopyTrade = () => {
    if (!signal) return;
    const directionText = signalType === 'UP' ? 'CALL (شراء صاعد)' : signalType === 'DOWN' ? 'PUT (بيع هابط)' : 'WAIT';
    const copyText = `[POCKET OPTION SIGNAL]\nالأصل المالي: ${asset}\nالاتجاه: ${directionText}\nالوقت الموصى به: ${expiry}\nنسبة التوافق: ${actualConfidence}%\nرتبة الإشارة: ${signal.signalGrade || 'GRADE_A'}\nسعر الدخول: ${signal.entryPrice ?? signal.price ?? 'سعر السوق اللحظي'}`;
    
    navigator.clipboard?.writeText(copyText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }).catch(() => {});
  };

  // Border & Glow Palette based on Direction
  const containerClasses = !isAnalyzing
    ? 'border-slate-700 shadow-lg bg-slate-900/90'
    : isUp
    ? 'border-emerald-500/60 shadow-[0_0_35px_rgba(16,185,129,0.22)] bg-gradient-to-b from-slate-900/95 via-emerald-950/20 to-slate-900/95'
    : isDown
    ? 'border-rose-500/60 shadow-[0_0_35px_rgba(244,63,94,0.22)] bg-gradient-to-b from-slate-900/95 via-rose-950/20 to-slate-900/95'
    : 'border-amber-500/40 shadow-[0_0_20px_rgba(245,158,11,0.12)] bg-slate-900/90';

  return (
    <div
      id="signal-panel"
      className={`w-full rounded-2xl border p-5 transition-all duration-300 ${containerClasses}`}
    >
      {/* 1. Header Bar: Asset & Timeframe | LIVE Indicator | Start/Stop Button | Last Update */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800/90 border border-slate-700 text-xs font-mono font-bold text-white tracking-wide">
            <span>{asset}</span>
            <span className="text-slate-400">•</span>
            <span className="text-amber-400">{tfLabel}</span>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/60 border border-slate-700/60 text-[11px] text-slate-300 font-medium">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>{t('signals.expiry', 'Recommended Expiry')}: <strong className="text-slate-100">{expiry}</strong></span>
          </div>
          {/* Analysis Mode Badge (Rule 8) */}
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/60 border border-slate-700 text-[10px] font-mono text-slate-300">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
            <span>{signal?.analysisMode === 'INTRABAR' ? tTerm('Intrabar') : tTerm('Closed Candle')}</span>
          </div>
          {/* State Machine Status Badge (Rule 2) */}
          {signal?.stateMachineState && (
            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/60 border border-slate-700 text-[10px] font-mono text-slate-300">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  signal.stateMachineState === 'SIGNAL_GENERATED' || signal.stateMachineState === 'SETUP_CONFIRMED'
                    ? 'bg-emerald-400'
                    : signal.stateMachineState === 'CONDITIONS_CHECKING' || signal.stateMachineState === 'ANALYZING'
                    ? 'bg-amber-400 animate-pulse'
                    : 'bg-slate-400'
                }`}
              />
              <span>{tDynamic(signal.stateMachineState)}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          {/* Analysis Active / Standby State Button (Bug 108) */}
          {isAnalyzing ? (
            <button
              id="btn-stop-analysis-header"
              onClick={onStopAnalysis}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold transition-all shadow-sm group"
              title={t('signals.stopAnalysis', 'STOP ANALYSIS')}
            >
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              <span>{t('signals.stopAnalysis', 'STOP ANALYSIS')}</span>
            </button>
          ) : (
            <button
              id="btn-start-analysis-header"
              onClick={onStartAnalysis}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 border border-emerald-400 text-xs font-extrabold transition-all shadow-md shadow-emerald-500/20 group"
              title={t('signals.startAnalysis', 'START ANALYSIS')}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{t('signals.startAnalysis', 'START ANALYSIS')}</span>
            </button>
          )}

          {/* Audio Alerts & Voice Controls */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              onClick={handleToggleSound}
              className={`p-1.5 rounded-md text-xs transition-colors ${
                soundOn
                  ? 'text-amber-400 hover:text-amber-300 bg-amber-500/15'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
              title={soundOn ? 'كتم التنبيه الصوتي' : 'تفعيل التنبيه الصوتي (جرس)'}
            >
              {soundOn ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={handleToggleVoice}
              className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold transition-colors ${
                voiceOn
                  ? 'text-emerald-400 hover:text-emerald-300 bg-emerald-500/15'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
              title={voiceOn ? 'تعطيل النطق الآلي بالعربية' : 'تفعيل النطق الآلي لإشارات التداول'}
            >
              VOICE
            </button>
          </div>

          {/* Real-time Data Freshness & Authoritative Source Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-950 border border-slate-800 text-[11px] font-mono">
            <span
              className={`w-2 h-2 rounded-full ${
                dataStatus === 'LIVE' && !isStale ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
              }`}
            />
            <span className={dataStatus === 'LIVE' && !isStale ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
              {dataStatus === 'LIVE' && !isStale
                ? `REAL MARKET DATA • ${signal?.candle?.isAvailable ? (asset.includes('_otc') ? 'Pocket Option OTC' : 'Pocket Option Real Feed') : 'Validated Feed'}`
                : 'NO REAL DATA • WAITING'}
            </span>
          </div>

          <div className="text-[11px] font-mono text-slate-400 hidden sm:block">
            {tTerm('Time')}: <span className="text-slate-200 font-semibold">{updateTime}</span>
          </div>

          {handleOpen && (
            <button
              onClick={handleOpen}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium border border-slate-700 transition-colors"
            >
              <Eye className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden sm:inline">{t('signals.signalDetail', 'Details')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Standby Banner if Analysis is Stopped */}
      {!isAnalyzing && (
        <div className="my-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Pause className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <div className="font-bold text-amber-300">{tDynamic('Quantitative Analysis Pipeline In Standby')}</div>
              <div className="text-[11px] text-amber-200/80">
                {tDynamic('Click "START ANALYSIS" to run multi-strategy evaluation and generate high-probability signals.')}
              </div>
            </div>
          </div>
          <button
            onClick={onStartAnalysis}
            className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md transition-colors"
          >
            {t('signals.startAnalysis', 'START ANALYSIS')}
          </button>
        </div>
      )}

      {/* 2. Hero Signal Section: Direction + Big Arrow + Key Metrics */}
      <div className="my-5 grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
        {/* Direction Badge & Icon (6 cols) */}
        <div className="md:col-span-6 flex items-center gap-4">
          {isUp && (
            <>
              <div className="relative flex items-center justify-center w-14 h-14 sm:w-20 sm:h-20 rounded-2xl bg-emerald-500 text-slate-950 shadow-xl shadow-emerald-500/40 ring-4 ring-emerald-500/20 shrink-0">
                <ArrowUp className="w-8 h-8 sm:w-12 sm:h-12 stroke-[3]" />
              </div>
              <div>
                <div className="text-[10px] sm:text-[11px] uppercase tracking-wider font-bold text-emerald-400/90 flex flex-wrap items-center gap-1.5">
                  <span>{t('signals.currentSignal', 'CURRENT SIGNAL')}</span>
                  <span className="px-1.5 py-0.2 rounded text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    CONFIRMED
                  </span>
                  {signal?.signalGrade && (
                    <span className="px-2 py-0.2 rounded text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono font-bold flex items-center gap-1">
                      <Star className="w-2.5 h-2.5 fill-current text-amber-400" />
                      {signal.signalGrade === 'GRADE_A_PLUS' ? 'A+ ULTRA CONFLUENCE' : signal.signalGrade === 'GRADE_A' ? 'GRADE A' : 'GRADE B'}
                    </span>
                  )}
                  <span className="px-2 py-0.2 rounded text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono font-bold">
                    {signal?.scoreLabel ? signal.scoreLabel.toUpperCase() : 'STRATEGY SCORE'}: {actualConfidence}%
                  </span>
                </div>
                <div className="text-2xl sm:text-4xl font-black text-emerald-400 tracking-tight font-mono flex items-center gap-3">
                  <span>{tTerm('UP')}</span>
                  <button
                    onClick={handleCopyTrade}
                    className="text-xs font-sans font-bold px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 flex items-center gap-1 transition-colors"
                    title="نسخ تفاصيل الصفقة"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'تم النسخ' : 'نسخ الصفقة'}</span>
                  </button>
                </div>
                <div className="text-xs text-emerald-300/80 font-medium mt-0.5">
                  {tDynamic('Institutional Bullish Expansion')} • {signal?.scoreLabel || 'Strategy Score'}: {actualConfidence}%
                </div>
              </div>
            </>
          )}

          {isDown && (
            <>
              <div className="relative flex items-center justify-center w-14 h-14 sm:w-20 sm:h-20 rounded-2xl bg-rose-500 text-slate-950 shadow-xl shadow-rose-500/40 ring-4 ring-rose-500/20 shrink-0">
                <ArrowDown className="w-8 h-8 sm:w-12 sm:h-12 stroke-[3]" />
              </div>
              <div>
                <div className="text-[10px] sm:text-[11px] uppercase tracking-wider font-bold text-rose-400/90 flex flex-wrap items-center gap-1.5">
                  <span>{t('signals.currentSignal', 'CURRENT SIGNAL')}</span>
                  <span className="px-1.5 py-0.2 rounded text-[9px] bg-rose-500/20 text-rose-300 border border-rose-500/40">
                    CONFIRMED
                  </span>
                  {signal?.signalGrade && (
                    <span className="px-2 py-0.2 rounded text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono font-bold flex items-center gap-1">
                      <Star className="w-2.5 h-2.5 fill-current text-amber-400" />
                      {signal.signalGrade === 'GRADE_A_PLUS' ? 'A+ ULTRA CONFLUENCE' : signal.signalGrade === 'GRADE_A' ? 'GRADE A' : 'GRADE B'}
                    </span>
                  )}
                  <span className="px-2 py-0.2 rounded text-[9px] bg-rose-500/20 text-rose-300 border border-rose-500/40 font-mono font-bold">
                    {signal?.scoreLabel ? signal.scoreLabel.toUpperCase() : 'STRATEGY SCORE'}: {actualConfidence}%
                  </span>
                </div>
                <div className="text-2xl sm:text-4xl font-black text-rose-400 tracking-tight font-mono flex items-center gap-3">
                  <span>{tTerm('DOWN')}</span>
                  <button
                    onClick={handleCopyTrade}
                    className="text-xs font-sans font-bold px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 flex items-center gap-1 transition-colors"
                    title="نسخ تفاصيل الصفقة"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'تم النسخ' : 'نسخ الصفقة'}</span>
                  </button>
                </div>
                <div className="text-xs text-rose-300/80 font-medium mt-0.5">
                  {tDynamic('Institutional Bearish Pressure')} • {signal?.scoreLabel || 'Strategy Score'}: {actualConfidence}%
                </div>
              </div>
            </>
          )}

          {isWait && (
            <>
              <div className="relative flex items-center justify-center w-14 h-14 sm:w-20 sm:h-20 rounded-2xl bg-amber-500/20 border-2 border-amber-500/40 text-amber-400 shadow-lg shadow-amber-500/10 shrink-0">
                <Pause className="w-7 h-7 sm:w-10 sm:h-10" />
              </div>
              <div>
                <div className="text-[10px] sm:text-[11px] uppercase tracking-wider font-bold text-amber-400/90 flex items-center gap-1.5">
                  <span>{t('signals.currentSignal', 'CURRENT SIGNAL')}</span>
                  <span className="px-1.5 py-0.2 rounded text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    {isValidating ? 'VALIDATING' : 'WAIT'}
                  </span>
                  {signal?.reasonCode && (
                    <span className="px-1.5 py-0.2 rounded text-[9px] bg-slate-800 text-slate-400 border border-slate-700 font-mono">
                      {signal.reasonCode}
                    </span>
                  )}
                </div>
                <div className="text-4xl font-black text-amber-400 tracking-tight font-mono flex flex-wrap items-baseline gap-2">
                  <span>{tTerm('WAIT')}</span>
                  {signal?.candidateDirection && signal.candidateDirection !== 'WAIT' && (
                    <span className="text-xs font-bold text-sky-400 bg-sky-950/80 px-2 py-0.5 rounded border border-sky-700/60 uppercase tracking-wide">
                      Candidate: {signal.candidateDirection} ({actualConfidence}%)
                    </span>
                  )}
                </div>
                <div className="text-xs text-amber-300/80 font-medium mt-0.5">
                  {signal?.blockedReasons && signal.blockedReasons.length > 0
                    ? `Blocker: ${signal.blockedReasons[0]}`
                    : isValidating
                    ? tDynamic(`Candle Forming • Validating ${signal?.candidateDirection || ''} on Close`)
                    : signal?.reason || tDynamic('Awaiting Clear Market Confluence')}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Confidence & Confluence Gauges (6 cols) */}
        <div className="md:col-span-6 grid grid-cols-2 gap-3">
          {/* Confidence Box */}
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <span>{signal?.scoreLabel || t('signals.confidence', 'Strategy Score')}</span>
              <span className="font-mono text-emerald-400 text-[10px]">{signal?.strategy || 'Confluence'}</span>
            </div>
            <div className="my-1 flex items-baseline justify-between">
              <span
                className={`text-2xl font-black font-mono ${
                  isUp ? 'text-emerald-400' : isDown ? 'text-rose-400' : 'text-amber-400'
                }`}
              >
                {actualConfidence}%
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                {score > 0 ? `+${score}` : score} net
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isUp
                    ? 'bg-emerald-500'
                    : isDown
                    ? 'bg-rose-500'
                    : 'bg-amber-400'
                }`}
                style={{
                  width: `${Math.min(100, Math.max(5, actualConfidence))}%`,
                }}
              />
            </div>
          </div>

          {/* Confluence Box */}
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col justify-between">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {t('signals.confluence', 'Confluence')}
            </div>
            <div className="my-1 flex items-baseline gap-1.5">
              <span
                className={`text-2xl font-black font-mono ${
                  confirmations >= 4
                    ? 'text-emerald-400'
                    : confirmations >= 2
                    ? 'text-sky-400'
                    : 'text-slate-300'
                }`}
              >
                {confirmations}
              </span>
              <span className="text-xs text-slate-400 font-mono">/ {totalStrategies} {t('nav.strategies', 'strategies')}</span>
            </div>
            <div className="text-[10px] text-slate-400 truncate">
              {confirmations >= 3 ? tDynamic('Institutional Consensus') : tDynamic('Quantitative Evaluation')}
            </div>
          </div>
        </div>
      </div>

      {/* Signal Persistence & Expiry Countdown Banner */}
      <div className="mb-4 p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-200">
              Signal Execution Lifecycle:
            </span>
            {isUp || isDown ? (
              <span className="px-2.5 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-mono font-black flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                ACTIVE PERSISTENT SIGNAL
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-lg bg-slate-800 text-slate-400 border border-slate-700 text-xs font-mono font-bold">
                {validation?.validationState === 'VALIDATING' ? 'EVALUATING CANDLE' : 'SCANNING FOR CONFLUENCE'}
              </span>
            )}
          </div>

          <div className="text-xs font-mono">
            {isUp || isDown ? (
              <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Signal Locked • Expiry: {signal?.remainingSeconds ?? (timeframe || 60)}s remaining
              </span>
            ) : (
              <span className="text-slate-400 font-medium flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                Automatic Multi-Strategy Engine Active
              </span>
            )}
          </div>
        </div>

        {/* Live Signal Details if confirmed */}
        {(isUp || isDown) && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px] font-mono">
            <div className="p-2 rounded bg-slate-900 border border-slate-800">
              <span className="text-slate-500 block text-[10px]">ENTRY PRICE</span>
              <span className="text-slate-200 font-bold">{signal?.entryPrice ?? signal?.price ?? '—'}</span>
            </div>
            <div className="p-2 rounded bg-slate-900 border border-slate-800">
              <span className="text-slate-500 block text-[10px]">CURRENT PRICE</span>
              <span className="text-slate-200 font-bold">{signal?.price ?? '—'}</span>
            </div>
            <div className="p-2 rounded bg-slate-900 border border-slate-800">
              <span className="text-slate-500 block text-[10px]">EXPIRY DURATION</span>
              <span className="text-slate-200 font-bold">{signal?.expiryDurationSec ?? timeframe ?? 60}s</span>
            </div>
            <div className="p-2 rounded bg-slate-900 border border-slate-800">
              <span className="text-slate-500 block text-[10px]">COUNTDOWN</span>
              <span className="text-emerald-400 font-bold">{signal?.remainingSeconds ?? (timeframe || 60)}s</span>
            </div>
          </div>
        )}
      </div>



      {/* Real Candle Structure & Pattern Analysis (Rule 15, 37) */}
      {candle && (
        <div className="mb-4 p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold text-slate-300 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-sky-400" />
              <span>Real-Time Candle Structure & Pattern:</span>
            </span>
            <span className="font-mono text-[11px] text-slate-400">
              {candle.isAvailable === false || candle.direction === 'UNAVAILABLE'
                ? 'AWAITING REAL MARKET CANDLE'
                : (candle.pattern || 'STANDARD')}
            </span>
          </div>

          {candle.isAvailable === false || candle.direction === 'UNAVAILABLE' || candle.bodySize === null ? (
            <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/80 flex items-center justify-between font-mono text-[11px]">
              <span className="text-amber-400/90 font-medium">Candle Structure Unavailable</span>
              <span className="text-slate-400">Awaiting verified closed bar from feed</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px]">
              <div className="p-2 rounded bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">Direction:</span>
                <span
                  className={`font-bold ${
                    candle.direction === 'BULLISH'
                      ? 'text-emerald-400'
                      : candle.direction === 'BEARISH'
                      ? 'text-rose-400'
                      : 'text-amber-400'
                  }`}
                >
                  {candle.direction}
                </span>
              </div>
              <div className="p-2 rounded bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">Body Size:</span>
                <span className="text-slate-200 font-semibold">{candle.bodySize ?? 'UNAVAILABLE'}</span>
              </div>
              <div className="p-2 rounded bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">Upper Wick:</span>
                <span className="text-slate-200">{candle.upperWick ?? 'UNAVAILABLE'}</span>
              </div>
              <div className="p-2 rounded bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">Lower Wick:</span>
                <span className="text-slate-200">{candle.lowerWick ?? 'UNAVAILABLE'}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Stale Warning if Active */}
      {isStale && (
        <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">{tDynamic('Stream Freshness Warning:')}</span> {tDynamic('Last tick was received')} {freshnessSeconds}s ago. {tDynamic('Signals automatically lock on WAIT until real ticks resume.')}
          </div>
        </div>
      )}

      {/* 3. Reason & Conditions Checklist */}
      <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/90 space-y-2 mb-4">
        <div className="flex items-center justify-between text-xs font-bold text-slate-300">
          <span className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>{t('signals.whyThisSignal', 'Primary Rationale')}:</span>
          </span>
          <span className="text-[11px] font-mono text-slate-400 truncate max-w-[65%]">{tDynamic(reason)}</span>
        </div>

        {details.length > 0 && (
          <div className="pt-2 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {details.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 text-xs text-slate-300 bg-slate-900/60 px-2.5 py-1.5 rounded-lg border border-slate-800"
              >
                <CheckCircle2
                  className={`w-3.5 h-3.5 shrink-0 ${
                    isUp ? 'text-emerald-400' : isDown ? 'text-rose-400' : 'text-amber-400'
                  }`}
                />
                <span className="truncate">{tDynamic(item)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Dynamic Threshold, Blocker Audit & Conflict Details */}
        {signal?.blockedReasons && signal.blockedReasons.length > 0 ? (
          <div className="pt-2 border-t border-slate-800/80 space-y-1.5 text-xs">
            <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              <span>Final Signal Gate Blocker Audit:</span>
            </div>
            {signal.blockedReasons.map((blocker, idx) => (
              <div
                key={`blocker-${idx}`}
                className="flex items-center gap-2 text-amber-300 bg-amber-500/10 px-2.5 py-1.5 rounded-lg border border-amber-500/20 font-mono text-[11px]"
              >
                <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="truncate">{blocker}</span>
              </div>
            ))}
          </div>
        ) : auditTrail && (auditTrail.failedConditions?.length > 0 || auditTrail.conflicts?.length > 0) ? (
          <div className="pt-2 border-t border-slate-800/80 space-y-1.5 text-xs">
            {auditTrail.failedConditions?.map((cond, idx) => (
              <div
                key={`failed-${idx}`}
                className="flex items-center gap-2 text-amber-300 bg-amber-500/10 px-2.5 py-1.5 rounded-lg border border-amber-500/20 font-mono text-[11px]"
              >
                <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="truncate">{cond}</span>
              </div>
            ))}
            {auditTrail.conflicts?.map((conflict, idx) => (
              <div
                key={`conflict-${idx}`}
                className="flex items-center gap-2 text-rose-300 bg-rose-500/10 px-2.5 py-1.5 rounded-lg border border-rose-500/20 font-mono text-[11px]"
              >
                <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span className="truncate">Conflict: {conflict}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {/* 4. Embedded Transparent Signal Explanation Engine */}
      <div className="mb-4">
        <SignalExplanationCard signal={signal} defaultExpanded={false} />
      </div>

      {/* 5. Footer: Reference Price & Safety Gate */}
      <div className="pt-3 border-t border-slate-800/60 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>{t('signals.nonRepaintingNotice', 'Real Quantitative Model. Strict Signal Analysis. Zero Automated Order Execution.')}</span>
        </div>
        <div className="font-mono text-slate-400">
          {tTerm('Price')}:{' '}
          <strong className="text-slate-200">
            {typeof signal?.price === 'number' ? signal.price.toFixed(5) : '—'}
          </strong>
        </div>
      </div>
    </div>
  );
};
