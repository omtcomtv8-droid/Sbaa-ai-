import React, { useState } from 'react';
import { ShieldCheck, Lock, AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

interface AdminChangePasswordModalProps {
  isOpen: boolean;
  adminToken: string;
  onSuccess: () => void;
}

export const AdminChangePasswordModal: React.FC<AdminChangePasswordModalProps> = ({
  isOpen,
  adminToken,
  onSuccess,
}) => {
  const { isRTL } = useLanguage();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError(isRTL ? 'يرجى ملء جميع الحقول' : 'All fields are required');
      return;
    }
    if (newPassword.length < 8) {
      setError(isRTL ? 'كلمة المرور الجديدة يجب ألا تقل عن 8 أحرف' : 'New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(isRTL ? 'كلمة المرور الجديدة وتأكيدها غير متطابقين' : 'Passwords do not match');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': adminToken,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();
      setIsLoading(false);

      if (!res.ok || !data.success) {
        setError(data.error || (isRTL ? 'فشل تغيير كلمة المرور' : 'Failed to change password'));
        return;
      }

      onSuccess();
    } catch (err: any) {
      setIsLoading(false);
      setError(err?.message || 'Server error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-lg" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="relative w-full max-w-md bg-slate-900 border border-amber-500/50 rounded-2xl shadow-2xl p-6 sm:p-8">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
          <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-100">{isRTL ? 'تغيير كلمة مرور المشرف (إلزامي)' : 'Change Administrator Password'}</h3>
            <p className="text-xs text-amber-400 font-bold">{isRTL ? 'يجب تعيين كلمة مرور قوية جديدة للمتابعة' : 'Mandatory new secure password required'}</p>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">{isRTL ? 'كلمة المرور الحالية:' : 'Current Password:'}</label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full py-2.5 px-3 bg-slate-950 border border-slate-700 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">{isRTL ? 'كلمة المرور الجديدة (8 أحرف على الأقل):' : 'New Password (min 8 chars):'}</label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full py-2.5 px-3 bg-slate-950 border border-slate-700 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">{isRTL ? 'تأكيد كلمة المرور الجديدة:' : 'Confirm New Password:'}</label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full py-2.5 px-3 bg-slate-950 border border-slate-700 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
              required
            />
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="hover:text-slate-200 flex items-center gap-1 cursor-pointer"
            >
              {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{showPassword ? (isRTL ? 'إخفاء كلمة المرور' : 'Hide') : (isRTL ? 'إظهار كلمة المرور' : 'Show')}</span>
            </button>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs sm:text-sm shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>{isRTL ? 'حفظ وتأمين لوحة الإدارة' : 'Save & Secure Admin Room'}</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
