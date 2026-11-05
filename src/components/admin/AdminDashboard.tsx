import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Key,
  Users,
  Smartphone,
  FileText,
  Activity,
  Plus,
  RefreshCw,
  Search,
  Copy,
  Check,
  AlertCircle,
  Clock,
  LogOut,
  XCircle,
  Sliders,
  CheckCircle2,
  Trash2,
  TrendingUp,
  Cpu,
  Server,
  ArrowRight,
  Filter,
  Lock,
  Bot,
  Send,
  ExternalLink,
} from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { telegramService, TelegramStatus } from '../../services/TelegramService';

interface AdminDashboardProps {
  adminToken: string;
  onLogout: () => void;
  onClose: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ adminToken, onLogout, onClose }) => {
  const { isRTL } = useLanguage();
  const [activeTab, setActiveTab] = useState<'overview' | 'codes' | 'users' | 'devices' | 'logs' | 'system' | 'telegram'>('overview');

  // Stats
  const [stats, setStats] = useState<any>(null);
  const [codes, setCodes] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [systemStatus, setSystemStatus] = useState<any>(null);

  // Telegram Integration State
  const [telegramStatus, setTelegramStatus] = useState<TelegramStatus | null>(null);
  const [telegramToken, setTelegramToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [telegramAutoBroadcast, setTelegramAutoBroadcast] = useState(true);
  const [telegramMinConfidence, setTelegramMinConfidence] = useState(70);
  const [isSavingTelegram, setIsSavingTelegram] = useState(false);
  const [telegramNotice, setTelegramNotice] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

  // Filters & search
  const [codeSearch, setCodeSearch] = useState('');
  const [codeFilter, setCodeFilter] = useState('ALL');
  const [userSearch, setUserSearch] = useState('');

  // Code Generation Modal State
  const [isGenModalOpen, setIsGenModalOpen] = useState(false);
  const [genDurationType, setGenDurationType] = useState<string>('720'); // 30 days default
  const [genCustomHours, setGenCustomHours] = useState<number>(24);
  const [genExactDate, setGenExactDate] = useState<string>('');
  const [genMaxDevices, setGenMaxDevices] = useState<number>(1);
  const [genCount, setGenCount] = useState<number>(1);
  const [genBoundEmail, setGenBoundEmail] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [genSuccessMessage, setGenSuccessMessage] = useState<string | null>(null);

  // Action Dialogs
  const [extendModalCode, setExtendModalCode] = useState<any | null>(null);
  const [extendHours, setExtendHours] = useState<number>(24);
  const [deviceLimitModalCode, setDeviceLimitModalCode] = useState<any | null>(null);
  const [newDeviceLimit, setNewDeviceLimit] = useState<number>(1);

  const fetchWithAuth = useCallback(
    async (endpoint: string, options: RequestInit = {}) => {
      const headers = {
        'Content-Type': 'application/json',
        'x-admin-token': adminToken,
        ...(options.headers || {}),
      };
      return fetch(endpoint, { ...options, headers });
    },
    [adminToken]
  );

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Stats
      const statsRes = await fetchWithAuth('/api/admin/dashboard-stats');
      const statsData = await statsRes.json();
      if (statsData.success) setStats(statsData.stats);

      // 2. Codes
      const codesRes = await fetchWithAuth(`/api/admin/codes?search=${encodeURIComponent(codeSearch)}&status=${codeFilter}`);
      const codesData = await codesRes.json();
      if (codesData.success) setCodes(codesData.codes || []);

      // 3. Users
      const usersRes = await fetchWithAuth(`/api/admin/users?search=${encodeURIComponent(userSearch)}`);
      const usersData = await usersRes.json();
      if (usersData.success) setUsers(usersData.users || []);

      // 4. Devices
      const devRes = await fetchWithAuth('/api/admin/devices');
      const devData = await devRes.json();
      if (devData.success) setDevices(devData.devices || []);

      // 5. Logs
      const logsRes = await fetchWithAuth('/api/admin/logs?limit=100');
      const logsData = await logsRes.json();
      if (logsData.success) setLogs(logsData.logs || []);

      // 6. System
      const sysRes = await fetchWithAuth('/api/admin/system-status');
      const sysData = await sysRes.json();
      if (sysData.success) setSystemStatus(sysData);
    } catch (err) {
      console.error('[AdminDashboard] Error loading data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [fetchWithAuth, codeSearch, codeFilter, userSearch]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleCopyCode = (codeText: string, id: string) => {
    navigator.clipboard.writeText(codeText);
    setCopiedCodeId(id);
    setTimeout(() => setCopiedCodeId(null), 2500);
  };

  const handleGenerateCodes = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    setGenSuccessMessage(null);

    let durationHours = Number(genDurationType);
    let customHours: number | undefined = undefined;
    let exactExpiration: string | undefined = undefined;

    if (genDurationType === 'custom') {
      customHours = Number(genCustomHours) || 24;
      durationHours = customHours;
    } else if (genDurationType === 'exact') {
      if (!genExactDate) {
        alert(isRTL ? 'يرجى تحديد تاريخ انتهاء الصلاحية' : 'Please select an exact expiration date');
        setIsGenerating(false);
        return;
      }
      exactExpiration = genExactDate;
    }

    try {
      const res = await fetchWithAuth('/api/admin/codes/generate', {
        method: 'POST',
        body: JSON.stringify({
          count: Number(genCount) || 1,
          durationHours,
          customHours,
          exactExpiration,
          maxDevices: Number(genMaxDevices) || 1,
          boundUserEmail: genBoundEmail.trim() || undefined,
        }),
      });

      const data = await res.json();
      setIsGenerating(false);

      if (data.success) {
        setGenSuccessMessage(
          isRTL
            ? `✅ تم توليد ${data.count} كود تفعيل بنجاح!`
            : `✅ Successfully generated ${data.count} activation code(s)!`
        );
        loadData();
        setTimeout(() => {
          setIsGenModalOpen(false);
          setGenSuccessMessage(null);
        }, 2000);
      } else {
        alert(data.error || 'Failed to generate codes');
      }
    } catch {
      setIsGenerating(false);
      alert('Error generating codes');
    }
  };

  const handleRevokeCode = async (codeId: string) => {
    if (!confirm(isRTL ? 'هل أنت متأكد من إلغاء تفعيل هذا الكود فوراً؟' : 'Are you sure you want to revoke this code?')) return;
    try {
      const res = await fetchWithAuth(`/api/admin/codes/${codeId}/revoke`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Revoked from admin dashboard' }),
      });
      if (res.ok) loadData();
    } catch {
      // ignore
    }
  };

  const handleToggleCode = async (codeId: string, currentStatus: string) => {
    const nextEnabled = currentStatus !== 'ACTIVE';
    try {
      const res = await fetchWithAuth(`/api/admin/codes/${codeId}/toggle`, {
        method: 'POST',
        body: JSON.stringify({ enabled: nextEnabled }),
      });
      if (res.ok) loadData();
    } catch {
      // ignore
    }
  };

  const handleExtendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extendModalCode) return;
    try {
      const res = await fetchWithAuth(`/api/admin/codes/${extendModalCode.id}/extend`, {
        method: 'POST',
        body: JSON.stringify({ additionalHours: Number(extendHours) }),
      });
      if (res.ok) {
        setExtendModalCode(null);
        loadData();
      }
    } catch {
      // ignore
    }
  };

  const handleChangeDeviceLimit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceLimitModalCode) return;
    try {
      const res = await fetchWithAuth(`/api/admin/codes/${deviceLimitModalCode.id}/device-limit`, {
        method: 'POST',
        body: JSON.stringify({ maxDevices: Number(newDeviceLimit) }),
      });
      if (res.ok) {
        setDeviceLimitModalCode(null);
        loadData();
      }
    } catch {
      // ignore
    }
  };

  const handleRevokeDevice = async (deviceId: string) => {
    if (!confirm(isRTL ? 'هل أنت متأكد من إلغاء هذا الجهاز؟' : 'Revoke this device?')) return;
    try {
      const res = await fetchWithAuth(`/api/admin/devices/${deviceId}/revoke`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Revoked by admin' }),
      });
      if (res.ok) loadData();
    } catch {
      // ignore
    }
  };

  const handleToggleUser = async (userId: string, currentStatus: string) => {
    const nextActive = currentStatus !== 'ACTIVE';
    try {
      const res = await fetchWithAuth(`/api/admin/users/${userId}/toggle`, {
        method: 'POST',
        body: JSON.stringify({ active: nextActive }),
      });
      if (res.ok) loadData();
    } catch {
      // ignore
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#05070B] text-slate-100 flex flex-col font-sans overflow-hidden" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Top Header Bar */}
      <header className="h-16 px-4 sm:px-6 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black text-slate-100">{isRTL ? 'لوحة تحكم المشرف والاشتراكات' : 'Administrator & License Command Center'}</h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                PROD ADMIN
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono hidden sm:block">
              {isRTL ? 'إدارة أكواد التفعيل، حدود الأجهزة، المستخدمين وسجلات الأمان' : 'Activation Codes, Device Limits, User Registry & Security Audit'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={loadData}
            disabled={isLoading}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
            title={isRTL ? 'تحديث البيانات' : 'Refresh Data'}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
          </button>

          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <span>{isRTL ? 'العودة للمنصة' : 'Back to App'}</span>
          </button>

          <button
            onClick={onLogout}
            className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{isRTL ? 'خروج المشرف' : 'Admin Logout'}</span>
          </button>
        </div>
      </header>

      {/* Main Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Navigation Sidebar */}
        <nav className="w-16 sm:w-56 bg-slate-950 border-r border-slate-800 p-2 sm:p-3 flex flex-col justify-between shrink-0">
          <div className="space-y-1">
            <button
              onClick={() => setActiveTab('overview')}
              className={`w-full p-2.5 rounded-xl text-xs font-bold flex items-center gap-3 transition-all cursor-pointer ${
                activeTab === 'overview'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Activity className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">{isRTL ? 'نظرة عامة وإحصائيات' : 'Overview & KPIs'}</span>
            </button>

            <button
              onClick={() => setActiveTab('codes')}
              className={`w-full p-2.5 rounded-xl text-xs font-bold flex items-center gap-3 transition-all cursor-pointer ${
                activeTab === 'codes'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Key className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">{isRTL ? 'أكواد التفعيل' : 'Activation Codes'}</span>
            </button>

            <button
              onClick={() => setActiveTab('users')}
              className={`w-full p-2.5 rounded-xl text-xs font-bold flex items-center gap-3 transition-all cursor-pointer ${
                activeTab === 'users'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Users className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">{isRTL ? 'المستخدمين والحسابات' : 'User Accounts'}</span>
            </button>

            <button
              onClick={() => setActiveTab('devices')}
              className={`w-full p-2.5 rounded-xl text-xs font-bold flex items-center gap-3 transition-all cursor-pointer ${
                activeTab === 'devices'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Smartphone className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">{isRTL ? 'إدارة الأجهزة' : 'Active Devices'}</span>
            </button>

            <button
              onClick={() => setActiveTab('logs')}
              className={`w-full p-2.5 rounded-xl text-xs font-bold flex items-center gap-3 transition-all cursor-pointer ${
                activeTab === 'logs'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <FileText className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">{isRTL ? 'سجلات الأمان' : 'Audit Logs'}</span>
            </button>

            <button
              onClick={() => setActiveTab('telegram')}
              className={`w-full p-2.5 rounded-xl text-xs font-bold flex items-center gap-3 transition-all cursor-pointer ${
                activeTab === 'telegram'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Bot className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">{isRTL ? 'بوت التلجرام' : 'Telegram Bot'}</span>
            </button>

            <button
              onClick={() => setActiveTab('system')}
              className={`w-full p-2.5 rounded-xl text-xs font-bold flex items-center gap-3 transition-all cursor-pointer ${
                activeTab === 'system'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Server className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">{isRTL ? 'حالة النظام' : 'System Health'}</span>
            </button>
          </div>

          <div className="p-2 hidden sm:block rounded-xl bg-slate-900/60 border border-slate-800 text-[10px] text-slate-500">
            <span>Server: Active</span>
            <br />
            <span className="font-mono text-emerald-400">Node {systemStatus?.nodeVersion || 'v20+'}</span>
          </div>
        </nav>

        {/* Viewport Content */}
        <main className="flex-1 p-4 sm:p-6 overflow-y-auto bg-[#080B10]">
          {/* ================= TAB 1: OVERVIEW ================= */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* KPI Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-sm">
                  <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                    <span>{isRTL ? 'إجمالي المستخدمين' : 'Total Users'}</span>
                    <Users className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="text-2xl font-black text-slate-100">{stats?.totalUsers ?? users.length}</div>
                  <p className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1">
                    <span>{stats?.activeUsers ?? users.length} {isRTL ? 'حساب نشط' : 'active'}</span>
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-sm">
                  <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                    <span>{isRTL ? 'التفعيلات النشطة' : 'Active Activations'}</span>
                    <Key className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-2xl font-black text-emerald-400">{stats?.activeActivations ?? 0}</div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {stats?.totalCodesCreated ?? codes.length} {isRTL ? 'كود صادر' : 'total codes'}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-sm">
                  <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                    <span>{isRTL ? 'الأجهزة المتصلة' : 'Active Devices'}</span>
                    <Smartphone className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="text-2xl font-black text-amber-400">{stats?.activeDevices ?? devices.length}</div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {isRTL ? 'مع تتبع حدود الأجهزة' : 'Strict limit enforced'}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-sm">
                  <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                    <span>{isRTL ? 'تنتهي قريباً (48h)' : 'Expiring Soon (48h)'}</span>
                    <Clock className="w-4 h-4 text-rose-400" />
                  </div>
                  <div className="text-2xl font-black text-rose-400">{stats?.codesExpiringSoon ?? 0}</div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {stats?.expiredActivations ?? 0} {isRTL ? 'منتهية الصلاحية' : 'expired'}
                  </p>
                </div>
              </div>

              {/* Quick Code Generator Callout */}
              <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-amber-500/10 via-slate-900 to-slate-900 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-base font-black text-amber-400 flex items-center gap-2">
                    <Key className="w-5 h-5" />
                    <span>{isRTL ? 'توليد وتصدير أكواد تفعيل جديدة' : 'Generate New Activation Codes'}</span>
                  </h3>
                  <p className="text-xs text-slate-300">
                    {isRTL
                      ? 'قم بإنشاء كود فوري بمدة محددة (ساعة، 24 ساعة، 7 أيام، 30 يوم، 90 يوم أو مخصص) مع تحديد حد الأجهزة المسموحة.'
                      : 'Create cryptographically random activation codes with customizable duration and hardware device limits.'}
                  </p>
                </div>

                <button
                  onClick={() => setIsGenModalOpen(true)}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs sm:text-sm shadow-md shadow-amber-500/20 flex items-center gap-2 cursor-pointer transition-all shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isRTL ? 'إنشاء أكواد جديدة' : 'Generate Codes'}</span>
                </button>
              </div>

              {/* Latest Recent Codes & Activity */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">{isRTL ? 'أحدث الأكواد الصادرة' : 'Latest Generated Codes'}</h4>
                    <button onClick={() => setActiveTab('codes')} className="text-xs text-amber-400 hover:underline">
                      {isRTL ? 'عرض الكل' : 'View All'}
                    </button>
                  </div>

                  <div className="space-y-2">
                    {codes.slice(0, 5).map((c) => (
                      <div key={c.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between gap-3 text-xs">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-amber-400">{c.code}</span>
                            <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                              c.status === 'ACTIVE'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : c.status === 'UNUSED'
                                ? 'bg-blue-500/20 text-blue-400'
                                : 'bg-rose-500/20 text-rose-400'
                            }`}>
                              {c.status}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 truncate mt-0.5">
                            {c.durationLabel} • {c.boundUserEmail || (isRTL ? 'غير مربوط بعد' : 'Unbound')}
                          </p>
                        </div>

                        <button
                          onClick={() => handleCopyCode(c.code, c.id)}
                          className="p-1.5 text-slate-400 hover:text-amber-300 rounded bg-slate-900 border border-slate-800 cursor-pointer"
                          title="Copy"
                        >
                          {copiedCodeId === c.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">{isRTL ? 'أحدث أحداث الأمان' : 'Recent Security Events'}</h4>
                    <button onClick={() => setActiveTab('logs')} className="text-xs text-amber-400 hover:underline">
                      {isRTL ? 'عرض السجل' : 'View Logs'}
                    </button>
                  </div>

                  <div className="space-y-2">
                    {logs.slice(0, 5).map((l) => (
                      <div key={l.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-xs">
                        <div className="flex items-center justify-between text-slate-400 text-[10px]">
                          <span className="font-mono text-amber-300 font-bold">{l.action}</span>
                          <span>{new Date(l.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <p className="text-[11px] text-slate-300 mt-1 truncate">
                          {l.actor} • IP: {l.ipAddress}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 2: ACTIVATION CODES ================= */}
          {activeTab === 'codes' && (
            <div className="space-y-4">
              {/* Filter and search bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800">
                <div className="flex items-center gap-2 flex-1">
                  <div className="relative flex-1 max-w-sm">
                    <Search className={`w-4 h-4 text-slate-500 absolute top-3 ${isRTL ? 'right-3' : 'left-3'}`} />
                    <input
                      type="text"
                      value={codeSearch}
                      onChange={(e) => setCodeSearch(e.target.value)}
                      placeholder={isRTL ? 'بحث بكود التفعيل أو الإيميل...' : 'Search code or email...'}
                      className={`w-full py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-amber-500 ${
                        isRTL ? 'pr-9 pl-3' : 'pl-9 pr-3'
                      }`}
                    />
                  </div>

                  <select
                    value={codeFilter}
                    onChange={(e) => setCodeFilter(e.target.value)}
                    className="py-2 px-3 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="UNUSED">UNUSED</option>
                    <option value="EXPIRED">EXPIRED</option>
                    <option value="REVOKED">REVOKED</option>
                    <option value="DISABLED">DISABLED</option>
                  </select>
                </div>

                <button
                  onClick={() => setIsGenModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isRTL ? 'توليد أكواد' : 'New Code'}</span>
                </button>
              </div>

              {/* Codes Table */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] font-mono border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-4">{isRTL ? 'الكود' : 'Code'}</th>
                        <th className="py-3 px-3">{isRTL ? 'الحالة' : 'Status'}</th>
                        <th className="py-3 px-3">{isRTL ? 'المدة' : 'Duration'}</th>
                        <th className="py-3 px-3">{isRTL ? 'حد الأجهزة' : 'Devices'}</th>
                        <th className="py-3 px-3">{isRTL ? 'الحساب المربوط' : 'Bound User'}</th>
                        <th className="py-3 px-3">{isRTL ? 'تاريخ الانتهاء' : 'Expires At'}</th>
                        <th className="py-3 px-4 text-right">{isRTL ? 'الإجراءات' : 'Actions'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {codes.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-500">
                            {isRTL ? 'لا توجد أكواد مطابقة' : 'No activation codes found'}
                          </td>
                        </tr>
                      ) : (
                        codes.map((c) => (
                          <tr key={c.id} className="hover:bg-slate-800/40 transition-colors">
                            <td className="py-3 px-4 font-bold text-amber-300 flex items-center gap-2">
                              <span>{c.code}</span>
                              <button
                                onClick={() => handleCopyCode(c.code, c.id)}
                                className="p-1 text-slate-500 hover:text-amber-300 cursor-pointer"
                                title="Copy"
                              >
                                {copiedCodeId === c.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  c.status === 'ACTIVE'
                                    ? 'bg-emerald-500/20 text-emerald-400'
                                    : c.status === 'UNUSED'
                                    ? 'bg-blue-500/20 text-blue-400'
                                    : c.status === 'EXPIRED'
                                    ? 'bg-amber-500/20 text-amber-400'
                                    : 'bg-rose-500/20 text-rose-400'
                                }`}
                              >
                                {c.status}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-slate-300">{c.durationLabel}</td>
                            <td className="py-3 px-3">
                              <span className="text-slate-200">{c.activeDevicesCount || 0}</span> / <span className="text-amber-400 font-bold">{c.maxDevices}</span>
                            </td>
                            <td className="py-3 px-3 text-slate-300 max-w-xs truncate">
                              {c.boundUserEmail || <span className="text-slate-500 italic">None</span>}
                            </td>
                            <td className="py-3 px-3 text-slate-400 text-[11px]">
                              {c.expiresAt ? new Date(c.expiresAt).toLocaleDateString() : 'Upon activation'}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => setExtendModalCode(c)}
                                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] cursor-pointer"
                                  title="Extend"
                                >
                                  {isRTL ? 'تمديد' : 'Extend'}
                                </button>
                                <button
                                  onClick={() => {
                                    setDeviceLimitModalCode(c);
                                    setNewDeviceLimit(c.maxDevices);
                                  }}
                                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] cursor-pointer"
                                  title="Device Limit"
                                >
                                  {isRTL ? 'حد الأجهزة' : 'Limit'}
                                </button>
                                <button
                                  onClick={() => handleToggleCode(c.id, c.status)}
                                  className={`px-2 py-1 rounded text-[11px] cursor-pointer ${
                                    c.status === 'ACTIVE'
                                      ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300'
                                      : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300'
                                  }`}
                                >
                                  {c.status === 'ACTIVE' ? (isRTL ? 'تعطيل' : 'Disable') : (isRTL ? 'تفعيل' : 'Enable')}
                                </button>
                                {c.status !== 'REVOKED' && (
                                  <button
                                    onClick={() => handleRevokeCode(c.id)}
                                    className="p-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 cursor-pointer"
                                    title="Revoke"
                                  >
                                    <XCircle className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 3: USERS ================= */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800 flex items-center justify-between">
                <div className="relative flex-1 max-w-sm">
                  <Search className={`w-4 h-4 text-slate-500 absolute top-3 ${isRTL ? 'right-3' : 'left-3'}`} />
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder={isRTL ? 'بحث بالاسم أو الإيميل أو UID...' : 'Search name, email or UID...'}
                    className={`w-full py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-amber-500 ${
                      isRTL ? 'pr-9 pl-3' : 'pl-9 pr-3'
                    }`}
                  />
                </div>
                <div className="text-xs text-slate-400 font-mono">
                  {users.length} {isRTL ? 'مستخدم مسجل' : 'Registered Users'}
                </div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] font-mono border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-4">{isRTL ? 'المستخدم' : 'User'}</th>
                        <th className="py-3 px-3">{isRTL ? 'البريد الإلكتروني' : 'Email'}</th>
                        <th className="py-3 px-3">{isRTL ? 'الحالة' : 'Status'}</th>
                        <th className="py-3 px-3">{isRTL ? 'كود التفعيل' : 'Active Code'}</th>
                        <th className="py-3 px-3">{isRTL ? 'انتهاء الصلاحية' : 'Expires At'}</th>
                        <th className="py-3 px-4 text-right">{isRTL ? 'الإجراءات' : 'Actions'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {users.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-500">
                            {isRTL ? 'لا يوجد مستخدمين' : 'No users found'}
                          </td>
                        </tr>
                      ) : (
                        users.map((u) => (
                          <tr key={u.uid} className="hover:bg-slate-800/40 transition-colors">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold text-xs">
                                  {u.displayName?.charAt(0).toUpperCase() || 'U'}
                                </div>
                                <div>
                                  <div className="font-bold text-slate-100">{u.displayName}</div>
                                  <div className="text-[10px] text-slate-500">UID: {u.uid.substring(0, 8)}...</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-3 text-slate-300">{u.email}</td>
                            <td className="py-3 px-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  u.status === 'ACTIVE'
                                    ? 'bg-emerald-500/20 text-emerald-400'
                                    : 'bg-rose-500/20 text-rose-400'
                                }`}
                              >
                                {u.status}
                              </span>
                            </td>
                            <td className="py-3 px-3 font-bold text-amber-400">
                              {u.activeCode || <span className="text-slate-500 italic">None</span>}
                            </td>
                            <td className="py-3 px-3 text-slate-400 text-[11px]">
                              {u.activeExpiresAt ? new Date(u.activeExpiresAt).toLocaleDateString() : 'N/A'}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                onClick={() => handleToggleUser(u.uid, u.status)}
                                className={`px-2.5 py-1 rounded text-xs font-bold cursor-pointer ${
                                  u.status === 'ACTIVE'
                                    ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-400'
                                    : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400'
                                }`}
                              >
                                {u.status === 'ACTIVE' ? (isRTL ? 'حظر الحساب' : 'Disable') : (isRTL ? 'إلغاء الحظر' : 'Enable')}
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 4: DEVICES ================= */}
          {activeTab === 'devices' && (
            <div className="space-y-4">
              <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-200 uppercase">{isRTL ? 'سجل الأجهزة والجلسات النشطة' : 'Active Registered Devices'}</h3>
                  <p className="text-[11px] text-slate-400">{isRTL ? 'مراقبة وإلغاء صلاحية الأجهزة المصرح لها' : 'Monitor and revoke authorized devices'}</p>
                </div>
                <div className="text-xs text-amber-400 font-mono font-bold">
                  {devices.length} {isRTL ? 'أجهزة مسجلة' : 'Tracked Devices'}
                </div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] font-mono border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-4">{isRTL ? 'الجهاز والمنصة' : 'Device & OS'}</th>
                        <th className="py-3 px-3">{isRTL ? 'المستخدم' : 'User'}</th>
                        <th className="py-3 px-3">{isRTL ? 'كود التفعيل' : 'Code'}</th>
                        <th className="py-3 px-3">{isRTL ? 'عنوان IP' : 'IP Address'}</th>
                        <th className="py-3 px-3">{isRTL ? 'الحالة' : 'Status'}</th>
                        <th className="py-3 px-3">{isRTL ? 'آخر نشاط' : 'Last Active'}</th>
                        <th className="py-3 px-4 text-right">{isRTL ? 'الإجراء' : 'Action'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {devices.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-500">
                            {isRTL ? 'لا توجد أجهزة مسجلة حالياً' : 'No registered devices'}
                          </td>
                        </tr>
                      ) : (
                        devices.map((d) => (
                          <tr key={d.id} className="hover:bg-slate-800/40 transition-colors">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <Smartphone className="w-4 h-4 text-slate-400" />
                                <div>
                                  <span className="font-bold text-slate-200">{d.os}</span> • {d.browser}
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-3 text-slate-300">{d.userEmail}</td>
                            <td className="py-3 px-3 font-bold text-amber-400">{d.code}</td>
                            <td className="py-3 px-3 text-slate-400">{d.ipAddress}</td>
                            <td className="py-3 px-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  d.status === 'ACTIVE'
                                    ? 'bg-emerald-500/20 text-emerald-400'
                                    : 'bg-rose-500/20 text-rose-400'
                                }`}
                              >
                                {d.status}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-slate-400 text-[11px]">
                              {new Date(d.lastActiveAt).toLocaleString()}
                            </td>
                            <td className="py-3 px-4 text-right">
                              {d.status === 'ACTIVE' && (
                                <button
                                  onClick={() => handleRevokeDevice(d.id)}
                                  className="px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 font-bold text-xs cursor-pointer"
                                >
                                  {isRTL ? 'إلغاء الجهاز' : 'Revoke'}
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 5: AUDIT LOGS ================= */}
          {activeTab === 'logs' && (
            <div className="space-y-4">
              <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-200 uppercase">{isRTL ? 'سجل العمليات والتدقيق الأمني' : 'Security Audit & Activity Trail'}</h3>
                  <p className="text-[11px] text-slate-400">{isRTL ? 'تسجيل كامل لكافة أحداث الدخول، التوليد والإلغاء' : 'Immutable audit trail of administrator and user actions'}</p>
                </div>
                <div className="text-xs text-slate-400 font-mono">
                  {logs.length} {isRTL ? 'حدث مسجل' : 'Logged Events'}
                </div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] font-mono border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-4">{isRTL ? 'التوقيت' : 'Timestamp'}</th>
                        <th className="py-3 px-3">{isRTL ? 'نوع الحدث' : 'Action'}</th>
                        <th className="py-3 px-3">{isRTL ? 'الفاعل' : 'Actor'}</th>
                        <th className="py-3 px-3">{isRTL ? 'عنوان IP' : 'IP Address'}</th>
                        <th className="py-3 px-4">{isRTL ? 'التفاصيل' : 'Details'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {logs.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-500">
                            {isRTL ? 'لا توجد سجلات بعد' : 'No audit records yet'}
                          </td>
                        </tr>
                      ) : (
                        logs.map((l) => (
                          <tr key={l.id} className="hover:bg-slate-800/40 transition-colors">
                            <td className="py-3 px-4 text-slate-400 text-[11px]">
                              {new Date(l.timestamp).toLocaleString()}
                            </td>
                            <td className="py-3 px-3 font-bold text-amber-400">{l.action}</td>
                            <td className="py-3 px-3 text-slate-200">{l.actor}</td>
                            <td className="py-3 px-3 text-slate-400">{l.ipAddress}</td>
                            <td className="py-3 px-4 text-slate-300 max-w-md truncate">
                              {JSON.stringify(l.details || {})}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 6: SYSTEM STATUS ================= */}
          {activeTab === 'system' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                    <Clock className="w-4 h-4 text-emerald-400" />
                    <span>{isRTL ? 'مدة تشغيل الخادم' : 'Server Uptime'}</span>
                  </div>
                  <div className="text-xl font-bold font-mono text-emerald-400">
                    {Math.floor((systemStatus?.uptimeSeconds || 0) / 3600)}h {Math.floor(((systemStatus?.uptimeSeconds || 0) % 3600) / 60)}m
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                    <Cpu className="w-4 h-4 text-blue-400" />
                    <span>{isRTL ? 'استهلاك الذاكرة' : 'Memory Heap'}</span>
                  </div>
                  <div className="text-xl font-bold font-mono text-blue-400">
                    {systemStatus?.memory?.heapUsedMb || 0} MB / {systemStatus?.memory?.heapTotalMb || 0} MB
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                    <Server className="w-4 h-4 text-amber-400" />
                    <span>{isRTL ? 'قاعدة البيانات والتخزين' : 'Firestore Status'}</span>
                  </div>
                  <div className="text-xl font-bold font-mono text-amber-400">
                    ONLINE (Connected)
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 7: TELEGRAM BOT API ================= */}
          {activeTab === 'telegram' && (
            <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-200 text-xs flex items-start gap-3">
                <Bot className="w-6 h-6 text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-bold text-sm text-blue-100">{isRTL ? 'ربط المفاتيح مع بوت التلجرام عبر API' : 'Telegram Bot & License Verification API'}</h3>
                  <p className="text-[11px] text-blue-300/80 mt-1 leading-relaxed">
                    {isRTL
                      ? 'يقوم بوت التلجرام بالتحقق من الأكواد وبث الإشارات للمشتركين وربط الحسابات فورياً عبر API. تم عزل وتجريد البوت بالكامل من أي روابط أو طلبات لتثبيت تطبيقات الهاتف؛ يقتصر البوت على التحقق وبث الإشارات للويب.'
                      : 'The Telegram bot verifies licenses (/activate), checks subscription status, and broadcasts confirmed trade signals. Zero phone app installations; purely web trading access.'}
                  </p>
                </div>
              </div>

              {telegramNotice && (
                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono">
                  {telegramNotice}
                </div>
              )}

              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full ${telegramStatus?.configured ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
                    <span className="font-mono text-xs text-slate-200">
                      {telegramStatus?.configured ? (telegramStatus.botUsername ? `@${telegramStatus.botUsername}` : 'Configured') : (isRTL ? 'غير مربوط' : 'Not Connected')}
                    </span>
                  </div>

                  {telegramStatus?.botUsername && (
                    <a
                      href={`https://t.me/${telegramStatus.botUsername}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                    >
                      <span>{isRTL ? 'فتح البوت في تلجرام' : 'Open in Telegram'}</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block font-bold text-slate-300 mb-1">{isRTL ? 'رمز التوكن (Bot Token):' : 'Bot Token:'}</label>
                    <input
                      type="password"
                      value={telegramToken}
                      onChange={(e) => setTelegramToken(e.target.value)}
                      placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ..."
                      className="w-full py-2 px-3 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-300 mb-1">{isRTL ? 'معرف القناة / الشات للبث:' : 'Target Chat / Channel ID:'}</label>
                    <input
                      type="text"
                      value={telegramChatId}
                      onChange={(e) => setTelegramChatId(e.target.value)}
                      placeholder="@SabaaSignalsChannel"
                      className="w-full py-2 px-3 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 text-xs">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="dashAutoBc"
                      checked={telegramAutoBroadcast}
                      onChange={(e) => setTelegramAutoBroadcast(e.target.checked)}
                      className="w-4 h-4 rounded text-amber-500 bg-slate-950 border-slate-700 cursor-pointer"
                    />
                    <label htmlFor="dashAutoBc" className="text-slate-300 font-bold cursor-pointer">
                      {isRTL ? 'بث الإشارات المؤكدة آلياً' : 'Auto-broadcast confirmed signals'}
                    </label>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-300 mb-1">{isRTL ? 'الحد الأدنى للتأكيد (%):' : 'Min Confidence (%):'}</label>
                    <input
                      type="number"
                      min="50"
                      max="95"
                      value={telegramMinConfidence}
                      onChange={(e) => setTelegramMinConfidence(Number(e.target.value))}
                      className="w-full py-1.5 px-3 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 font-mono"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-4 border-t border-slate-800">
                  <button
                    onClick={async () => {
                      setIsSavingTelegram(true);
                      const res = await telegramService.updateConfig({
                        botToken: telegramToken || undefined,
                        chatId: telegramChatId || undefined,
                        autoBroadcastSignals: telegramAutoBroadcast,
                        minConfidence: telegramMinConfidence,
                        adminToken,
                      });
                      setIsSavingTelegram(false);
                      setTelegramNotice(res.success ? '✅ Saved successfully!' : `❌ ${res.error}`);
                      telegramService.getStatus().then(setTelegramStatus);
                    }}
                    disabled={isSavingTelegram}
                    className="py-2.5 px-5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <Send className="w-4 h-4" />
                    <span>{isRTL ? 'حفظ إعدادات البوت' : 'Save Telegram Settings'}</span>
                  </button>

                  <button
                    onClick={async () => {
                      const res = await telegramService.testConnection(telegramChatId);
                      setTelegramNotice(res.message);
                      telegramService.getStatus().then(setTelegramStatus);
                    }}
                    disabled={!telegramChatId}
                    className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs cursor-pointer disabled:opacity-50"
                  >
                    {isRTL ? 'إرسال رسالة تجربة' : 'Send Test Alert'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ================= MODAL: CODE GENERATOR ================= */}
      {isGenModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 overflow-hidden">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-100">{isRTL ? 'توليد أكواد تفعيل جديدة' : 'Generate Activation Codes'}</h3>
                  <p className="text-xs text-slate-400">{isRTL ? 'تخصيص المدة (ساعة حتى سنة) وحد الأجهزة' : 'Configure duration (1h to 1y) & devices'}</p>
                </div>
              </div>
              <button onClick={() => setIsGenModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-200 rounded cursor-pointer">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {genSuccessMessage && (
              <div className="my-3 p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold">
                {genSuccessMessage}
              </div>
            )}

            <form onSubmit={handleGenerateCodes} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1">{isRTL ? 'مدة الصلاحية (من ساعة حتى سنة):' : 'Duration (1 Hour to 1 Year):'}</label>
                <select
                  value={genDurationType}
                  onChange={(e) => setGenDurationType(e.target.value)}
                  className="w-full py-2.5 px-3 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                >
                  <option value="1">⏱ 1 Hour (ساعة واحدة - تجربة سريعة)</option>
                  <option value="24">📅 24 Hours (يوم كامل - 24 ساعة)</option>
                  <option value="168">🗓 7 Days (أسبوع كامل - 7 أيام)</option>
                  <option value="720">⭐️ 30 Days (شهر كامل - 30 يوماً)</option>
                  <option value="2160">⚡️ 90 Days (3 أشهر - 90 يوماً)</option>
                  <option value="4320">💎 180 Days (6 أشهر - نصف سنة)</option>
                  <option value="8760">👑 1 Year (سنة كاملة - 365 يوماً - VIP)</option>
                  <option value="custom">⚙️ Custom Hours (ساعات مخصصة)</option>
                  <option value="exact">🎯 Exact Date/Time (تاريخ محدد بالدقيقة)</option>
                </select>
              </div>

              {genDurationType === 'custom' && (
                <div>
                  <label className="block font-bold text-slate-300 mb-1">{isRTL ? 'عدد الساعات المخصصة:' : 'Custom Hours:'}</label>
                  <input
                    type="number"
                    min="1"
                    value={genCustomHours}
                    onChange={(e) => setGenCustomHours(Number(e.target.value))}
                    className="w-full py-2 px-3 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 font-mono"
                  />
                </div>
              )}

              {genDurationType === 'exact' && (
                <div>
                  <label className="block font-bold text-slate-300 mb-1">{isRTL ? 'تاريخ ووقت الانتهاء المحدد:' : 'Exact Expiration DateTime:'}</label>
                  <input
                    type="datetime-local"
                    value={genExactDate}
                    onChange={(e) => setGenExactDate(e.target.value)}
                    className="w-full py-2 px-3 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 font-mono"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">{isRTL ? 'الحد الأقصى للأجهزة:' : 'Max Devices Limit:'}</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={genMaxDevices}
                    onChange={(e) => setGenMaxDevices(Number(e.target.value))}
                    className="w-full py-2 px-3 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">{isRTL ? 'عدد الأكواد المراد إنشاؤها:' : 'Number of Codes:'}</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={genCount}
                    onChange={(e) => setGenCount(Number(e.target.value))}
                    className="w-full py-2 px-3 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">{isRTL ? 'ربط بحساب إيميل محدد (اختياري):' : 'Pre-bind to User Email (Optional):'}</label>
                <input
                  type="email"
                  value={genBoundEmail}
                  onChange={(e) => setGenBoundEmail(e.target.value)}
                  placeholder="user@gmail.com"
                  className="w-full py-2 px-3 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={isGenerating}
                className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
              >
                {isGenerating ? (
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Key className="w-4 h-4" />
                    <span>{isRTL ? 'توليد الأكواد الآن' : 'Generate Codes Now'}</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: EXTEND CODE ================= */}
      {extendModalCode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl p-5 shadow-2xl">
            <h4 className="text-sm font-bold text-slate-100 mb-3">{isRTL ? 'تمديد صلاحية الكود' : 'Extend Code Expiration'}</h4>
            <p className="text-xs text-amber-400 font-mono mb-4">{extendModalCode.code}</p>

            <form onSubmit={handleExtendCode} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1">{isRTL ? 'إضافة ساعات إضافية:' : 'Add Additional Hours:'}</label>
                <input
                  type="number"
                  min="1"
                  value={extendHours}
                  onChange={(e) => setExtendHours(Number(e.target.value))}
                  className="w-full py-2 px-3 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setExtendModalCode(null)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 font-bold"
                >
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold"
                >
                  {isRTL ? 'تأكيد التمديد' : 'Confirm Extension'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: CHANGE DEVICE LIMIT ================= */}
      {deviceLimitModalCode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl p-5 shadow-2xl">
            <h4 className="text-sm font-bold text-slate-100 mb-3">{isRTL ? 'تعديل حد الأجهزة المسموحة' : 'Change Max Devices Limit'}</h4>
            <p className="text-xs text-amber-400 font-mono mb-4">{deviceLimitModalCode.code}</p>

            <form onSubmit={handleChangeDeviceLimit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1">{isRTL ? 'عدد الأجهزة المسموحة الجديد:' : 'New Max Allowed Devices:'}</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={newDeviceLimit}
                  onChange={(e) => setNewDeviceLimit(Number(e.target.value))}
                  className="w-full py-2 px-3 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeviceLimitModalCode(null)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 font-bold"
                >
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-bold"
                >
                  {isRTL ? 'حفظ الحد الجديد' : 'Save Limit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
