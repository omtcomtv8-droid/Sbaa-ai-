import React, { useState } from 'react';
import {
  Brain,
  Sparkles,
  RefreshCw,
  TrendingUp,
  Target,
  ShieldCheck,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  Sliders,
  Layers,
  FileText,
  AlertCircle,
  Send,
} from 'lucide-react';
import { AIAnalysisResult } from '../types';
import { useLanguage } from '../i18n/LanguageContext';

interface AIAnalysisViewProps {
  activeAsset?: string;
  timeframe?: number;
  currentSymbol?: string;
  currentPrice?: number;
  onApplySetup?: (setup: any) => void;
  onUseSetupInTicket?: (setup: {
    symbol?: string;
    side: 'BUY' | 'SELL';
    entryPrice?: number;
    stopLoss?: number;
    takeProfit?: number;
  }) => void;
}

export const AIAnalysisView: React.FC<AIAnalysisViewProps> = ({
  activeAsset,
  timeframe,
  currentSymbol,
  currentPrice,
  onApplySetup,
  onUseSetupInTicket,
}) => {
  const { t, tTerm, isRTL } = useLanguage();
  const [selectedAsset, setSelectedAsset] = useState<string>(activeAsset || currentSymbol || 'EURUSD_otc');
  const [selectedTf, setSelectedTf] = useState<number>(timeframe || 60);
  const [selectedEngine, setSelectedEngine] = useState<string>('SMC / Liquidity Order Blocks');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [result, setResult] = useState<AIAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const engines = [
    { id: 'SMC / Liquidity Order Blocks', label: 'مفاهيم الأموال الذكية (SMC / OB)' },
    { id: 'ICT Silver Bullet & Liquidity', label: 'نموذج سيولة وتوقيت ICT المؤسسي' },
    { id: 'Wyckoff Accumulation & Markup', label: 'دورة تجميع وتصريف وايكوف (Wyckoff)' },
    { id: 'Quantitative Multi-Model Confluence', label: 'التوافق الكمي متعدد المؤشرات' },
  ];

  const assets = [
    { id: 'EURUSD_otc', label: 'EUR / USD (OTC)' },
    { id: 'GBPUSD_otc', label: 'GBP / USD (OTC)' },
    { id: 'USDJPY_otc', label: 'USD / JPY (OTC)' },
    { id: 'AUDUSD_otc', label: 'AUD / USD (OTC)' },
    { id: 'BTCUSD', label: 'Bitcoin (BTC/USD)' },
    { id: 'XAUUSD', label: 'Gold (XAU/USD)' },
  ];

  const runAiAnalysis = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: selectedAsset,
          timeframe: selectedTf,
          engine: selectedEngine,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        if (res.status === 503) {
          setError('خدمة Gemini للذكاء الاصطناعي تشهد ضغطاً مؤقتاً في الطلب (503). محرك التداول المباشر مستمر بالعمل بكامل كفاءته.');
        } else {
          setError(errJson?.error || `تعذر استخراج التحليل (${res.status}). يرجى إعادة المحاولة.`);
        }
        return;
      }

      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      console.warn('AI analysis error:', err);
      setError('تعذر الاتصال بخدمة التحليل الذكي مؤقتاً. تم حفظ الاتصال المباشر بمنصة التداول دون أي انقطاع.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div id="ai-analysis-view" className={`space-y-6 max-w-6xl mx-auto ${isRTL ? 'text-right' : 'text-left'}`}>
      {/* Header Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/20 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 font-black flex items-center justify-center shadow-lg shadow-amber-500/20 shrink-0">
            <Brain className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <span>محرك التحليل المؤسسي الذكي</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-mono font-bold">
                SMC / ICT QUANTUM ENGINE
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              توليد تقارير هيكل السيولة المؤسسية وفحص كتل الأوامر وفجوات القيمة العادلة المعتمدة على نموذج Gemini 3.8 Flash.
            </p>
          </div>
        </div>

        <button
          onClick={runAiAnalysis}
          disabled={isLoading}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-black text-xs shadow-md shadow-amber-500/20 disabled:opacity-50 flex items-center gap-2 shrink-0 cursor-pointer transition-all"
        >
          {isLoading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>جارٍ المعالجة...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>توليد التقرير التحليلي الآن</span>
            </>
          )}
        </button>
      </div>

      {/* Control Configuration Bar */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="text-[11px] font-bold text-slate-400 block mb-1">الأصل المالي المراد تحليله:</label>
          <select
            value={selectedAsset}
            onChange={(e) => setSelectedAsset(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500/50"
          >
            {assets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[11px] font-bold text-slate-400 block mb-1">الإطار الزمني للشموع:</label>
          <select
            value={selectedTf}
            onChange={(e) => setSelectedTf(Number(e.target.value))}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500/50"
          >
            <option value={60}>دقيقة واحدة (M1 - 60s)</option>
            <option value={300}>5 دقائق (M5 - 300s)</option>
            <option value={900}>15 دقيقة (M15 - 900s)</option>
            <option value={3600}>ساعة واحدة (H1 - 3600s)</option>
          </select>
        </div>

        <div>
          <label className="text-[11px] font-bold text-slate-400 block mb-1">النموذج والمنهجية التحليلية:</label>
          <select
            value={selectedEngine}
            onChange={(e) => setSelectedEngine(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500/50"
          >
            {engines.map((eng) => (
              <option key={eng.id} value={eng.id}>
                {eng.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
            <span>{error}</span>
          </div>
          <button
            onClick={runAiAnalysis}
            className="px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 font-bold text-xs shrink-0 flex items-center gap-1 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            <span>إعادة المحاولة الآن</span>
          </button>
        </div>
      )}

      {/* Main Results Display */}
      {!result && !isLoading && (
        <div className="p-16 rounded-2xl border border-slate-800 bg-slate-900/30 text-center space-y-4 flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Sparkles className="w-8 h-8" />
          </div>
          <div className="space-y-1 max-w-md">
            <h3 className="text-sm font-bold text-slate-200">التقرير التحليلي جاهز للتوليد</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              اختر الأصل والمنهجية واضغط على &quot;توليد التقرير التحليلي الآن&quot; للحصول على قراءة دقيقة لهيكل السيولة وكتل الأوامر.
            </p>
          </div>
          <button
            onClick={runAiAnalysis}
            className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md cursor-pointer"
          >
            ابدأ التحليل الآن &larr;
          </button>
        </div>
      )}

      {isLoading && (
        <div className="p-16 rounded-2xl border border-slate-800 bg-slate-900/40 text-center space-y-4 flex flex-col items-center justify-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 animate-pulse">
            <RefreshCw className="w-7 h-7 animate-spin" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-amber-300">جارٍ معالجة البيانات السعرية عبر محرك Gemini 3.8</h3>
            <p className="text-xs text-slate-400">
              يتم استخلاص كتل الأوامر وفجوات القيمة العادلة وتحديد مناطق سحب السيولة...
            </p>
          </div>
        </div>
      )}

      {result && !isLoading && (
        <div className="space-y-4 animate-in fade-in duration-300">
          {/* Bias Bar */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-lg ${
                  result.marketBias.includes('BULLISH')
                    ? 'bg-emerald-500 text-slate-950 shadow-emerald-500/20'
                    : result.marketBias.includes('BEARISH')
                    ? 'bg-rose-500 text-slate-950 shadow-rose-500/20'
                    : 'bg-amber-500 text-slate-950 shadow-amber-500/20'
                }`}
              >
                {result.marketBias.includes('BULLISH') ? (
                  <ArrowUpRight className="w-7 h-7 stroke-[2.5]" />
                ) : result.marketBias.includes('BEARISH') ? (
                  <ArrowDownRight className="w-7 h-7 stroke-[2.5]" />
                ) : (
                  <TrendingUp className="w-6 h-6" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-black text-slate-100 font-mono">
                    الانحياز المؤسسي: {result.marketBias}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
                    Score: {result.score > 0 ? `+${result.score}` : result.score}/10
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  الأصل: <strong className="text-amber-400">{result.symbol}</strong> • الإطار: {result.timeframe} • المنهجية: {result.engine}
                </p>
              </div>
            </div>

            <div className="font-mono text-xs text-slate-400 text-left">
              <div>ID: {result.id}</div>
              <div className="text-[10px] text-slate-500">{new Date(result.timestamp).toLocaleTimeString()}</div>
            </div>
          </div>

          {/* Structure Summary */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
            <div className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" />
              <span>هيكل السوق والكسر المؤسسي (Market Structure):</span>
            </div>
            <p className="text-xs text-slate-200 leading-relaxed font-mono bg-slate-950/60 p-3 rounded-lg border border-slate-800">
              {result.structure}
            </p>
          </div>

          {/* Liquidity Targets & Order Blocks */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2.5">
              <div className="text-xs font-bold text-sky-400 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5" />
                <span>كتل الأوامر المؤسسية (Order Blocks):</span>
              </div>
              {result.orderBlocks.map((ob, idx) => (
                <div key={idx} className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 text-xs text-slate-300">
                  {ob}
                </div>
              ))}
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2.5">
              <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5" />
                <span>مناطق تجمع السيولة (Liquidity Pools):</span>
              </div>
              {result.liquidityZones.map((lz, idx) => (
                <div key={idx} className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 text-xs text-slate-300">
                  {lz}
                </div>
              ))}
            </div>
          </div>

          {/* Fair Value Gaps */}
          {result.fairValueGaps && result.fairValueGaps.length > 0 && (
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
              <div className="text-xs font-bold text-purple-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>فجوات القيمة العادلة المفتوحة (Fair Value Gaps - FVG):</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {result.fairValueGaps.map((fvg, idx) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 text-xs text-slate-300">
                    {fvg}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Trade Recommendation Card */}
          {result.tradeRecommendation && (
            <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/10 via-slate-900 to-amber-500/10 border border-amber-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <span>توصية التمركز الفني الاستئناسية (تنفيذ يدوي فقط):</span>
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  R:R = {result.tradeRecommendation.riskReward}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono text-center">
                <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-sans">الاتجاه</span>
                  <span
                    className={`font-black ${
                      result.tradeRecommendation.direction === 'BUY'
                        ? 'text-emerald-400'
                        : result.tradeRecommendation.direction === 'SELL'
                        ? 'text-rose-400'
                        : 'text-amber-400'
                    }`}
                  >
                    {result.tradeRecommendation.direction === 'BUY'
                      ? 'BUY (شراء)'
                      : result.tradeRecommendation.direction === 'SELL'
                      ? 'SELL (بيع)'
                      : 'WAIT (ترقب)'}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-sans">نطاق الدخول</span>
                  <span className="font-bold text-slate-200">{result.tradeRecommendation.entryZone}</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-sans">وقف الخسارة (SL)</span>
                  <span className="font-bold text-rose-400">{result.tradeRecommendation.stopLoss}</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-sans">الهدف (TP)</span>
                  <span className="font-bold text-emerald-400">{result.tradeRecommendation.target}</span>
                </div>
              </div>

              {onUseSetupInTicket && result.tradeRecommendation.direction !== 'WAIT' && (
                <button
                  onClick={() => {
                    const dir = result.tradeRecommendation!.direction === 'BUY' ? 'BUY' : 'SELL';
                    const slNum = parseFloat(result.tradeRecommendation!.stopLoss);
                    const tpNum = parseFloat(result.tradeRecommendation!.target);
                    onUseSetupInTicket({
                      symbol: result.symbol,
                      side: dir,
                      stopLoss: isNaN(slNum) ? undefined : slNum,
                      takeProfit: isNaN(tpNum) ? undefined : tpNum,
                    });
                  }}
                  className="w-full py-2 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>عرض الرسم البياني المباشر والتحليل &larr;</span>
                </button>
              )}
            </div>
          )}

          {/* Full Commentary */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
            <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-sky-400" />
              <span>التعليق والتحليل الفني المؤسسي:</span>
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
              {result.commentary}
            </p>
          </div>

          <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/80 text-[11px] text-slate-400 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>تنبيه أمان: هذا التحليل مخصص للدعم الفني والقرارات الاسترشادية. جميع الأوامر يجب مراجعتها وتأكيدها يدويًا من قبلك.</span>
          </div>
        </div>
      )}
    </div>
  );
};
