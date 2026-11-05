import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Activity,
  Server,
  Cpu,
  Brain,
  FileText,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Database,
  Lock,
} from 'lucide-react';
import { SystemAuditLog } from '../types';
import { useLanguage } from '../i18n/LanguageContext';

export const AdminPanel: React.FC = () => {
  const { t, tTerm, isRTL } = useLanguage();
  const [health, setHealth] = useState<any>(null);
  const [logs, setLogs] = useState<SystemAuditLog[]>([]);
  const [filterLevel, setFilterLevel] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchAdminData = async () => {
    try {
      const [hRes, lRes] = await Promise.all([
        fetch('/api/admin/health'),
        fetch('/api/admin/logs'),
      ]);
      if (hRes.ok) setHealth(await hRes.json());
      if (lRes.ok) setLogs(await lRes.json());
    } catch (err) {
      console.error('Admin telemetry fetch failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
    const interval = setInterval(fetchAdminData, 6000);
    return () => clearInterval(interval);
  }, []);

  const filteredLogs = logs.filter((log) => {
    if (filterLevel === 'ALL') return true;
    return log.level === filterLevel;
  });

  const formatUptime = (sec: number) => {
    const hours = Math.floor(sec / 3600);
    const minutes = Math.floor((sec % 3600) / 60);
    const seconds = sec % 60;
    return `${hours}h ${minutes}m ${seconds}s`;
  };

  return (
    <div id="admin-panel" className={`space-y-6 max-w-6xl mx-auto font-sans ${isRTL ? 'text-right' : 'text-left'}`}>
      {/* Header */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/20 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
            <Server className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <span>لوحة التحكم والمراقبة المؤسسية للأنظمة</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono font-bold">
                TELEMETRY ACTIVE
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              مراقبة الخوادم اللحظية، واستهلاك الذاكرة، وطلبات الذكاء الاصطناعي، وسجل تدقيق العمليات والأمان.
            </p>
          </div>
        </div>

        <button
          onClick={fetchAdminData}
          className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors flex items-center gap-2 text-xs font-semibold"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          <span>تحديث المقاييس</span>
        </button>
      </div>

      {/* Health Metric Cards */}
      {health && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-mono">
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
            <span className="text-slate-400 font-sans block text-[11px]">حالة البوابة والخدمة:</span>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-emerald-400 font-bold text-sm">{health.status}</span>
            </div>
            <div className="text-[10px] text-slate-400 font-sans">مدة التشغيل: {formatUptime(health.uptimeSeconds)}</div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
            <span className="text-slate-400 font-sans block text-[11px]">قنوات البث المباشر (SSE/Sockets):</span>
            <div className="text-xl font-black text-amber-400">{health.activeSockets}</div>
            <div className="text-[10px] text-slate-400 font-sans">عميل متصل بالبث الحي</div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
            <span className="text-slate-400 font-sans block text-[11px]">استهلاك الذاكرة (Memory Heap):</span>
            <div className="text-xl font-bold text-slate-200">
              {health.memory.heapUsedMb} <span className="text-xs text-slate-400">/ {health.memory.heapTotalMb} MB</span>
            </div>
            <div className="text-[10px] text-slate-400 font-sans">RSS: {health.memory.rssMb} MB</div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
            <span className="text-slate-400 font-sans block text-[11px]">محرك الذكاء الاصطناعي (Gemini):</span>
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-amber-400" />
              <span className="text-slate-200 font-bold">
                {health.geminiApiConfigured ? 'مفعل وجاهز' : 'وضع المحاكاة الخوارزمية'}
              </span>
            </div>
            <div className="text-[10px] text-slate-400 font-sans">
              AI: {health.stats.totalAiRequests} | Vision: {health.stats.totalVisionRequests}
            </div>
          </div>
        </div>
      )}

      {/* Audit Logs Section */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden space-y-3 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
            <FileText className="w-4 h-4 text-amber-400" />
            <span>سجل تدقيق الأمان والعمليات المؤسسية (Audit Trail):</span>
          </div>

          {/* Level Filter */}
          <div className="flex items-center gap-1 text-xs">
            {['ALL', 'INFO', 'WARN', 'ERROR', 'SECURITY'].map((lvl) => (
              <button
                key={lvl}
                onClick={() => setFilterLevel(lvl)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-mono border transition-all ${
                  filterLevel === lvl
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 font-bold'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>

        {/* Logs List */}
        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
          {filteredLogs.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">لا توجد سجلات تطابق الفلتر الحالي.</div>
          ) : (
            filteredLogs.map((log) => (
              <div
                key={log.id}
                className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs font-mono space-y-1 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                        log.level === 'INFO'
                          ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                          : log.level === 'WARN'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : log.level === 'ERROR'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                      }`}
                    >
                      {log.level}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 text-[9px]">
                      {log.category}
                    </span>
                    <span className="text-slate-200 font-sans font-semibold">{log.message}</span>
                  </div>
                  <span className="text-slate-400 text-[10px]">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                {log.details && (
                  <div className="text-[10px] text-slate-400 text-left pl-2 border-l border-slate-800">
                    {log.details}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
