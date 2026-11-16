import React, { useState } from 'react';
import {
  TrendingUp,
  ShieldCheck,
  Zap,
  Lock,
  Layers,
  AlertTriangle,
  Terminal,
  Activity,
  Globe,
  LogIn,
  LogOut,
  UserCheck,
  Key,
  Smartphone,
  Bot,
} from 'lucide-react';
import { DiagnosticsInfo } from '../types';
import { GatewayOnboardingCard } from './GatewayOnboardingCard';
import { DemoPlatformActivityCard } from './DemoPlatformActivityCard';
import { useLanguage, LanguageSwitcher } from '../i18n/LanguageContext';
import { BrandLogo } from './BrandLogo';

interface LandingPageProps {
  onEnterTerminal?: () => void;
  onLaunchTerminal?: () => void;
  onOpenScanner?: () => void;
  onOpenSettings?: () => void;
  firebaseUser?: {
    uid: string;
    displayName: string | null;
    email: string | null;
    photoURL?: string | null;
  } | null;
  onSignInGoogle?: () => void;
  onSignOut?: () => void;
  diagnostics?: DiagnosticsInfo | null;
  onConnectAccount?: (params: {
    endpoint?: string;
    sessionToken: string;
    isDemo: boolean;
    uid?: number | null;
  }) => Promise<{ success: boolean; error?: string; diagnostics?: DiagnosticsInfo }>;
  onDisconnectAccount?: () => void;
  configuredSession?: string;
  configuredIsDemo?: boolean;
  configuredUid?: string | number | null;
  isReconnecting?: boolean;
  onOpenAndroidInstall?: () => void;
  onOpenTelegram?: () => void;
  onOpenAdmin?: () => void;
  onOpenKeyRoom?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onEnterTerminal,
  onLaunchTerminal,
  onOpenScanner,
  onOpenSettings,
  firebaseUser,
  onSignInGoogle,
  onSignOut,
  diagnostics,
  onConnectAccount,
  onDisconnectAccount,
  configuredSession,
  configuredIsDemo,
  configuredUid,
  isReconnecting,
  onOpenAndroidInstall,
  onOpenTelegram,
  onOpenAdmin,
  onOpenKeyRoom,
}) => {
  const [highlightCard, setHighlightCard] = useState(false);
  const { t, tTerm, tDynamic, isRTL } = useLanguage();
  const handleTerminal = onEnterTerminal || onLaunchTerminal || (() => {});
  const handleScanner = onOpenScanner || handleTerminal;

  const handleTerminalGuard = () => {
    handleTerminal();
  };
  return (
    <div id="sabaa-landing-page" className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-amber-500/30 selection:text-amber-200">
      {/* Top Floating Announcement Bar */}
      <div className="bg-gradient-to-r from-emerald-500/10 via-amber-500/15 to-emerald-500/10 border-b border-emerald-500/20 py-2 px-4 text-center text-xs text-emerald-300 flex items-center justify-center gap-2">
        <Activity className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        <span className="font-semibold">{isRTL ? 'تحديث المحرك:' : 'Engine Update:'}</span>
        <span>{isRTL ? 'تشغيل منظومة التوافق الخوارزمي الـ 26 وسيولة SMC / ICT مع التنفيذ الفعلي للحساب الحقيقي.' : '26 Algorithmic Strategy Modules & SMC / ICT Liquidity Confluence Live on Real Account.'}</span>
      </div>

      {/* Main Navigation */}
      <nav className="border-b border-slate-800/80 bg-slate-950/90 backdrop-blur sticky top-0 z-40 px-4 lg:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BrandLogo size="md" className="shrink-0" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-lg tracking-tight bg-gradient-to-r from-emerald-200 via-emerald-400 to-amber-400 bg-clip-text text-transparent">
                  SABAA QUANT
                </span>
                <span className="px-2 py-0.5 text-[9px] font-bold rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  REAL LIVE TERMINAL
                </span>
              </div>
              <p className="text-[11px] text-slate-400">{t('appSubtitle', 'Institutional algorithmic quantitative engine, multi-strategy confluence, and risk management')}</p>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
            <a href="#features" className="hover:text-emerald-400 transition-colors">{t('nav.strategies', 'Strategies')}</a>
            <a href="#smc-section" className="hover:text-emerald-400 transition-colors">{tTerm('SMC Liquidity')}</a>
            <a href="#faq" className="hover:text-emerald-400 transition-colors">FAQ</a>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Language Switcher */}
            <LanguageSwitcher compact />

            {/* Firebase Auth in Nav */}
            {firebaseUser ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                {firebaseUser.photoURL ? (
                  <img src={firebaseUser.photoURL} alt="Avatar" className="w-5 h-5 rounded-full" referrerPolicy="no-referrer" />
                ) : (
                  <UserCheck className="w-4 h-4 text-emerald-400" />
                )}
                <span className="font-semibold">{firebaseUser.displayName || t('header.cloudAccount', 'Cloud Account')}</span>
                {onSignOut && (
                  <button
                    onClick={onSignOut}
                    className="text-slate-400 hover:text-rose-400 ml-1 p-0.5 transition-colors cursor-pointer"
                    title="Sign Out"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ) : onSignInGoogle ? (
              <button
                onClick={onSignInGoogle}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-amber-500/40 text-amber-300 hover:text-amber-200 text-xs font-semibold transition-colors cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5 text-amber-400" />
                <span>{t('header.cloudSignIn', 'Sign In')}</span>
              </button>
            ) : null}

            {/* Telegram Bot Button */}
            {onOpenTelegram && (
              <button
                onClick={onOpenTelegram}
                className="p-2 rounded-lg bg-blue-600/15 hover:bg-blue-600/25 border border-blue-500/30 text-blue-400 text-xs transition-colors cursor-pointer flex items-center gap-1"
                title={isRTL ? 'إعدادات وبث بوت التلجرام' : 'Telegram Bot & Broadcast'}
              >
                <Bot className="w-3.5 h-3.5" />
                <span className="hidden xl:inline">{isRTL ? 'بوت التلجرام' : 'Bot'}</span>
              </button>
            )}

            {/* Key Room Button */}
            {onOpenKeyRoom && (
              <button
                onClick={onOpenKeyRoom}
                className="px-2.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                title={isRTL ? 'غرفة توليد المفاتيح (sbaa0000)' : 'Key Generator Room'}
              >
                <Key className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden lg:inline">{isRTL ? 'غرفة المفاتيح' : 'Key Room'}</span>
              </button>
            )}

            <button
              id="landing-btn-scanner"
              onClick={handleScanner}
              className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-semibold transition-colors cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5 text-sky-400" />
              <span>{t('nav.scanner', 'Market Scanner')}</span>
            </button>
            {onOpenAndroidInstall && (
              <button
                onClick={onOpenAndroidInstall}
                className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 text-xs font-bold transition-colors cursor-pointer"
                title="تثبيت التطبيق على الهاتف (PWA & APK)"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>تثبيت التطبيق</span>
              </button>
            )}
            <button
              id="landing-btn-enter-terminal"
              onClick={handleTerminalGuard}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition-all cursor-pointer"
            >
              <Terminal className="w-4 h-4" />
              <span>{t('landing.connectTerminal', 'Enter Terminal')}</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section with Dual-Column Institutional Gateway */}
      <section className="relative overflow-hidden pt-10 pb-16 px-4 lg:px-8 border-b border-slate-900">
        {/* Glow Effects */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-amber-500/10 blur-[130px] pointer-events-none rounded-full" />
        <div className="absolute top-1/3 left-1/4 w-[400px] h-[300px] bg-sky-500/10 blur-[140px] pointer-events-none rounded-full" />

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Hero Pitch & CTAs */}
            <div className={`lg:col-span-7 space-y-6 ${isRTL ? 'text-right' : 'text-left'}`}>
              {/* Trust Badge */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded bg-slate-900/90 border border-emerald-500/30 text-xs text-slate-300 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-semibold text-emerald-300">{isRTL ? 'محرك تحليل كمي خوارزمي مستقل' : 'Autonomous Quantitative Market Analysis Engine'}</span>
                <span className="text-slate-500">|</span>
                <span className="text-slate-400">{isRTL ? 'ربط مباشر مع الحساب الحقيقي 100%' : 'Direct Real Account Connectivity'}</span>
              </div>

              <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-[1.25] text-slate-100">
                {t('landing.heroTitle', 'INSTITUTIONAL QUANTITATIVE SIGNAL ENGINE')} <br className="hidden sm:inline" />
                <span className="bg-gradient-to-r from-emerald-300 via-emerald-400 to-amber-400 bg-clip-text text-transparent">
                  {tTerm('SMC Liquidity')} &amp; {isRTL ? 'التوافق الخوارزمي' : 'Algorithmic Confluence'}
                </span>
              </h1>

              <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl">
                {t('landing.heroSubtitle', 'Autonomous multi-factor algorithmic analysis, certified non-repainting mathematical indicators, and real-time broker execution telemetry.')}
              </p>

              {/* Action CTAs */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  onClick={handleTerminalGuard}
                  className="flex items-center gap-2.5 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-amber-500 hover:from-emerald-400 hover:to-amber-400 text-slate-950 font-black text-xs shadow-xl shadow-emerald-500/20 transition-all transform hover:-translate-y-0.5 cursor-pointer"
                >
                  <Terminal className="w-4 h-4" />
                  <span>{t('landing.connectTerminal', 'Open Trading Terminal')}</span>
                </button>

                <button
                  onClick={handleScanner}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 hover:border-emerald-500/50 text-xs font-bold shadow-sm transition-all cursor-pointer"
                >
                  <Globe className="w-4 h-4 text-emerald-400" />
                  <span>{t('nav.scanner', 'Market Scanner')}</span>
                </button>

                {onOpenAndroidInstall && (
                  <button
                    onClick={onOpenAndroidInstall}
                    className="flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 border border-emerald-500/40 text-xs font-bold shadow-sm transition-all cursor-pointer"
                  >
                    <Smartphone className="w-4 h-4 text-emerald-400" />
                    <span>تثبيت التطبيق على الهاتف (مباشر)</span>
                  </button>
                )}

                {!firebaseUser && onSignInGoogle && (
                  <button
                    onClick={onSignInGoogle}
                    className="flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-500/40 text-xs font-bold shadow-sm transition-all cursor-pointer"
                  >
                    <LogIn className="w-4 h-4 text-amber-400" />
                    <span>{t('header.cloudSignIn', 'Sign In (Google)')}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Left Column: Real System Gateway Onboarding & Pre-Entry Card */}
            <div className="lg:col-span-5 space-y-6">
              <GatewayOnboardingCard
                diagnostics={diagnostics}
                firebaseUser={firebaseUser}
                onSignInGoogle={onSignInGoogle}
                onSignOut={onSignOut}
                onConnectAccount={onConnectAccount}
                onDisconnectAccount={onDisconnectAccount}
                onEnterTerminal={handleTerminal}
                configuredSession={configuredSession}
                configuredIsDemo={configuredIsDemo}
                configuredUid={configuredUid}
                isReconnecting={isReconnecting}
                forceHighlight={highlightCard}
                onClearHighlight={() => setHighlightCard(false)}
              />

              {/* Real Platform Activity & Telemetry - Displayed on Login / Pre-Entry Landing Interface */}
              <DemoPlatformActivityCard diagnostics={diagnostics} />
            </div>
          </div>

          {/* Live Ticker Strip */}
          <div className="pt-10 max-w-4xl mx-auto">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs text-right">
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-200">EUR / USD</div>
                  <div className="text-[10px] text-emerald-400 font-mono">1.0854 (+0.32%)</div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">شراء قوي</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-200">GBP / USD</div>
                  <div className="text-[10px] text-emerald-400 font-mono">1.2942 (+0.18%)</div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">شراء</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-200">Gold (XAU/USD)</div>
                  <div className="text-[10px] text-amber-400 font-mono">2715.40 (+0.85%)</div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">ترقب كسر</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-200">BTC / USD</div>
                  <div className="text-[10px] text-emerald-400 font-mono">94,500 (+2.40%)</div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">صاعد</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Terminal Preview Card Showcase */}
      <section className="py-14 px-4 lg:px-8 max-w-6xl mx-auto">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 sm:p-7 shadow-2xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-rose-500 inline-block" />
              <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
              <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
              <span className="text-xs font-mono text-slate-400 mr-2">SABAA-TERMINAL-CORE // EURUSD_otc (60s)</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300">Confluence: 8/9 Modules (88%)</span>
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">BUY SETUP CONFIRMED</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
              <div className="text-xs font-semibold text-amber-400 uppercase">01. فحص كتل الأوامر (Order Blocks)</div>
              <p className="text-xs text-slate-300 leading-relaxed">
                رصد ارتداد صاعد مؤكد من كتلة شرائية مؤسسية غير ملموسة عند 1.0845 مع تفريغ سيولة القيعان السابقة (Liquidity Sweep).
              </p>
            </div>
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
              <div className="text-xs font-semibold text-sky-400 uppercase">02. فجوة القيمة العادلة (FVG)</div>
              <p className="text-xs text-slate-300 leading-relaxed">
                تكون فجوة سعرية متوازنة على الإطار الزمني الدقيق تؤكد رغبة صناع السوق في إغلاق الاختلال السعري نحو مستويات 1.0890.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
              <div className="text-xs font-semibold text-emerald-400 uppercase">03. إدارة المخاطر وتحديد العائد</div>
              <p className="text-xs text-slate-300 leading-relaxed">
                نسبة العائد إلى المخاطرة المحسوبة 1:2.4 مع وقف خسارة محكم أسفل قاع السيولة بمقدار 15 نقطة لتأمين رأس المال.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-amber-300">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span><strong>مبدأ الأمان الصارم:</strong> المنصة لا تنفذ الصفقات آلياً أبداً. يتم التحليل وتقديم المعطيات للمتداول لاتخاذ قراره اليدوي.</span>
            </div>
            <button
              onClick={onEnterTerminal}
              className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shrink-0 cursor-pointer"
            >
              افتح الشارت التفاعلي &larr;
            </button>
          </div>
        </div>
      </section>

      {/* 6 Institutional Pillars Section */}
      <section id="features" className="py-16 px-4 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center space-y-3 mb-12">
          <div className="text-xs font-bold uppercase tracking-wider text-emerald-400">المعمارية المؤسسية</div>
          <h2 className="text-2xl sm:text-4xl font-black text-slate-100">
            6 محركات تحليلية مدمجة في منصة واحدة
          </h2>
          <p className="text-sm text-slate-400 max-w-2xl mx-auto">
            بُنيت منصة SABAA QUANT لتمنح المتداول أدوات التحليل الرياضي الصارم وإدارة المخاطر المؤسسية.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Card 1 */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-emerald-500/40 transition-all space-y-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
              <Zap className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-100">26 استراتيجية خوارزمية دقيقة</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              تقييم لحظي لمحركات الاتجاه، الزخم، بولينجر، فيبوناتشي، إليوت، جان، وشموع الانعكاس بناءً على الشموع المغلقة الفعلية دون إعادة رسم.
            </p>
          </div>

          {/* Card 2 */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-amber-500/40 transition-all space-y-4">
            <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400 flex items-center justify-center">
              <Layers className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-100">تحليل السيولة وكتل الأوامر (SMC / ICT)</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              كشف تلقائي لمناطق تمركز السيولة المؤسسية، فجوات القيمة العادلة (FVG)، والكسور الهيكلية (BOS) مع إشارات واضحة لمناطق الشراء والبيع.
            </p>
          </div>

          {/* Card 3 */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-amber-500/40 transition-all space-y-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
              <TrendingUp className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-100">مصفوفة التوافق الحسابي (Confluence Matrix)</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              تصفية التذبذب الخادع؛ لا تصدر الإشارة إلا بعد تصويت حاسم من 9 نماذج واستراتيجيات مختلفة لمنع الصفقات العشوائية.
            </p>
          </div>

          {/* Card 4 */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-amber-500/40 transition-all space-y-4">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400 flex items-center justify-center">
              <Globe className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-100">ماسح الأسواق اللحظي (Market Scanner)</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              مسح دوري مباشر لثمانية أسواق رئيسية (العملات، الذهب، العملات الرقمية، والمؤشرات) مع تقييم قوة الاتجاه والفرص المهيأة.
            </p>
          </div>

          {/* Card 5 */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-amber-500/40 transition-all space-y-4">
            <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-100">إدارة المخاطر وحماية رأس المال</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              حاسبة مدمجة تحدد الحجم الدقيق للعقد (Lot Size) بناءً على نسبة المخاطرة المحددة (1% إلى 2%) وحساب وقف الخسارة قبل اتخاذ القرار.
            </p>
          </div>

          {/* Card 6 */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-amber-500/40 transition-all space-y-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-100">تنفيذ يدوي حصري وخالٍ من الروبوتات</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              بطاقة تنفيذ أوامر يدوي تتطلب تأكيداً صريحاً ومراجعة من المتداول. لا يقوم أي نظام في المنصة بوضع أوامر من وراء ظهرك.
            </p>
          </div>
        </div>
      </section>

      {/* Comparison Table Section */}
      <section className="py-16 px-4 lg:px-8 max-w-5xl mx-auto border-t border-slate-900">
        <div className="text-center space-y-3 mb-10">
          <h2 className="text-2xl sm:text-3xl font-black text-slate-100">
            لماذا تختلف SABAA QUANT عن البوتات التقليدية؟
          </h2>
          <p className="text-xs text-slate-400">مقارنة معمارية مع الأنظمة العشوائية وغير المنضبطة</p>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/50">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950 text-slate-400">
                <th className="py-3 px-4 font-semibold">المعيار التقني</th>
                <th className="py-3 px-4 font-bold text-emerald-400">منصة SABAA QUANT</th>
                <th className="py-3 px-4 font-normal text-slate-500">البوتات العشوائية المروجة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              <tr>
                <td className="py-3.5 px-4 font-semibold text-slate-300">انضباط الدخول</td>
                <td className="py-3.5 px-4 text-emerald-400 font-bold">دخول صارم عند تأهل الإشارة الكميّة غير المعاد رسمها</td>
                <td className="py-3.5 px-4 text-rose-400">دخول عشوائي ومقامرة برأس المال</td>
              </tr>
              <tr>
                <td className="py-3.5 px-4 font-semibold text-slate-300">محرك التوافق والشموع</td>
                <td className="py-3.5 px-4 text-emerald-400 font-bold">26 وحدة خوارزمية + مصفوفة SBAA 100 نقطة</td>
                <td className="py-3.5 px-4 text-slate-500">مؤشر واحد سطحي أو وهمي</td>
              </tr>
              <tr>
                <td className="py-3.5 px-4 font-semibold text-slate-300">فحص ما قبل التنفيذ</td>
                <td className="py-3.5 px-4 text-emerald-400 font-bold">التحقق من 15 شمعة حقيقية والرصيد والمصادقة قبل أي أمر</td>
                <td className="py-3.5 px-4 text-slate-500">أوامر عشوائية بدون تدقيق</td>
              </tr>
              <tr>
                <td className="py-3.5 px-4 font-semibold text-slate-300">إدارة المخاطر</td>
                <td className="py-3.5 px-4 text-emerald-400 font-bold">قاطع الدائرة لحد الخسارة والربح ومنع تكرار الصفقات</td>
                <td className="py-3.5 px-4 text-rose-400">مضاعفات غير منضبطة تحرق الحساب</td>
              </tr>
              <tr>
                <td className="py-3.5 px-4 font-semibold text-slate-300">شفافية الإحصائيات</td>
                <td className="py-3.5 px-4 text-emerald-400 font-bold">سجل مدقق بالأسعار المرجعية اللحظية الحقيقية</td>
                <td className="py-3.5 px-4 text-rose-400">أرقام ونسب فوز زائفة تسويقية</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-16 px-4 lg:px-8 max-w-4xl mx-auto border-t border-slate-900">
        <div className="text-center space-y-3 mb-10">
          <h2 className="text-2xl sm:text-3xl font-black text-slate-100">
            الأسئلة الشائعة حول المنصة
          </h2>
          <p className="text-xs text-slate-400">كل ما تحتاج لمعرفته حول طريقة عمل منظومة SABAA QUANT</p>
        </div>

        <div className="space-y-3 text-right">
          <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
            <h3 className="text-sm font-bold text-emerald-300">كيف يعمل التداول الآلي الخوارزمي؟</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              يعتمد التداول الآلي على مصفوفة التحليل الكمي الصارمة؛ حيث لا يُسمح بأي أمر تداول إلا عند تحقق الإشارة الاتجاهية المؤهلة غير المعاد رسمها، وبعد فحص اتصال الوسيط وتوفر 15 شمعة حقيقية وتوفر الرصيد في الحساب الحقيقي.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
            <h3 className="text-sm font-bold text-emerald-300">ما هي استراتيجيات SMC و ICT المدعومة؟</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              المنصة ترصد مفاهيم الأموال الذكية: مناطق تجميع السيولة (Liquidity Sweeps)، فجوات القيمة العادلة (Fair Value Gaps)، كسر الهيكل (BOS)، والتغير في السلوك (CHoCH)، وتدمجها مع مؤشرات الزخم المعتمدة.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
            <h3 className="text-sm font-bold text-emerald-300">هل البيانات المعروضة في الشارت والصفقات حقيقية؟</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              نعم، المنصة تتصل ببث حي للأسعار عبر بروتوكولات WebSocket وتنفذ الأوامر حصرياً على جلسة الحساب الحقيقي الموثقة دون أي محاكاة أو بيانات وهمية.
            </p>
          </div>
        </div>
      </section>

      {/* Call To Action Banner */}
      <section className="py-16 px-4 lg:px-8 border-t border-slate-900 bg-gradient-to-b from-transparent to-slate-900/60 text-center space-y-6">
        <h2 className="text-2xl sm:text-4xl font-black text-slate-100">
          جاهز لتجربة التداول الخوارزمي المنضبط؟
        </h2>
        <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto">
          اربط جلسة حسابك الحقيقي واستكشف شاشات التحليل المباشرة ومصفوفة الاستراتيجيات الـ 26.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={onEnterTerminal}
            className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-amber-500 hover:from-emerald-400 hover:to-amber-400 text-slate-950 font-black text-sm shadow-xl shadow-emerald-500/20 cursor-pointer"
          >
            دخول منصة التداول والتحليل المباشر &larr;
          </button>
        </div>
      </section>

      {/* Institutional Footer & Risk Disclaimer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-10 px-4 lg:px-8 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-800/60 pb-6">
            <div className="flex items-center gap-3">
              <BrandLogo size="sm" />
              <span className="font-bold text-slate-200">SABAA QUANT</span>
            </div>
            <div className="flex items-center gap-6 text-[11px]">
              <span>منظومة تحليل الأسواق المالية</span>
              <span>•</span>
              <span>26 وحدة خوارزمية دقيقة</span>
              <span>•</span>
              <span>إدارة مخاطر مؤسسية</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 text-[11px] leading-relaxed text-slate-400 space-y-2 text-right">
            <div className="font-bold text-amber-400 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>تحذير المخاطر وإخلاء المسؤولية القانونية:</span>
            </div>
            <p>
              التداول في الأسواق المالية ينطوي على درجة عالية من المخاطرة وقد لا يكون مناسباً لجميع المستثمرين.
              إن إشارات وبيانات منصة SABAA QUANT مبنية على خوارزميات كمية لأغراض تحليلية مساعدة، والمستخدم وحده هو المسؤول قانونياً ومالياً عن جميع القرارات والصفقات المنفذة على حسابه الحقيقي.
            </p>
          </div>

          <div className="text-center text-[10px] text-slate-400">
            جميع الحقوق محفوظة © {new Date().getFullYear()} SABAA QUANT. منظومة التحليل الكمي والتداول الخوارزمي.
          </div>
        </div>
      </footer>
    </div>
  );
};
