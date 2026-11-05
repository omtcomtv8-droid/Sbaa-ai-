import React, { useState } from 'react';
import { ShieldAlert, Lock, User, Key, AlertCircle, Eye, EyeOff, X, ArrowRight } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (token: string, mustChangePassword: boolean) => void;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { t, isRTL } = useLanguage();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError(isRTL ? 'يرجى إدخال اسم المستخدم وكلمة المرور' : 'Username and password required');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      const data = await res.json();
      setIsLoading(false);

      if (!res.ok || !data.success) {
        setError(data.error || (isRTL ? 'فشل تسجيل الدخول كمسؤول' : 'Admin login failed'));
        return;
      }

      onSuccess(data.token, Boolean(data.mustChangePassword));
    } catch (err: any) {
      setIsLoading(false);
      setError(err?.message || (isRTL ? 'خطأ في الاتصال بالخادم' : 'Server connection error'));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 sm:p-7 overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-100">{isRTL ? 'بوابة إدارة النظام (Admin)' : 'Administrator Portal'}</h3>
              <p className="text-[11px] text-slate-400">{isRTL ? 'منطقة مخصصة للمشرف المعتمد فقط' : 'Restricted to authorized system administrators'}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              {isRTL ? 'اسم المستخدم:' : 'Username:'}
            </label>
            <div className="relative">
              <User className={`w-4 h-4 text-slate-500 absolute top-3.5 ${isRTL ? 'right-3.5' : 'left-3.5'}`} />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                className={`w-full py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-amber-500 transition-all font-mono ${
                  isRTL ? 'pr-10 pl-3' : 'pl-10 pr-3'
                }`}
                autoComplete="username"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              {isRTL ? 'كلمة المرور المشفرة:' : 'Password:'}
            </label>
            <div className="relative">
              <Lock className={`w-4 h-4 text-slate-500 absolute top-3.5 ${isRTL ? 'right-3.5' : 'left-3.5'}`} />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={`w-full py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-amber-500 transition-all font-mono ${
                  isRTL ? 'pr-10 pl-10' : 'pl-10 pr-10'
                }`}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className={`absolute top-2.5 p-1 text-slate-400 hover:text-slate-200 cursor-pointer ${
                  isRTL ? 'left-2.5' : 'right-2.5'
                }`}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs sm:text-sm shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Key className="w-4 h-4" />
                <span>{isRTL ? 'تسجيل دخول الإدارة' : 'Authenticate Administrator'}</span>
                <ArrowRight className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
