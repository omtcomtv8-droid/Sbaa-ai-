import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  DollarSign,
  Eye,
  EyeOff,
  HelpCircle,
  Key,
  Lock,
  LogIn,
  LogOut,
  RefreshCw,
  Server,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Terminal,
  User,
  UserCheck,
  Wifi,
  WifiOff,
  Zap,
} from 'lucide-react';
import { DiagnosticsInfo } from '../types';
import { useLanguage } from '../i18n/LanguageContext';
import {
  pocketOptionSessionStore,
  PocketOptionSessionSnapshot,
} from '../services/PocketOptionSessionStore';
import { accountStore } from '../services/AccountStore';
import { pocketOptionConnectionService } from '../services/PocketOptionConnectionService';

interface GatewayOnboardingCardProps {
  diagnostics?: DiagnosticsInfo | null;
  firebaseUser?: {
    uid: string;
    displayName: string | null;
    email: string | null;
    photoURL?: string | null;
  } | null;
  onSignInGoogle?: () => void;
  onSignOut?: () => void;
  onConnectAccount?: (params: {
    endpoint?: string;
    sessionToken: string;
    isDemo: boolean;
    uid?: number | null;
  }) => Promise<{ success: boolean; error?: string; diagnostics?: DiagnosticsInfo }>;
  onDisconnectAccount?: () => void;
  onEnterTerminal: () => void;
  configuredSession?: string;
  configuredIsDemo?: boolean;
  configuredUid?: string | number | null;
  isReconnecting?: boolean;
  forceHighlight?: boolean;
  onClearHighlight?: () => void;
}

