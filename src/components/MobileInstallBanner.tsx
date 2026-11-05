import React, { useState } from 'react';
import { Smartphone, Download, X } from 'lucide-react';
import { usePwaInstall } from '../hooks/usePwaInstall';
import { useLanguage } from '../i18n/LanguageContext';

interface MobileInstallBannerProps {
  onOpenModal: () => void;
}

export const MobileInstallBanner: React.FC<MobileInstallBannerProps> = ({ onOpenModal }) => {
  const [dismissed, setDismissed] = useState(false);
  const { isInstalled, isInstallable, promptInstall } = usePwaInstall();
  const { t, isRTL } = useLanguage();

  // If already installed in standalone mode, never show banner
  if (isInstalled || dismissed) {
    return null;
  }

  const handleAction = async () => {
    if (isInstallable) {
      const outcome = await promptInstall();
      if (outcome === 'accepted') {
        setDismissed(true);
        return;
      }
    }
    // If prompt not available or on iOS, open the detailed visual modal
    onOpenModal();
  };

  return (
    <div
      id="mobile-install-banner"
      className="fixed bottom-3 inset-x-3 z-40 sm:hidden animate-in slide-in-from-bottom duration-300"
    >
      <div className={`p-3 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 border border-emerald-500/40 shadow-2xl shadow-emerald-500/10 flex items-center justify-between gap-2.5 backdrop-blur-lg ${isRTL ? 'text-right' : 'text-left'}`}>
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <Smartphone className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5 truncate">
              <span>{t('install.bannerTitle', 'تطبيق SABAA AI للهاتف')}</span>
              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-400">
                PWA
              </span>
            </div>
            <p className="text-[10px] text-slate-400 truncate">
              {t('install.bannerSub', 'تثبيت مباشر وسريع بدون متجر تطبيقات')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={handleAction}
            className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black shadow-md flex items-center gap-1 transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t('install.installBtn', 'تثبيت')}</span>
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="p-1 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            title={t('common.close', 'إخفاء')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
