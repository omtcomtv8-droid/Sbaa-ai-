import { Candle, DetectedPattern } from './types';

export class CandlestickPatternEngine {
  /**
   * Evaluates the candle series and returns the most prominent pattern detected on the latest closed candle.
   */
  public static detect(candles: Candle[]): DetectedPattern | null {
    if (candles.length < 2) return null;

    const n = candles.length;
    const curr = candles[n - 1];
    const prev = candles[n - 2];
    const prev2 = n >= 3 ? candles[n - 3] : null;

    const currBody = Math.abs(curr.close - curr.open);
    const currRange = curr.high - curr.low;
    if (currRange === 0) return null;

    const currUpperWick = curr.high - Math.max(curr.open, curr.close);
    const currLowerWick = Math.min(curr.open, curr.close) - curr.low;
    const currBodyRatio = currBody / currRange;

    const isCurrBullish = curr.close > curr.open;
    const isCurrBearish = curr.close < curr.open;

    const prevBody = Math.abs(prev.close - prev.open);
    const prevRange = prev.high - prev.low;
    const isPrevBullish = prev.close > prev.open;
    const isPrevBearish = prev.close < prev.open;

    // 1. Morning Star (3-bar bullish reversal)
    if (prev2 && isPrevBearish && prev2.close < prev2.open) {
      const isStarSmall = prevBody / (prevRange || 1) < 0.35;
      const starGappedOrLower = prev.close <= prev2.close;
      const currClosesDeep = curr.close >= prev2.open - (prev2.open - prev2.close) * 0.5;
      if (isStarSmall && starGappedOrLower && isCurrBullish && currClosesDeep) {
        return {
          name: 'Morning Star',
          bias: 'BULLISH',
          strength: 3,
          description: 'Three-candle bullish reversal pattern confirming downside exhaustion and strong buyer influx.',
          candleTimestamp: curr.time,
        };
      }
    }

    // 2. Evening Star (3-bar bearish reversal)
    if (prev2 && prev2.close > prev2.open) {
      const isStarSmall = prevBody / (prevRange || 1) < 0.35;
      const starGappedOrHigher = prev.close >= prev2.close;
      const currClosesDeep = curr.close <= prev2.open + (prev2.close - prev2.open) * 0.5;
      if (isStarSmall && starGappedOrHigher && isCurrBearish && currClosesDeep) {
        return {
          name: 'Evening Star',
          bias: 'BEARISH',
          strength: 3,
          description: 'Three-candle bearish reversal pattern confirming upside rejection and strong seller influx.',
          candleTimestamp: curr.time,
        };
      }
    }

    // 3. Three White Soldiers (Strong Bullish Continuation)
    if (prev2 && isCurrBullish && isPrevBullish && prev2.close > prev2.open) {
      if (
        curr.close > prev.close &&
        prev.close > prev2.close &&
        curr.open > prev.open &&
        currUpperWick <= currRange * 0.25
      ) {
        return {
          name: 'Three White Soldiers',
          bias: 'BULLISH',
          strength: 3,
          description: 'Three consecutive strong upward candles with progressive higher closes demonstrating sustained demand.',
          candleTimestamp: curr.time,
        };
      }
    }

    // 4. Three Black Crows (Strong Bearish Continuation)
    if (prev2 && isCurrBearish && isPrevBearish && prev2.close < prev2.open) {
      if (
        curr.close < prev.close &&
        prev.close < prev2.close &&
        curr.open < prev.open &&
        currLowerWick <= currRange * 0.25
      ) {
        return {
          name: 'Three Black Crows',
          bias: 'BEARISH',
          strength: 3,
          description: 'Three consecutive strong downward candles with progressive lower closes demonstrating heavy distribution.',
          candleTimestamp: curr.time,
        };
      }
    }

    // 5. Bullish Engulfing
    if (
      isPrevBearish &&
      isCurrBullish &&
      curr.open <= prev.close &&
      curr.close >= prev.open &&
      currBody > prevBody * 1.05
    ) {
      return {
        name: 'Bullish Engulfing',
        bias: 'BULLISH',
        strength: 2,
        description: 'Current bullish candle body completely engulfs previous bearish candle, signaling bullish takeover.',
        candleTimestamp: curr.time,
      };
    }

    // 6. Bearish Engulfing
    if (
      isPrevBullish &&
      isCurrBearish &&
      curr.open >= prev.close &&
      curr.close <= prev.open &&
      currBody > prevBody * 1.05
    ) {
      return {
        name: 'Bearish Engulfing',
        bias: 'BEARISH',
        strength: 2,
        description: 'Current bearish candle body completely engulfs previous bullish candle, signaling bearish takeover.',
        candleTimestamp: curr.time,
      };
    }

    // 7. Piercing Pattern (Bullish)
    if (
      isPrevBearish &&
      isCurrBullish &&
      curr.open < prev.low &&
      curr.close > prev.close + prevBody * 0.5 &&
      curr.close < prev.open
    ) {
      return {
        name: 'Piercing Pattern',
        bias: 'BULLISH',
        strength: 2,
        description: 'Bullish candle opened below previous low and closed past 50% midpoint of the previous red body.',
        candleTimestamp: curr.time,
      };
    }

    // 8. Dark Cloud Cover (Bearish)
    if (
      isPrevBullish &&
      isCurrBearish &&
      curr.open > prev.high &&
      curr.close < prev.open - prevBody * 0.5 &&
      curr.close > prev.open
    ) {
      return {
        name: 'Dark Cloud Cover',
        bias: 'BEARISH',
        strength: 2,
        description: 'Bearish candle opened above previous high and closed past 50% midpoint of previous green body.',
        candleTimestamp: curr.time,
      };
    }

    // 9. Bullish Harami
    if (
      isPrevBearish &&
      isCurrBullish &&
      curr.open > prev.close &&
      curr.close < prev.open &&
      currBody < prevBody * 0.6
    ) {
      return {
        name: 'Bullish Harami',
        bias: 'BULLISH',
        strength: 1,
        description: 'Small bullish inside candle following a large bearish bar, suggesting selling exhaustion.',
        candleTimestamp: curr.time,
      };
    }

    // 10. Bearish Harami
    if (
      isPrevBullish &&
      isCurrBearish &&
      curr.open < prev.close &&
      curr.close > prev.open &&
      currBody < prevBody * 0.6
    ) {
      return {
        name: 'Bearish Harami',
        bias: 'BEARISH',
        strength: 1,
        description: 'Small bearish inside candle following a large bullish bar, suggesting buying exhaustion.',
        candleTimestamp: curr.time,
      };
    }

    // 11. Hammer / Bullish Pinbar
    if (currLowerWick >= 2 * currBody && currUpperWick <= 0.2 * currRange && currBodyRatio <= 0.35) {
      return {
        name: 'Hammer / Bullish Pinbar',
        bias: 'BULLISH',
        strength: 2,
        description: 'Long lower shadow with small upper body reflecting aggressive rejection of lower prices.',
        candleTimestamp: curr.time,
      };
    }

    // 12. Shooting Star / Bearish Pinbar
    if (currUpperWick >= 2 * currBody && currLowerWick <= 0.2 * currRange && currBodyRatio <= 0.35) {
      return {
        name: 'Shooting Star / Bearish Pinbar',
        bias: 'BEARISH',
        strength: 2,
        description: 'Long upper shadow with small lower body reflecting aggressive rejection of higher prices.',
        candleTimestamp: curr.time,
      };
    }

    // 13. Marubozu (Strong directional trend impulse)
    if (currBodyRatio >= 0.85) {
      return {
        name: isCurrBullish ? 'Bullish Marubozu' : 'Bearish Marubozu',
        bias: isCurrBullish ? 'BULLISH' : 'BEARISH',
        strength: 2,
        description: isCurrBullish
          ? 'Full-bodied green candle with negligible wicks displaying dominant buyer dominance.'
          : 'Full-bodied red candle with negligible wicks displaying dominant seller dominance.',
        candleTimestamp: curr.time,
      };
    }

    // 14. Inside Bar
    if (curr.high < prev.high && curr.low > prev.low) {
      return {
        name: 'Inside Bar (Compression)',
        bias: 'NEUTRAL',
        strength: 1,
        description: 'Price compressed completely within previous candle range, building energy for a directional breakout.',
        candleTimestamp: curr.time,
      };
    }

    // 15. Outside Bar
    if (curr.high > prev.high && curr.low < prev.low) {
      return {
        name: 'Outside Bar (Volatility Expansion)',
        bias: isCurrBullish ? 'BULLISH' : 'BEARISH',
        strength: 1,
        description: 'Candle engulfs previous high and low, demonstrating volatility expansion.',
        candleTimestamp: curr.time,
      };
    }

    // 16. Doji (Indecision)
    if (currBodyRatio <= 0.1) {
      let subtype = 'Neutral Doji';
      if (currUpperWick >= currRange * 0.6) subtype = 'Gravestone Doji (Bearish Bias)';
      else if (currLowerWick >= currRange * 0.6) subtype = 'Dragonfly Doji (Bullish Bias)';

      return {
        name: subtype,
        bias: subtype.includes('Bullish') ? 'BULLISH' : subtype.includes('Bearish') ? 'BEARISH' : 'NEUTRAL',
        strength: 1,
        description: 'Open and close are nearly identical, showing market equilibrium and hesitation between buyers and sellers.',
        candleTimestamp: curr.time,
      };
    }

    return null;
  }
}