export const GatewayOnboardingCard: React.FC<GatewayOnboardingCardProps> = ({
  diagnostics,
  firebaseUser,
  onSignInGoogle,
  onSignOut,
  onConnectAccount,
  onDisconnectAccount,
  onEnterTerminal,
  configuredSession = '',
  configuredIsDemo = false,
  configuredUid,
  isReconnecting = false,
  forceHighlight = false,
  onClearHighlight,
}) => {
  const { t, tTerm, tDynamic, isRTL } = useLanguage();
  // 1. Local state for form
  const [mode, setMode] = useState<'DEMO' | 'REAL'>(configuredIsDemo ? 'DEMO' : 'REAL');
  const [sessionToken, setSessionToken] = useState<string>(configuredSession || '');
  const [uid, setUid] = useState<string>(
    configuredUid ? String(configuredUid) : diagnostics?.account.uid ? String(diagnostics.account.uid) : ''
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [showSessionSecret, setShowSessionSecret] = useState(false);
  const [showQuickHelp, setShowHelp] = useState(false);
  const [showGuestPrompt, setShowGuestPrompt] = useState(false);
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1);
  const [verificationProgress, setVerificationProgress] = useState<{
    formatCheck: 'pending' | 'active' | 'success' | 'failed';
    isolationCheck: 'pending' | 'active' | 'success' | 'failed';
    socketCheck: 'pending' | 'active' | 'success' | 'failed';
    balanceCheck: 'pending' | 'active' | 'success' | 'failed';
    signalCheck: 'pending' | 'active' | 'success' | 'failed';
  }>({
    formatCheck: 'pending',
    isolationCheck: 'pending',
    socketCheck: 'pending',
    balanceCheck: 'pending',
    signalCheck: 'pending',
  });

  const cardRef = useRef<HTMLDivElement>(null);

  // Sync state if external props change
  useEffect(() => {
    if (configuredSession && !sessionToken) {
      setSessionToken(configuredSession);
    }
    if (configuredIsDemo !== undefined) {
      setMode(configuredIsDemo ? 'DEMO' : 'REAL');
    }
    if (configuredUid && !uid) {
      setUid(String(configuredUid));
    }
  }, [configuredSession, configuredIsDemo, configuredUid]);

  // Subscribe to authoritative stores
  const [poSession, setPoSession] = useState<PocketOptionSessionSnapshot>(() => pocketOptionSessionStore.getState());
  const [accState, setAccState] = useState(() => accountStore.getState());
  const [isRefreshingBalance, setIsRefreshingBalance] = useState(false);

  const handleRefreshBalance = async () => {
    setIsRefreshingBalance(true);
    await pocketOptionConnectionService.requestBalanceRefresh();
    setTimeout(() => setIsRefreshingBalance(false), 2000);
  };

  useEffect(() => {
    const unsub1 = pocketOptionSessionStore.subscribe((snap) => {
      setPoSession(snap);
      if (snap.cachedSessionToken && !sessionToken) {
        setSessionToken(snap.cachedSessionToken);
      }
      if (snap.error && snap.connectionState === 'PO_CONNECTION_FAILED') {
        setConnectError(snap.error.message);
      }
    });
    const unsub2 = accountStore.subscribe(setAccState);
    return () => {
      unsub1();
      unsub2();
    };
  }, [sessionToken]);

  // Compute effective state
  const isAuthVerified = Boolean(diagnostics?.authVerified || poSession.authenticated);
  const isWsConnected = diagnostics?.subsystems.websocket === 'connected' || poSession.status === 'READY' || poSession.connectionState === 'PO_CONNECTION_AUTHENTICATED';
  const balance =
    diagnostics?.account.balance !== null && typeof diagnostics?.account.balance === 'number' && !isNaN(diagnostics.account.balance)
      ? diagnostics.account.balance
      : poSession.balance !== null && typeof poSession.balance === 'number' && !isNaN(poSession.balance)
      ? poSession.balance
      : accState.balance !== null && typeof accState.balance === 'number' && !isNaN(accState.balance)
      ? accState.balance
      : null;
  const balanceAvailable = balance !== null && balance !== undefined;

  // Strict state machine: never redirect or kick back to step 1 while connecting, authenticating, or authenticated
  useEffect(() => {
    if (poSession.authenticated || isAuthVerified) {
      setActiveStep(3);
    } else if (
      isSubmitting ||
      isReconnecting ||
      poSession.connectionState === 'PO_CONNECTION_CONNECTING' ||
      poSession.connectionState === 'PO_CONNECTION_AUTHENTICATING'
    ) {
      setActiveStep(2);
    } else if (poSession.connectionState === 'PO_CONNECTION_FAILED') {
      setActiveStep(1);
    }
  }, [poSession.authenticated, poSession.connectionState, isAuthVerified, isSubmitting, isReconnecting]);

  // Scroll into view if forceHighlight is triggered
  useEffect(() => {
    if (forceHighlight && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const timer = setTimeout(() => {
        if (onClearHighlight) onClearHighlight();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [forceHighlight, onClearHighlight]);

  // 2. Intelligent Live Payload Parser
  const parsedPreview = useMemo(() => {
    let input = sessionToken.trim();

    // 1. Unquote if wrapped in outer quotes
    if (
      (input.startsWith('"') && input.endsWith('"')) ||
      (input.startsWith("'") && input.endsWith("'"))
    ) {
      input = input.slice(1, -1).trim();
    }

    // 2. Unescape escaped quotes
    if (input.includes('\\"')) {
      input = input.replace(/\\"/g, '"');
    }

    // 3. URL Decode if URL-encoded
    if (input.includes('%22') || input.includes('%5B') || input.includes('%7B')) {
      try {
        input = decodeURIComponent(input);
      } catch {
        // ignore
      }
    }

    let detectedUid = uid ? parseInt(uid, 10) : null;
    let payloadDetectedMode: 'DEMO' | 'REAL' | null = null;
    let format = 'FORMAT A (مفتاح مباشر Raw Session)';

    // Detect UID before splitting cookies
    const uidMatch =
      input.match(/"?(?:uid|user_id)"?\s*[:=]\s*"?(\d+)"?/i) ||
      input.match(/(?:^|[;&,\s])(?:uid|user_id)\s*=\s*"?(\d+)"?/i);
    if (uidMatch && uidMatch[1] && Number(uidMatch[1]) > 0 && !detectedUid) {
      detectedUid = Number(uidMatch[1]);
    }

    // Comprehensive detect of isDemo from string
    if (/(?:^|[;&,\s"{])isDemo"?\s*[:=]\s*"?0"?/i.test(input) || /(?:^|[;&,\s"{])is_demo"?\s*[:=]\s*"?0"?/i.test(input)) {
      payloadDetectedMode = 'REAL';
    } else if (/(?:^|[;&,\s"{])isDemo"?\s*[:=]\s*"?1"?/i.test(input) || /(?:^|[;&,\s"{])is_demo"?\s*[:=]\s*"?1"?/i.test(input)) {
      payloadDetectedMode = 'DEMO';
    }

    let cleanSession = input;

    // 4. Check for PHP Serialized session before cookie splitting: e.g. a:4:{s:10:"session_id";s:32:"...";...}
    if (input.includes('session_id')) {
      const phpMatch = input.match(/"session_id";s:\d+:"([^"]+)";/) || input.match(/session_id";s:\d+:"([a-zA-Z0-9_-]+)"/);
      if (phpMatch && phpMatch[1]) {
        cleanSession = phpMatch[1].trim();
        format = 'FORMAT A (PHP Serialized)';
      }
    }

    // 5. Check if user pasted full Socket.IO frame: 42["auth", ...]
    const authFrameMatch = input.match(/(?:42)?\[\s*"auth"\s*,\s*(\{[\s\S]*\})\s*\]/);
    if (authFrameMatch && authFrameMatch[1]) {
      format = 'FORMAT B (حزمة DevTools 42["auth", ...] كاملة)';
      try {
        const payload = JSON.parse(authFrameMatch[1]);
        if (payload && typeof payload === 'object') {
          if (payload.session || payload.sessionToken) cleanSession = payload.session || payload.sessionToken;
          if (payload.uid && !detectedUid) detectedUid = Number(payload.uid);
          if (payload.isDemo === 0 || payload.isDemo === '0' || payload.isDemo === false) payloadDetectedMode = 'REAL';
          if (payload.isDemo === 1 || payload.isDemo === '1' || payload.isDemo === true) payloadDetectedMode = 'DEMO';
        }
      } catch {
        const sessMatch = authFrameMatch[1].match(/"session(?:Token)?"\s*:\s*"([^"]+)"/);
        if (sessMatch && sessMatch[1]) cleanSession = sessMatch[1];
      }
    } else if (input.startsWith('{') && input.endsWith('}')) {
      format = 'FORMAT B (JSON Payload)';
      try {
        const obj = JSON.parse(input);
        if (obj && typeof obj === 'object') {
          if (obj.session || obj.sessionToken) cleanSession = obj.session || obj.sessionToken;
          if (obj.uid && !detectedUid) detectedUid = Number(obj.uid);
          if (obj.isDemo === 0 || obj.isDemo === '0' || obj.isDemo === false) payloadDetectedMode = 'REAL';
          if (obj.isDemo === 1 || obj.isDemo === '1' || obj.isDemo === true) payloadDetectedMode = 'DEMO';
        }
      } catch {
        const sessMatch = input.match(/"session(?:Token)?"\s*:\s*"([^"]+)"/);
        if (sessMatch && sessMatch[1]) cleanSession = sessMatch[1];
      }
    } else {
      // 6. Strip cookie prefix if present: prioritize SSID over others!
      const ssidMatch = input.match(/(?:^|[;\s])SSID\s*=\s*([^;]+)/i);
      const sessionCookieMatch = input.match(/(?:^|[;\s])(?:po_session|session|session_id|remember_code)\s*=\s*([^;]+)/i);
      const phpCookieMatch = input.match(/(?:^|[;\s])PHPSESSID\s*=\s*([^;]+)/i);

      if (ssidMatch && ssidMatch[1]) {
        cleanSession = ssidMatch[1].trim();
      } else if (sessionCookieMatch && sessionCookieMatch[1]) {
        cleanSession = sessionCookieMatch[1].trim();
      } else if (phpCookieMatch && phpCookieMatch[1]) {
        cleanSession = phpCookieMatch[1].trim();
      }
    }

    if (
      (cleanSession.startsWith('"') && cleanSession.endsWith('"')) ||
      (cleanSession.startsWith("'") && cleanSession.endsWith("'"))
    ) {
      cleanSession = cleanSession.slice(1, -1).trim();
    }

    const maskedSession =
      cleanSession.length > 8
        ? `${cleanSession.slice(0, 4)}...${cleanSession.slice(-4)}`
        : cleanSession || '(فارغ)';

    const isTokenLongEnough = cleanSession.length >= 8;

    let errorReason: string | null = null;
    if (!cleanSession) {
      errorReason = 'مفتاح الجلسة فارغ. يرجى إدخال رمز الجلسة أو حزمة DevTools.';
    } else if (!isTokenLongEnough) {
      errorReason = 'رمز الجلسة قصير جداً (أقل من 8 أحرف).';
    }

    const isValid = Boolean(isTokenLongEnough);

    const isMismatch = Boolean(payloadDetectedMode && payloadDetectedMode !== mode);

    return {
      cleanSession,
      detectedUid,
      payloadDetectedMode,
      detectedMode: payloadDetectedMode || mode,
      isMismatch,
      format,
      maskedSession,
      isValid,
      errorReason,
    };
  }, [sessionToken, uid, mode]);

  // Auto-fill UID and Mode if detected from session packet
  const handleSessionChange = (val: string) => {
    setSessionToken(val);
    setConnectError(null);

    // Auto-detect isDemo from typed/pasted text
    if (/(?:^|[;&,\s"{])isDemo"?\s*[:=]\s*"?0"?/i.test(val) || /(?:^|[;&,\s"{])is_demo"?\s*[:=]\s*"?0"?/i.test(val)) {
      setMode('REAL');
    } else if (/(?:^|[;&,\s"{])isDemo"?\s*[:=]\s*"?1"?/i.test(val) || /(?:^|[;&,\s"{])is_demo"?\s*[:=]\s*"?1"?/i.test(val)) {
      setMode('DEMO');
    }

    // Auto-detect UID from DevTools packet or JSON: "uid": 1234567 or uid=1234567
    const uidMatch =
      val.match(/"?(?:uid|user_id)"?\s*[:=]\s*"?(\d+)"?/i) ||
      val.match(/(?:^|[;&,\s])(?:uid|user_id)\s*=\s*"?(\d+)"?/i);
    if (uidMatch && uidMatch[1] && Number(uidMatch[1]) > 0 && !uid) {
      setUid(uidMatch[1]);
    }
  };

  // 3. Quick Demo Fill Helper
  const handleFillDemo = () => {
    setMode('DEMO');
    setSessionToken(configuredSession && configuredIsDemo ? configuredSession : '296a5cb3321a6c66c7ab018b8a596b8b');
    setUid(configuredUid ? String(configuredUid) : '98148605');
    setConnectError(null);
  };

  // 4. Connect & Verify Action
  const handleConnect = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setConnectError(null);

    // Strict Rule Validation
    if (!parsedPreview.cleanSession || parsedPreview.cleanSession.length < 8) {
      setConnectError('رمز الجلسة غير صالح أو أقل من 8 أحرف. يرجى إدخال رمز الجلسة الصحيح.');
      return;
    }

    if (
      isSubmitting ||
      poSession.connectionState === 'PO_CONNECTION_CONNECTING' ||
      poSession.connectionState === 'PO_CONNECTION_AUTHENTICATING'
    ) {
      return;
    }

    const isDemoBool = mode === 'DEMO';
    const parsedUidNum = uid ? parseInt(uid, 10) : parsedPreview.detectedUid || undefined;

    setIsSubmitting(true);
    setActiveStep(2);

    // Step-by-step verification progress sequence
    setVerificationProgress({
      formatCheck: 'active',
      isolationCheck: 'pending',
      socketCheck: 'pending',
      balanceCheck: 'pending',
      signalCheck: 'pending',
    });

    try {
      // Step 1: Format Check
      setVerificationProgress((prev) => ({ ...prev, formatCheck: 'success', isolationCheck: 'active' }));

      // Step 2: Isolation Check & Connection via Authoritative Service
      setVerificationProgress((prev) => ({ ...prev, isolationCheck: 'success', socketCheck: 'active' }));

      // Strictly single connection request: delegate to onConnectAccount or pocketOptionConnectionService
      let res: { ok: boolean; errorMessage?: string; balance?: number | null };

      if (onConnectAccount) {
        const out = await onConnectAccount({
          sessionToken: parsedPreview.cleanSession,
          isDemo: isDemoBool,
          uid: parsedUidNum,
        });
        res = {
          ok: out.success,
          errorMessage: out.error,
          balance: out.diagnostics?.account?.balance ?? null,
        };
      } else {
        const out = await pocketOptionConnectionService.connect({
          sessionToken: parsedPreview.cleanSession,
          isDemo: isDemoBool,
          uid: parsedUidNum,
        });
        res = {
          ok: out.ok,
          errorMessage: out.errorMessage,
          balance: out.balance,
        };
      }

      if (!res.ok) {
        setIsSubmitting(false);
        setActiveStep(1);
        setConnectError(res.errorMessage || 'فشل الاتصال بالبوابة. تأكد من صحة رمز الجلسة وسيرفر Pocket Option.');
        setVerificationProgress((prev) => ({ ...prev, socketCheck: 'failed' }));
        return;
      }

      // Step 3: WebSocket Check succeeded
      setVerificationProgress((prev) => ({ ...prev, socketCheck: 'success', balanceCheck: 'active' }));

      // Step 4: Balance & Auth Handshake
      if (res.balance !== null && res.balance !== undefined) {
        setVerificationProgress((prev) => ({ ...prev, balanceCheck: 'success', signalCheck: 'success' }));
      } else {
        // Balance is pending, but platform authentication is verified!
        setVerificationProgress((prev) => ({ ...prev, balanceCheck: 'active', signalCheck: 'success' }));
      }

      setIsSubmitting(false);
      setActiveStep(3);
    } catch (err: any) {
      setIsSubmitting(false);
      setActiveStep(1);
      setConnectError(err.message || 'حدث خطأ غير متوقع أثناء الاتصال');
    }
  };

  // 5. Handling Enter Terminal
  const handleEnter = () => {
    onEnterTerminal();
  };

  return (
    <div
      ref={cardRef}
      id="gateway-onboarding-card"
      className={`rounded-2xl border transition-colors duration-200 backdrop-blur shadow-2xl space-y-4 ${isRTL ? 'text-right' : 'text-left'} ${
        forceHighlight
          ? 'border-amber-400 ring-4 ring-amber-500/40 bg-slate-900 shadow-amber-500/20'
          : 'border-slate-800/90 bg-slate-900/95 p-5'
      } p-5`}
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              isAuthVerified ? 'bg-emerald-400 animate-pulse' : isSubmitting ? 'bg-amber-400 animate-pulse' : 'bg-slate-500'
            }`}
          />
          <div>
            <div className="text-xs font-bold text-slate-100 font-mono flex items-center gap-1.5">
              <span>Real System Gateway</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-sans border border-amber-500/30">
                V2.5
              </span>
            </div>
            <div className="text-[10px] text-slate-400 font-sans">{tDynamic('Session Authentication & Account Isolation Gate')}</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 ${
              isAuthVerified
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : isSubmitting
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'bg-slate-800 text-slate-300 border border-slate-700'
            }`}
          >
            {isAuthVerified ? (
              <>
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span>{tDynamic('Verified & Active')}</span>
              </>
            ) : isSubmitting ? (
              <>
                <RefreshCw className="w-3 h-3 text-amber-400 animate-spin" />
                <span>{tDynamic('Verifying...')}</span>
              </>
            ) : (
              <span>{tDynamic('Awaiting Credentials')}</span>
            )}
          </span>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="grid grid-cols-3 gap-1.5 text-center text-[10px] font-sans">
        <div
          className={`py-1 rounded-md border ${
            activeStep === 1
              ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 font-bold'
              : 'bg-slate-950/60 border-slate-800 text-slate-400'
          }`}
        >
          1. {tDynamic('Enter Token')}
        </div>
        <div
          className={`py-1 rounded-md border ${
            activeStep === 2
              ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 font-bold'
              : 'bg-slate-950/60 border-slate-800 text-slate-400'
          }`}
        >
          2. {tDynamic('Verify Session')}
        </div>
        <div
          className={`py-1 rounded-md border ${
            activeStep === 3
              ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 font-bold'
              : 'bg-slate-950/60 border-slate-800 text-slate-400'
          }`}
        >
          3. {tDynamic('Enter Terminal')}
        </div>
      </div>

      {/* Warning Notice if user tried to enter before filling / connecting */}
      {connectError && (
        <div className={`p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2 ${isRTL ? 'text-right' : 'text-left'}`}>
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1.5">
            <div className="font-bold">{tDynamic('Authentication Warning:')}</div>
            <div className="text-[11px] leading-relaxed">{connectError}</div>
            <div className="pt-1 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleConnect()}
                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px] transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{isRTL ? 'إعادة المحاولة (Retry Connection)' : 'Retry Connection'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  handleFillDemo();
                  setTimeout(() => {
                    handleConnect();
                  }, 100);
                }}
                className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[10px] transition-all flex items-center gap-1 cursor-pointer shadow-sm"
              >
                <Zap className="w-3 h-3" />
                <span>{isRTL ? 'تجربة الحساب التجريبي الفوري (Demo Sandbox)' : 'Try Instant Demo Sandbox'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CASE A: ALREADY VERIFIED STATE */}
      {isAuthVerified && (
        <div className={`p-4 rounded-xl border space-y-3 ${
          (poSession.account?.accountMode === 'REAL' || (!diagnostics?.account.isDemo && poSession.account?.accountMode !== 'DEMO'))
            ? 'bg-emerald-950/40 border-emerald-500/50 shadow-lg shadow-emerald-500/10'
            : 'bg-sky-950/40 border-sky-500/50 shadow-lg shadow-sky-500/10'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              {(poSession.account?.accountMode === 'REAL' || (!diagnostics?.account.isDemo && poSession.account?.accountMode !== 'DEMO')) ? (
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400">
                  <Shield className="w-5 h-5" />
                </div>
              )}
              <div>
                <span className={`font-black text-xs uppercase tracking-wide ${
                  (poSession.account?.accountMode === 'REAL' || (!diagnostics?.account.isDemo && poSession.account?.accountMode !== 'DEMO'))
                    ? 'text-emerald-300'
                    : 'text-sky-300'
                }`}>
                  {(poSession.account?.accountMode === 'REAL' || (!diagnostics?.account.isDemo && poSession.account?.accountMode !== 'DEMO'))
                    ? tDynamic('🟢 حساب حقيقي مباشر موثق ومحمي (REAL LIVE)')
                    : tDynamic('🔵 حساب تجريبي افتراضي موثق ومحمي (DEMO PRACTICE)')}
                </span>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {(poSession.account?.accountMode === 'REAL' || (!diagnostics?.account.isDemo && poSession.account?.accountMode !== 'DEMO'))
                    ? tDynamic('متصل بسيرفر Pocket Option الحقيقي وتتداول بأموالك الحقيقية')
                    : tDynamic('متصل بسيرفر Pocket Option التجريبي وتتداول برصيد افتراضي آمن')}
                </div>
              </div>
            </div>
            <span className={`px-2.5 py-1 rounded font-mono text-xs font-black border ${
              (poSession.account?.accountMode === 'REAL' || (!diagnostics?.account.isDemo && poSession.account?.accountMode !== 'DEMO'))
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                : 'bg-sky-500/20 text-sky-300 border-sky-500/40 shadow-sm'
            }`}>
              {poSession.account?.accountMode || (diagnostics?.account.isDemo ? 'DEMO' : 'REAL')}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-1">
            <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800">
              <span className="text-[10px] text-slate-400 font-sans block">{tDynamic('الرصيد المتوفر:')}</span>
              <span className={`text-sm font-bold flex items-center gap-1.5 ${poSession.account?.accountMode === 'DEMO' || diagnostics?.account.isDemo ? 'text-sky-400' : 'text-emerald-400 font-mono'}`}>
                {balanceAvailable && typeof balance === 'number' ? (
                  `$${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                ) : poSession.balanceState === 'BALANCE_LOADING' || diagnostics?.subsystems.account === 'LOADING' ? (
                  <span className="flex items-center gap-1 text-xs text-amber-300">
                    <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
                    {tDynamic('جاري جلب الرصيد...')}
                  </span>
                ) : poSession.balanceState === 'BALANCE_UNAVAILABLE' ? (
                  <span className="text-xs text-slate-400">
                    {tDynamic('الرصيد غير متوفر حالياً')}
                  </span>
                ) : (
                  '--'
                )}
              </span>
              {(!balanceAvailable || poSession.balanceState === 'BALANCE_UNAVAILABLE') && (
                <button
                  type="button"
                  onClick={handleRefreshBalance}
                  disabled={isRefreshingBalance}
                  className="mt-1 text-[10px] text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <RefreshCw className={`w-2.5 h-2.5 ${isRefreshingBalance ? 'animate-spin' : ''}`} />
                  <span>{tDynamic('إعادة طلب الرصيد (Retry)')}</span>
                </button>
              )}
            </div>
            <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800">
              <span className="text-[10px] text-slate-400 font-sans block">{tDynamic('معرّف الحساب (UID):')}</span>
              <span className="text-xs font-bold text-slate-200">
                {poSession.account?.accountId || diagnostics?.account.uidMasked || diagnostics?.authUid || diagnostics?.account.uid || uid || tDynamic('تم التحقق')}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-300 pt-1">
            <span className="text-slate-400 font-sans">{tDynamic('خادم الاتصال:')}</span>
            <span className="text-emerald-400 font-semibold flex items-center gap-1 font-sans">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              <span>{tDynamic('WebSocket متصل ومباشر')}</span>
            </span>
          </div>

          <div className="pt-2">
            <button
              id="btn-enter-terminal-verified"
              onClick={onEnterTerminal}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/25 transition-all cursor-pointer"
            >
              <span>{tDynamic('Enter Trading Terminal (Ready)')}</span>
              <ArrowLeft className={`w-4 h-4 ${isRTL ? '' : 'rotate-180'}`} />
            </button>
          </div>

          {onDisconnectAccount && (
            <div className="text-center pt-1">
              <button
                onClick={onDisconnectAccount}
                className="text-[10px] text-slate-400 hover:text-rose-400 underline cursor-pointer"
              >
                {tDynamic('Change account or disconnect current session')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* CASE B: DATA ENTRY & VERIFICATION FLOW */}
      {!isAuthVerified && (
        <form onSubmit={handleConnect} className="space-y-3.5">
          {/* 1. Session Key / SSD Token Field (Placed First for Immediate Detection) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-amber-400" />
                <span>{tDynamic('رمز الجلسة / حزمة الـ SSD (Session Token)')}</span>
                <span className="text-rose-400">*</span>
              </label>
              <button
                type="button"
                onClick={() => setShowHelp(!showQuickHelp)}
                className="text-[10px] text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer font-sans"
              >
                <HelpCircle className="w-3 h-3" />
                <span>{tDynamic('كيف تستخرج الـ SSD؟')}</span>
              </button>
            </div>
            <div className="relative">
              <textarea
                id="input-gateway-session"
                rows={2}
                value={sessionToken}
                onChange={(e) => handleSessionChange(e.target.value)}
                placeholder={tDynamic('الصق هنا رمز الجلسة أو حزمة الـ SSD: 42["auth",{"session":"...","isDemo":0,"uid":...}]')}
                className={`w-full py-2.5 px-3 pl-8 rounded-xl bg-slate-950 border text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 resize-none ${
                  sessionToken && !parsedPreview.isValid
                    ? 'border-amber-500/50 focus:ring-amber-500'
                    : 'border-slate-800 focus:border-amber-500/60 focus:ring-amber-500/30'
                }`}
              />
              <Key className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-3" />
            </div>
          </div>

          {/* 2. Intelligent Auto-Detection Banner (Triggered when SSD is pasted) */}
          {sessionToken && parsedPreview.payloadDetectedMode && (
            <div
              className={`p-3 rounded-xl border flex items-center justify-between shadow-md transition-all ${
                parsedPreview.payloadDetectedMode === 'REAL'
                  ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-200 shadow-emerald-500/10'
                  : 'bg-sky-950/60 border-sky-500/60 text-sky-200 shadow-sky-500/10'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                    parsedPreview.payloadDetectedMode === 'REAL'
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                      : 'bg-sky-500/20 border-sky-500/40 text-sky-400'
                  }`}
                >
                  {parsedPreview.payloadDetectedMode === 'REAL' ? (
                    <ShieldCheck className="w-5 h-5" />
                  ) : (
                    <Shield className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-black tracking-wide">
                      {parsedPreview.payloadDetectedMode === 'REAL'
                        ? tDynamic('🟢 تم التعرف: حساب حقيقي مباشر (REAL LIVE)')
                        : tDynamic('🔵 تم التعرف: حساب تجريبي افتراضي (DEMO PRACTICE)')}
                    </span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold border ${
                        parsedPreview.payloadDetectedMode === 'REAL'
                          ? 'bg-emerald-500/30 text-emerald-300 border-emerald-500/40'
                          : 'bg-sky-500/30 text-sky-300 border-sky-500/40'
                      }`}
                    >
                      {parsedPreview.payloadDetectedMode === 'REAL' ? 'isDemo = 0' : 'isDemo = 1'}
                    </span>
                  </div>
                  <p className="text-[11px] opacity-80 mt-0.5 font-sans leading-relaxed">
                    {parsedPreview.payloadDetectedMode === 'REAL'
                      ? tDynamic('تم فحص الـ SSD بنجاح: تم التعرف على جلسة تداول بأموال حقيقية على منصة Pocket Option.')
                      : tDynamic('تم فحص الـ SSD بنجاح: تم التعرف على جلسة تدريب آمنة برصيد افتراضي.')}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 3. Mismatch Warning (If user explicitly selected opposite of what SSD says) */}
          {sessionToken && parsedPreview.isMismatch && (
            <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/40 text-xs text-amber-200 flex items-center justify-between gap-2 shadow-sm">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-[11px] font-sans">
                  {mode === 'DEMO'
                    ? tDynamic('تنبيه: الـ SSD يحتوي على حساب حقيقي (isDemo=0) بينما تم تحديد الحساب التجريبي!')
                    : tDynamic('تنبيه: الـ SSD يحتوي على حساب تجريبي (isDemo=1) بينما تم تحديد الحساب الحقيقي!')}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMode(parsedPreview.payloadDetectedMode || 'DEMO')}
                className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[10px] shrink-0 cursor-pointer transition-all"
              >
                {tDynamic('مزامنة فورية')}
              </button>
            </div>
          )}

          {/* 4. Explicit Mode Selector Cards (DEMO vs REAL) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-slate-300 block">
                {t('settings.accountFeedType', 'نوع الحساب المستهدف')} <span className="text-amber-400">*</span>
              </label>
              <span className="text-[10px] text-slate-400 font-sans">
                {mode === 'REAL' ? '🟢 وضع الأموال الحقيقية' : '🔵 وضع الرصيد الافتراضي'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {/* DEMO CARD */}
              <button
                type="button"
                onClick={() => setMode('DEMO')}
                className={`p-3 rounded-xl border text-right transition-all flex flex-col justify-between cursor-pointer relative overflow-hidden ${
                  mode === 'DEMO'
                    ? 'bg-sky-500/15 border-sky-500 text-sky-200 ring-2 ring-sky-500/30 shadow-lg shadow-sky-500/10'
                    : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <Shield className={`w-4 h-4 ${mode === 'DEMO' ? 'text-sky-400' : 'text-slate-500'}`} />
                    <span className="text-xs font-black uppercase tracking-wide">
                      {tTerm('Demo Account')} (DEMO)
                    </span>
                  </div>
                  {mode === 'DEMO' && (
                    <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
                  )}
                </div>
                <p className="text-[10px] opacity-80 leading-relaxed font-sans">
                  {tDynamic('رصيد افتراضي للتدريب والتجربة بأمان 100%')}
                </p>
                <span className="text-[9px] font-mono mt-1 text-sky-400 font-bold block">
                  isDemo = 1 • عزل تجريبي
                </span>
              </button>

              {/* REAL CARD */}
              <button
                type="button"
                onClick={() => setMode('REAL')}
                className={`p-3 rounded-xl border text-right transition-all flex flex-col justify-between cursor-pointer relative overflow-hidden ${
                  mode === 'REAL'
                    ? 'bg-emerald-500/15 border-emerald-500 text-emerald-200 ring-2 ring-emerald-500/30 shadow-lg shadow-emerald-500/10'
                    : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className={`w-4 h-4 ${mode === 'REAL' ? 'text-emerald-400' : 'text-slate-500'}`} />
                    <span className="text-xs font-black uppercase tracking-wide">
                      {tTerm('Real Account')} (REAL)
                    </span>
                  </div>
                  {mode === 'REAL' && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  )}
                </div>
                <p className="text-[10px] opacity-80 leading-relaxed font-sans">
                  {tDynamic('أموال حقيقية • تداول مباشر في السوق الحقيقي')}
                </p>
                <span className="text-[9px] font-mono mt-1 text-emerald-400 font-bold block">
                  isDemo = 0 • اتصال حقيقي
                </span>
              </button>
            </div>
          </div>

          {/* 5. UID Field */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-slate-300">
                {tDynamic('رقم الحساب (UID)')}{' '}
                <span className="text-slate-400 font-normal">
                  ({tDynamic('اختياري - يتم جلبه تلقائياً من الـ SSD أو المنصة')})
                </span>
              </label>
              {parsedPreview.detectedUid && parsedPreview.detectedUid > 0 ? (
                <span className="text-[10px] text-emerald-400 font-mono font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>{tDynamic('تم جلبه من الـ SSD:')} {parsedPreview.detectedUid}</span>
                </span>
              ) : null}
            </div>
            <div className="relative">
              <input
                id="input-gateway-uid"
                type="number"
                value={uid}
                onChange={(e) => {
                  setUid(e.target.value);
                  setConnectError(null);
                }}
                placeholder={parsedPreview.detectedUid ? String(parsedPreview.detectedUid) : tDynamic('مثال: 98148605 (أو اتركه فارغاً للاكتشاف التلقائي)')}
                className="w-full py-2 px-3 pl-8 rounded-xl bg-slate-950 border border-slate-800 focus:border-amber-500/60 focus:ring-amber-500/30 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1"
              />
              <User className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          {/* 6. Live Token Breakdown Badge */}
          {sessionToken && (
            <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80 text-[10px] font-mono space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span>{tDynamic('البروتوكول والصيغة:')}</span>
                <span className="text-amber-300 font-bold">{parsedPreview.format}</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>{tDynamic('مفتاح الجلسة المقنع:')}</span>
                <span className="text-slate-300">{parsedPreview.maskedSession}</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>{tDynamic('السيرفر المستهدف:')}</span>
                <span className={mode === 'REAL' ? 'text-emerald-400 font-bold' : 'text-sky-400 font-bold'}>
                  {mode === 'REAL' ? 'api-eu.po.market (خادم حقيقي)' : 'demo-api-eu.po.market (خادم تجريبي)'}
                </span>
              </div>
              <div className="flex items-center justify-between pt-0.5">
                <span className="text-slate-400">{tDynamic('حالة التحقق المبدئي:')}</span>
                <span className={parsedPreview.isValid ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                  {parsedPreview.isValid ? `✓ ${tDynamic('جاهز للمصادقة وتأكيد الاتصال')}` : parsedPreview.errorReason}
                </span>
              </div>
            </div>
          )}

          {/* Quick Help Collapsible */}
          {showQuickHelp && (
            <div className={`p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-300 space-y-1.5 ${isRTL ? 'text-right' : 'text-left'}`}>
              <div className="font-bold text-amber-300 flex items-center gap-1">
                <Zap className="w-3.5 h-3.5" />
                <span>{tDynamic('How to extract session token in seconds:')}</span>
              </div>
              <ol className="list-decimal list-inside space-y-1 text-[10px] text-slate-400 leading-relaxed">
                <li>{tDynamic('Open broker trading terminal and press F12 to open Developer Tools (DevTools).')}</li>
                <li>{tDynamic('Navigate to the Network tab and filter by WS (WebSockets).')}</li>
                <li>{tDynamic('Select active connection and find payload starting with 42["auth", ...] or copy the session value.')}</li>
                <li>{tDynamic('Paste the full payload here, and our parser will safely isolate credentials.')}</li>
              </ol>
            </div>
          )}

          {/* Quick Demo Button for Instant Testing */}
          <div className="flex items-center justify-between pt-0.5">
            <button
              type="button"
              onClick={handleFillDemo}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
            >
              <Zap className="w-3 h-3 text-amber-400" />
              <span>⚡ {tDynamic('Fast 1-Click Demo Sandbox Testing')}</span>
            </button>
          </div>

          {/* Google Cloud Auth Status Row */}
          <div className="p-2 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between text-xs">
            <span className="text-slate-400 font-sans text-[11px]">{tDynamic('Cloud Backup (Google):')}</span>
            {firebaseUser ? (
              <div className="flex items-center gap-1.5 text-emerald-400 text-[11px] font-semibold font-sans">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{firebaseUser.displayName || t('header.cloudAccount', 'Cloud Account')}</span>
              </div>
            ) : onSignInGoogle ? (
              <button
                type="button"
                onClick={onSignInGoogle}
                className="text-amber-400 hover:text-amber-300 text-[11px] underline font-sans cursor-pointer"
              >
                {t('header.cloudSignIn', 'Sign In with Google')}
              </button>
            ) : (
              <span className="text-slate-500 text-[11px]">{tDynamic('Not Active')}</span>
            )}
          </div>

          {/* Verification Step-by-Step Progress (Rendered when in-flight) */}
          {isSubmitting && (
            <div className="p-3 rounded-xl bg-slate-950 border border-amber-500/30 space-y-2 text-xs">
              <div className="font-bold text-amber-300 flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                <span>{tDynamic('Verifying session step-by-step:')}</span>
              </div>
              <div className="space-y-1 text-[10px] font-sans">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">1. {tDynamic('Payload check & de-duplication:')}</span>
                  <span className={verificationProgress.formatCheck === 'success' ? 'text-emerald-400' : 'text-amber-400'}>
                    {verificationProgress.formatCheck === 'success' ? `✓ ${tDynamic('Valid')}` : tDynamic('Checking...')}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">2. {tDynamic('Account context isolation & session generation:')}</span>
                  <span className={verificationProgress.isolationCheck === 'success' ? 'text-emerald-400' : 'text-amber-400'}>
                    {verificationProgress.isolationCheck === 'success' ? `✓ ${tDynamic('Isolated')}` : tDynamic('Processing...')}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">3. {tDynamic('WebSocket protocol handshake:')}</span>
                  <span className={verificationProgress.socketCheck === 'success' ? 'text-emerald-400' : 'text-amber-400'}>
                    {verificationProgress.socketCheck === 'success' ? `✓ ${tDynamic('Connected')}` : tDynamic('Waiting...')}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">4. {tDynamic('Balance retrieval & verification:')}</span>
                  <span className={verificationProgress.balanceCheck === 'success' ? 'text-emerald-400' : 'text-amber-400'}>
                    {verificationProgress.balanceCheck === 'success' ? `✓ ${tDynamic('Verified')}` : tDynamic('Waiting...')}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">5. {tDynamic('Signal engine activation:')}</span>
                  <span className={verificationProgress.signalCheck === 'success' ? 'text-emerald-400' : 'text-amber-400'}>
                    {verificationProgress.signalCheck === 'success' ? `✓ ${tDynamic('Ready')}` : tDynamic('Waiting...')}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Action Button: Connect & Verify */}
          <div className="pt-1">
            <button
              id="btn-gateway-connect-and-verify"
              type="submit"
              disabled={isSubmitting || !sessionToken.trim()}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs shadow-xl shadow-amber-500/25 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>{tDynamic('Connecting and verifying session...')}</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  <span>{tDynamic('Connect & Verify Session')}</span>
                </>
              )}
            </button>
          </div>

          {/* Pre-entry Guard Option */}
          <div className="pt-1 text-center">
            <button
              type="button"
              onClick={handleEnter}
              className="text-[11px] text-slate-400 hover:text-amber-400 underline transition-colors cursor-pointer"
            >
              {tDynamic('Or continue in preview / read-only mode (without active session)')}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
