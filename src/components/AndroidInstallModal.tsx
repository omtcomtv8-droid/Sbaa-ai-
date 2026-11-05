import React, { useState } from 'react';
import {
  Smartphone,
  Download,
  Copy,
  Check,
  ShieldCheck,
  X,
  Zap,
  Share2,
  CheckCircle2,
  Globe,
  AlertTriangle,
  Monitor,
  ExternalLink,
  ChevronLeft,
} from 'lucide-react';
import { usePwaInstall } from '../hooks/usePwaInstall';
import { useLanguage } from '../i18n/LanguageContext';

interface AndroidInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AndroidInstallModal: React.FC<AndroidInstallModalProps> = ({ isOpen, onClose }) => {
  const { t, tTerm, isRTL } = useLanguage();
  const [copied, setCopied] = useState(false);
  const [installStatus, setInstallStatus] = useState<string | null>(null);
  const [activePlatformTab, setActivePlatformTab] = useState<'android' | 'ios' | 'desktop'>('android');
  const { isInstallable, isInstalled, isIOS, isAndroid, isInAppBrowser, promptInstall } = usePwaInstall();

  // Auto-select platform tab if detected
  React.useEffect(() => {
    if (isIOS) setActivePlatformTab('ios');
    else if (isAndroid) setActivePlatformTab('android');
  }, [isIOS, isAndroid]);

  if (!isOpen) return null;

  const getPublicOrigin = () => {
    const origin = window.location.origin;
    if (origin.includes('ais-dev-')) {
      return origin.replace('ais-dev-', 'ais-pre-');
    }
    return origin;
  };

