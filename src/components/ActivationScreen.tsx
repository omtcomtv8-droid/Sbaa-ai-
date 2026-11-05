import React, { useState } from 'react';
import { ShieldAlert, Key, Sparkles, TrendingUp, CheckCircle2, Lock, ArrowRight, ArrowLeft } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../i18n/LanguageContext';

interface ActivationScreenProps {
  onOpenAdminLogin?: () => void;
  onOpenKeyRoom?: () => void;
}

export const ActivationScreen: React.FC<ActivationScreenProps> = ({
  onOpenAdminLogin,
  onOpenKeyRoom,
}) => {
  const { activateCode, isActivating, errorMessage, enterDemoGuest } = useAuth();
  const { isRTL } = useLanguage();
  const [code, setCode] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setLocalError(null);
    const res = await activateCode(code.trim());
    if (!res.success) {
      setLocalError(res.error || (isRTL ? 'فشل التحقق من كود التفعيل' : 'Invalid activation code'));
    }
  };

  return (
    <div
      className="min-h-screen bg-[#05070B] text-slate-100 flex items-center justify-center p-4 relative overflow-hidden font-sans"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-80 h-80 bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative w-full max-w-md bg-slate-900/90 border border-slate-800 backdrop-blur-2xl rounded-3xl shadow-2xl p-6 sm:p-8 text-center space-y-6">
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
          <p className="text-xs text-slate-400 leading-relaxed">
            {isRTL
              ? 'تفعيل ترخيص المنصة المؤسسية للدخول إلى غرفة التداول الحية'
              : 'Institutional Platform License Activation Required'}
          </p>
        </div>

        {/* Notice badge */}
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-3 text-xs text-amber-300 text-left">
          <Key className="w-5 h-5 text-amber-400 shrink-0" />
          <p className="leading-snug">
            {isRTL
              ? 'يرجى إدخال كود التفعيل المخصص أو كود الماستر (sbaa0000) للوصول الفوري للمنصة.'
              : 'Please enter your license key or master code (sbaa0000) to access live trading signals.'}
          </p>
        </div>

        {(localError || errorMessage) && (
          <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs text-center">
            {localError || errorMessage}
          </div>
        )}

        {/* Activation Code Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setLocalError(null);
            }}
            placeholder="SABAA-XXXX-XXXX or sbaa0000"
            className="w-full py-3 px-4 bg-slate-950 border border-slate-700 rounded-2xl text-slate-100 placeholder-slate-500 font-mono text-sm tracking-widest text-center focus:outline-none focus:border-amber-400"
          />

          <button
            type="submit"
            disabled={isActivating || !code.trim()}
            className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs sm:text-sm shadow-xl shadow-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isActivating ? (
              <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            <span>{isRTL ? 'تفعيل ودخول المنصة' : 'Activate & Enter Platform'}</span>
          </button>
        </form>

        {/* Instant Demo Access Button */}
        <button
          type="button"
          onClick={() => enterDemoGuest()}
          className="w-full py-3 px-4 rounded-2xl bg-slate-950/80 hover:bg-slate-800/80 border border-slate-800 text-slate-300 hover:text-amber-400 font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>{isRTL ? 'دخول تجريبي فوري (Instant Demo)' : 'Instant Demo Access'}</span>
        </button>

        {/* Footer Admin Links */}
        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-center gap-4 text-xs">
          {onOpenAdminLogin && (
            <button
              onClick={onOpenAdminLogin}
              className="text-slate-400 hover:text-amber-400 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>{isRTL ? 'بوابة المشرف' : 'Admin Login'}</span>
            </button>
          )}

          {onOpenKeyRoom && (
            <button
              onClick={onOpenKeyRoom}
              className="text-amber-400/80 hover:text-amber-300 font-bold transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Key className="w-3.5 h-3.5 text-amber-400" />
              <span>{isRTL ? 'غرفة المفاتيح (sbaa0000)' : 'Key Room'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
