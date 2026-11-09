import React, { useState, useEffect } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ChevronRight,
  Clock,
  DollarSign,
  Home,
  Key,
  LogIn,
  LogOut,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  User,
  UserCheck,
  Wifi,
  WifiOff,
  Zap,
  Smartphone,
  Bot,
} from 'lucide-react';
import { DiagnosticsInfo, Signal } from '../types';
import { useLanguage, LanguageSwitcher } from '../i18n/LanguageContext';
import { pocketOptionSessionStore } from '../services/PocketOptionSessionStore';
import { accountStore } from '../services/AccountStore';

interface HeaderProps {
  diagnostics: DiagnosticsInfo | null;
  activeSignal?: Signal | null;
  onSelectSignal?: (signal: Signal) => void;
  selectedAsset?: string;
  selectedTimeframe?: number;
  onOpenSettings: () => void;
  onReconnect: () => void;
  isReconnecting: boolean;
  firebaseUser?: {
    uid?: string;
    id?: string;
    displayName: string | null;
    email: string | null;
    photoURL?: string | null;
  } | null;
  user?: {
    id?: string;
    uid?: string;
    displayName: string | null;
    email: string | null;
    photoURL?: string | null;
  } | null;
  onSignInGoogle?: () => void;
  onSignOut?: () => void;
  onOpenLanding?: () => void;
  onOpenAndroidInstall?: () => void;
  onOpenAdmin?: () => void;
  onOpenKeyRoom?: () => void;
  onOpenTelegramSettings?: () => void;
  activation?: {
    code?: string;
    expiresAt?: string;
    durationLabel?: string;
  } | null;
}

