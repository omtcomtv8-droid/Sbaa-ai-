import React, { useEffect, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Cpu,
  DollarSign,
  Radio,
  Server,
  ShieldCheck,
} from 'lucide-react';
import { AssetInfo, DiagnosticsInfo, SystemAuditLog } from '../types';
import { useLanguage } from '../i18n/LanguageContext';

interface RealPlatformActivityCardProps {
  diagnostics?: DiagnosticsInfo | null;
}

interface TelemetryHealth {
  status: string;
  uptimeSeconds: number;
  activeSockets: number;
  memory?: {
    heapUsedMb: number;
  };
  stats?: {
    auditLogsStored: number;
  };
}

export const DemoPlatformActivityCard: React.FC<RealPlatformActivityCardProps> = ({
  diagnostics: propDiagnostics,
}) => {
  const { isRTL } = useLanguage();

  // 100% Real Telemetry from Server / Broker (never initialized with fake numbers)
  const [livePackets, setLivePackets] = useState<number>(() => propDiagnostics?.packetCount ?? 0);
  const [assetsCount, setAssetsCount] = useState<number>(() => propDiagnostics?.assetsCount ?? 0);
  const [latency, setLatency] = useState<number | null>(() =>
    propDiagnostics && typeof propDiagnostics.latencyMs === 'number' && propDiagnostics.latencyMs > 0
      ? propDiagnostics.latencyMs
      : null
  );
  const [ticksCount, setTicksCount] = useState<number>(() => propDiagnostics?.ticksCount ?? 0);
  const [candlesCount, setCandlesCount] = useState<number>(() => propDiagnostics?.candlesCount ?? 0);
  const [wsState, setWsState] = useState<string>(() => propDiagnostics?.subsystems?.websocket || 'disconnected');
  const [authState, setAuthState] = useState<string>(() => propDiagnostics?.subsystems?.auth || 'none');
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);

  const [health, setHealth] = useState<TelemetryHealth | null>(null);
  const [topRealAssets, setTopRealAssets] = useState<AssetInfo[]>([]);
  const [realLogs, setRealLogs] = useState<SystemAuditLog[]>([]);

  useEffect(() => {
    let isMounted = true;

    const fetchRealTelemetry = async () => {
      try {
        const [statusRes, healthRes, assetsRes, logsRes] = await Promise.all([
          fetch('/api/status').catch(() => null),
          fetch('/api/telemetry/health').catch(() => null),
          fetch('/api/assets').catch(() => null),
          fetch('/api/telemetry/logs').catch(() => null),
        ]);

        if (!isMounted) return;

        if (statusRes && statusRes.ok) {
          const data = await statusRes.json();
          if (data.diagnostics) {
            const diag = data.diagnostics;
            setLivePackets(typeof diag.packetCount === 'number' ? diag.packetCount : 0);
            setAssetsCount(typeof diag.assetsCount === 'number' ? diag.assetsCount : 0);
            setTicksCount(typeof diag.ticksCount === 'number' ? diag.ticksCount : 0);
            setCandlesCount(typeof diag.candlesCount === 'number' ? diag.candlesCount : 0);
            setLatency(typeof diag.latencyMs === 'number' && diag.latencyMs > 0 ? diag.latencyMs : null);
            setWsState(diag.subsystems?.websocket || 'disconnected');
            setAuthState(diag.subsystems?.auth || 'none');
            setLastSyncTime(Date.now());
          }
        }

        if (healthRes && healthRes.ok) {
          const hData = await healthRes.json();
          setHealth(hData);
        }

        if (assetsRes && assetsRes.ok) {
          const assetsList = await assetsRes.json();
          if (Array.isArray(assetsList)) {
            const sorted = [...assetsList]
              .filter((a: AssetInfo) => a && a.active && typeof a.payout === 'number' && a.payout > 0)
              .sort((a, b) => b.payout - a.payout)
              .slice(0, 3);
            setTopRealAssets(sorted);
            if (sorted.length > 0) {
              setAssetsCount((prev) => (prev > 0 ? prev : assetsList.length));
            }
          }
        }

        if (logsRes && logsRes.ok) {
          const logsList = await logsRes.json();
          if (Array.isArray(logsList)) {
            setRealLogs(logsList.slice(0, 4));
          }
        }
      } catch {
        // Keep authentic empty/last known server state on network hiccup
      }
    };

    fetchRealTelemetry();
    const interval = setInterval(fetchRealTelemetry, 5000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Sync directly from parent diagnostics prop if updated via SSE
  useEffect(() => {
    if (propDiagnostics) {
      setLivePackets(propDiagnostics.packetCount ?? 0);
      setAssetsCount(propDiagnostics.assetsCount ?? 0);
      setTicksCount(propDiagnostics.ticksCount ?? 0);
      setCandlesCount(propDiagnostics.candlesCount ?? 0);
      if (typeof propDiagnostics.latencyMs === 'number' && propDiagnostics.latencyMs > 0) {
        setLatency(propDiagnostics.latencyMs);
      }
      setWsState(propDiagnostics.subsystems?.websocket || 'disconnected');
      setAuthState(propDiagnostics.subsystems?.auth || 'none');
    }
  }, [propDiagnostics]);

  const isBrokerLive = wsState === 'connected' && authState === 'success';
  const uptimeMinutes = health ? Math.floor(health.uptimeSeconds / 60) : null;

  return (
    <div
      id="real-platform-activity-card"
      className={`rounded-2xl border border-emerald-500/25 bg-gradient-to-b from-slate-900/95 via-slate-950 to-slate-900/95 p-5 sm:p-6 shadow-2xl backdrop-blur-md relative overflow-hidden anti-jitter select-none ${isRTL ? 'text-right' : 'text-left'}`}
      style={{ transform: 'translateZ(0)', backfaceVisibility: 'hidden' }}
    >
      {/* Background Subtle Ambient Glow */}
      <div className="absolute top-0 right-1/4 w-60 h-28 bg-emerald-500/10 blur-[80px] pointer-events-none rounded-full" />
      <div className="absolute -bottom-10 left-10 w-48 h-24 bg-sky-500/10 blur-[70px] pointer-events-none rounded-full" />

      {/* 1. Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800/80 relative z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Radio className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm sm:text-base text-slate-100 tracking-tight">
                {isRTL ? 'نشاط محرك المنصة اللحظي' : 'Live Platform Engine Telemetry'}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                بيانات حقيقية 100% • Real Live Data
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              {isRTL
                ? 'قراءة مباشرة من خادم المنصة وقناة WebSocket للوسيط بدون أي أرقام تقديرية'
                : 'Direct readouts from platform server & broker WebSocket without estimated numbers'}
            </p>
          </div>
        </div>

        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-950/80 border text-[10px] font-mono tabular-nums ${
            isBrokerLive
              ? 'border-emerald-500/30 text-emerald-400'
              : 'border-slate-700 text-slate-400'
          }`}
        >
          <CheckCircle2 className={`w-3.5 h-3.5 ${isBrokerLive ? 'text-emerald-400' : 'text-slate-500'}`} />
          <span>
            {isBrokerLive
              ? 'بث فوري مباشر • WebSocket Live'
              : wsState === 'connected'
              ? 'متصل — بانتظار التوثيق'
              : 'بانتظار ربط جلسة الوسيط'}
          </span>
        </div>
      </div>

      {/* 2. Primary Metric: Live Server Telemetry Readout */}
      <div className="my-5 p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
            <Server className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{isRTL ? 'الحزم والمؤشرات المعالجة فعلياً على الخادم' : 'Real Packets & Stream State on Server'}</span>
          </div>

          <div className="flex flex-wrap items-baseline gap-2.5">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3 items-center justify-center">
                <span
                  className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                    isBrokerLive ? 'bg-emerald-500 shadow-sm shadow-emerald-400/50' : 'bg-amber-400'
                  }`}
                />
              </span>
              <span
                className="text-3xl sm:text-4xl font-black font-mono tabular-nums text-emerald-400 tracking-tight inline-block min-w-[3.5rem]"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {livePackets.toLocaleString()}
              </span>
            </div>
            <span className="text-sm font-bold text-slate-200">
              {isRTL ? 'حزمة بيانات حقيقية مستلمة' : 'real packets received'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-0.5 text-[10px] text-slate-400 font-mono tabular-nums">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-emerald-300 bg-emerald-500/10 border border-emerald-500/20">
              {isRTL ? `النبضات (Ticks): ${ticksCount}` : `Ticks: ${ticksCount}`}
            </span>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-sky-300 bg-sky-500/10 border border-sky-500/20">
              {isRTL ? `الشموع المغلقة: ${candlesCount}` : `Closed Candles: ${candlesCount}`}
            </span>
            <span>
              • {isRTL ? `الأصول المتاحة: ${assetsCount}` : `Catalog Assets: ${assetsCount}`}
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:items-end justify-center gap-1 border-t sm:border-t-0 sm:border-r border-slate-800 sm:pr-4 pt-2 sm:pt-0">
          <span className="px-2.5 py-1 rounded-md text-[10px] font-bold font-mono tabular-nums bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 inline-flex items-center gap-1">
            <Activity className="w-3 h-3 text-emerald-400" />
            {health ? `SSE Clients: ${health.activeSockets}` : 'Checking Server...'}
          </span>
          <span className="text-[10px] text-slate-400 font-mono tabular-nums">
            {isRTL ? 'زمن الاستجابة' : 'Latency'}: {latency !== null ? `${latency}ms` : '—'}
            {uptimeMinutes !== null ? ` • Uptime ${uptimeMinutes}m` : ''}
          </span>
          <span className="text-[10px] text-slate-500 font-mono tabular-nums">
            {lastSyncTime
              ? `${isRTL ? 'آخر تحديث:' : 'Synced:'} ${new Date(lastSyncTime).toLocaleTimeString([], { hour12: false })}`
              : isRTL ? 'بانتظار الاستجابة' : 'Connecting'}
          </span>
        </div>
      </div>

      {/* 3. Real Broker Assets & Payouts */}
      <div className="my-5 space-y-3 relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold text-slate-200">
              {isRTL ? 'عوائد وأصول الوسيط الحقيقية الأعلى عائداً' : 'Top Live Broker Assets by Real Payout'}
            </span>
          </div>
          <span className="px-2 py-0.5 rounded text-[10px] font-mono tabular-nums font-bold bg-slate-800 text-emerald-300 border border-emerald-500/30">
            أرقام حقيقية / Real Market Figures
          </span>
        </div>

        {topRealAssets.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {topRealAssets.map((asset) => (
              <div
                key={asset.asset}
                className="p-3.5 rounded-xl bg-slate-950/80 border border-emerald-500/20 hover:border-emerald-500/40 transition-colors flex flex-col justify-between"
              >
                <div className="flex items-center justify-between text-[11px] text-slate-300 mb-1">
                  <span className="font-bold truncate">{asset.label || asset.asset}</span>
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-mono tabular-nums font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    REAL / حقيقي
                  </span>
                </div>
                <div className="flex items-baseline justify-between my-1">
                  <span className="text-2xl font-black font-mono tabular-nums text-emerald-400">
                    +{asset.payout}%
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {isRTL ? 'نسبة العائد' : 'Payout'}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 font-mono tabular-nums flex items-center justify-between pt-1 border-t border-slate-900">
                  <span>{asset.is_otc ? 'OTC Feed' : asset.type || 'Market'}</span>
                  <span>{asset.digits} {isRTL ? 'أرقام عشرية' : 'digits'}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-center text-xs text-slate-400">
            {isRTL
              ? 'تظهر الأصول ونسب العوائد الفعلية فور اتصال جلسة Pocket Option وتحميل كتالوج السوق الحقيقي.'
              : 'Live assets and real payout rates appear once the Pocket Option session is connected.'}
          </div>
        )}
      </div>

      {/* 4. Real Platform Activity Feed (نشاط حقيقي — Real Activity) */}
      <div className="my-5 space-y-2.5 relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold text-slate-200">
              {isRTL ? 'سجل نشاط النظام الحقيقي المباشر' : 'Real Server Audit Activity'}
            </span>
          </div>
          <span className="text-[10px] text-emerald-400/90 font-mono flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            {isRTL ? 'سجل فعلي' : 'Live Audit'}
          </span>
        </div>

        <div className="space-y-2">
          {realLogs.length > 0 ? (
            realLogs.map((log) => (
              <div
                key={log.id}
                className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-200 truncate">
                      {log.message}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono truncate">
                      {log.category} • {new Date(log.timestamp).toLocaleTimeString([], { hour12: false })}
                    </div>
                  </div>
                </div>

                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shrink-0">
                  نشاط حقيقي — Real Activity
                </span>
              </div>
            ))
          ) : (
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between gap-3 text-xs">
              <span className="text-slate-400">
                {isRTL ? 'بانتظار استلام أحداث التدقيق من الخادم...' : 'Awaiting server audit events...'}
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shrink-0">
                نشاط حقيقي — Real Activity
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 5. Authoritative Truth & Integrity Guarantee */}
      <div className="mt-4 pt-3.5 border-t border-slate-800/80 flex items-start gap-2.5 text-[11px] text-slate-300 relative z-10">
        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong className="text-emerald-400 font-semibold">تأكيد الشفافية ومصداقية البيانات:</strong>{' '}
          جميع الإحصائيات والأرقام وأنشطة النظام المعروضة في هذا القسم مستمدة 100% من محرك المنصة الفعلي،
          وبروتوكول الاتصال بالوسيط (WebSocket)، وحسابات المؤشرات الرياضية الحقيقية.{' '}
          <strong className="text-slate-100">لا توجد أي بيانات وهمية أو أرقام محاكاة زائفة</strong> على الإطلاق.
        </p>
      </div>
    </div>
  );
};