  const publicOrigin = getPublicOrigin();
  const installUrl = `${publicOrigin}`;
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(installUrl)}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(installUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleInstallClick = async () => {
    if (isInstallable) {
      const outcome = await promptInstall();
      if (outcome === 'accepted') {
        setInstallStatus('تم تثبيت التطبيق بنجاح على جهازك!');
      } else if (outcome === 'dismissed') {
        setInstallStatus('تم إغلاق نافذة التثبيت');
      }
    } else {
      if (isIOS) {
        setInstallStatus('على الآيفون: اضغط زر المشاركة (Share) ثم "إضافة إلى الشاشة الرئيسية"');
      } else {
        setInstallStatus('افتح قائمة المتصفح (⋮) بالأعلى واختر "تثبيت التطبيق" أو "إضافة إلى الشاشة الرئيسية"');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-100 flex items-center gap-2">
                <span>تثبيت تطبيق SABAA AI على الهاتف</span>
                <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold">
                  بدون أخطاء حزم
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                يعمل كتطبيق مستقل بملء الشاشة، سرعة فائقة، وبدون الحاجة لمتجر تطبيقات
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className={`p-4 sm:p-6 overflow-y-auto space-y-4 text-sm font-sans ${isRTL ? 'text-right' : 'text-left'}`}>
          {/* In-App Browser Warning Alert */}
          {isInAppBrowser && (
            <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-200 flex items-start gap-2.5 text-xs leading-relaxed">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold text-amber-300 block mb-0.5">تنبيه: متصفح داخلي</strong>
                أنت تتصفح من داخل تطبيق محادثة (مثل تلغرام أو واتساب). متصفحات التطبيقات الداخلية تمنع تثبيت التطبيقات. يرجى الضغط على القائمة <strong>(⋮)</strong> واختيار <strong>&quot;فتح في متصفح خارجي (Chrome / Safari)&quot;</strong> لتثبيت التطبيق بنجاح.
              </div>
            </div>
          )}

          {/* Primary Action Card: 1-Click Install Button */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-950/50 via-slate-950 to-slate-900 border border-emerald-500/40 shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                  <Zap className="w-4 h-4" />
                </span>
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                  التثبيت المباشر بنقرة واحدة
                </span>
              </div>
              <span className="text-[10px] font-mono text-emerald-300 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                PWA Standalone App
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              يتم تثبيت التطبيق مباشرة على شاشة هاتفك الرئيسية كبرنامج مستقل؛ بدون استهلاك مساحة، بدون أخطاء &quot;حزمة تالفة&quot;، وبكامل الشاشة بدون شريط المتصفح.
            </p>

            <div className="pt-1 flex flex-col sm:flex-row items-center gap-2.5">
              <button
                onClick={handleInstallClick}
                className="w-full sm:w-auto flex-1 py-3 px-4 rounded-xl text-xs font-black bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transition-all cursor-pointer transform hover:-translate-y-0.5"
              >
                {isInstalled ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-slate-950" />
                    <span>التطبيق مثبت بالفعل على جهازك</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 text-slate-950" />
                    <span>تثبيت التطبيق على هاتفي الآن</span>
                  </>
                )}
              </button>

              <button
                onClick={handleCopyLink}
                className="w-full sm:w-auto py-3 px-4 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center gap-1.5 border border-slate-700 transition-colors cursor-pointer"
                title="نسخ الرابط لإرساله للهاتف"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-400">تم نسخ الرابط!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-slate-400" />
                    <span>نسخ رابط الهاتف</span>
                  </>
                )}
              </button>
            </div>

            {installStatus && (
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{installStatus}</span>
              </div>
            )}
          </div>

          {/* Interactive Step-by-Step Platform Tabs */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-amber-400" />
                <span>خطوات التثبيت اليدوية السريعة (إذا لم تظهر نافذة التثبيت تلقائياً):</span>
              </span>
            </div>

            {/* Platform Selector Buttons */}
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-900 rounded-lg border border-slate-800 text-xs font-bold">
              <button
                onClick={() => setActivePlatformTab('android')}
                className={`py-2 px-2 rounded-md flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activePlatformTab === 'android'
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>أندرويد (Chrome)</span>
              </button>
              <button
                onClick={() => setActivePlatformTab('ios')}
                className={`py-2 px-2 rounded-md flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activePlatformTab === 'ios'
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>آيفون (Safari)</span>
              </button>
              <button
                onClick={() => setActivePlatformTab('desktop')}
                className={`py-2 px-2 rounded-md flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activePlatformTab === 'desktop'
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Monitor className="w-3.5 h-3.5" />
                <span>الكمبيوتر (PC)</span>
              </button>
            </div>

            {/* Android Tab Content */}
            {activePlatformTab === 'android' && (
              <div className="space-y-2 text-xs text-slate-300 pt-1 animate-in fade-in duration-150">
                <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    1
                  </span>
                  <div>
                    افتح المنصة في متصفح <strong>Google Chrome</strong> على هاتفك واضغط على زر القائمة النقاط الثلاث <strong>(⋮)</strong> في الزاوية العلوية للمتصفح.
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    2
                  </span>
                  <div>
                    اختر خيار <strong>&quot;تثبيت التطبيق&quot; (Install app)</strong> أو <strong>&quot;إضافة إلى الشاشة الرئيسية&quot; (Add to Home screen)</strong>.
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    3
                  </span>
                  <div>
                    اضغط على <strong>&quot;تثبيت&quot;</strong> — سيتم تنزيل وتثبيت أيقونة التطبيق على شاشة هاتفك فوراً، وستفتح ملء الشاشة كتطبيق أصلي سريع.
                  </div>
                </div>
              </div>
            )}

            {/* iOS Tab Content */}
            {activePlatformTab === 'ios' && (
              <div className="space-y-2 text-xs text-slate-300 pt-1 animate-in fade-in duration-150">
                <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    1
                  </span>
                  <div>
                    افتح الرابط في متصفح <strong>Safari</strong> على جهاز الآيفون أو الآيباد.
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    2
                  </span>
                  <div>
                    اضغط على زر المشاركة <strong>(Share / مربع به سهم للأعلى)</strong> في أسفل شاشة Safari.
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    3
                  </span>
                  <div>
                    مرر لأسفل القائمة واضغط على <strong>&quot;إضافة إلى الشاشة الرئيسية&quot; (Add to Home Screen)</strong>، ثم اضغط <strong>&quot;إضافة&quot;</strong>.
                  </div>
                </div>
              </div>
            )}

            {/* Desktop Tab Content */}
            {activePlatformTab === 'desktop' && (
              <div className="space-y-2 text-xs text-slate-300 pt-1 animate-in fade-in duration-150">
                <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    1
                  </span>
                  <div>
                    على متصفح Chrome أو Edge: انظر إلى يمين شريط العنوان (URL bar) ستجد أيقونة تثبيت صغيرة.
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    2
                  </span>
                  <div>
                    اضغط على أيقونة التثبيت أو افتح القائمة (⋮) واضغط <strong>&quot;تثبيت SABAA AI SOLUTION&quot;</strong>.
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* QR Code Section: Open on Phone */}
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col sm:flex-row items-center gap-4">
            <div className="bg-white p-2 rounded-xl shrink-0 shadow-md">
              <img
                src={qrApiUrl}
                alt="QR Code"
                className="w-24 h-24 sm:w-28 sm:h-28 object-contain"
                loading="lazy"
              />
            </div>
            <div className="space-y-1.5 text-xs text-slate-300">
              <div className="font-bold text-slate-100 flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-emerald-400" />
                <span>فتح المنصة فوراً على هاتفك:</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                وجه كاميرا هاتفك نحو رمز الاستجابة السريعة (QR Code) لفتح المنصة مباشرة في متصفح هاتفك وتثبيتها بنقرة واحدة.
              </p>
              <div className="pt-1 flex items-center gap-2">
                <button
                  onClick={handleCopyLink}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  <span>{copied ? 'تم النسخ!' : 'نسخ رابط المنصة العام'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Technical Note on PWA vs Raw APK */}
          <div className="p-3 rounded-lg bg-slate-950/50 border border-slate-800/80 text-[11px] text-slate-400 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong className="text-slate-300">لماذا نعتمد تقنية PWA المباشرة؟</strong>{' '}
              تقنية تطبيقات الويب التقدمية (PWA) تضمن تثبيت التطبيق على جهازك بدون أخطاء توافق ملفات APK مع معالجات الهواتف (Parse Errors)، وتوفر تحديثات فورية بدون الحاجة لإعادة تحميل وتثبيت حزم يدوياً.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span className="font-mono text-[11px] text-slate-500">SABAA AI SOLUTION • v1.0.0</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold transition-colors cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
