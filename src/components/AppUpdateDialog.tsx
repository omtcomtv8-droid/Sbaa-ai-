import React, { useState } from 'react';
import { Download, AlertCircle, CheckCircle, Shield, X, ExternalLink, RefreshCw, FileCheck } from 'lucide-react';
import { AppVersionInfo, appUpdateService } from '../services/AppUpdateService';
import { useLanguage } from '../i18n/LanguageContext';

interface AppUpdateDialogProps {
  versionInfo: AppVersionInfo | null;
  isOpen: boolean;
  onClose: () => void;
}

export const AppUpdateDialog: React.FC<AppUpdateDialogProps> = ({ versionInfo, isOpen, onClose }) => {
  const { t, isRTL } = useLanguage();
  const [downloading, setDownloading] = useState(false);
  const [downloadStarted, setDownloadStarted] = useState(false);

  if (!isOpen || !versionInfo) return null;

  const isMandatory = Boolean(versionInfo.mandatory);

  const handleUpdateNow = () => {
    setDownloading(true);
    try {
      appUpdateService.installApk(versionInfo);
      setDownloadStarted(true);
    } catch (e) {
      console.error('Failed to initiate APK download:', e);
    } finally {
      setTimeout(() => setDownloading(false), 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-lg bg-slate-900 border border-amber-500/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Top Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-950/60 to-slate-900 border-b border-amber-500/20 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40">
              <Download className="w-6 h-6 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-400">
                  {isMandatory ? 'تحديث إلزامي مطلوب' : 'تحديث جديد متاح'}
                </span>
                {isMandatory && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                    MANDATORY
                  </span>
                )}
              </div>
              <h3 className="text-lg font-black text-slate-100 mt-0.5">
                SABAA AI SOLUTION v{versionInfo.versionName}
              </h3>
            </div>
          </div>

          {!isMandatory && (
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className={`p-4 sm:p-6 overflow-y-auto space-y-4 text-sm font-sans ${isRTL ? 'text-right' : 'text-left'}`}>
          {/* Version Comparison Card */}
          <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-950/70 border border-slate-800">
            <div>
              <span className="text-[10px] font-mono text-slate-400 uppercase block">الإصدار الحالي المثبت</span>
              <span className="text-sm font-mono font-bold text-slate-300">
                v{appUpdateService.CURRENT_VERSION_NAME} (Build {appUpdateService.CURRENT_VERSION_CODE})
              </span>
            </div>
            <div>
              <span className="text-[10px] font-mono text-emerald-400 uppercase block">الإصدار الجديد المتاح</span>
              <span className="text-sm font-mono font-bold text-emerald-400">
                v{versionInfo.versionName} (Build {versionInfo.versionCode})
              </span>
            </div>
          </div>

          {/* Release Notes */}
          <div className="space-y-1.5">
            <span className="text-xs font-bold font-mono text-slate-300 uppercase">ما الجديد في هذا التحديث:</span>
            <div className="p-3.5 rounded-xl bg-slate-950/50 border border-slate-800 text-xs text-slate-300 leading-relaxed max-h-36 overflow-y-auto whitespace-pre-wrap">
              {versionInfo.releaseNotes || 'تحسينات في استقرار الاتصال، دقة المحرك الفني، وسرعة معالجة الشموع.'}
            </div>
          </div>

          {/* Integrity & Security Badges */}
          <div className="p-3 rounded-xl bg-blue-950/20 border border-blue-500/20 space-y-2">
            <div className="flex items-center gap-2 text-xs text-blue-300 font-semibold">
              <Shield className="w-4 h-4 text-blue-400 shrink-0" />
              <span>حزمة APK موثوقة وموقعة رقمياً (توزيع مباشر)</span>
            </div>
            {versionInfo.fileSize && (
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span>حجم الملف:</span>
                <span className="text-slate-200 font-bold">{versionInfo.fileSize}</span>
              </div>
            )}
            {versionInfo.sha256 && (
              <div className="space-y-1 text-[10px] font-mono text-slate-400">
                <div className="flex items-center gap-1 text-slate-400">
                  <FileCheck className="w-3.5 h-3.5 text-cyan-400" />
                  <span>SHA-256 Checksum:</span>
                </div>
                <div className="p-1.5 rounded bg-slate-950 font-mono text-[9px] text-cyan-300/90 break-all select-all">
                  {versionInfo.sha256}
                </div>
              </div>
            )}
          </div>

          {/* Instructions note */}
          <div className="text-[11px] text-amber-300/80 bg-amber-950/20 p-2.5 rounded-lg border border-amber-500/20">
            💡 ملاحظة لتثبيت التحديث: عند تنزيل ملف الـ APK، اضغط على إشعار التنزيل أو افتح الملف مباشرة من مجلد التنزيلات واضغط "تثبيت".
          </div>

          {downloadStarted && (
            <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 flex items-center gap-2.5 text-xs text-emerald-300">
              <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <p className="font-bold">تم بدء تحميل الحزمة بنجاح!</p>
                <p className="text-[11px] text-emerald-300/80">
                  افتح إشعارات أندرويد لتثبيت ملف APK المحدّث.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-950/80 border-t border-slate-800 flex items-center justify-end gap-3">
          {!isMandatory && (
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              تخطي الآن
            </button>
          )}

          <button
            onClick={handleUpdateNow}
            disabled={downloading}
            className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-50"
          >
            {downloading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>جاري فتح التحميل...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>تحديث وتثبيت الآن (APK)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
