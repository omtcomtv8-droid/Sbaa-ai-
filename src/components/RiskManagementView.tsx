import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  Calculator,
  Percent,
  DollarSign,
  TrendingDown,
  TrendingUp,
  CheckCircle2,
  Lock,
  RefreshCw,
  Flame,
  Layers,
  ArrowRight,
  ShieldAlert,
  Zap,
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

interface RiskManagementViewProps {
  initialBalance?: number | null;
  isDemo?: boolean;
}

export const RiskManagementView: React.FC<RiskManagementViewProps> = ({
  initialBalance,
  isDemo: propIsDemo,
}) => {
  const { t, tTerm, isRTL } = useLanguage();
  const [accountBalance, setAccountBalance] = useState<number>(initialBalance || 1000);
  const [isDemo, setIsDemo] = useState<boolean>(propIsDemo ?? true);
  const [activeStrategyType, setActiveStrategyType] = useState<'fixed' | 'martingale' | 'compound'>('fixed');
  const [payoutPercent, setPayoutPercent] = useState<number>(85); // Pocket Option payout %
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Strategy 1: Fixed Risk
  const [fixedRiskPercent, setFixedRiskPercent] = useState<number>(2.0);

  // Strategy 2: Martingale
  const [martingaleBaseStake, setMartingaleBaseStake] = useState<number>(5);
  const [martingaleMaxSteps, setMartingaleMaxSteps] = useState<number>(4);

  // Strategy 3: Compounding
  const [compoundInitialStake, setCompoundInitialStake] = useState<number>(10);
  const [compoundTargetSteps, setCompoundTargetSteps] = useState<number>(3);

  // Capital Guardian Daily Rules
  const [dailyProfitTargetPercent, setDailyProfitTargetPercent] = useState<number>(10);
  const [dailyMaxDrawdownPercent, setDailyMaxDrawdownPercent] = useState<number>(5);

  // Sync with live Pocket Option balance
  const syncLiveBalance = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const data = await res.json();
        const liveBal = data.diagnostics?.account?.balance;
        const liveIsDemo = data.diagnostics?.account?.isDemo;
        if (typeof liveBal === 'number' && !isNaN(liveBal) && liveBal > 0) {
          setAccountBalance(Number(liveBal.toFixed(2)));
        }
        if (liveIsDemo !== undefined) {
          setIsDemo(Boolean(liveIsDemo));
        }
      }
    } catch (e) {
      console.warn('Could not sync balance', e);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    syncLiveBalance();
  }, []);

  // Calculated Metrics
  const fixedStakeDollars = Number(((accountBalance * fixedRiskPercent) / 100).toFixed(2));
  const fixedProfitOnWin = Number((fixedStakeDollars * (payoutPercent / 100)).toFixed(2));

  // Martingale Calculation
  // Multiplier to recover cumulative loss and secure target profit:
  // At 85% payout: stake * 0.85 > cumulative_losses
  const payoutDec = payoutPercent / 100;
  const martingaleMultiplier = Number(((1 + payoutDec) / payoutDec).toFixed(2)); // ~2.18 for 85%

  const martingaleLadder = [];
  let cumulativeLoss = 0;
  for (let step = 1; step <= martingaleMaxSteps; step++) {
    let stake = 0;
    if (step === 1) {
      stake = martingaleBaseStake;
    } else {
      // Stake needed to recover cumulativeLoss and net at least step 1 profit
      stake = Number(((cumulativeLoss + martingaleBaseStake * payoutDec) / payoutDec).toFixed(2));
      // Ensure minimum 2x step
      if (stake < martingaleLadder[step - 2].stake * 2) {
        stake = Number((martingaleLadder[step - 2].stake * martingaleMultiplier).toFixed(2));
      }
    }
    const potentialPayout = Number((stake * (1 + payoutDec)).toFixed(2));
    const netProfitOnWin = Number((potentialPayout - (cumulativeLoss + stake)).toFixed(2));
    cumulativeLoss += stake;
    const percentOfAccount = Number(((cumulativeLoss / accountBalance) * 100).toFixed(1));

    martingaleLadder.push({
      step,
      stake,
      cumulativeLoss: Number(cumulativeLoss.toFixed(2)),
      potentialPayout,
      netProfitOnWin,
      percentOfAccount,
      isDangerous: percentOfAccount > 25,
    });
  }

  // Compounding Calculation
  const compoundLadder = [];
  let currentStake = compoundInitialStake;
  for (let step = 1; step <= compoundTargetSteps; step++) {
    const profit = Number((currentStake * payoutDec).toFixed(2));
    const totalReturn = Number((currentStake + profit).toFixed(2));
    compoundLadder.push({
      step,
      stake: currentStake,
      profit,
      totalReturn,
    });
    currentStake = totalReturn;
  }

  const targetDailyProfitDollars = Number(((accountBalance * dailyProfitTargetPercent) / 100).toFixed(2));
  const maxDailyLossDollars = Number(((accountBalance * dailyMaxDrawdownPercent) / 100).toFixed(2));

  return (
    <div id="risk-management-view" className={`space-y-6 max-w-6xl mx-auto font-sans ${isRTL ? 'text-right' : 'text-left'}`}>
      {/* Header Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-rose-950/20 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <span>حاسبة إدارة رأس المال وخطة التداول (Pocket Option)</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 font-mono font-bold">
                CAPITAL GUARDIAN
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              حساب حجم الصفقات ومضاعفات التعويض بدقة حسب نسبة العائد المباشر لمنع المرجنة وحماية الحساب.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={syncLiveBalance}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>مزامنة رصيد المنصة</span>
          </button>
        </div>
      </div>

      {/* Account Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>الرصيد المتاح</span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${isDemo ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
              {isDemo ? 'DEMO' : 'REAL'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={accountBalance}
              onChange={(e) => setAccountBalance(Math.max(1, parseFloat(e.target.value) || 0))}
              className="text-xl font-bold font-mono bg-transparent border-b border-dashed border-slate-700 focus:border-amber-400 text-slate-100 outline-none w-full"
            />
            <span className="text-sm font-bold text-slate-400">$</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
          <div className="text-xs text-slate-400 mb-1">نسبة العائد للصفقة (Payout)</div>
          <div className="flex items-center gap-2">
            {[80, 85, 90, 92].map((p) => (
              <button
                key={p}
                onClick={() => setPayoutPercent(p)}
                className={`px-2 py-1 rounded text-xs font-mono font-bold border transition-colors ${
                  payoutPercent === p
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {p}%
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
          <div className="text-xs text-slate-400 mb-1">الهدف اليومي للربح (+{dailyProfitTargetPercent}%)</div>
          <div className="text-xl font-bold font-mono text-emerald-400">
            +${targetDailyProfitDollars.toFixed(2)}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">عند تحقيقه يجب إغلاق المنصة</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
          <div className="text-xs text-slate-400 mb-1">الحد الأقصى للخسارة اليومية (-{dailyMaxDrawdownPercent}%)</div>
          <div className="text-xl font-bold font-mono text-rose-400">
            -${maxDailyLossDollars.toFixed(2)}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">صمام أمان: التوقف التام فور الوصول</div>
        </div>
      </div>

      {/* Model Selector Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveStrategyType('fixed')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            activeStrategyType === 'fixed'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>المخاطرة الثابتة (النموذج الآمن الموصى به)</span>
        </button>

        <button
          onClick={() => setActiveStrategyType('martingale')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            activeStrategyType === 'martingale'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Flame className="w-4 h-4" />
          <span>مارتينجال ذكي لتعويض الصفقات</span>
        </button>

        <button
          onClick={() => setActiveStrategyType('compound')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            activeStrategyType === 'compound'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>الفائدة المركبة (سلسلة الصفقات التراكمية)</span>
        </button>
      </div>

      {/* MODEL 1: FIXED RISK */}
      {activeStrategyType === 'fixed' && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-5 p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-400 border-b border-slate-800 pb-2">
              <Calculator className="w-4 h-4" />
              <span>إعدادات نسبة المخاطرة الثابتة:</span>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-400">النسبة المئوية من الرصيد:</span>
                <span className="text-xs font-bold font-mono text-amber-400">{fixedRiskPercent}%</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[1.0, 2.0, 3.0, 5.0].map((r) => (
                  <button
                    key={r}
                    onClick={() => setFixedRiskPercent(r)}
                    className={`py-2 rounded-lg text-xs font-mono font-bold border transition-colors ${
                      fixedRiskPercent === r
                        ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {r}%
                  </button>
                ))}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2 text-xs">
              <div className="flex justify-between text-slate-300">
                <span>مبلغ الدخول للصفقة الواحدة:</span>
                <span className="font-bold font-mono text-amber-400 text-sm">${fixedStakeDollars.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>صافي الربح عند الفوز ({payoutPercent}%):</span>
                <span className="font-bold font-mono text-emerald-400">+${fixedProfitOnWin.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>عدد الصفقات الخاسرة المتتالية لتحمل الحد اليومي:</span>
                <span className="font-bold font-mono text-slate-200">
                  {Math.floor(maxDailyLossDollars / (fixedStakeDollars || 1))} صفقات
                </span>
              </div>
            </div>
          </div>

          <div className="md:col-span-7 p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
            <h3 className="text-xs font-bold text-slate-200 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>جدول المحاكاة والتطور التراكمي (10 صفقات نموذجية)</span>
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-sans">
                    <th className="py-2 px-3">نسبة الفوز المفترضة</th>
                    <th className="py-2 px-3">الصفقات الرابحة</th>
                    <th className="py-2 px-3">الصفقات الخاسرة</th>
                    <th className="py-2 px-3">صافي العائد ($)</th>
                    <th className="py-2 px-3">نمو الرصيد</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {[
                    { winRate: 60, wins: 6, losses: 4 },
                    { winRate: 70, wins: 7, losses: 3 },
                    { winRate: 80, wins: 8, losses: 2 },
                  ].map((row) => {
                    const netProfit = Number((row.wins * fixedProfitOnWin - row.losses * fixedStakeDollars).toFixed(2));
                    const growthPercent = Number(((netProfit / accountBalance) * 100).toFixed(1));
                    return (
                      <tr key={row.winRate} className="hover:bg-slate-800/30">
                        <td className="py-2.5 px-3 font-bold text-slate-200">{row.winRate}% دقة الإشارات</td>
                        <td className="py-2.5 px-3 text-emerald-400 font-bold">{row.wins} رابحة</td>
                        <td className="py-2.5 px-3 text-rose-400 font-bold">{row.losses} خاسرة</td>
                        <td className="py-2.5 px-3 font-bold text-emerald-400">+${netProfit}</td>
                        <td className="py-2.5 px-3 font-bold text-amber-400">+{growthPercent}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="text-[11px] text-slate-400 leading-relaxed bg-slate-950 p-3 rounded-lg border border-slate-800">
              💡 **نصيحة الخبراء**: نظام المخاطرة الثابتة بنسبة 1% إلى 2% هو الأسلوب الأكثر أماناً للاستمرار طويل الأجل على منصة Pocket Option، حيث يمنحك مناعة ضد تقلبات السوق المؤقتة.
            </div>
          </div>
        </div>
      )}

      {/* MODEL 2: SMART MARTINGALE */}
      {activeStrategyType === 'martingale' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-500/30 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-200/90 leading-relaxed">
              <strong className="text-amber-300 block mb-0.5">تحذير إدارة المخاطر لنظام المارتينجال:</strong>
              يعتمد المارتينجال على مضاعفة مبلغ الدخول بعد الخسارة لاستعادة رأس المال مع ربح إضافي. يجب ألا تزيد خطوات التعويض عن 3 أو 4 خطوات كحد أقصى لتفادي استنزاف الرصيد في فترات التذبذب العالي.
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-4">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">المبلغ الأساسي للخطوة 1 ($):</label>
                  <input
                    type="number"
                    value={martingaleBaseStake}
                    onChange={(e) => setMartingaleBaseStake(Math.max(1, parseFloat(e.target.value) || 1))}
                    className="w-28 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200 text-left"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">أقصى عدد للخطوات:</label>
                  <div className="flex items-center gap-1.5">
                    {[3, 4, 5].map((s) => (
                      <button
                        key={s}
                        onClick={() => setMartingaleMaxSteps(s)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold border ${
                          martingaleMaxSteps === s
                            ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                            : 'bg-slate-950 border-slate-800 text-slate-400'
                        }`}
                      >
                        {s} خطوات
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="text-xs font-mono text-slate-400">
                معامل المضاعفة المحسوب: <span className="font-bold text-amber-400">{martingaleMultiplier}x</span> (بنسبة عائد {payoutPercent}%)
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-sans">
                    <th className="py-2.5 px-3">الخطوة</th>
                    <th className="py-2.5 px-3">مبلغ الدخول</th>
                    <th className="py-2.5 px-3">إجمالي الخسارة المتراكمة</th>
                    <th className="py-2.5 px-3">إجمالي العائد عند الفوز</th>
                    <th className="py-2.5 px-3">صافي الربح المحقق</th>
                    <th className="py-2.5 px-3">نسبة المخاطرة من الرصيد</th>
                    <th className="py-2.5 px-3">حالة الأمان</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {martingaleLadder.map((row) => (
                    <tr key={row.step} className={`hover:bg-slate-800/30 ${row.isDangerous ? 'bg-rose-950/10' : ''}`}>
                      <td className="py-3 px-3 font-bold text-slate-200">الخطوة #{row.step}</td>
                      <td className="py-3 px-3 font-bold text-amber-400 text-sm">${row.stake}</td>
                      <td className="py-3 px-3 text-slate-300">${row.cumulativeLoss}</td>
                      <td className="py-3 px-3 text-slate-300">${row.potentialPayout}</td>
                      <td className="py-3 px-3 font-bold text-emerald-400">+${row.netProfitOnWin}</td>
                      <td className="py-3 px-3 font-bold text-slate-200">{row.percentOfAccount}%</td>
                      <td className="py-3 px-3">
                        {row.isDangerous ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-rose-500/20 text-rose-300 font-bold">
                            <ShieldAlert className="w-3 h-3" /> خطورة عالية
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 font-bold">
                            <CheckCircle2 className="w-3 h-3" /> آمن ومسيطر عليه
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODEL 3: COMPOUNDING */}
      {activeStrategyType === 'compound' && (
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1">المبلغ المبدئي للمغامرة ($):</label>
                <input
                  type="number"
                  value={compoundInitialStake}
                  onChange={(e) => setCompoundInitialStake(Math.max(1, parseFloat(e.target.value) || 1))}
                  className="w-28 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200 text-left"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">عدد الصفقات الرابحة المتتالية المستهدفة:</label>
                <div className="flex items-center gap-1.5">
                  {[2, 3, 4].map((s) => (
                    <button
                      key={s}
                      onClick={() => setCompoundTargetSteps(s)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold border ${
                        compoundTargetSteps === s
                          ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      {s} صفقات
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="text-xs text-slate-300 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
              أقصى خسارة ممكنة في أي لحظة: <span className="font-bold font-mono text-rose-400">${compoundInitialStake} فقط</span> (رأس المال المبدئي محمي)
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            {compoundLadder.map((row) => (
              <div key={row.step} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400 font-bold">
                  <span>الصفقة #{row.step}</span>
                  <span className="text-emerald-400">عائد {payoutPercent}%</span>
                </div>
                <div className="text-xs text-slate-300 flex justify-between">
                  <span>المبلغ المدفوع:</span>
                  <span className="font-bold font-mono text-amber-400">${row.stake}</span>
                </div>
                <div className="text-xs text-slate-300 flex justify-between">
                  <span>صافي الربح المحقق:</span>
                  <span className="font-bold font-mono text-emerald-400">+${row.profit}</span>
                </div>
                <div className="pt-2 border-t border-slate-800/80 flex justify-between text-xs font-bold text-slate-100">
                  <span>الرصيد التراكمي:</span>
                  <span className="font-mono text-emerald-400 text-sm">${row.totalReturn}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
