import React, { useState, useMemo } from 'react';
import { X, Shield, Server, Key, Volume2, Save, RefreshCw, LogOut, CheckCircle2, AlertTriangle, Cpu } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { StrategySettings, DiagnosticsInfo } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: ((endpoint: string, session: string, isDemo: boolean, settings: StrategySettings, uid?: string | number | null) => Promise<void> | void) | ((settings: any) => void);
  currentEndpoint?: string;
  currentSession?: string;
  currentUid?: string | number | null;
  isDemo?: boolean;
  strategySettings?: StrategySettings;
  diagnostics?: DiagnosticsInfo | null;
  onDisconnect?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onSave,
  currentEndpoint = 'wss://api-eu.po.market/socket.io/?EIO=4&transport=websocket',
  currentSession = '',
  currentUid = '',
  isDemo = true,
  strategySettings,
  diagnostics,
  onDisconnect,
}) => {
  const { isRTL, t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'connection' | 'audio' | 'risk'>('connection');
  const [endpoint, setEndpoint] = useState(currentEndpoint);
  const [session, setSession] = useState(currentSession);
  const [uid, setUid] = useState(String(currentUid || ''));
  const [demoMode, setDemoMode] = useState(isDemo);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [testingConn, setTestingConn] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    state: string;
    error?: string;
    balance?: number | null;
    accountMode?: string;
  } | null>(null);

  const handleTestConnection = async () => {
    if (!session || !session.trim()) return;
    setTestingConn(true);
    setTestResult(null);
    try {
      const effectiveEndpoint = endpoint?.trim() || 'wss://api-eu.po.market/socket.io/?EIO=4&transport=websocket';
      const res = await fetch('/api/account/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionToken: session,
          endpoint: effectiveEndpoint,
          uid,
          isDemo: demoMode,
          mode: demoMode ? 'DEMO' : 'REAL',
          timeoutMs: 10000,
        }),
      });
      let data: any = null;
      try {
        const text = await res.text();
        data = JSON.parse(text);
      } catch {
        data = {
          success: false,
          error: isRTL ? 'تعذر الاتصال بخادم Pocket Option. يرجى التأكد من اتصال الإنترنت وصحة رمز الجلسة.' : 'Pocket Option Gateway unreachable. Please check connection and session token.',
        };
      }

      setTestResult({
        success: Boolean(data.success || data.ok),
        state: data.state || (data.success ? 'CONNECTED' : 'FAILED'),
        error: data.error || (data.diagnostics?.authError) || (data.diagnostics?.error),
        balance: data.balance ?? data.account?.balance,
        accountMode: data.accountMode || (demoMode ? 'DEMO' : 'REAL'),
      });
    } catch (err: any) {
      setTestResult({
        success: false,
        state: 'FAILED',
        error: isRTL ? 'خطأ في شبكة الاتصال، يرجى المحاولة مرة أخرى' : (err?.message || 'Connection error'),
      });
    } finally {
      setTestingConn(false);
    }
  };

  const detectedMode = useMemo(() => {
    if (/(?:^|[;&,\s"{])isDemo"?\s*[:=]\s*"?0"?/i.test(session) || /(?:^|[;&,\s"{])is_demo"?\s*[:=]\s*"?0"?/i.test(session)) {
      return 'REAL';
    } else if (/(?:^|[;&,\s"{])isDemo"?\s*[:=]\s*"?1"?/i.test(session) || /(?:^|[;&,\s"{])is_demo"?\s*[:=]\s*"?1"?/i.test(session)) {
      return 'DEMO';
    }
    return null;
  }, [session]);

  const handleSessionChange = (val: string) => {
    setSession(val);
    const uidMatch =
      val.match(/"?(?:uid|user_id)"?\s*[:=]\s*"?(\d+)"?/i) ||
      val.match(/(?:^|[;&,\s])(?:uid|user_id)\s*=\s*"?(\d+)"?/i);
    if (uidMatch && uidMatch[1] && Number(uidMatch[1]) > 0) {
      setUid(uidMatch[1]);
    }
    const isDemoMatch = val.match(/"?(?:isDemo|is_demo)"?\s*[:=]\s*"?([01]|true|false)"?/i);
    if (isDemoMatch) {
      const isDemoVal = isDemoMatch[1] === '1' || isDemoMatch[1].toLowerCase() === 'true';
      setDemoMode(isDemoVal);
    }
  };

  if (!isOpen) return null;

  const handleSave = () => {
    if (onSave) {
      if (onSave.length >= 3) {
        (onSave as any)(endpoint, session, demoMode, strategySettings || ({} as any), uid);
      } else {
        (onSave as any)({
          endpoint,
          session,
          uid,
          isDemo: demoMode,
          audioEnabled,
        });
      }
    }
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-100">
                {isRTL ? 'إعدادات المنصة والاتصال' : 'Platform & Connection Settings'}
              </h2>
              <p className="text-xs text-slate-400">
                {isRTL ? 'تهيئة الاتصال المباشر مع Pocket Option وتفضيلات النظام' : 'Configure Pocket Option WebSocket & System Preferences'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/30 px-5 pt-3 gap-2">
          <button
            onClick={() => setActiveTab('connection')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'connection'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {isRTL ? 'الاتصال والوسيط' : 'Connection & Broker'}
          </button>
          <button
            onClick={() => setActiveTab('audio')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'audio'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {isRTL ? 'التنبيهات الصوتية' : 'Audio Alerts'}
          </button>
          <button
            onClick={() => setActiveTab('risk')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'risk'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {isRTL ? 'المخاطر والتداول' : 'Risk & Execution'}
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {activeTab === 'connection' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  {isRTL ? 'نوع الحساب النشط' : 'Active Account Mode'}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setDemoMode(true);
                      if (!endpoint || endpoint.includes('demo-api-')) {
                        setEndpoint('wss://api-eu.po.market/socket.io/?EIO=4&transport=websocket');
                      }
                    }}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                      demoMode
                        ? 'bg-amber-500/15 border-amber-500/50 text-amber-300 shadow-sm shadow-amber-500/20'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span>{isRTL ? 'تجريبي (DEMO)' : 'DEMO Account'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDemoMode(false);
                      if (!endpoint || endpoint.includes('demo-api-')) {
                        setEndpoint('wss://api-eu.po.market/socket.io/?EIO=4&transport=websocket');
                      }
                    }}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                      !demoMode
                        ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300 shadow-sm shadow-emerald-500/20'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span>{isRTL ? 'حقيقي (REAL)' : 'REAL Account'}</span>
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    {isRTL ? 'نقطة نهاية الـ WebSocket (خادم الاتصال)' : 'WebSocket Endpoint'}
                  </label>
                  <span className="text-[10px] text-amber-400 font-mono">
                    {endpoint.includes('api-eu') ? 'api-eu (الموصى به)' : endpoint.includes('api-us') ? 'api-us' : endpoint.includes('api-sc') ? 'api-sc' : 'demo-api'}
                  </span>
                </div>
                <input
                  type="text"
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                  placeholder="wss://api-eu.po.market/socket.io/?EIO=4&transport=websocket"
                  className="w-full py-2.5 px-3.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-mono text-xs focus:outline-none focus:border-amber-400"
                />
                {/* Server Quick Select Buttons */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <button
                    type="button"
                    onClick={() => setEndpoint('wss://api-eu.po.market/socket.io/?EIO=4&transport=websocket')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-mono border transition-all cursor-pointer ${
                      endpoint.includes('api-eu.po.market')
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 font-bold'
                        : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    ⭐ api-eu (أوروبا - رئيسي)
                  </button>
                  <button
                    type="button"
                    onClick={() => setEndpoint('wss://api-us-north.po.market/socket.io/?EIO=4&transport=websocket')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-mono border transition-all cursor-pointer ${
                      endpoint.includes('api-us-north.po.market')
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 font-bold'
                        : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    api-us-north (أمريكا)
                  </button>
                  <button
                    type="button"
                    onClick={() => setEndpoint('wss://api-sc.po.market/socket.io/?EIO=4&transport=websocket')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-mono border transition-all cursor-pointer ${
                      endpoint.includes('api-sc.po.market')
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 font-bold'
                        : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    api-sc (سيشيل)
                  </button>
                  <button
                    type="button"
                    onClick={() => setEndpoint('wss://demo-api-eu.po.market/socket.io/?EIO=4&transport=websocket')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-mono border transition-all cursor-pointer ${
                      endpoint.includes('demo-api-eu.po.market')
                        ? 'bg-sky-500/20 text-sky-300 border-sky-500/50 font-bold'
                        : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    demo-api (ضيوف)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  {isRTL ? 'معرّف الحساب (UID)' : 'Pocket Option UID'}
                </label>
                <input
                  type="text"
                  value={uid}
                  onChange={(e) => setUid(e.target.value)}
                  placeholder="e.g. 7849102"
                  className="w-full py-2.5 px-3.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-mono text-xs focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    {isRTL ? 'جلسة الاتصال (Session / SSD Token)' : 'Session / SSD Token'}
                  </label>
                  {detectedMode && (
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold border ${
                      detectedMode === 'REAL'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                    }`}>
                      {detectedMode === 'REAL'
                        ? (isRTL ? '🟢 تم اكتشافه: حساب حقيقي' : '🟢 Detected: REAL')
                        : (isRTL ? '🔵 تم اكتشافه: حساب تجريبي' : '🔵 Detected: DEMO')}
                    </span>
                  )}
                </div>
                <textarea
                  rows={3}
                  dir="ltr"
                  value={session}
                  onChange={(e) => handleSessionChange(e.target.value)}
                  placeholder="Paste session token or 42['auth', ...]"
                  className="w-full py-2.5 px-3.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-mono text-xs focus:outline-none focus:border-amber-400 resize-none text-left"
                />
              </div>

                {/* Test Connection Button */}
                <div className="pt-1">
                  <button
                    type="button"
                    disabled={testingConn || !session.trim()}
                    onClick={handleTestConnection}
                    className="w-full py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 border border-slate-700 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${testingConn ? 'animate-spin text-amber-400' : 'text-slate-400'}`} />
                    <span>
                      {testingConn
                        ? (isRTL ? 'جاري فحص الاتصال والمصادقة...' : 'Testing Handshake & Auth...')
                        : (isRTL ? 'فحص الاتصال وتحديث الجلسة الآن' : 'Test Connection & Handshake Now')}
                    </span>
                  </button>
                </div>

                {/* Test Connection Result Card */}
                {testResult && (
                  <div className={`p-3.5 rounded-xl border text-xs space-y-2 ${
                    testResult.success
                      ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                      : 'bg-rose-950/30 border-rose-500/40 text-rose-300'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold">
                        {testResult.success ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-rose-400" />
                        )}
                        <span>
                          {testResult.success
                            ? (isRTL ? 'الاتصال والمصادقة ناجحة 100%' : 'Handshake & Auth Successful')
                            : (isRTL ? 'فشل الاتصال / المصادقة' : 'Handshake / Auth Failed')}
                        </span>
                      </div>
                      <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold uppercase ${
                        testResult.success ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                      }`}>
                        {testResult.state}
                      </span>
                    </div>

                    {testResult.success && testResult.balance !== null && testResult.balance !== undefined && (
                      <div className="flex justify-between items-center pt-1 border-t border-emerald-500/20 text-slate-300">
                        <span>{isRTL ? 'رصيد الحساب المؤكد:' : 'Verified Balance:'}</span>
                        <span className="font-mono font-bold text-emerald-400">${testResult.balance.toFixed(2)} ({testResult.accountMode})</span>
                      </div>
                    )}

                    {!testResult.success && testResult.error && (
                      <p className="text-[11px] text-rose-400 font-mono leading-relaxed pt-1 border-t border-rose-500/20">
                        ⚠️ {testResult.error}
                      </p>
                    )}
                  </div>
                )}

                {/* Live Diagnostics Card */}
                {diagnostics && !testResult && (
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1.5 text-xs">
                    <div className="flex justify-between items-center text-slate-400">
                      <span>{isRTL ? 'حالة المقبس' : 'Socket Status'}:</span>
                      <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                        diagnostics.status === 'connected' || diagnostics.authVerified
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-rose-500/20 text-rose-400'
                      }`}>
                        {diagnostics.status === 'connected' || diagnostics.authVerified ? 'CONNECTED' : (diagnostics.status?.toUpperCase() || 'DISCONNECTED')}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-slate-400">
                      <span>{isRTL ? 'الرصيد' : 'Balance'}:</span>
                      <span className="text-amber-400 font-mono font-bold">
                        ${diagnostics.account?.balance?.toFixed(2) || '0.00'}
                      </span>
                    </div>
                    {diagnostics.authError && (
                      <div className="pt-1 text-[11px] text-rose-400 font-mono">
                        ⚠️ {diagnostics.authError}
                      </div>
                    )}
                  </div>
                )}
              </div>
          )}

          {activeTab === 'audio' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                <div className="flex items-center gap-3">
                  <Volume2 className="w-5 h-5 text-amber-400" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">
                      {isRTL ? 'التنبيهات الصوتية الحية' : 'Live Voice & Sound Chimes'}
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      {isRTL ? 'نطق فوري عند توليد إشارة صعود أو هبوط قوية' : 'Vocal callouts for high confidence UP / DOWN signals'}
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={audioEnabled}
                  onChange={(e) => setAudioEnabled(e.target.checked)}
                  className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                />
              </div>
            </div>
          )}

          {activeTab === 'risk' && (
            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <h4 className="font-bold text-slate-200">{isRTL ? 'إدارة رأس المال الذكية' : 'Smart Capital Preservation'}</h4>
                <p className="text-slate-400 text-[11px]">
                  {isRTL ? 'حظر الصفقات في حال حدوث تقلبات عنيفة أو تضارب في مؤشرات الاتجاه' : 'Circuit breaker triggers when market regime exhibits high volatility or strategy divergence'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          {onDisconnect ? (
            <button
              type="button"
              onClick={onDisconnect}
              className="py-2.5 px-4 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{isRTL ? 'قطع الاتصال' : 'Disconnect'}</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
            >
              {isRTL ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="py-2.5 px-5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition-all flex items-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer"
            >
              {savedSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isRTL ? 'تم الحفظ!' : 'Saved!'}</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>{isRTL ? 'حفظ الإعدادات' : 'Save Settings'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