export const Header: React.FC<HeaderProps> = ({
  diagnostics,
  activeSignal,
  onSelectSignal,
  selectedAsset,
  selectedTimeframe,
  onOpenSettings,
  onReconnect,
  isReconnecting,
  firebaseUser,
  user,
  onSignInGoogle,
  onSignOut,
  onOpenLanding,
  onOpenAndroidInstall,
  onOpenAdmin,
  onOpenKeyRoom,
  onOpenTelegramSettings,
  activation,
}) => {
  const { t, tTerm, tDynamic, isRTL } = useLanguage();
  const activeUser = user || firebaseUser;

  const [poSession, setPoSession] = useState(() => pocketOptionSessionStore.getState());
  const [accState, setAccState] = useState(() => accountStore.getState());
  useEffect(() => {
    const unsub1 = pocketOptionSessionStore.subscribe(setPoSession);
    const unsub2 = accountStore.subscribe(setAccState);
    return () => {
      unsub1();
      unsub2();
    };
  }, []);

  const [isSwitchingAccount, setIsSwitchingAccount] = useState(false);
  const handleToggleAccountMode = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSwitchingAccount) return;
    try {
      setIsSwitchingAccount(true);
      const isCurrentlyDemo = account?.isDemo ?? (poSession.accountMode === 'DEMO');
      const targetMode = isCurrentlyDemo ? 'REAL' : 'DEMO';
      await fetch('/api/account/switch-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: targetMode }),
      });
      setTimeout(() => {
        setIsSwitchingAccount(false);
        if (onReconnect) onReconnect();
      }, 1000);
    } catch (err) {
      setIsSwitchingAccount(false);
      console.error('Failed to switch account mode:', err);
    }
  };

  const subsystems = diagnostics?.subsystems;
  const overall = subsystems?.overall || 'DISCONNECTED';
  const account = diagnostics?.account;
  const isStale = diagnostics?.isStale ?? true;
  const freshness = diagnostics?.freshnessSeconds ?? 999;
  const latency = diagnostics?.latencyMs ?? 0;
  const endpoint = diagnostics?.endpoint || 'api-eu.po.market';

  const effectiveBalance =
    account?.balance !== null && typeof account?.balance === 'number' && !isNaN(account.balance)
      ? account.balance
      : poSession.balance !== null && typeof poSession.balance === 'number' && !isNaN(poSession.balance)
      ? poSession.balance
      : accState.balance !== null && typeof accState.balance === 'number' && !isNaN(accState.balance)
      ? accState.balance
      : null;
  const isBalanceLoading =
    (effectiveBalance === null || effectiveBalance === undefined) &&
    (subsystems?.account === 'LOADING' || poSession.balanceState === 'BALANCE_LOADING');

  const cleanEndpoint = endpoint.replace('wss://', '').split('/')[0];

  const getStatusBadge = () => {
    switch (overall) {
      case 'LIVE':
        return (
          <div
            id="badge-status-live"
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shadow-xs"
            title="WebSocket connected, session verified, and real market ticks streaming"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{t('header.liveStream', 'LIVE STREAM')}</span>
          </div>
        );
      case 'ACCOUNT_READY':
      case 'AUTHENTICATED':
        return (
          <div
            id="badge-status-authenticated"
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shadow-xs"
            title="Session confirmed by Pocket Option protocol (successauth)"
          >
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            <span>{t('header.authenticated', 'AUTHENTICATED')}</span>
          </div>
        );
      case 'AUTH_FAILED':
        return (
          <button
            id="badge-status-auth-failed"
            onClick={onOpenSettings}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 shadow-xs cursor-pointer transition-colors"
            title={diagnostics?.authError ? tDynamic(diagnostics.authError) : t('header.authFailed', 'AUTH FAILED (UPDATE SSD)')}
          >
            <AlertTriangle className="w-3 h-3 text-rose-500" />
            <span>{t('header.authFailed', 'AUTH FAILED (UPDATE SSD)')}</span>
          </button>
        );
      case 'SOCKET_CONNECTED':
        return (
          <div
            id="badge-status-socket-connected"
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30"
            title="WebSocket transport connected, awaiting authentication response"
          >
            <RefreshCw className="w-3 h-3 animate-spin text-amber-500" />
            <span>{t('header.socketConnected', 'SOCKET CONNECTED')}</span>
          </div>
        );
      case 'RECONNECTING':
      case 'CONNECTION_LOST':
        return (
          <div
            id="badge-status-reconnecting"
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30"
            title="Connection lost, attempting WebSocket transport reconnection"
          >
            <RefreshCw className="w-3 h-3 animate-spin text-amber-500" />
            <span>{t('header.reconnecting', 'RECONNECTING')}</span>
          </div>
        );
      case 'SYNCING':
        return (
          <div
            id="badge-status-syncing"
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/30"
            title="Connected to platform, loading candles and subscribing to tick feed"
          >
            <RefreshCw className="w-3 h-3 animate-spin text-sky-500" />
            <span>{t('header.syncing', 'SYNCING FEED')}</span>
          </div>
        );
      case 'AUTHENTICATING':
        return (
          <div
            id="badge-status-authenticating"
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30"
            title="Performing Pocket Option session authentication handshake"
          >
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
            <span>{tTerm('Authenticating')}</span>
          </div>
        );
      case 'STALE':
        return (
          <div
            id="badge-status-stale"
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30"
            title="Tick feed has not received updates in over 8 seconds. Signals paused."
          >
            <AlertTriangle className="w-3 h-3 text-amber-500" />
            <span>{tTerm('Stale')} ({freshness > 90 ? '>90s' : `${freshness}s`})</span>
          </div>
        );
      case 'CONNECTING':
        return (
          <div
            id="badge-status-connecting"
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30"
          >
            <RefreshCw className="w-3 h-3 animate-spin text-blue-500" />
            <span>{tTerm('Connecting')}</span>
          </div>
        );
      case 'ERROR':
        return (
          <div
            id="badge-status-error"
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30"
            title={diagnostics?.error || 'Connection error'}
          >
            <WifiOff className="w-3 h-3 text-rose-500" />
            <span>{tTerm('Connection')} {tTerm('Error')}</span>
          </div>
        );
      case 'DISCONNECTED':
      default:
        return (
          <div
            id="badge-status-disconnected"
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border border-zinc-500/20"
          >
            <WifiOff className="w-3 h-3" />
            <span>{t('header.disconnected', 'DISCONNECTED')}</span>
          </div>
        );
    }
  };

  return (
    <header className="w-full bg-slate-950 border-b border-slate-800/80 px-2.5 sm:px-4 lg:px-6 py-2 sm:py-3 transition-colors font-sans safe-pt">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 sm:gap-3">
        {/* Title & Scope Badges */}
        <div className="flex items-center justify-between md:justify-start gap-2.5 sm:gap-3 min-w-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 shrink-0 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 font-black text-lg sm:text-xl shadow-lg shadow-amber-500/20 border border-amber-300">
              S
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <h1 className="text-sm sm:text-base font-black text-slate-100 tracking-tight bg-gradient-to-r from-amber-200 via-amber-400 to-amber-500 bg-clip-text text-transparent truncate">
                  SABAA AI SOLUTION
                </h1>
                <span className="px-1.5 sm:px-2 py-0.5 text-[8px] sm:text-[9px] font-bold tracking-wider uppercase rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30 flex items-center gap-1 whitespace-nowrap">
                  <ShieldAlert className="w-2.5 h-2.5 shrink-0" />
                  <span className="hidden xs:inline sm:inline">
                    {isRTL ? 'تحليل استشاري • تنفيذ يدوي حصري' : t('appSubtitle', 'Advisory • Manual Execution')}
                  </span>
                  <span className="xs:hidden sm:hidden">
                    {isRTL ? 'استشاري' : 'Advisory'}
                  </span>
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-400 truncate hidden sm:block">
                {t('appSubtitle', 'Institutional algorithmic engine, computer vision analysis, multi-strategy confluence, and risk management')}
              </p>
            </div>
          </div>

          {/* Quick Actions for small screens on top row */}
          <div className="flex items-center gap-1.5 md:hidden shrink-0">
            {onOpenAndroidInstall && (
              <button
                onClick={onOpenAndroidInstall}
                className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-xs font-bold flex items-center gap-1"
                title="تنزيل تطبيق أندرويد APK"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span className="text-[10px]">APK</span>
              </button>
            )}
            <LanguageSwitcher />
            <button
              onClick={onOpenSettings}
              className="p-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold shadow-sm"
              title={t('header.sessionSettings', 'Trading Session (SSD)')}
            >
              <Key className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Status Metrics & Actions */}
        <div className="flex flex-wrap items-center justify-between md:justify-end gap-1.5 sm:gap-2 lg:gap-3 text-xs font-mono">
          {/* Language Switcher (hidden on mobile top, shown on desktop) */}
          <div className="hidden md:block">
            <LanguageSwitcher />
          </div>

          {/* Subsystem Overall Badge */}
          {getStatusBadge()}

          {/* Real Account Info Pill with Click-to-Switch */}
          {account && (
            <button
              id="header-account-pill"
              type="button"
              onClick={handleToggleAccountMode}
              disabled={isSwitchingAccount}
              className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/50 text-slate-300 text-[10px] sm:text-[11px] max-w-[240px] sm:max-w-none truncate cursor-pointer transition-all shadow-sm"
              title={
                diagnostics?.authVerified
                  ? (isRTL ? `الحساب الحالي: ${account.isDemo ? 'تجريبي' : 'حقيقي'} ($${effectiveBalance?.toFixed(2) || '0.00'}) - اضغط هنا للتبديل الفوري بين الحقيقي والتجريبي` : `Current: ${account.isDemo ? 'DEMO' : 'REAL'} ($${effectiveBalance?.toFixed(2) || '0.00'}) - Click to toggle between Real & Demo`)
                  : 'Account data from broker protocol'
              }
            >
              {isSwitchingAccount ? (
                <span className="flex items-center gap-1 text-[9px] text-amber-300 font-bold">
                  <RefreshCw className="w-2.5 h-2.5 animate-spin text-amber-400" />
                  <span>{isRTL ? 'تبديل...' : 'Switching...'}</span>
                </span>
              ) : subsystems?.auth === 'failed' || account.status === 'INVALID' || account.status === 'EXPIRED' ? (
                <span className="px-1.5 py-0.2 rounded text-[8px] sm:text-[9px] font-bold uppercase bg-rose-500/15 text-rose-400 border border-rose-500/30 font-sans">
                  {t('header.unauthorized', 'UNAUTHORIZED')}
                </span>
              ) : diagnostics?.authVerified ? (
                <span
                  className={`px-1.5 py-0.2 rounded text-[8px] sm:text-[9px] font-bold uppercase font-sans flex items-center gap-1 ${
                    account.isDemo
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${account.isDemo ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'}`} />
                  {account.isDemo ? 'DEMO' : 'REAL'}
                </span>
              ) : (
                <span className="px-1.5 py-0.2 rounded text-[8px] sm:text-[9px] font-bold uppercase bg-slate-800 text-slate-400 border border-slate-700 font-sans">
                  NO SESSION
                </span>
              )}

              {effectiveBalance !== null && typeof effectiveBalance === 'number' && !isNaN(effectiveBalance) ? (
                <span className={`font-bold ${account.isDemo || poSession.accountMode === 'DEMO' ? 'text-amber-400' : 'text-emerald-400 font-mono'}`}>
                  ${effectiveBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              ) : isBalanceLoading ? (
                <span className="flex items-center gap-1 text-[10px] text-amber-300">
                  <RefreshCw className="w-2.5 h-2.5 animate-spin text-amber-400" />
                  <span>{isRTL ? 'جلب...' : 'Loading...'}</span>
                </span>
              ) : (
                <span className="text-slate-500">N/A</span>
              )}
            </button>
          )}

          {/* Latency badge */}
          {latency > 0 && subsystems?.websocket === 'connected' && (
            <div className="hidden lg:flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-900 text-slate-400 border border-slate-800 text-[11px]">
              <Wifi className="w-3 h-3 text-amber-400" />
              <span>{latency}ms</span>
            </div>
          )}

          {/* License Expiration Badge if active */}
          {activation && (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[10px] text-amber-300 font-mono">
              <Key className="w-3 h-3 text-amber-400" />
              <span>{activation.durationLabel || 'Active License'}</span>
            </div>
          )}

          {/* Telegram Bot Button */}
          {onOpenTelegramSettings && (
            <button
              onClick={onOpenTelegramSettings}
              className="p-1.5 rounded-lg bg-blue-600/15 hover:bg-blue-600/25 border border-blue-500/30 text-blue-400 text-xs transition-colors cursor-pointer flex items-center gap-1"
              title={isRTL ? 'بوت التلجرام وبث الإشارات' : 'Telegram Bot & Broadcast'}
            >
              <Bot className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Key Generation Room Button (sbaa0000) */}
          {onOpenKeyRoom && (
            <button
              onClick={onOpenKeyRoom}
              className="px-2 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1"
              title={isRTL ? 'غرفة توليد المفاتيح (sbaa0000)' : 'Key Generator Room (sbaa0000)'}
            >
              <Key className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden md:inline">{isRTL ? 'غرفة المفاتيح' : 'Key Room'}</span>
            </button>
          )}

          {/* Admin Room Button */}
          {onOpenAdmin && (
            <button
              onClick={onOpenAdmin}
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-400 hover:text-amber-400 text-xs transition-colors cursor-pointer"
              title={isRTL ? 'لوحة تحكم المشرف' : 'Admin Panel'}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Authenticated User Profile & Logout Badge */}
          {activeUser ? (
            <div className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[10px] sm:text-[11px] text-slate-300 font-sans">
              {activeUser.photoURL ? (
                <img
                  src={activeUser.photoURL}
                  alt={activeUser.displayName || 'User'}
                  className="w-4 h-4 rounded-full object-cover border border-slate-700"
                />
              ) : (
                <div className="w-2 h-2 rounded-full bg-emerald-400" title="Active Session" />
              )}
              <span className="max-w-[70px] sm:max-w-[110px] truncate font-medium">
                {activeUser.displayName || activeUser.email || 'Trader'}
              </span>
              {onSignOut && (
                <button
                  onClick={onSignOut}
                  className="text-slate-400 hover:text-rose-400 p-0.5 ml-1 transition-colors cursor-pointer"
                  title="تسجيل الخروج"
                >
                  <LogOut className="w-3 h-3" />
                </button>
              )}
            </div>
          ) : onSignInGoogle ? (
            <button
              id="header-firebase-login"
              onClick={onSignInGoogle}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-amber-500/40 text-amber-300 hover:text-amber-200 text-xs font-sans font-semibold transition-colors cursor-pointer"
              title="Sign in with Firebase Cloud"
            >
              <LogIn className="w-3.5 h-3.5 text-amber-400" />
              <span>Cloud</span>
            </button>
          ) : null}

          {/* Reconnect button */}
          <button
            id="btn-reconnect"
            onClick={onReconnect}
            disabled={isReconnecting}
            className="flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-[11px] font-sans transition-colors disabled:opacity-50 cursor-pointer"
            title={t('header.reconnect', 'Resync Stream')}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isReconnecting ? 'animate-spin text-amber-400' : ''}`} />
            <span className="hidden sm:inline">{t('header.reconnect', 'Resync')}</span>
          </button>

          {/* Mobile & Desktop App Install Button */}
          {onOpenAndroidInstall && (
            <button
              id="btn-install-app-header"
              onClick={onOpenAndroidInstall}
              className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 text-xs font-sans font-bold transition-all cursor-pointer shadow-sm"
              title="تثبيت التطبيق على الهاتف (PWA & APK)"
            >
              <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">تثبيت التطبيق</span>
              <span className="sm:hidden text-[10px]">تثبيت</span>
            </button>
          )}

          {/* Session / Settings button (Desktop) */}
          <button
            id="btn-settings"
            onClick={onOpenSettings}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-sans font-black shadow-md shadow-amber-500/20 transition-all cursor-pointer"
          >
            <Key className="w-3.5 h-3.5" />
            <span>{t('header.sessionSettings', 'Trading Session (SSD)')}</span>
          </button>
        </div>
      </div>

      {/* SECTION 8 & 9: RESPONSIVE SIGNAL HEADER (Priority: 1. Signal, 2. Symbol, 3. Timeframe, 4. Data status, 5. Secondary) */}
      {activeSignal && (
        <div className="max-w-7xl mx-auto mt-2 sm:mt-2.5">
          <div
            id="header-signal-bar"
            onClick={() => onSelectSignal?.(activeSignal)}
            role="button"
            tabIndex={0}
            className={`w-full px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-xl border transition-all duration-300 flex items-center justify-between gap-2 sm:gap-3 text-xs cursor-pointer group select-none ${
              activeSignal.type === 'UP'
                ? 'bg-gradient-to-r from-emerald-950/70 via-slate-900/90 to-slate-950 border-emerald-500/50 shadow-lg shadow-emerald-950/50 hover:border-emerald-400'
                : activeSignal.type === 'DOWN'
                ? 'bg-gradient-to-r from-rose-950/70 via-slate-900/90 to-slate-950 border-rose-500/50 shadow-lg shadow-rose-950/50 hover:border-rose-400'
                : 'bg-gradient-to-r from-amber-950/30 via-slate-900/80 to-slate-950 border-amber-500/30 hover:border-amber-500/50'
            }`}
            title={t('signals.clickForDetails', 'Click to open full Signal Analysis (trigger candle, OHLC, indicators, strategies, and confluence)')}
          >
            {/* Left Cluster: 1. SIGNAL BADGE + 2. SYMBOL + 3. TIMEFRAME */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 font-mono">
              {/* 1. Primary Signal Badge (Green UP, Red DOWN, Amber WAIT) - ALWAYS VISIBLE */}
              {activeSignal.type === 'UP' && (
                <div
                  id="header-signal-up"
                  className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 rounded-lg bg-emerald-500/25 text-emerald-400 border border-emerald-500/60 font-black text-xs sm:text-sm tracking-wider shadow-sm animate-pulse shrink-0"
                >
                  <ArrowUp className="w-4 h-4 stroke-[3] text-emerald-400" />
                  <span>{tTerm('UP')}</span>
                </div>
              )}
              {activeSignal.type === 'DOWN' && (
                <div
                  id="header-signal-down"
                  className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 rounded-lg bg-rose-500/25 text-rose-400 border border-rose-500/60 font-black text-xs sm:text-sm tracking-wider shadow-sm animate-pulse shrink-0"
                >
                  <ArrowDown className="w-4 h-4 stroke-[3] text-rose-400" />
                  <span>{tTerm('DOWN')}</span>
                </div>
              )}
              {activeSignal.type === 'WAIT' && (
                <div
                  id="header-signal-wait"
                  className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/40 font-bold text-xs sm:text-sm tracking-wider shrink-0"
                >
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>{tTerm('WAIT')}</span>
                </div>
              )}

              {/* 2. SYMBOL & OTC Badge */}
              <div className="flex items-center gap-1 sm:gap-1.5 min-w-0">
                <span className="font-bold text-slate-100 text-xs sm:text-sm tracking-tight truncate">
                  {(activeSignal.asset || selectedAsset || 'EURUSD_otc').toUpperCase().replace('_OTC', '')}
                </span>
                <span className="px-1 py-0.2 sm:px-1.5 sm:py-0.5 rounded text-[9px] sm:text-[10px] font-bold uppercase bg-slate-800 text-amber-400 border border-slate-700 shrink-0">
                  {(activeSignal.asset || selectedAsset || '').includes('otc') ? 'OTC' : 'SPOT'}
                </span>
              </div>

              {/* 3. TIMEFRAME */}
              <span className="px-1.5 sm:px-2 py-0.5 rounded bg-slate-800/80 text-slate-300 text-[10px] sm:text-xs font-semibold shrink-0">
                {activeSignal.timeframe < 60 ? `${activeSignal.timeframe}S` : `${Math.round(activeSignal.timeframe / 60)}M`}
              </span>

              {/* Score / Confidence (Prominent on all screens) */}
              <div className="flex items-center gap-1 font-mono shrink-0">
                {activeSignal.type !== 'WAIT' ? (
                  <span className="text-sm sm:text-base font-black text-emerald-400">
                    {activeSignal.actualConfidence ?? activeSignal.confidence ?? Math.round(activeSignal.strength * 100)}%
                  </span>
                ) : (
                  activeSignal.candidateConfidence && activeSignal.candidateConfidence > 0 ? (
                    <span className="text-xs sm:text-sm font-bold text-amber-400">
                      {activeSignal.candidateConfidence}%
                    </span>
                  ) : null
                )}
              </div>
            </div>

            {/* Right Cluster: 4. DATA STATUS + 5. SECONDARY INFO */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              {/* Strategy Agreement (Hidden on very narrow screens, visible on md+) */}
              <div className="hidden md:flex items-center gap-1.5 font-mono text-xs text-slate-300">
                <span className="font-bold text-amber-400">
                  {activeSignal.confirmations ?? 0}/{activeSignal.totalStrategies ?? 21}
                </span>
                <span className="text-[10px] text-slate-400 uppercase">
                  {tTerm('Strategies')}
                </span>
              </div>

              {/* Candle Direction Badge (Visible on lg+) */}
              {activeSignal.candle && (
                <div className="hidden lg:flex items-center gap-1 font-mono text-[10px] px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700">
                  <span className="text-slate-400">Bar:</span>
                  <span
                    className={`font-bold ${
                      activeSignal.candle.direction === 'BULLISH'
                        ? 'text-emerald-400'
                        : activeSignal.candle.direction === 'BEARISH'
                        ? 'text-rose-400'
                        : 'text-amber-400'
                    }`}
                  >
                    {activeSignal.candle.direction}
                  </span>
                </div>
              )}

              {/* 4. Data State Badge */}
              <span
                className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 border shrink-0 ${
                  activeSignal.dataStatus === 'LIVE'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                }`}
              >
                {activeSignal.dataStatus === 'LIVE' ? (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    <span>{tTerm('Live')}</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-2.5 h-2.5 text-amber-400" />
                    <span>{tTerm('Stale')}</span>
                  </>
                )}
              </span>

              {/* Signal Timestamp (Hidden on small screens) */}
              {activeSignal.timestamp && (
                <span className="text-[10px] sm:text-[11px] font-mono text-slate-400 hidden xl:inline">
                  {new Date(activeSignal.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              )}

              {/* 5. Click to inspect signal analysis */}
              <div className="flex items-center gap-1 text-[11px] font-bold text-amber-400 group-hover:text-amber-300 transition-colors">
                <span className="hidden sm:inline">{t('signals.inspectSignal', 'Analysis')}</span>
                <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 transition-transform" />
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

