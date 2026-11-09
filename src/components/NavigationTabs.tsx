import React, { useState } from 'react';
import { ViewTab } from '../types';
import { useLanguage } from '../i18n/LanguageContext';
import {
  Activity,
  BarChart2,
  Bot,
  Brain,
  Compass,
  Cpu,
  Database,
  Eye,
  Gauge,
  History,
  Home,
  Layers,
  LayoutDashboard,
  LineChart,
  Lock,
  MoreHorizontal,
  Radio,
  RefreshCw,
  Server,
  Settings,
  ShieldCheck,
  Sliders,
  TrendingUp,
  User,
  Wifi,
  X,
  ChevronRight,
  Zap,
} from 'lucide-react';

interface NavigationTabsProps {
  activeTab: ViewTab;
  onSelectTab: (tab: ViewTab) => void;
  signalType: 'UP' | 'DOWN' | 'WAIT' | 'BUY' | 'SELL';
  isConnected: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const NavigationTabs: React.FC<NavigationTabsProps> = ({
  activeTab,
  onSelectTab,
  signalType,
  isConnected,
  collapsed = false,
  onToggleCollapse,
}) => {
  const { t, tTerm, isRTL } = useLanguage();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Exact 12 Desktop Navigation items specified in Section 44
  const desktopNavItems: {
    id: ViewTab;
    label: string;
    sublabel: string;
    icon: React.ReactNode;
    badge?: React.ReactNode;
  }[] = [
    {
      id: 'landing',
      label: t('nav.gateway', 'Gateway Portal'),
      sublabel: t('nav.gatewaySub', 'Login & Broker Connection'),
      icon: <Home className="w-4 h-4 text-amber-400" />,
    },
    {
      id: 'dashboard',
      label: t('nav.dashboard', 'Dashboard'),
      sublabel: t('nav.dashboardSub', 'Overview & Telemetry'),
      icon: <LayoutDashboard className="w-4 h-4" />,
    },
    {
      id: 'market',
      label: t('nav.market', 'Market'),
      sublabel: t('nav.marketSub', 'Assets & Rates'),
      icon: <Database className="w-4 h-4 text-sky-400" />,
    },
    {
      id: 'chart',
      label: t('nav.chart', 'Chart'),
      sublabel: t('nav.chartSub', 'Technical Candlesticks'),
      icon: <LineChart className="w-4 h-4 text-amber-400" />,
    },
    {
      id: 'indicators',
      label: t('nav.indicators', 'Indicators'),
      sublabel: t('nav.indicatorsSub', 'Quantitative Formulas'),
      icon: <Gauge className="w-4 h-4 text-emerald-400" />,
    },
    {
      id: 'strategies',
      label: t('nav.strategies', 'Strategies'),
      sublabel: t('nav.strategiesSub', '21 Algorithm Modules'),
      icon: <Cpu className="w-4 h-4 text-indigo-400" />,
    },
    {
      id: 'signals',
      label: t('nav.signals', 'Signals'),
      sublabel: t('nav.signalsSub', 'Real-Time Confluence'),
      icon: <Radio className="w-4 h-4 text-rose-400" />,
      badge: (
        <span
          className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold ${
            signalType === 'UP' || signalType === 'BUY'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : signalType === 'DOWN' || signalType === 'SELL'
              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
              : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
          }`}
        >
          {tTerm(signalType)}
        </span>
      ),
    },

    {
      id: 'autotrader',
      label: isRTL ? '🤖 بوت التداول الآلي' : '🤖 AI Auto Trader',
      sublabel: isRTL ? 'نظام تداول متكامل' : 'Autonomous Trading Engine',
      icon: <Bot className="w-4 h-4 text-emerald-400" />,
      badge: (
        <span className="text-[9px] px-1.5 py-0.5 rounded font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
          BOT
        </span>
      ),
    },
    {
      id: 'history',
      label: t('nav.history', 'History'),
      sublabel: t('nav.historySub', 'Audited Trade Records'),
      icon: <History className="w-4 h-4 text-slate-400" />,
    },
    {
      id: 'performance',
      label: t('nav.performance', 'Performance'),
      sublabel: t('nav.performanceSub', 'Statistical Accuracy'),
      icon: <TrendingUp className="w-4 h-4 text-emerald-400" />,
    },
    {
      id: 'connection',
      label: t('nav.admin', 'Connection'),
      sublabel: tTerm('Connection'),
      icon: <Wifi className="w-4 h-4 text-blue-400" />,
      badge: (
        <span
          className={`w-2 h-2 rounded-full ${
            isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
          }`}
        />
      ),
    },
    {
      id: 'account',
      label: t('header.demoAccount', 'Account Context'),
      sublabel: 'REAL / DEMO',
      icon: <User className="w-4 h-4 text-amber-400" />,
    },
    {
      id: 'diagnostics',
      label: t('chart.diagnostics', 'Diagnostics'),
      sublabel: 'Audit & Telemetry',
      icon: <Activity className="w-4 h-4 text-purple-400" />,
    },
    {
      id: 'settings',
      label: t('common.edit', 'Settings'),
      sublabel: 'SSD & Platform',
      icon: <Settings className="w-4 h-4 text-slate-300" />,
    },
  ];

  // Secondary advanced tools for desktop side navigation
  const advancedTools: { id: ViewTab; label: string; sublabel: string; icon: React.ReactNode }[] = [
    {
      id: 'ai_analysis',
      label: t('nav.ai', 'SMC Engine'),
      sublabel: t('nav.aiSub', 'Smart Market Structure'),
      icon: <Brain className="w-4 h-4 text-amber-400" />,
    },
    {
      id: 'vision',
      label: t('nav.vision', 'Computer Vision'),
      sublabel: t('nav.visionSub', 'Chart Pattern Recognition'),
      icon: <Eye className="w-4 h-4 text-sky-400" />,
    },
    {
      id: 'scanner',
      label: t('nav.scanner', 'Market Scanner'),
      sublabel: t('nav.scannerSub', 'Multi-Asset Opportunities'),
      icon: <BarChart2 className="w-4 h-4 text-emerald-400" />,
    },
  ];

  // Section 43 — Exact 5 Mobile Bottom Navigation tabs
  const mobilePrimaryTabs: { id: ViewTab; label: string; icon: React.ReactNode }[] = [
    {
      id: 'dashboard',
      label: t('nav.dashboard', 'Dashboard'),
      icon: <LayoutDashboard className="w-5 h-5" />,
    },
    {
      id: 'market',
      label: t('nav.market', 'Market'),
      icon: <Database className="w-5 h-5 text-sky-400" />,
    },
    {
      id: 'chart',
      label: t('nav.chart', 'Chart'),
      icon: <LineChart className="w-5 h-5 text-amber-400" />,
    },
    {
      id: 'strategies',
      label: t('nav.strategies', 'Strategies'),
      icon: <Cpu className="w-5 h-5 text-indigo-400" />,
    },
    {
      id: 'signals',
      label: t('nav.signals', 'Signals'),
      icon: <Radio className="w-5 h-5 text-rose-400" />,
    },
  ];

  // Secondary tabs inside Mobile "More" Drawer
  const mobileSecondaryTabs: { id: ViewTab; label: string; desc: string; icon: React.ReactNode }[] = [
    {
      id: 'autotrader',
      label: isRTL ? '🤖 بوت التداول الآلي' : '🤖 AI Auto Trader',
      desc: isRTL ? 'نظام تداول آلي حقيقي متكامل' : 'Autonomous Trading Engine',
      icon: <Bot className="w-5 h-5 text-emerald-400" />,
    },
    {
      id: 'indicators',
      label: t('nav.indicators', 'Indicators'),
      desc: 'Wilder RSI, ADX, Bollinger, MACD',
      icon: <Gauge className="w-5 h-5 text-emerald-400" />,
    },
    {
      id: 'history',
      label: t('nav.history', 'Signal History'),
      desc: t('signals.nonRepaintingNotice', 'Non-repainting trade log'),
      icon: <History className="w-5 h-5 text-slate-300" />,
    },
    {
      id: 'performance',
      label: t('nav.performance', 'Performance Analytics'),
      desc: t('performance.accuracyNote', 'Statistical accuracy'),
      icon: <TrendingUp className="w-5 h-5 text-emerald-400" />,
    },
    {
      id: 'connection',
      label: t('header.liveStream', 'Connection & Gateway'),
      desc: 'WebSocket Engine.IO / Socket.IO',
      icon: <Wifi className="w-5 h-5 text-blue-400" />,
    },
    {
      id: 'account',
      label: t('header.demoAccount', 'Account Context'),
      desc: 'REAL & DEMO isolation',
      icon: <User className="w-5 h-5 text-amber-400" />,
    },
    {
      id: 'diagnostics',
      label: t('chart.diagnostics', 'Diagnostics Matrix'),
      desc: 'Telemetry & data lineage',
      icon: <Activity className="w-5 h-5 text-purple-400" />,
    },
    {
      id: 'settings',
      label: t('header.sessionSettings', 'Platform Settings'),
      desc: 'SSD & thresholds',
      icon: <Settings className="w-5 h-5 text-slate-200" />,
    },
    {
      id: 'ai_analysis',
      label: t('nav.ai', 'SMC Smart Analysis'),
      desc: 'Liquidity & Fair Value Gaps',
      icon: <Brain className="w-5 h-5 text-amber-400" />,
    },
    {
      id: 'vision',
      label: t('nav.vision', 'Computer Vision'),
      desc: 'Autonomous chart pattern vision',
      icon: <Eye className="w-5 h-5 text-sky-400" />,
    },
    {
      id: 'scanner',
      label: t('nav.scanner', 'Market Scanner'),
      desc: 'Multi-Asset Opportunities Scanner',
      icon: <BarChart2 className="w-5 h-5 text-emerald-400" />,
    },
  ];

  const handleMobileTabSelect = (tab: ViewTab) => {
    onSelectTab(tab);
    setMobileMenuOpen(false);
  };

  const isSecondaryActive = mobileSecondaryTabs.some((t) => t.id === activeTab);

  return (
    <>
      {/* 1. Desktop Side Navigation (Section 44) */}
      <aside
        id="desktop-side-nav"
        className={`hidden lg:flex flex-col shrink-0 bg-slate-950/95 border-r border-slate-800 transition-all duration-200 select-none ${
          collapsed ? 'w-16' : 'w-60'
        }`}
      >
        <div className="p-3 border-b border-slate-800 flex items-center justify-between">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-xs font-black tracking-wider uppercase text-slate-200">
                Navigation
              </span>
            </div>
          )}
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-900 transition-colors mx-auto"
              title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            >
              <ChevronRight
                className={`w-4 h-4 transition-transform ${collapsed ? '' : 'rotate-180'}`}
              />
            </button>
          )}
        </div>

        {/* Primary 12 Items List */}
        <div className="flex-1 overflow-y-auto py-2 px-2 space-y-1 scrollbar-thin scrollbar-thumb-slate-800">
          {desktopNavItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`side-nav-${item.id}`}
                onClick={() => onSelectTab(item.id)}
                title={collapsed ? `${item.label} (${item.sublabel})` : undefined}
                className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-left transition-all ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/80'
                }`}
              >
                <div className={`shrink-0 ${isActive ? 'text-slate-950' : ''}`}>
                  {item.icon}
                </div>
                {!collapsed && (
                  <div className="flex-1 min-w-0 flex items-center justify-between">
                    <div>
                      <div className="text-xs truncate font-medium">{item.label}</div>
                      <div
                        className={`text-[10px] truncate ${
                          isActive ? 'text-slate-900/80' : 'text-slate-500'
                        }`}
                      >
                        {item.sublabel}
                      </div>
                    </div>
                    {item.badge}
                  </div>
                )}
              </button>
            );
          })}

          {!collapsed && (
            <div className="pt-3 pb-1 px-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Advanced Modules
            </div>
          )}

          {advancedTools.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`side-nav-${item.id}`}
                onClick={() => onSelectTab(item.id)}
                title={collapsed ? `${item.label} (${item.sublabel})` : undefined}
                className={`w-full flex items-center gap-3 px-2.5 py-1.5 rounded-lg text-left transition-all ${
                  isActive
                    ? 'bg-sky-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/80'
                }`}
              >
                <div className="shrink-0">{item.icon}</div>
                {!collapsed && (
                  <div className="flex-1 min-w-0">
                    <div className="text-xs truncate font-medium">{item.label}</div>
                    <div
                      className={`text-[10px] truncate ${
                        isActive ? 'text-slate-900/80' : 'text-slate-500'
                      }`}
                    >
                      {item.sublabel}
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Footer Gateway Indicator */}
        {!collapsed && (
          <div className="p-3 border-t border-slate-800 bg-slate-950/60 text-[11px] flex items-center justify-between">
            <span className="text-slate-400">Signal Engine:</span>
            <span
              className={`font-mono font-bold flex items-center gap-1.5 ${
                isConnected ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
                }`}
              />
              {isConnected ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>
        )}
      </aside>

      {/* 2. Tablet / Intermediate Top Navigation Bar (md: to lg:) */}
      <nav className="hidden md:flex lg:hidden items-center gap-1 overflow-x-auto py-2 px-4 bg-slate-950 border-b border-slate-800 text-xs font-medium scrollbar-thin scrollbar-thumb-slate-800">
        {desktopNavItems.slice(0, 8).map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`tab-nav-${tab.id}`}
              onClick={() => onSelectTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap transition-all duration-150 cursor-pointer ${
                isActive
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.badge}
            </button>
          );
        })}
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap text-slate-400 hover:text-slate-200 hover:bg-slate-900 transition-colors"
        >
          <MoreHorizontal className="w-4 h-4" />
          <span>More...</span>
        </button>
      </nav>

      {/* 3. Section 43 — Mobile Fixed Bottom Navigation Bar */}
      <div
        id="mobile-bottom-nav"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-md border-t border-slate-800 px-2 py-1 safe-pb flex items-center justify-around select-none"
      >
        {mobilePrimaryTabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`mobile-tab-${tab.id}`}
              onClick={() => handleMobileTabSelect(tab.id)}
              className={`flex flex-col items-center justify-center min-w-[54px] min-h-[44px] py-1 px-1 rounded-lg transition-colors relative ${
                isActive ? 'text-amber-400 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="relative">{tab.icon}</div>
              <span className="text-[10px] mt-0.5 tracking-tight">{tab.label}</span>
            </button>
          );
        })}

        {/* More Button */}
        <button
          id="mobile-tab-more"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className={`flex flex-col items-center justify-center min-w-[54px] min-h-[44px] py-1 px-1 rounded-lg transition-colors ${
            isSecondaryActive ? 'text-amber-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <MoreHorizontal className="w-5 h-5" />
          <span className="text-[10px] mt-0.5 tracking-tight">More</span>
        </button>
      </div>

      {/* 4. Mobile Secondary Menu Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex flex-col justify-end">
          <div className="bg-slate-950 rounded-t-2xl border-t border-slate-800 p-4 max-h-[85vh] overflow-y-auto space-y-3 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <span className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                Platform Sections & Tools
              </span>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              {mobileSecondaryTabs.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleMobileTabSelect(item.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                      isActive
                        ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                        : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-900 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                        {item.icon}
                      </div>
                      <div className="text-left">
                        <div className="text-xs font-bold text-slate-100">{item.label}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{item.desc}</div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
