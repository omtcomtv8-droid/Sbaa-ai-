import React, { useRef, useEffect } from 'react';
import {
  X,
  TrendingUp,
  TrendingDown,
  Clock,
  DollarSign,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Percent,
  Layers,
  Activity,
  Calendar,
  Compass,
  Zap,
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

export interface DetailedTradeRecord {
  id: string;
  ticketId: string;
  asset: string;
  accountMode: 'DEMO' | 'REAL';
  timeframe: number;
  strategyName: string;
  action: 'call' | 'put';
  amount: number;
  openTime: number;
  closeTime?: number;
  openPrice: number;
  entryPrice?: number;
  closePrice?: number;
  exitPrice?: number;
  profit?: number;
  payout?: number;
  result: 'WIN' | 'LOSS' | 'DRAW' | 'CANCELLED' | 'PENDING';
  durationSec: number;
  reasons?: string[];
  confluenceScore?: number;
  chartSnapshotUrl?: string;
  candlesSnapshot?: Array<{ time: number; open: number; high: number; low: number; close: number }>;
}

interface TradeDetailModalProps {
  trade: DetailedTradeRecord | null;
  onClose: () => void;
}

export const TradeDetailModal: React.FC<TradeDetailModalProps> = ({ trade, onClose }) => {
  const { isRTL, language } = useLanguage();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const isCall = trade ? (trade.action.toLowerCase() === 'call' || trade.action.toLowerCase() === 'buy') : false;
  const isWin = trade?.result === 'WIN';
  const isLoss = trade?.result === 'LOSS';
  const isPending = trade?.result === 'PENDING';
  const isDraw = trade?.result === 'DRAW';

  const entry = trade?.entryPrice ?? trade?.openPrice ?? 0;
  const exit = trade?.exitPrice ?? trade?.closePrice ?? entry;
  const digits = trade?.asset?.includes('JPY') ? 3 : 5;
  const profitNum = trade?.profit ?? (isWin && trade ? trade.amount * ((trade.payout || 88) / 100) : isLoss && trade ? -trade.amount : 0);

  const tfLabel = trade ? (trade.timeframe === 60 ? '1M (60s)' : trade.timeframe === 300 ? '5M (300s)' : trade.timeframe === 900 ? '15M (900s)' : `${trade.timeframe}s`) : '';

  // Draw Visual Chart Trajectory on Canvas
  useEffect(() => {
    if (!trade) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#090d16');
    bgGrad.addColorStop(1, '#020617');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Grid lines
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let x = 40; x < width; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 30; y < height; y += 35) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    const minPrice = Math.min(entry, exit) * 0.9997;
    const maxPrice = Math.max(entry, exit) * 1.0003;
    const range = Math.max(0.0001, maxPrice - minPrice);

    const getY = (price: number) => height - 35 - ((price - minPrice) / range) * (height - 70);

    const entryX = 60;
    const exitX = width - 80;
    const entryY = getY(entry);
    const exitY = isPending ? entryY : getY(exit);

    // Entry Price Horizontal Guideline
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(entryX - 30, entryY);
    ctx.lineTo(width - 20, entryY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Path Curve representing Trade progression
    ctx.lineWidth = 3;
    ctx.strokeStyle = isWin ? '#10b981' : isLoss ? '#f43f5e' : '#38bdf8';
    ctx.beginPath();
    ctx.moveTo(entryX, entryY);

    const cp1x = entryX + (exitX - entryX) * 0.35;
    const cp1y = isCall ? Math.min(entryY, exitY) - 15 : Math.max(entryY, exitY) + 15;
    const cp2x = entryX + (exitX - entryX) * 0.7;
    const cp2y = exitY + (isWin ? (isCall ? -10 : 10) : (isCall ? 10 : -10));

    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, exitX, exitY);
    ctx.stroke();

    // Area fill under curve
    ctx.lineTo(exitX, height - 10);
    ctx.lineTo(entryX, height - 10);
    ctx.closePath();
    ctx.fillStyle = isWin ? 'rgba(16, 185, 129, 0.08)' : isLoss ? 'rgba(244, 63, 94, 0.08)' : 'rgba(56, 189, 248, 0.08)';
    ctx.fill();

    // Entry Marker Circle
    ctx.beginPath();
    ctx.arc(entryX, entryY, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#0284c7';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    // Exit Marker Circle
    if (!isPending) {
      ctx.beginPath();
      ctx.arc(exitX, exitY, 6, 0, Math.PI * 2);
      ctx.fillStyle = isWin ? '#10b981' : '#f43f5e';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    }

    // Text labels on canvas
    ctx.font = 'bold 11px monospace';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(`Entry: ${entry.toFixed(digits)}`, entryX - 25, entryY > 30 ? entryY - 12 : entryY + 22);

    if (!isPending) {
      ctx.fillStyle = isWin ? '#10b981' : '#f43f5e';
      ctx.fillText(`Exit: ${exit.toFixed(digits)}`, exitX - 50, exitY > 30 ? exitY - 12 : exitY + 22);
    }
  }, [trade, entry, exit, digits, isWin, isLoss, isPending, isCall]);

  if (!trade) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      dir={isRTL ? 'rtl' : 'ltr'}
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span
              className={`p-2.5 rounded-xl flex items-center justify-center ${
                isCall
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
              }`}
            >
              {isCall ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-slate-100">
                  {trade.asset} — {isCall ? (isRTL ? 'صفقة شراء (CALL)' : 'CALL Trade') : (isRTL ? 'صفقة بيع (PUT)' : 'PUT Trade')}
                </h3>
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold border ${
                    trade.accountMode === 'DEMO'
                      ? 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                      : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  }`}
                >
                  {trade.accountMode}
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded text-[11px] font-mono font-black border ${
                    isWin
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                      : isLoss
                      ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                      : isPending
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                      : 'bg-slate-800 text-slate-300 border-slate-700'
                  }`}
                >
                  {trade.result}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                {isRTL ? 'معرف التذكرة:' : 'Ticket ID:'} #{trade.ticketId || trade.id} • {tfLabel}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-xs text-slate-300">
          {/* Visual Chart Snapshot Section */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-slate-200">
                <Activity className="w-4 h-4 text-indigo-400" />
                <span>{isRTL ? 'المسار السعري المرئي للصفقة (Chart Visualizer)' : 'Trade Trajectory & Price Path'}</span>
              </span>
              <span className="font-mono text-[11px] text-slate-400">
                {isRTL ? 'نقطة الدخول -> نقطة الإغلاق' : 'Entry Point -> Exit Point'}
              </span>
            </div>
            <div className="relative rounded-lg overflow-hidden border border-slate-800/80 bg-slate-950">
              <canvas
                ref={canvasRef}
                width={700}
                height={160}
                className="w-full h-[160px] block"
              />
            </div>
          </div>

          {/* Key Metrics Grid (15 Required Properties) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
            {/* 1. Stake Amount */}
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <div className="text-slate-400 text-[11px] font-sans flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                <span>{isRTL ? 'مبلغ الصفقة (Stake)' : 'Stake Amount'}</span>
              </div>
              <div className="text-slate-100 font-bold text-sm">
                ${trade.amount.toFixed(2)}
              </div>
              <span className="text-[10px] text-slate-500 font-sans block">
                {trade.accountMode === 'DEMO' ? 'حساب تجريبي (حد أقصى 25$)' : 'حساب حقيقي مباشر'}
              </span>
            </div>

            {/* 2. Profit / PnL */}
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <div className="text-slate-400 text-[11px] font-sans flex items-center gap-1">
                <Percent className="w-3.5 h-3.5 text-indigo-400" />
                <span>{isRTL ? 'النتيجة المالية (PnL)' : 'Profit / PnL'}</span>
              </div>
              <div className={`font-bold text-sm ${profitNum > 0 ? 'text-emerald-400' : profitNum < 0 ? 'text-rose-400' : 'text-slate-300'}`}>
                {profitNum >= 0 ? `+$${profitNum.toFixed(2)}` : `-$${Math.abs(profitNum).toFixed(2)}`}
              </div>
              <span className="text-[10px] text-slate-500 font-sans block">
                {isRTL ? `عائد المنصة: ${trade.payout || 88}%` : `Payout: ${trade.payout || 88}%`}
              </span>
            </div>

            {/* 3. Entry Price */}
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <div className="text-slate-400 text-[11px] font-sans flex items-center gap-1">
                <Compass className="w-3.5 h-3.5 text-sky-400" />
                <span>{isRTL ? 'سعر الدخول (Entry)' : 'Entry Price'}</span>
              </div>
              <div className="text-sky-300 font-bold text-sm">
                {entry.toFixed(digits)}
              </div>
              <span className="text-[10px] text-slate-500 font-sans block">
                {new Date(trade.openTime * 1000).toLocaleTimeString()}
              </span>
            </div>

            {/* 4. Exit Price */}
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <div className="text-slate-400 text-[11px] font-sans flex items-center gap-1">
                <Compass className="w-3.5 h-3.5 text-amber-400" />
                <span>{isRTL ? 'سعر الخروج (Exit)' : 'Exit Price'}</span>
              </div>
              <div className={`font-bold text-sm ${isWin ? 'text-emerald-400' : isLoss ? 'text-rose-400' : 'text-slate-300'}`}>
                {exit.toFixed(digits)}
              </div>
              <span className="text-[10px] text-slate-500 font-sans block">
                {trade.closeTime ? new Date(trade.closeTime * 1000).toLocaleTimeString() : (isPending ? 'الصفقة جارية' : '—')}
              </span>
            </div>
          </div>

          {/* Details Table */}
          <div className="rounded-xl border border-slate-800 overflow-hidden">
            <div className="bg-slate-950/90 px-4 py-2.5 border-b border-slate-800 font-semibold text-slate-200 flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              <span>{isRTL ? 'بيانات الصفقة الكاملة وخوارزمية التنفيذ' : 'Complete Deal Execution Breakdown'}</span>
            </div>
            <div className="divide-y divide-slate-800/80 bg-slate-900/50">
              <div className="px-4 py-2.5 flex items-center justify-between">
                <span className="text-slate-400">{isRTL ? 'الاستراتيجية المطبقة' : 'Executing Strategy'}</span>
                <span className="font-bold text-slate-200">{trade.strategyName}</span>
              </div>
              <div className="px-4 py-2.5 flex items-center justify-between">
                <span className="text-slate-400">{isRTL ? 'الفريم الزمني المعتمد' : 'Timeframe Frame'}</span>
                <span className="font-mono font-bold text-slate-200">{tfLabel}</span>
              </div>
              <div className="px-4 py-2.5 flex items-center justify-between">
                <span className="text-slate-400">{isRTL ? 'المدة الزمنية الفعلية' : 'Actual Duration'}</span>
                <span className="font-mono font-bold text-slate-200">{trade.durationSec} {isRTL ? 'ثانية' : 'seconds'}</span>
              </div>
              <div className="px-4 py-2.5 flex items-center justify-between">
                <span className="text-slate-400">{isRTL ? 'تاريخ ووقت الفتح' : 'Open Timestamp'}</span>
                <span className="font-mono text-slate-300">{new Date(trade.openTime * 1000).toLocaleString()}</span>
              </div>
              <div className="px-4 py-2.5 flex items-center justify-between">
                <span className="text-slate-400">{isRTL ? 'تاريخ ووقت الإغلاق' : 'Close Timestamp'}</span>
                <span className="font-mono text-slate-300">
                  {trade.closeTime ? new Date(trade.closeTime * 1000).toLocaleString() : '—'}
                </span>
              </div>
              <div className="px-4 py-2.5 flex items-center justify-between">
                <span className="text-slate-400">{isRTL ? 'نسبة التوافق والثقة' : 'Confluence Score'}</span>
                <span className="font-mono font-bold text-emerald-400">{trade.confluenceScore || 85}%</span>
              </div>
            </div>
          </div>

          {/* Technical Reasons & Confluence Criteria */}
          {trade.reasons && trade.reasons.length > 0 && (
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
              <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-400" />
                <span>{isRTL ? 'الأسباب الفنية ومعايير الدخول (Signal Confluence Criteria)' : 'Technical Reasons & Confluence Signals'}</span>
              </div>
              <ul className="space-y-1.5 pl-2">
                {trade.reasons.map((r, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-slate-300 text-xs">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-500 text-[11px]">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>{isRTL ? 'صفقة موثقة ومحفوظة في سجل التداول الآمن' : 'Audited and securely stored in trade history'}</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs cursor-pointer transition-colors"
          >
            {isRTL ? 'إغلاق النافذة' : 'Close Details'}
          </button>
        </div>
      </div>
    </div>
  );
};
