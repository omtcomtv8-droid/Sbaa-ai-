import { Candle } from '../types';
import {
  SbaaDecision,
  SbaaDetectedPattern,
  SbaaMtfState,
  SbaaScoreBreakdown,
} from './SbaaTypes';
import { calculateATR, calculateEMA, calculateMACD, calculateRSI } from '../indicators';
import { SupportResistanceEngine } from '../SupportResistanceEngine';

export interface ScoringContext {
  candles: Candle[];
  pattern: SbaaDetectedPattern | null;
  timeframe: number;
  mtfState?: SbaaMtfState | null;
  isClosedCandle: boolean;
  isStaleData?: boolean;
  isConnected?: boolean;
  recentSignalsHistory?: Array<{ patternType: string; timestamp: number; candleIndex: number }>;
}

export interface SbaaEvaluationResult {
  decision: SbaaDecision;
  scoreBreakdown: SbaaScoreBreakdown;
  primaryReasonAr: string;
  primaryReasonEn: string;
  blockers: string[];
  isQualifiedForDemo: boolean;
  srZoneLabel: string;
}

export class SbaaScoringEngine {
  /**
   * Evaluates a trading setup against the 100-Point SBAA Confluence Matrix and enforces all No-Trade filters.
   */
  public static evaluate(ctx: ScoringContext): SbaaEvaluationResult {
    const blockers: string[] = [];
    const reasons: string[] = [];

    const candles = ctx.candles;
    if (!candles || candles.length < 15) {
      blockers.push('بيانات الشموع غير كافية لإجراء التحليل الفني المعمق (أقل من 15 شمعة)');
      return this.buildBlockedResult(blockers, 'غير كافٍ', 'Insufficient candles for evaluation');
    }

    const n = candles.length;
    const c0 = candles[n - 1]; // Latest candle
    const closes = candles.map((c) => c.close);
    const range0 = Math.max(0.00001, c0.high - c0.low);
    const body0 = Math.abs(c0.close - c0.open);
    const bodyRatio = body0 / range0;
    const upperWick = c0.high - Math.max(c0.open, c0.close);
    const lowerWick = Math.min(c0.open, c0.close) - c0.low;
    const upperWickRatio = upperWick / range0;
    const lowerWickRatio = lowerWick / range0;

    const atrObj = calculateATR(candles, 14);
    const atr: number = (typeof atrObj === 'number' ? atrObj : atrObj?.currentATR) ?? range0;
    const ema20 = calculateEMA(closes, 20);
    const ema50 = calculateEMA(closes, 50);
    const ema200 = calculateEMA(closes, Math.min(200, closes.length));
    const rsi14 = calculateRSI(closes, 14);
    const macd = calculateMACD(closes, 12, 26, 9);

    // Support & Resistance zones
    const srLevels = SupportResistanceEngine.calculateLevels(candles, 40, 0.08);
    const nearestSupport = srLevels.nearestSupport?.price ?? Math.min(...candles.slice(-20).map((c) => c.low));
    const nearestResistance = srLevels.nearestResistance?.price ?? Math.max(...candles.slice(-20).map((c) => c.high));
    const distToSupport = Math.abs(c0.close - nearestSupport);
    const distToResistance = Math.abs(nearestResistance - c0.close);
    const totalBand = Math.max(0.0001, nearestResistance - nearestSupport);

    const pattern = ctx.pattern;
    const intendedDirection = pattern ? pattern.direction : (c0.close >= (ema20 ?? c0.close) ? 'BUY' : 'SELL');

    // =========================================================================
    // MANDATORY NO-TRADE FILTERS (Section 7)
    // =========================================================================

    // Filter 1: Incomplete forming candle
    if (!ctx.isClosedCandle) {
      blockers.push('يمنع الدخول أثناء تشكل الشمعة الحالية. يجب انتظار إغلاق الشمعة لتجنب الإشارات الوهمية.');
    }

    // Filter 2: Doji / High Hesitation without resolution
    if (bodyRatio <= 0.12 && upperWickRatio >= 0.35 && lowerWickRatio >= 0.35) {
      blockers.push('ظهور شمعة دوجي (Doji) وتردد سعري حاد دون اتجاه واضح. حظر الدخول حتى تتشكل شمعة تأكيد صريحة.');
    }

    // Filter 3: Price stranded in the middle of a sideways range
    const isSideways = ema20 !== null && ema50 !== null && Math.abs(ema20 - ema50) < atr * 0.25;
    const isMiddleOfRange = distToSupport / totalBand > 0.30 && distToResistance / totalBand > 0.30;
    if (isSideways && isMiddleOfRange) {
      blockers.push('السوق في نطاق عرضي والسعر يتذبذب في منتصف النطاق. يمنع الدخول من المنتصف ويشترط الارتداد من الحدود الخارجية.');
    }

    // Filter 4: Abnormal Volatility Spike (Outlier candle > 2.5 * ATR)
    if (range0 > atr * 2.8) {
      blockers.push(`تقلبات سعرية عنيفة غير طبيعية (حجم الشمعة ${range0.toFixed(5)} يتجاوز 2.8 أضعاف متوسط ATR). تجنب الدخول أثناء الانفلات السعري.`);
    }

    // Filter 5: Connection and data reliability
    if (ctx.isConnected === false) {
      blockers.push('انقطاع اتصال مقبس الويب المباشر. حظر إصدار أو تنفيذ أي إشارة آلية.');
    }
    if (ctx.isStaleData === true) {
      blockers.push('بيانات السوق غير مستقرة أو متأخرة زمنياً (Stale Data). حظر الدخول.');
    }

    // Filter 6: Pattern repetition on same or recent candles (3-candle cooldown)
    if (pattern && ctx.recentSignalsHistory && ctx.recentSignalsHistory.length > 0) {
      const recentSame = ctx.recentSignalsHistory.find(
        (s) => s.patternType === pattern.type && (n - 1) - s.candleIndex < 3
      );
      if (recentSame) {
        blockers.push(`تكرار نفس النموذج (${pattern.nameAr}) خلال أقل من 3 شموع. تم تفعيل نظام الحماية من تكرار الإشارات.`);
      }
    }

    // Filter 7: Absence of clear S/R or Demand/Supply near trigger (strictly for reversal setups)
    const toleranceSR = atr * 1.25;
    const isNearSupport = distToSupport <= toleranceSR;
    const isNearResistance = distToResistance <= toleranceSR;
    const isTrendOrBreakout = Boolean(
      pattern?.type?.includes('BREAKOUT') ||
      pattern?.type?.includes('TREND') ||
      pattern?.type?.includes('MOMENTUM') ||
      pattern?.type?.includes('BOS') ||
      pattern?.type?.includes('EMA') ||
      pattern?.type?.includes('MACD') ||
      pattern?.type?.includes('SUPERTREND') ||
      pattern?.type?.includes('ALIGNMENT') ||
      pattern?.type?.includes('INTEGRATED')
    );

    if (!isTrendOrBreakout) {
      if (pattern?.direction === 'BUY' && !isNearSupport && distToSupport > atr * 1.5) {
        blockers.push('غياب منطقة دعم أو طلب صالحة قريبة تدعم إشارة الشراء الانعكاسية.');
      }
      if (pattern?.direction === 'SELL' && !isNearResistance && distToResistance > atr * 1.5) {
        blockers.push('غياب منطقة مقاومة أو عرض صالحة قريبة تدعم إشارة البيع الانعكاسية.');
      }
    }

    // =========================================================================
    // 100-POINT CONFLUENCE SCORING ENGINE (Section 5)
    // =========================================================================

    let trendScore = 0;         // Max 15
    let srLocationScore = 0;    // Max 20
    let patternScore = 0;       // Max 15
    let wickLiquidityScore = 0; // Max 15
    let structureScore = 0;     // Max 15
    let momentumScore = 0;      // Max 10
    let mtfScore = 0;           // Max 10

    // 1. Trend Analysis (15 pts)
    if (ema20 !== null && ema50 !== null) {
      if (intendedDirection === 'BUY') {
        if (ema20 > ema50) {
          trendScore += 8;
          reasons.push('محاذاة صاعدة: EMA 20 أعلى من EMA 50');
        }
        if (c0.close > ema20) {
          trendScore += 4;
          reasons.push('السعر يتداول أعلى متوسط EMA 20');
        }
        if (ema200 !== null && c0.close > ema200) {
          trendScore += 3;
          reasons.push('السعر أعلى الاتجاه الكلي الأكبر EMA 200');
        }
      } else {
        if (ema20 < ema50) {
          trendScore += 8;
          reasons.push('محاذاة هابطة: EMA 20 أسفل من EMA 50');
        }
        if (c0.close < ema20) {
          trendScore += 4;
          reasons.push('السعر يتداول أسفل متوسط EMA 20');
        }
        if (ema200 !== null && c0.close < ema200) {
          trendScore += 3;
          reasons.push('السعر أسفل الاتجاه الكلي الأكبر EMA 200');
        }
      }
    }

    // 2. Support & Resistance Location (20 pts)
    const srTolerance = atr * 0.8;
    if (intendedDirection === 'BUY') {
      if (distToSupport <= srTolerance * 0.5) {
        srLocationScore = 20;
        reasons.push(`ارتداد مثالي من منطقة الدعم الرئيسية (${nearestSupport.toFixed(5)})`);
      } else if (distToSupport <= srTolerance) {
        srLocationScore = 15;
        reasons.push(`السعر يتواجد داخل حيز منطقة الدعم (${nearestSupport.toFixed(5)})`);
      } else if (distToSupport <= srTolerance * 1.5) {
        srLocationScore = 8;
        reasons.push('السعر يقترب من منطقة الدعم');
      }
    } else {
      if (distToResistance <= srTolerance * 0.5) {
        srLocationScore = 20;
        reasons.push(`ارتداد مثالي من منطقة المقاومة الرئيسية (${nearestResistance.toFixed(5)})`);
      } else if (distToResistance <= srTolerance) {
        srLocationScore = 15;
        reasons.push(`السعر يتواجد داخل حيز منطقة المقاومة (${nearestResistance.toFixed(5)})`);
      } else if (distToResistance <= srTolerance * 1.5) {
        srLocationScore = 8;
        reasons.push('السعر يقترب من منطقة المقاومة');
      }
    }

    // 3. Candlestick Pattern (15 pts)
    if (pattern) {
      if (pattern.confidence >= 0.90) {
        patternScore = 15;
        reasons.push(`نموذج فني قوي مكتمل ومؤكد: ${pattern.nameAr}`);
      } else if (pattern.confidence >= 0.80) {
        patternScore = 12;
        reasons.push(`نموذج فني معتمد: ${pattern.nameAr}`);
      } else {
        patternScore = 8;
        reasons.push(`نموذج فني متوسط: ${pattern.nameAr}`);
      }
    } else {
      patternScore = 0;
    }

    // 4. Wick & Liquidity Analysis (15 pts)
    if (intendedDirection === 'BUY') {
      if (lowerWickRatio >= 0.50) {
        wickLiquidityScore += 10;
        reasons.push(`رفض سعري سفلي قوي جداً (فتيلة تمثل ${(lowerWickRatio * 100).toFixed(0)}% من الشمعة)`);
      } else if (lowerWickRatio >= 0.30) {
        wickLiquidityScore += 6;
        reasons.push('ضغط شرائي ملحوظ من القاع');
      }
      if (pattern?.type === 'LIQUIDITY_SWEEP_LOW') {
        wickLiquidityScore = 15;
        reasons.push('سحب سيولة القاع مؤكد مع رفض هبوطي قاطع');
      }
    } else {
      if (upperWickRatio >= 0.50) {
        wickLiquidityScore += 10;
        reasons.push(`رفض سعري علوي قوي جداً (فتيلة تمثل ${(upperWickRatio * 100).toFixed(0)}% من الشمعة)`);
      } else if (upperWickRatio >= 0.30) {
        wickLiquidityScore += 6;
        reasons.push('ضغط بيعي ملحوظ من القمة');
      }
      if (pattern?.type === 'LIQUIDITY_SWEEP_HIGH') {
        wickLiquidityScore = 15;
        reasons.push('سحب سيولة القمة مؤكد مع رفض صعودي قاطع');
      }
    }

    // 5. Market Structure Confirmation (15 pts)
    if (pattern?.type === 'BOS_BULLISH' || pattern?.type === 'CHOCH_BULLISH') {
      structureScore = 15;
      reasons.push('تأكيد هيكلي قوي: اختراق القمة وتأكيد كسر الهيكل الصاعد (BOS/CHOCH)');
    } else if (pattern?.type === 'BOS_BEARISH' || pattern?.type === 'CHOCH_BEARISH') {
      structureScore = 15;
      reasons.push('تأكيد هيكلي قوي: كسر القاع وتأكيد كسر الهيكل الهابط (BOS/CHOCH)');
    } else {
      // Evaluate recent swings
      const last5 = candles.slice(-6);
      const isHigherLows = last5[5].low > last5[2].low;
      const isLowerHighs = last5[5].high < last5[2].high;
      if (intendedDirection === 'BUY' && isHigherLows) {
        structureScore = 10;
        reasons.push('تتابع قيعان صاعدة (Higher Lows) تدعم استمرار الصعود');
      } else if (intendedDirection === 'SELL' && isLowerHighs) {
        structureScore = 10;
        reasons.push('تتابع قمم هابطة (Lower Highs) تدعم استمرار الهبوط');
      } else {
        structureScore = 5;
      }
    }

    // 6. Momentum & Indicators (10 pts)
    if (rsi14 !== null) {
      if (intendedDirection === 'BUY') {
        if (rsi14 >= 42 && rsi14 <= 68) {
          momentumScore += 5;
          reasons.push(`زخم صاعد صحي على مؤشر RSI (${rsi14.toFixed(1)})`);
        } else if (rsi14 < 35) {
          momentumScore += 3;
          reasons.push('مؤشر RSI في منطقة تشبع بيعي تدعم الارتداد');
        }
      } else {
        if (rsi14 <= 58 && rsi14 >= 32) {
          momentumScore += 5;
          reasons.push(`زخم هابط متوازن على مؤشر RSI (${rsi14.toFixed(1)})`);
        } else if (rsi14 > 65) {
          momentumScore += 3;
          reasons.push('مؤشر RSI في منطقة تشبع شرائي تدعم الهبوط');
        }
      }
    }
    if (macd && macd.histogram !== undefined) {
      if (intendedDirection === 'BUY' && macd.histogram >= 0) {
        momentumScore += 5;
        reasons.push('مدرج الماكد MACD إيجابي يدعم الزخم الشرائي');
      } else if (intendedDirection === 'SELL' && macd.histogram <= 0) {
        momentumScore += 5;
        reasons.push('مدرج الماكد MACD سلبي يدعم الزخم البيعي');
      }
    }

    // 7. Higher Timeframe Confirmation (10 pts)
    if (ctx.mtfState) {
      if (
        (intendedDirection === 'BUY' && ctx.mtfState.trend === 'BULLISH') ||
        (intendedDirection === 'SELL' && ctx.mtfState.trend === 'BEARISH')
      ) {
        mtfScore = 10;
        reasons.push(`توافق تام مع اتجاه الإطار الزمني الأكبر (${ctx.mtfState.timeframe}s: ${ctx.mtfState.trend})`);
      } else if (ctx.mtfState.trend === 'RANGING') {
        mtfScore = 5;
        reasons.push(`الإطار الزمني الأكبر في حالة تذبذب عرضي`);
      } else {
        mtfScore = 0;
        reasons.push(`تعارض مع الإطار الزمني الأكبر (${ctx.mtfState.timeframe}s: ${ctx.mtfState.trend})`);
      }
    } else {
      mtfScore = 7; // Neutral baseline if MTF data pending
    }

    const totalScore = Math.min(
      100,
      trendScore + srLocationScore + patternScore + wickLiquidityScore + structureScore + momentumScore + mtfScore
    );

    // Classification Verdict
    let verdict: SbaaScoreBreakdown['verdict'] = 'IGNORE';
    if (totalScore >= 90) verdict = 'STRONG_CONFLUENCE';
    else if (totalScore >= 80) verdict = 'DEMO_QUALIFIED';
    else if (totalScore >= 70) verdict = 'WEAK_SIGNAL';
    else if (totalScore >= 60) verdict = 'WATCH_ONLY';
    else verdict = 'IGNORE';

    const scoreBreakdown: SbaaScoreBreakdown = {
      trendScore,
      srLocationScore,
      patternScore,
      wickLiquidityScore,
      structureScore,
      momentumScore,
      mtfScore,
      totalScore,
      verdict,
      reasons,
      blockers,
    };

    const srZoneLabel = `دعم: ${nearestSupport.toFixed(5)} | مقاومة: ${nearestResistance.toFixed(5)}`;

    // Decision Logic
    const hasBlockers = blockers.length > 0;
    const isQualifiedForDemo = !hasBlockers && totalScore >= 75 && pattern !== null;

    let decision: SbaaDecision = 'WAIT';
    let primaryReasonAr = '';
    let primaryReasonEn = '';

    if (hasBlockers) {
      decision = 'WAIT';
      primaryReasonAr = `WAIT: تم تعليق الإشارة لوجود شروط منع إلزامية: ${blockers[0]}`;
      primaryReasonEn = `WAIT: Decision withheld due to mandatory rule: ${blockers[0]}`;
    } else if (isQualifiedForDemo && pattern) {
      decision = pattern.direction;
      primaryReasonAr = `${decision}: تم اكتشاف ${pattern.nameAr} عند ${srZoneLabel} مع نقاط توافق ${totalScore}/100 وتأكيد الهيكل والزخم. مؤهلة للدخول التجريبي المباشر.`;
      primaryReasonEn = `${decision}: Detected ${pattern.nameEn} near key levels with score ${totalScore}/100. Qualified for demo execution.`;
    } else if (totalScore >= 65) {
      decision = 'WAIT';
      primaryReasonAr = `WAIT: إشارة فنية متوسطة (${totalScore}/100) لم تبلغ الحد الإلزامي للدخول الآلي (75/100). للمراقبة فقط.`;
      primaryReasonEn = `WAIT: Moderate signal score (${totalScore}/100) below minimum threshold (75/100). Watch only.`;
    } else {
      decision = 'WAIT';
      primaryReasonAr = 'WAIT: لا يوجد نموذج فني مكتمل أو أن السوق في حالة تذبذب وتردد.';
      primaryReasonEn = 'WAIT: No clear technical setup or market in indecision.';
    }

    return {
      decision,
      scoreBreakdown,
      primaryReasonAr,
      primaryReasonEn,
      blockers,
      isQualifiedForDemo,
      srZoneLabel,
    };
  }

  private static buildBlockedResult(blockers: string[], reasonAr: string, reasonEn: string): SbaaEvaluationResult {
    return {
      decision: 'WAIT',
      scoreBreakdown: {
        trendScore: 0,
        srLocationScore: 0,
        patternScore: 0,
        wickLiquidityScore: 0,
        structureScore: 0,
        momentumScore: 0,
        mtfScore: 0,
        totalScore: 0,
        verdict: 'IGNORE',
        reasons: [],
        blockers,
      },
      primaryReasonAr: `WAIT: ${reasonAr}`,
      primaryReasonEn: `WAIT: ${reasonEn}`,
      blockers,
      isQualifiedForDemo: false,
      srZoneLabel: 'غير محددة',
    };
  }
}
