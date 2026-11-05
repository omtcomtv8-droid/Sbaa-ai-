import React, { useState, useEffect } from 'react';
import { Key, Lock, CheckCircle2, AlertCircle, RefreshCw, Trash2, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../i18n/LanguageContext';

export const UserApiKeySection: React.FC = () => {
  const { sessionToken, isActivating } = useAuth();
  const { t, isRTL } = useLanguage();

  const [platformToken, setPlatformToken] = useState('');
  const [accountUid, setAccountUid] = useState('');
  const [isDemo, setIsDemo] = useState(true);
  const [showToken, setShowToken] = useState(false);

  const [savedCreds, setSavedCreds] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchCreds = async () => {
    if (!sessionToken) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/credentials', {
        headers: { 'x-session-token': sessionToken },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSavedCreds(data.credentials);
        if (data.credentials?.accountUid) {
          setAccountUid(data.credentials.accountUid);
        }
        if (data.credentials?.isDemo !== undefined) {
          setIsDemo(data.credentials.isDemo);
        }
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCreds();
  }, [sessionToken]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionToken) return;
    if (!platformToken.trim() && !savedCreds) {
      setMessage({ text: isRTL ? 'يرجى إدخال توكن الجلسة' : 'Session token required', type: 'error' });
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const res = await fetch('/api/auth/credentials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-token': sessionToken,
        },
        body: JSON.stringify({
          platform: 'pocket_option',
          sessionToken: platformToken.trim() || 'preserved',
          accountUid: accountUid.trim(),
          isDemo,
        }),
      });

      const data = await res.json();
      setIsSaving(false);

      if (res.ok && data.success) {
        setMessage({ text: isRTL ? '✅ تم حفظ واعتماد بيانات المنصة بنجاح' : 'Credentials securely saved!', type: 'success' });
        setPlatformToken('');
        fetchCreds();
      } else {
        setMessage({ text: data.error || 'Failed to save', type: 'error' });
      }
    } catch (err: any) {
      setIsSaving(false);
      setMessage({ text: err?.message || 'Connection error', type: 'error' });
    }
  };

  const handleDelete = async () => {
    if (!sessionToken) return;
    if (!confirm(isRTL ? 'هل أنت متأكد من حذف بيانات الاعتماد؟' : 'Remove saved credentials?')) return;

    try {
      const res = await fetch('/api/auth/credentials', {
        method: 'DELETE',
        headers: { 'x-session-token': sessionToken },
      });
      if (res.ok) {
        setSavedCreds(null);
        setPlatformToken('');
        setAccountUid('');
        setMessage({ text: isRTL ? 'تمت إزالة بيانات الاعتماد' : 'Credentials removed', type: 'success' });
      }
    } catch {
      // ignore
    }
  };

  return (
    <div className="p-4 sm:p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-6 text-slate-200 text-xs" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Section Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-black text-slate-100">{isRTL ? 'إدارة مفاتيح وبيانات الاتصال (API & Gateway)' : 'API & Gateway Credentials'}</h3>
            <p className="text-[11px] text-slate-400">{isRTL ? 'تشفير وربط بيانات التداول بحسابك الموثق' : 'Secure platform credentials bound to your verified account'}</p>
          </div>
        </div>

        {savedCreds && (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{isRTL ? 'بيانات معتمدة' : 'Verified'}</span>
          </span>
        )}
      </div>

      {message && (
        <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
          message.type === 'success' ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' : 'bg-rose-500/20 border-rose-500/40 text-rose-300'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Existing Credential Badge if present */}
      {savedCreds && (
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 font-mono text-slate-300">
              <span className="text-slate-500">Session Token:</span>
              <span className="text-amber-400 font-bold">{savedCreds.sessionTokenMasked}</span>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono">
              <span>Mode: <strong className={savedCreds.isDemo ? 'text-blue-400' : 'text-emerald-400'}>{savedCreds.isDemo ? 'DEMO' : 'REAL'}</strong></span>
              {savedCreds.accountUid && <span>UID: <strong>{savedCreds.accountUid}</strong></span>}
            </div>
          </div>

          <button
            type="button"
            onClick={handleDelete}
            className="px-3 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isRTL ? 'إزالة البيانات' : 'Remove'}</span>
          </button>
        </div>
      )}

      {/* Input Form */}
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="block font-bold text-slate-300 mb-1 flex items-center justify-between">
            <span>{isRTL ? 'توكن جلسة Pocket Option (SSD Session):' : 'Pocket Option Session Token (SSD):'}</span>
          </label>
          <div className="relative">
            <input
              type={showToken ? 'text' : 'password'}
              value={platformToken}
              onChange={(e) => setPlatformToken(e.target.value)}
              placeholder={savedCreds ? (isRTL ? 'اتركه فارغاً للاحتفاظ بالتوكن الحالي' : 'Leave empty to keep existing token') : '42["auth",{"session":"...","isDemo":1}]'}
              className="w-full py-2.5 px-3 bg-slate-950 border border-slate-700 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
            />
            <button
              type="button"
              onClick={() => setShowToken(!showToken)}
              className={`absolute top-2.5 p-1 text-slate-400 hover:text-slate-200 cursor-pointer ${isRTL ? 'left-2.5' : 'right-2.5'}`}
            >
              {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-bold text-slate-300 mb-1">{isRTL ? 'معرف الحساب (UID اختياري):' : 'Account UID (Optional):'}</label>
            <input
              type="text"
              value={accountUid}
              onChange={(e) => setAccountUid(e.target.value)}
              placeholder="e.g. 12345678"
              className="w-full py-2 px-3 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-200 font-mono"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-300 mb-1">{isRTL ? 'نوع الحساب الافتراضي:' : 'Default Account Mode:'}</label>
            <select
              value={isDemo ? 'demo' : 'real'}
              onChange={(e) => setIsDemo(e.target.value === 'demo')}
              className="w-full py-2 px-3 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-200 font-mono"
            >
              <option value="demo">DEMO (حساب تجريبي)</option>
              <option value="real">REAL (حساب حقيقي)</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={isSaving}
          className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
        >
          {isSaving ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <ShieldCheck className="w-4 h-4" />
              <span>{isRTL ? 'حفظ وتأمين بيانات الاعتماد' : 'Save & Secure Credentials'}</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
};
