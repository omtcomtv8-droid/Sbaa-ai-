import React, { useState, useRef } from 'react';
import {
  Eye,
  Upload,
  Image as ImageIcon,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  RefreshCw,
  FileText,
  Sliders,
  TrendingUp,
  Target,
  Send,
} from 'lucide-react';
import { VisionAnalysisResult } from '../types';
import { useLanguage } from '../i18n/LanguageContext';

interface VisionAnalysisViewProps {
  currentSymbol?: string;
  currentPrice?: number;
  onApplySetup?: (setup: any) => void;
  onUseSetupInTicket?: (setup: {
    symbol?: string;
    side: 'BUY' | 'SELL';
    entryPrice: number;
    stopLoss: number;
    takeProfit: number;
  }) => void;
}

export const VisionAnalysisView: React.FC<VisionAnalysisViewProps> = ({ onUseSetupInTicket, onApplySetup, currentSymbol, currentPrice }) => {
  const { t, tTerm, isRTL } = useLanguage();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>('image/png');
  const [analysisDepth, setAnalysisDepth] = useState<'SMC' | 'CLASSIC' | 'LIQUIDITY'>('SMC');
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [result, setResult] = useState<VisionAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sample chart base64 preview (SVG candlestick canvas data URL)
  const loadSampleChart = () => {
    // Generate clean SVG chart canvas as data URL
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="350" viewBox="0 0 600 350" style="background:#090d16">
      <rect width="600" height="350" fill="#090d16"/>
      <line x1="50" y1="50" x2="550" y2="50" stroke="#1e293b" stroke-dasharray="3,3"/>
      <line x1="50" y1="120" x2="550" y2="120" stroke="#1e293b" stroke-dasharray="3,3"/>
      <line x1="50" y1="190" x2="550" y2="190" stroke="#1e293b" stroke-dasharray="3,3"/>
      <line x1="50" y1="260" x2="550" y2="260" stroke="#1e293b" stroke-dasharray="3,3"/>
      <!-- Bullish Order Block Zone -->
      <rect x="180" y="220" width="220" height="40" fill="rgba(16, 185, 129, 0.15)" stroke="#10b981" stroke-width="1" stroke-dasharray="4,2"/>
      <text x="190" y="245" fill="#34d399" font-family="sans-serif" font-size="11" font-weight="bold">Bullish Order Block (1.0820 - 1.0835)</text>
      <!-- Candles -->
      <line x1="80" y1="90" x2="80" y2="180" stroke="#ef4444" stroke-width="1.5"/>
      <rect x="74" y="110" width="12" height="50" fill="#ef4444"/>
      <line x1="120" y1="130" x2="120" y2="230" stroke="#ef4444" stroke-width="1.5"/>
      <rect x="114" y="150" width="12" height="60" fill="#ef4444"/>
      <line x1="160" y1="190" x2="160" y2="260" stroke="#ef4444" stroke-width="1.5"/>
      <rect x="154" y="210" width="12" height="45" fill="#ef4444"/>
      <!-- Sweep and Reversal -->
      <line x1="200" y1="210" x2="200" y2="270" stroke="#10b981" stroke-width="1.5"/>
      <rect x="194" y="225" width="12" height="35" fill="#10b981"/>
      <line x1="240" y1="180" x2="240" y2="240" stroke="#10b981" stroke-width="1.5"/>
      <rect x="234" y="190" width="12" height="40" fill="#10b981"/>
      <!-- Break of Structure BOS -->
      <line x1="280" y1="140" x2="280" y2="210" stroke="#10b981" stroke-width="1.5"/>
      <rect x="274" y="150" width="12" height="50" fill="#10b981"/>
      <line x1="200" y1="150" x2="450" y2="150" stroke="#38bdf8" stroke-width="1.5" stroke-dasharray="4,4"/>
      <text x="320" y="142" fill="#38bdf8" font-family="sans-serif" font-size="10" font-weight="bold">BOS (Break of Structure)</text>
      <!-- Target & FVG -->
      <line x1="330" y1="100" x2="330" y2="160" stroke="#10b981" stroke-width="1.5"/>
      <rect x="324" y="110" width="12" height="40" fill="#10b981"/>
      <text x="40" y="320" fill="#94a3b8" font-family="sans-serif" font-size="12">EUR/USD 1H • SABAA Multi-Structure Sample</text>
    </svg>`;
    const base64 = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
    setSelectedImage(base64);
    setMimeType('image/svg+xml');
    setError(null);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('يرجى اختيار ملف صورة صالح (PNG, JPG, WEBP).');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setError('حجم الصورة كبير جداً. الحد الأقصى المسموح هو 15 ميغابايت.');
      return;
    }

    setMimeType(file.type);
    setError(null);

    const reader = new FileReader();
    reader.onload = () => {
      setSelectedImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('يرجى سحب ملف صورة صالح.');
      return;
    }
    setMimeType(file.type);
    setError(null);

    const reader = new FileReader();
    reader.onload = () => {
      setSelectedImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const runVisionAnalysis = async () => {
    if (!selectedImage) {
      setError('يرجى تحميل صورة الشارت أولاً أو استخدام النموذج التجريبي.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const prompt = `Focus: ${analysisDepth} analysis. ${customPrompt}`;
      const res = await fetch('/api/vision/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: selectedImage,
          mimeType,
          prompt,
        }),
      });

      if (!res.ok) {
        throw new Error(`Server returned status: ${res.status}`);
      }

      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      console.error('Vision analysis error:', err);
      setError('تعذر استكمال تحليل الرؤية الحاسوبية. تأكد من اتصال الخادم وإعداد مفتاح Gemini API.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div id="vision-analysis-view" className={`space-y-6 max-w-6xl mx-auto ${isRTL ? 'text-right' : 'text-left'}`}>
      {/* Header Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/30 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
            <Eye className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <span>محرك الرؤية الحاسوبية للشارتات</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono font-bold">
                GEMINI 3.8 VISION
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              ارفع أي لقطة شاشة لشارت التداول لاستخراج نماذج السيولة، كتل الأوامر، ومستويات الدخول والوقف بدقة عالية.
            </p>
          </div>
        </div>

        <button
          onClick={loadSampleChart}
          className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-colors flex items-center gap-2 shrink-0 cursor-pointer"
        >
          <ImageIcon className="w-3.5 h-3.5 text-sky-400" />
          <span>تحميل نموذج شارت تجريبي (SMC)</span>
        </button>
      </div>

      {/* Main Grid: Upload & Controls | Preview & Results */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Upload Box and Options */}
        <div className="lg:col-span-5 space-y-4">
          {/* Upload Dropzone */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[200px] ${
              selectedImage
                ? 'border-amber-500/40 bg-slate-900/40'
                : 'border-slate-800 hover:border-amber-500/30 bg-slate-900/20 hover:bg-slate-900/40'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept="image/*"
              className="hidden"
            />
            <div className="w-12 h-12 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400 mb-3">
              <Upload className="w-6 h-6 text-amber-400" />
            </div>
            <div className="text-xs font-bold text-slate-200">
              اسحب وأفلت لقطة شاشة الشارت هنا، أو اضغط للتصفح
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              يدعم ملفات PNG، JPG، WEBP حتى 15 ميغابايت
            </div>
          </div>

          {/* Analysis Options */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
            <label className="text-xs font-bold text-slate-300 block">
              منهجية الفحص البصري المطلوبة:
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setAnalysisDepth('SMC')}
                className={`py-2 px-2.5 rounded-lg text-xs font-bold transition-all border ${
                  analysisDepth === 'SMC'
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                سيولة SMC / ICT
              </button>
              <button
                type="button"
                onClick={() => setAnalysisDepth('CLASSIC')}
                className={`py-2 px-2.5 rounded-lg text-xs font-bold transition-all border ${
                  analysisDepth === 'CLASSIC'
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                نماذج كلاسيكية
              </button>
              <button
                type="button"
                onClick={() => setAnalysisDepth('LIQUIDITY')}
                className={`py-2 px-2.5 rounded-lg text-xs font-bold transition-all border ${
                  analysisDepth === 'LIQUIDITY'
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                دعوم ومقاومات
              </button>
            </div>

            <div className="space-y-1 pt-1">
              <label className="text-[11px] font-medium text-slate-400">
                ملاحظات مخصصة لمحرك الرؤية (اختياري):
              </label>
              <input
                type="text"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="مثال: ركز على القمة الأخيرة وفجوة FVG على فريم 15 دقيقة..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500/50"
              />
            </div>

            <button
              onClick={runVisionAnalysis}
              disabled={!selectedImage || isLoading}
              className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>جارٍ الفحص البصري بالذكاء الاصطناعي...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>بدء تحليل الشارت بالرؤية الحاسوبية</span>
                </>
              )}
            </button>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Active Image Thumbnail */}
          {selectedImage && (
            <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800 space-y-2">
              <div className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
                <span>معاينة الشارت المختار</span>
                <span className="text-amber-400 font-mono text-[10px]">جاهز للتحليل</span>
              </div>
              <div className="rounded-lg overflow-hidden border border-slate-800 max-h-56 bg-slate-950 flex items-center justify-center">
                <img
                  src={selectedImage}
                  alt="Chart preview"
                  className="max-h-56 w-auto object-contain"
                />
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Detailed Vision Analysis Results */}
        <div className="lg:col-span-7 space-y-4">
          {!result && !isLoading && (
            <div className="p-12 rounded-2xl border border-slate-800 bg-slate-900/30 text-center space-y-4 flex flex-col items-center justify-center min-h-[420px]">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Eye className="w-8 h-8" />
              </div>
              <div className="space-y-1 max-w-sm">
                <h3 className="text-sm font-bold text-slate-200">بانتظار فحص الشارت</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  ارفع صورة الشارت واضغط على &quot;بدء تحليل الشارت بالرؤية الحاسوبية&quot; لاستعراض القراءة الفنية المؤسسية وإعدادات الدخول المقترحة.
                </p>
              </div>
            </div>
          )}

          {isLoading && (
            <div className="p-12 rounded-2xl border border-slate-800 bg-slate-900/40 text-center space-y-4 flex flex-col items-center justify-center min-h-[420px]">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 animate-pulse">
                <RefreshCw className="w-7 h-7 animate-spin" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-amber-300">جارٍ معالجة لقطة الشارت عبر Gemini Vision</h3>
                <p className="text-xs text-slate-400">
                  يتم استخراج خطوط الاتجاه، وتحديد كتل الأوامر (Order Blocks)، وفحص فجوات القيمة العادلة (FVG)...
                </p>
              </div>
            </div>
          )}

          {result && !isLoading && (
            <div className="space-y-4 animate-in fade-in duration-300">
              {/* Primary Bias Banner */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-lg ${
                      result.trend === 'BULLISH'
                        ? 'bg-emerald-500 text-slate-950 shadow-emerald-500/20'
                        : result.trend === 'BEARISH'
                        ? 'bg-rose-500 text-slate-950 shadow-rose-500/20'
                        : 'bg-amber-500 text-slate-950 shadow-amber-500/20'
                    }`}
                  >
                    {result.trend === 'BULLISH' ? (
                      <ArrowUpRight className="w-7 h-7 stroke-[2.5]" />
                    ) : result.trend === 'BEARISH' ? (
                      <ArrowDownRight className="w-7 h-7 stroke-[2.5]" />
                    ) : (
                      <TrendingUp className="w-6 h-6" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-black text-slate-100 font-mono">
                        الاتجاه المرصود: {result.trend === 'BULLISH' ? 'صاعد (BULLISH)' : result.trend === 'BEARISH' ? 'هابط (BEARISH)' : 'محايد / تذبذب'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      درجة موثوقية القراءة البصرية: <strong className="text-amber-400 font-mono">{result.confidence}%</strong>
                    </p>
                  </div>
                </div>

                <div className="text-left font-mono text-xs text-slate-400">
                  <div>ID: {result.id}</div>
                  <div className="text-[10px] text-slate-500">{new Date(result.timestamp).toLocaleTimeString()}</div>
                </div>
              </div>

              {/* Detected Patterns */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
                  <span>النماذج البصرية وكسور الهيكل المكتشفة:</span>
                </div>
                <div className="space-y-1.5">
                  {result.patterns.map((p, i) => (
                    <div key={i} className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 text-xs text-slate-300 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                      <span>{p}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Order Blocks & FVGs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                  <div className="text-xs font-bold text-sky-400 flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5" />
                    <span>كتل الأوامر المؤسسية (Order Blocks):</span>
                  </div>
                  {result.orderBlocks.length > 0 ? (
                    result.orderBlocks.map((ob, idx) => (
                      <div key={idx} className="p-2 rounded bg-slate-950 text-xs text-slate-300 border border-slate-800">
                        {ob.zone}
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-slate-500 italic">لم تُرصد كتل أوامر بارزة في النطاق المعروض.</div>
                  )}
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                  <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5" />
                    <span>فجوات القيمة العادلة (FVG):</span>
                  </div>
                  {result.fairValueGaps && result.fairValueGaps.length > 0 ? (
                    result.fairValueGaps.map((fvg, idx) => (
                      <div key={idx} className="p-2 rounded bg-slate-950 text-xs text-slate-300 border border-slate-800">
                        {fvg}
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-slate-500 italic">لا توجد اختلالات سعرية مفتوحة.</div>
                  )}
                </div>
              </div>

              {/* Suggested Setup Card */}
              {result.suggestedSetup && (
                <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/10 via-slate-900 to-amber-500/10 border border-amber-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      <Target className="w-4 h-4 text-amber-400" />
                      <span>إعداد التداول الاستئناسي المقترح (يدوي فقط):</span>
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      R:R = 1:{result.suggestedSetup.rrRatio}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono text-center">
                    <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block font-sans">الاتجاه</span>
                      <span className={`font-black ${result.suggestedSetup.direction === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {result.suggestedSetup.direction === 'BUY' ? 'BUY (شراء)' : 'SELL (بيع)'}
                      </span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block font-sans">سعر الدخول</span>
                      <span className="font-bold text-slate-200">{result.suggestedSetup.entry}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block font-sans">وقف الخسارة (SL)</span>
                      <span className="font-bold text-rose-400">{result.suggestedSetup.stopLoss}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block font-sans">أخذ الربح (TP)</span>
                      <span className="font-bold text-emerald-400">{result.suggestedSetup.takeProfit}</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 font-sans leading-relaxed">
                    {result.suggestedSetup.rationale}
                  </p>

                  {onUseSetupInTicket && (
                    <button
                      onClick={() =>
                        onUseSetupInTicket({
                          side: result.suggestedSetup!.direction,
                          entryPrice: result.suggestedSetup!.entry,
                          stopLoss: result.suggestedSetup!.stopLoss,
                          takeProfit: result.suggestedSetup!.takeProfit,
                        })
                      }
                      className="w-full py-2 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>عرض الرسم البياني المباشر والتحليل &larr;</span>
                    </button>
                  )}
                </div>
              )}

              {/* Full Technical Commentary */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-sky-400" />
                  <span>التقرير الفني الشامل:</span>
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
                  {result.fullReport}
                </p>
              </div>

              {/* Strict Notice */}
              <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/80 text-[11px] text-slate-400 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>إخلاء مسؤولية: نتائج الرؤية الحاسوبية استئناسية وفنية لمساعدتك على اتخاذ القرار اليدوي. لا يوجد أي تنفيذ آلي للصفقات.</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
