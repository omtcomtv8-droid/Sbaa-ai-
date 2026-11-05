import { Candle } from '../types';
import { SbaaDetectedPattern, SbaaPatternType } from './SbaaTypes';
import { calculateATR, calculateBollingerBands, calculateEMA, calculateRSI } from '../indicators';

export interface PatternDetectionResult {
  patterns: SbaaDetectedPattern[];
  primaryPattern: SbaaDetectedPattern | null;
  isDojiOrHesitation: boolean;
  atr: number;
  upperWickRatio: number;
  lowerWickRatio: number;
  bodyRatio: number;
}

export class SbaaPatternDetector {
  /**
   * Scans a series of closed candles and extracts all recognized SBAA technical patterns.
   */
  public static detectPatterns(candles: Candle[], rsiValues?: number[]): PatternDetectionResult {
    const emptyResult: PatternDetectionResult = {
      patterns: [],
      primaryPattern: null,
      isDojiOrHesitation: false,
      atr: 0,
      upperWickRatio: 0,
      lowerWickRatio: 0,
      bodyRatio: 0,
    };

    if (!candles || candles.length < 2) {
      return emptyResult;
    }

    const n = candles.length;
    const c0 = candles[n - 1]; // Latest closed candle
    const c1 = candles[n - 2]; // 1 candle ago
    const c2 = candles[n - 3]; // 2 candles ago
    const c3 = n >= 4 ? candles[n - 4] : null;

    const range0 = Math.max(0.00001, c0.high - c0.low);
    const body0 = Math.abs(c0.close - c0.open);
    const upperWick0 = c0.high - Math.max(c0.open, c0.close);
    const lowerWick0 = Math.min(c0.open, c0.close) - c0.low;

    const range1 = Math.max(0.00001, c1.high - c1.low);
    const body1 = Math.abs(c1.close - c1.open);

    const isBullish0 = c0.close > c0.open;
    const isBearish0 = c0.close < c0.open;
    const isBullish1 = c1.close > c1.open;
    const isBearish1 = c1.close < c1.open;

    const bodyRatio0 = body0 / range0;
    const upperWickRatio0 = upperWick0 / range0;
    const lowerWickRatio0 = lowerWick0 / range0;

    // ATR for thresholding
    const atrObj = calculateATR(candles, 14);
    const atr: number = (typeof atrObj === 'number' ? atrObj : atrObj?.currentATR) ?? (range0 + range1) / 2;

    // Doji & Indecision Check (Rule 1 in Section 7)
    const isDojiOrHesitation = bodyRatio0 <= 0.12 && (upperWickRatio0 > 0.35 && lowerWickRatio0 > 0.35);

    const detected: SbaaDetectedPattern[] = [];

    // Helper to register
    const add = (
      type: SbaaPatternType,
      nameAr: string,
      nameEn: string,
      direction: 'BUY' | 'SELL',
      confidence: number,
      descriptionAr: string,
      descriptionEn: string,
      isConfirmed: boolean = true
    ) => {
      detected.push({
        type,
        nameAr,
        nameEn,
        direction,
        confidence,
        candleIndex: n - 1,
        triggerPrice: c0.close,
        descriptionAr,
        descriptionEn,
        isConfirmed,
      });
    };

    // -------------------------------------------------------------
    // 1. PIN BAR (BULLISH / BEARISH)
    // -------------------------------------------------------------
    // Bullish Pin Bar: small body in top third, long lower wick (>= 2x body), lower wick >= 50% range
    if (lowerWickRatio0 >= 0.55 && upperWickRatio0 <= 0.20 && bodyRatio0 <= 0.35) {
      add(
        'BULLISH_PIN_BAR',
        'شمعة الدبوس الصاعدة (Bullish Pin Bar)',
        'Bullish Pin Bar',
        'BUY',
        0.88,
        'فتيلة سفلية طويلة ترفض المستويات المتدنية مع إغلاق قرب القمة يدل على سيطرة المشترين.',
        'Long lower wick rejecting lower levels with close near the top confirming buyers dominance.'
      );
    }
    // Bearish Pin Bar: small body in bottom third, long upper wick (>= 2x body), upper wick >= 50% range
    if (upperWickRatio0 >= 0.55 && lowerWickRatio0 <= 0.20 && bodyRatio0 <= 0.35) {
      add(
        'BEARISH_PIN_BAR',
        'شمعة الدبوس الهابطة (Bearish Pin Bar)',
        'Bearish Pin Bar',
        'SELL',
        0.88,
        'فتيلة علوية طويلة ترفض المستويات المرتفعة مع إغلاق قرب القاع يدل على سيطرة البائعين.',
        'Long upper wick rejecting higher levels with close near the bottom confirming sellers dominance.'
      );
    }

    // -------------------------------------------------------------
    // 2. TWEEZER BOTTOM & TOP
    // -------------------------------------------------------------
    const lowDiff = Math.abs(c0.low - c1.low);
    const highDiff = Math.abs(c0.high - c1.high);
    const tolerance = Math.max(0.00005, atr * 0.15);

    if (lowDiff <= tolerance && isBearish1 && isBullish0 && lowerWickRatio0 >= 0.15) {
      add(
        'TWEEZER_BOTTOM',
        'القاع المزدوج للشموع (Tweezer Bottom)',
        'Tweezer Bottom',
        'BUY',
        0.85,
        'قاعان متطابقان يظهران رفضاً مزدوجاً للهبوط ودفاعاً شرائياً قوياً عند الدعم.',
        'Dual identical candle lows demonstrating double rejection of lower prices and strong support defense.'
      );
    }

    if (highDiff <= tolerance && isBullish1 && isBearish0 && upperWickRatio0 >= 0.15) {
      add(
        'TWEEZER_TOP',
        'القمة المزدوجة للشموع (Tweezer Top)',
        'Tweezer Top',
        'SELL',
        0.85,
        'قمتان متطابقتان تظهران رفضاً مزدوجاً للصعود وضغطاً بيعياً عند المقاومة.',
        'Dual identical candle highs demonstrating double rejection of higher prices and resistance pressure.'
      );
    }

    // -------------------------------------------------------------
    // 3. MORNING STAR & EVENING STAR (3-Candle Pattern)
    // -------------------------------------------------------------
    if (c2) {
      const isC2Bearish = c2.close < c2.open;
      const isC2Bullish = c2.close > c2.open;
      const body2 = Math.abs(c2.close - c2.open);
      const range2 = Math.max(0.00001, c2.high - c2.low);

      // Morning Star: C2 strong red, C1 small indecision star, C0 strong green closing > 50% into C2 body
      if (
        isC2Bearish &&
        body2 / range2 >= 0.5 &&
        body1 / range1 <= 0.48 &&
        isBullish0 &&
        c0.close >= c2.close + body2 * 0.5
      ) {
        add(
          'MORNING_STAR',
          'نجمة الصباح (Morning Star)',
          'Morning Star',
          'BUY',
          0.92,
          'نموذج انعكاسي ثلاثي يظهر استنفاد البائعين وظهور شمعة صاعدة تخترق منتصف الشمعة الهابطة.',
          'Three-candle bullish reversal pattern showing sellers exhaustion and strong buying impulse.'
        );
      }

      // Evening Star: C2 strong green, C1 small indecision star, C0 strong red closing < 50% into C2 body
      if (
        isC2Bullish &&
        body2 / range2 >= 0.5 &&
        body1 / range1 <= 0.48 &&
        isBearish0 &&
        c0.close <= c2.close - body2 * 0.5
      ) {
        add(
          'EVENING_STAR',
          'نجمة المساء (Evening Star)',
          'Evening Star',
          'SELL',
          0.92,
          'نموذج انعكاسي ثلاثي يظهر استنفاد المشترين وظهور شمعة هابطة تخترق منتصف الشمعة الصاعدة.',
          'Three-candle bearish reversal pattern showing buyers exhaustion and strong selling impulse.'
        );
      }
    }

    // -------------------------------------------------------------
    // 4. PIERCING LINE & DARK CLOUD COVER
    // -------------------------------------------------------------
    const midPoint1 = c1.open + (c1.close - c1.open) * 0.5;

    // Piercing Line: C1 bearish, C0 opens low but closes > 50% of C1 body, but <= C1 open
    if (isBearish1 && isBullish0 && c0.close > midPoint1 && c0.close < c1.open && body1 >= atr * 0.4) {
      add(
        'PIERCING_LINE',
        'الخط الثاقب (Piercing Line)',
        'Piercing Line',
        'BUY',
        0.83,
        'شمعة صاعدة تخترق وتغلق فوق منتصف جسم الشمعة الهابطة السابقة مؤكدة عودة المشترين.',
        'Bullish candle piercing and closing above the midpoint of the prior bearish candle.'
      );
    }

    // Dark Cloud Cover: C1 bullish, C0 opens high but closes < 50% of C1 body, but >= C1 open
    if (isBullish1 && isBearish0 && c0.close < midPoint1 && c0.close > c1.open && body1 >= atr * 0.4) {
      add(
        'DARK_CLOUD_COVER',
        'السحابة القاتمة (Dark Cloud Cover)',
        'Dark Cloud Cover',
        'SELL',
        0.83,
        'شمعة هابطة تخترق وتغلق أسفل منتصف جسم الشمعة الصاعدة السابقة مؤكدة ضغط البائعين.',
        'Bearish candle penetrating and closing below the midpoint of the prior bullish candle.'
      );
    }

    // -------------------------------------------------------------
    // 5. HARAMI (BULLISH & BEARISH)
    // -------------------------------------------------------------
    // Bullish Harami: C1 large red, C0 small green inside C1 body
    if (
      isBearish1 &&
      isBullish0 &&
      body1 >= atr * 0.5 &&
      c0.open >= c1.close &&
      c0.close <= c1.open &&
      body0 <= body1 * 0.6
    ) {
      add(
        'BULLISH_HARAMI',
        'الحامل الصاعد (Bullish Harami)',
        'Bullish Harami',
        'BUY',
        0.80,
        'شمعة خضراء صغيرة داخل جسم الشمعة الحمراء السابقة تشير إلى تراجع ضغط البيع واستعداد السعر للانعكاس.',
        'Small green candle contained within the prior red body signalling seller deceleration.'
      );
    }

    // Bearish Harami: C1 large green, C0 small red inside C1 body
    if (
      isBullish1 &&
      isBearish0 &&
      body1 >= atr * 0.5 &&
      c0.open <= c1.close &&
      c0.close >= c1.open &&
      body0 <= body1 * 0.6
    ) {
      add(
        'BEARISH_HARAMI',
        'الحامل الهابط (Bearish Harami)',
        'Bearish Harami',
        'SELL',
        0.80,
        'شمعة حمراء صغيرة داخل جسم الشمعة الخضراء السابقة تشير إلى تراجع زخم المشترين واستعداد السعر للهبوط.',
        'Small red candle contained within the prior green body signalling buyer deceleration.'
      );
    }

    // -------------------------------------------------------------
    // 6. INSIDE BAR BREAKOUT (BUY / SELL)
    // -------------------------------------------------------------
    // C1 is inside C2 (Inside bar), C0 breaks out
    if (c2) {
      const isC1InsideC2 = c1.high <= c2.high && c1.low >= c2.low;
      if (isC1InsideC2) {
        if (c0.close > c2.high && isBullish0) {
          add(
            'INSIDE_BAR_BREAKOUT_BUY',
            'اختراق الشمعة الداخلية صعوداً (Inside Bar Breakout BUY)',
            'Inside Bar Bullish Breakout',
            'BUY',
            0.87,
            'كسر صاعد مؤكد ومكتمل الإغلاق أعلى نطاق الشمعة الأم بعد مرحلة انضغاط سعري.',
            'Confirmed close above the mother bar high following inside bar compression.'
          );
        } else if (c0.close < c2.low && isBearish0) {
          add(
            'INSIDE_BAR_BREAKOUT_SELL',
            'اختراق الشمعة الداخلية هبوطاً (Inside Bar Breakout SELL)',
            'Inside Bar Bearish Breakout',
            'SELL',
            0.87,
            'كسر هابط مؤكد ومكتمل الإغلاق أسفل نطاق الشمعة الأم بعد مرحلة انضغاط سعري.',
            'Confirmed close below the mother bar low following inside bar compression.'
          );
        }
      }
    }

    // -------------------------------------------------------------
    // 7. OUTSIDE BAR (ENGULFING RANGE)
    // -------------------------------------------------------------
    if (c0.high > c1.high && c0.low < c1.low) {
      if (isBullish0 && c0.close >= c0.high - range0 * 0.25) {
        add(
          'BULLISH_OUTSIDE_BAR',
          'الشمعة الخارجية الصاعدة (Bullish Outside Bar)',
          'Bullish Outside Bar',
          'BUY',
          0.84,
          'شمعة صاعدة شاملة تبتلع أعلى وأدنى الشمعة السابقة وتغلق بالقرب من القمة.',
          'Comprehensive bullish bar engulfing prior high and low with close near the peak.'
        );
      } else if (isBearish0 && c0.close <= c0.low + range0 * 0.25) {
        add(
          'BEARISH_OUTSIDE_BAR',
          'الشمعة الخارجية الهابطة (Bearish Outside Bar)',
          'Bearish Outside Bar',
          'SELL',
          0.84,
          'شمعة هابطة شاملة تبتلع أعلى وأدنى الشمعة السابقة وتغلق بالقرب من القاع.',
          'Comprehensive bearish bar engulfing prior high and low with close near the trough.'
        );
      }
    }

    // -------------------------------------------------------------
    // 8. THREE WHITE SOLDIERS & THREE BLACK CROWS
    // -------------------------------------------------------------
    if (c2) {
      const isC2Bullish = c2.close > c2.open;
      const isC2Bearish = c2.close < c2.open;

      if (
        isBullish0 &&
        isBullish1 &&
        isC2Bullish &&
        c0.close > c1.close &&
        c1.close > c2.close &&
        c0.open >= c1.open &&
        c1.open >= c2.open &&
        upperWickRatio0 <= 0.3
      ) {
        add(
          'THREE_WHITE_SOLDIERS',
          'الجنود الثلاثة البيض (Three White Soldiers)',
          'Three White Soldiers',
          'BUY',
          0.90,
          'ثلاث شموع صاعدة متتالية بأجسام واضحة وإغلاقات متصاعدة تؤكد استمرار الزخم الشرائي.',
          'Three consecutive solid green candles with progressive higher closes confirming upward momentum.'
        );
      }

      if (
        isBearish0 &&
        isBearish1 &&
        isC2Bearish &&
        c0.close < c1.close &&
        c1.close < c2.close &&
        c0.open <= c1.open &&
        c1.open <= c2.open &&
        lowerWickRatio0 <= 0.3
      ) {
        add(
          'THREE_BLACK_CROWS',
          'الغربان الثلاثة السود (Three Black Crows)',
          'Three Black Crows',
          'SELL',
          0.90,
          'ثلاث شموع هابطة متتالية بأجسام واضحة وإغلاقات متنازلة تؤكد ضغط البيع القوي.',
          'Three consecutive solid red candles with progressive lower closes confirming distribution.'
        );
      }
    }

    // -------------------------------------------------------------
    // 9. BULLISH & BEARISH ENGULFING
    // -------------------------------------------------------------
    if (isBearish1 && isBullish0 && c0.close >= c1.open && c0.open <= c1.close && body0 > body1) {
      add(
        'BULLISH_ENGULFING',
        'الابتلاع الصاعد (Bullish Engulfing)',
        'Bullish Engulfing',
        'BUY',
        0.89,
        'جسم الشمعة الصاعدة يبتلع جسم الشمعة الهابطة السابقة بالكامل مع إغلاق قوي.',
        'Bullish candle body completely engulfs the prior bearish body with authoritative close.'
      );
    }

    if (isBullish1 && isBearish0 && c0.close <= c1.open && c0.open >= c1.close && body0 > body1) {
      add(
        'BEARISH_ENGULFING',
        'الابتلاع الهابط (Bearish Engulfing)',
        'Bearish Engulfing',
        'SELL',
        0.89,
        'جسم الشمعة الهابطة يبتلع جسم الشمعة الصاعدة السابقة بالكامل مع إغلاق قوي.',
        'Bearish candle body completely engulfs the prior bullish body with authoritative close.'
      );
    }

    // -------------------------------------------------------------
    // 10. LIQUIDITY SWEEP (HIGH & LOW) - Section 3
    // -------------------------------------------------------------
    // Look back 15-40 candles for swing highs and swing lows
    const lookbackWindow = candles.slice(Math.max(0, n - 35), n - 1);
    if (lookbackWindow.length >= 10) {
      const priorHighs = lookbackWindow.map((c) => c.high);
      const priorLows = lookbackWindow.map((c) => c.low);
      const swingHigh = Math.max(...priorHighs);
      const swingLow = Math.min(...priorLows);

      // Sweep High: c0 or c1 spiked above swingHigh, but current closed strictly below swingHigh with upper wick
      if ((c0.high > swingHigh || c1.high > swingHigh) && c0.close < swingHigh && (upperWickRatio0 >= 0.4 || isBearish0)) {
        add(
          'LIQUIDITY_SWEEP_HIGH',
          'سحب سيولة القمة (Liquidity Sweep High)',
          'Liquidity Sweep High',
          'SELL',
          0.94,
          `تم سحب سيولة أوامر الشراء المعلقة أعلى القمة السابقة (${swingHigh.toFixed(5)}) مع عجز السعر عن الاستقرار وإغلاق هابط.`,
          `Liquidity above swing high (${swingHigh.toFixed(5)}) swept with immediate failure and bearish rejection close.`
        );
      }

      // Sweep Low: c0 or c1 spiked below swingLow, but current closed strictly above swingLow with lower wick
      if ((c0.low < swingLow || c1.low < swingLow) && c0.close > swingLow && (lowerWickRatio0 >= 0.4 || isBullish0)) {
        add(
          'LIQUIDITY_SWEEP_LOW',
          'سحب سيولة القاع (Liquidity Sweep Low)',
          'Liquidity Sweep Low',
          'BUY',
          0.94,
          `تم سحب سيولة أوامر وقف الخسارة أسفل القاع السابق (${swingLow.toFixed(5)}) مع رفض استمرار الهبوط وإغلاق صاعد.`,
          `Liquidity below swing low (${swingLow.toFixed(5)}) swept with immediate failure and bullish rejection close.`
        );
      }

      // -------------------------------------------------------------
      // 11. BREAK OF STRUCTURE (BOS)
      // -------------------------------------------------------------
      // Bullish BOS: Candle closes with substantial body above key swing high
      if (c0.close > swingHigh && c1.close <= swingHigh && bodyRatio0 >= 0.45 && isBullish0) {
        add(
          'BOS_BULLISH',
          'كسر هيكل صاعد (Bullish Break of Structure - BOS)',
          'Bullish Break of Structure',
          'BUY',
          0.91,
          `اختراق صاعد مؤكد للقمة الهيكلية السابقة (${swingHigh.toFixed(5)}) بإغلاق شمعة صريح يؤكد استمرار الاتجاه الصاعد.`,
          `Structural breakout above swing high (${swingHigh.toFixed(5)}) with solid candle close confirming continuation.`
        );
      }

      // Bearish BOS: Candle closes with substantial body below key swing low
      if (c0.close < swingLow && c1.close >= swingLow && bodyRatio0 >= 0.45 && isBearish0) {
        add(
          'BOS_BEARISH',
          'كسر هيكل هابط (Bearish Break of Structure - BOS)',
          'Bearish Break of Structure',
          'SELL',
          0.91,
          `كسر هابط مؤكد للقاع الهيكلي السابق (${swingLow.toFixed(5)}) بإغلاق شمعة صريح يؤكد استمرار الضغط الهابط.`,
          `Structural breakdown below swing low (${swingLow.toFixed(5)}) with solid candle close confirming continuation.`
        );
      }
    }

    // -------------------------------------------------------------
    // 12. BOLLINGER BANDS SQUEEZE & BREAKOUT (Section 4)
    // -------------------------------------------------------------
    const bb = calculateBollingerBands(candles.map((c) => c.close), 20, 2);
    if (bb && bb.bandwidth <= 0.008) {
      if (c0.close > bb.upper && isBullish0) {
        add(
          'BOLLINGER_SQUEEZE_BUY',
          'انفجار سعري بعد انضغاط بولينجر صاعد (BB Squeeze BUY)',
          'Bollinger Squeeze Bullish Expansion',
          'BUY',
          0.86,
          'انضغاط في نطاق البولينجر تلاه إغلاق اختراق صاعد مؤكد خارج النطاق العلوي.',
          'Tight Bollinger squeeze followed by confirmed breakout close above upper band.'
        );
      } else if (c0.close < bb.lower && isBearish0) {
        add(
          'BOLLINGER_SQUEEZE_SELL',
          'انفجار سعري بعد انضغاط بولينجر هابط (BB Squeeze SELL)',
          'Bollinger Squeeze Bearish Expansion',
          'SELL',
          0.86,
          'انضغاط في نطاق البولينجر تلاه إغلاق كسر هابط مؤكد خارج النطاق السفلي.',
          'Tight Bollinger squeeze followed by confirmed breakdown close below lower band.'
        );
      }
    }

    // -------------------------------------------------------------
    // 13. PULLBACK CONTINUATION (EMA 20 / EMA 50) - Section 4
    // -------------------------------------------------------------
    const closes = candles.map((c) => c.close);
    const ema20 = calculateEMA(closes, 20);
    const ema50 = calculateEMA(closes, 50);

    if (ema20 !== null && ema50 !== null) {
      // Bullish Trend: EMA 20 > EMA 50, price pulled back near EMA 20, now rejected upwards
      if (ema20 > ema50 && c0.low <= ema20 * 1.0015 && c0.close > ema20 && isBullish0) {
        add(
          'PULLBACK_CONTINUATION_BUY',
          'استمرار الاتجاه بعد تصحيح صاعد (Pullback Continuation BUY)',
          'Bullish Pullback Continuation',
          'BUY',
          0.88,
          `تصحيح صحي نحو متوسط EMA 20 (${ema20.toFixed(5)}) متبوعاً بارتداد صاعد مؤكد في اتجاه الصعود العام.`,
          `Healthy pullback into EMA 20 (${ema20.toFixed(5)}) followed by bullish bounce confirming trend continuation.`
        );
      }

      // Bearish Trend: EMA 20 < EMA 50, price pulled back near EMA 20, now rejected downwards
      if (ema20 < ema50 && c0.high >= ema20 * 0.9985 && c0.close < ema20 && isBearish0) {
        add(
          'PULLBACK_CONTINUATION_SELL',
          'استمرار الاتجاه بعد تصحيح هابط (Pullback Continuation SELL)',
          'Bearish Pullback Continuation',
          'SELL',
          0.88,
          `تصحيح صاعد نحو متوسط EMA 20 (${ema20.toFixed(5)}) متبوعاً بارتداد هابط مؤكد في اتجاه الهبوط العام.`,
          `Upward correction into EMA 20 (${ema20.toFixed(5)}) followed by bearish rejection confirming trend continuation.`
        );
      }
    }

    // -------------------------------------------------------------
    // 14. RSI DIVERGENCE (Section 4)
    // -------------------------------------------------------------
    const rsi14 = calculateRSI(closes, 14);
    if (rsi14 !== null && candles.length >= 25) {
      const prevPivot = candles[n - 12];
      const prevCloses = closes.slice(0, n - 11);
      const prevRsi = calculateRSI(prevCloses, 14);

      if (prevRsi !== null) {
        // Bullish Divergence: Price Lower Low, RSI Higher Low
        if (c0.low < prevPivot.low && rsi14 > prevRsi + 2.5 && isBullish0) {
          add(
            'RSI_DIVERGENCE_BULLISH',
            'انفراج صاعد في مؤشر القوة النسبية (Bullish RSI Divergence)',
            'Bullish RSI Divergence',
            'BUY',
            0.87,
            `السعر حقق قاعاً أقل بينما مؤشر RSI حقق قاعاً أعلى (${rsi14.toFixed(1)} > ${prevRsi.toFixed(1)}) دلالة على ضعف الزخم الهابط.`,
            `Price formed lower low while RSI formed higher low indicating bullish momentum divergence.`
          );
        }
        // Bearish Divergence: Price Higher High, RSI Lower High
        if (c0.high > prevPivot.high && rsi14 < prevRsi - 2.5 && isBearish0) {
          add(
            'RSI_DIVERGENCE_BEARISH',
            'انفراج هابط في مؤشر القوة النسبية (Bearish RSI Divergence)',
            'Bearish RSI Divergence',
            'SELL',
            0.87,
            `السعر حقق قمة أعلى بينما مؤشر RSI حقق قمة أقل (${rsi14.toFixed(1)} < ${prevRsi.toFixed(1)}) دلالة على ضعف المشترين.`,
            `Price formed higher high while RSI formed lower high indicating bearish momentum divergence.`
          );
        }
      }
    }

    // Sort patterns by confidence descending
    detected.sort((a, b) => b.confidence - a.confidence);

    return {
      patterns: detected,
      primaryPattern: detected.length > 0 ? detected[0] : null,
      isDojiOrHesitation,
      atr,
      upperWickRatio: upperWickRatio0,
      lowerWickRatio: lowerWickRatio0,
      bodyRatio: bodyRatio0,
    };
  }
}
