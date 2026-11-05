import React, { useState } from 'react';
import { ShieldCheck, LogIn, Lock, Sparkles, TrendingUp, CheckCircle2, ShieldAlert, Key } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../i18n/LanguageContext';

interface LoginPageProps {
  onOpenAdminLogin?: () => void;
  onOpenKeyRoom?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onOpenAdminLogin, onOpenKeyRoom }) => {
  const { signInWithGoogle, isAuthenticatingGoogle, errorMessage, activateCode, enterDemoGuest } = useAuth();
  const { isRTL } = useLanguage();
  const [directCode, setDirectCode] = useState('');
  const [activatingDirect, setActivatingDirect] = useState(false);
  const [directError, setDirectError] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-[#05070B] text-slate-100 flex items-center justify-center p-4 relative overflow-hidden font-sans" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Background ambient lighting */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 sm:w-[600px] h-96 bg-amber-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative w-full max-w-md bg-slate-900/90 border border-slate-800 backdrop-blur-xl rounded-3xl shadow-2xl p-6 sm:p-8 text-center space-y-6">
        {/* Brand Icon */}
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-400 p-0.5 shadow-xl shadow-amber-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-amber-400">
              <TrendingUp className="w-8 h-8" />
            </div>
          </div>
        </div>

        {/* Title */}
        <div className="space-y-2">
          <h1 className="text-xl sm:text-2xl font-black text-slate-100 tracking-tight">
            SABAA AI SOLUTION
          </h1>
          <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
            {isRTL
              ? 'منصة التحليل المؤسسي والرؤية الحاسوبية للتداول بالذكاء الاصطناعي وإدارة المخاطر'
              : 'Institutional algorithmic engine, computer vision analysis, and risk management'}
          </p>
        </div>

        {/* Error notice if any */}
        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs text-left">
            {errorMessage}
          </div>
        )}

        {/* Google Sign In Button */}
        <div className="pt-1 space-y-3">
          <button
            onClick={() => signInWithGoogle()}
            disabled={isAuthenticatingGoogle}
            className="w-full py-3.5 px-4 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs sm:text-sm shadow-xl transition-all flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50"
          >
            {isAuthenticatingGoogle ? (
              <div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            )}
            <span>{isRTL ? 'المتابعة باستخدام حساب Google' : 'Sign in with Google'}</span>
          </button>

          {/* Divider */}
          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-800 w-full" />
            <span className="bg-slate-900 px-3 text-[11px] text-slate-500 font-mono uppercase">
              {isRTL ? 'أو الدخول عبر المفتاح / التجريبي' : 'OR VIA KEY / DEMO'}
            </span>
            <div className="border-t border-slate-800 w-full" />
          </div>

          {/* Direct Key Activation Form */}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!directCode.trim()) return;
              setActivatingDirect(true);
              setDirectError(null);
              const res = await activateCode(directCode.trim());
              setActivatingDirect(false);
              if (!res.success) {
                setDirectError(res.error || 'فشل التحقق من الكود');
              }
            }}
            className="space-y-2 text-right"
          >
            <div className="relative">
              <input
                type="text"
                value={directCode}
                onChange={(e) => {
                  setDirectCode(e.target.value.toUpperCase());
                  setDirectError(null);
                }}
                placeholder={isRTL ? 'أدخل كود التفعيل أو الماستر (SABAA-XXXX أو sbaa0000)' : 'Enter activation code or master sbaa0000'}
                className="w-full py-2.5 px-3.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-slate-100 placeholder-slate-500 font-mono text-xs focus:outline-none focus:border-amber-400 text-center tracking-wider"
              />
            </div>
            {directError && (
              <p className="text-[11px] text-rose-400 text-center font-sans">{directError}</p>
            )}
            <button
              type="submit"
              disabled={activatingDirect || !directCode.trim()}
              className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs transition-all shadow-md shadow-amber-500/10 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {activatingDirect ? (
                <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Key className="w-3.5 h-3.5" />
              )}
              <span>{isRTL ? 'تفعيل ودخول المنصة المباشر' : 'Activate & Enter Platform'}</span>
            </button>
          </form>

          {/* Instant Demo Access Button */}
          <button
            type="button"
            onClick={() => enterDemoGuest()}
            className="w-full py-2.5 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-300 hover:text-amber-400 font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>{isRTL ? 'دخول تجريبي فوري ومباشر للمنصة (Instant Demo)' : 'Instant Demo Platform Access'}</span>
          </button>
        </div>

        {/* Security badges */}
        <div className="pt-4 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-[11px] text-slate-400">
          <div className="flex items-center justify-center gap-1.5 p-2 rounded-xl bg-slate-950/60 border border-slate-800/60">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>{isRTL ? 'توثيق Google آمن' : 'OAuth 2.0 Security'}</span>
          </div>
          <div className="flex items-center justify-center gap-1.5 p-2 rounded-xl bg-slate-950/60 border border-slate-800/60">
            <Key className="w-3.5 h-3.5 text-amber-400" />
            <span>{isRTL ? 'ترخيص وتفعيل حصري' : 'Device Bound License'}</span>
          </div>
        </div>

        {/* Administrator Portal & Key Room links */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
          {onOpenAdminLogin && (
            <button
              onClick={onOpenAdminLogin}
              className="text-[11px] text-slate-500 hover:text-amber-400 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ShieldAlert className="w-3 h-3" />
              <span>{isRTL ? 'بوابة دخول المشرف (Admin)' : 'Administrator Portal'}</span>
            </button>
          )}
          {onOpenKeyRoom && (
            <button
              onClick={onOpenKeyRoom}
              className="text-[11px] text-amber-500/80 hover:text-amber-300 transition-colors flex items-center justify-center gap-1.5 cursor-pointer font-bold"
            >
              <Key className="w-3 h-3 text-amber-400" />
              <span>{isRTL ? 'غرفة المدير (sbaa0000)' : 'Key Room (sbaa0000)'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
