import { Candle, MarketStructure } from './types';
import { calculateADX, calculateEMA, calculateSMA } from './indicators';

export interface TrendAnalysisResult {
  trendDirection: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  trendStrength: 'STRONG' | 'MODERATE' | 'WEAK';
  marketStructure: MarketStructure;
  reasons: string[];
}

export class TrendAnalysisEngine {
  /**
   * Analyzes trend direction, moving average alignment, and swing high/low market structure.
   */
  public static analyze(
    candles: Candle[],
    fastPeriod: number = 9,
    slowPeriod: number = 21,
    filterPeriod: number = 50
  ): TrendAnalysisResult {
    if (candles.length < 15) {
      return {
        trendDirection: 'NEUTRAL',
        trendStrength: 'WEAK',
        marketStructure: {
          state: 'UNCERTAIN',
          lastSwingHigh: null,
          lastSwingLow: null,
          details: 'Insufficient candles for market structure analysis',
        },
        reasons: ['Awaiting more closed candles for trend analysis'],
      };
    }

    const closes = candles.map((c) => c.close);
    const emaFast = calculateEMA(closes, fastPeriod);
    const emaSlow = calculateEMA(closes, slowPeriod);
    const smaFilter = calculateSMA(closes, filterPeriod) ?? calculateSMA(closes, 20);
    const currentPrice = closes[closes.length - 1];

    const reasons: string[] = [];
    let bullishPoints = 0;
    let bearishPoints = 0;

    // 1. Moving Average Alignment
    if (emaFast !== null && emaSlow !== null) {
      if (emaFast > emaSlow) {
        bullishPoints += 2;
        reasons.push(`EMA ${fastPeriod} (${emaFast}) > EMA ${slowPeriod} (${emaSlow}) bullish alignment`);
      } else if (emaFast < emaSlow) {
        bearishPoints += 2;
        reasons.push(`EMA ${fastPeriod} (${emaFast}) < EMA ${slowPeriod} (${emaSlow}) bearish alignment`);
      }
    }

    // 2. Price Relative to Baseline SMA
    if (smaFilter !== null) {
      if (currentPrice > smaFilter) {
        bullishPoints += 1;
        reasons.push(`Price (${currentPrice}) trading above baseline SMA (${smaFilter})`);
      } else if (currentPrice < smaFilter) {
        bearishPoints += 1;
        reasons.push(`Price (${currentPrice}) trading below baseline SMA (${smaFilter})`);
      }
    }

    // 3. Market Structure Swing Highs and Lows (Peak detection)
    const marketStructure = this.detectMarketStructure(candles);
    if (marketStructure.state === 'BULLISH_STRUCTURE') {
      bullishPoints += 2;
      reasons.push('Price action confirms Higher Highs (HH) and Higher Lows (HL) progression');
    } else if (marketStructure.state === 'BEARISH_STRUCTURE') {
      bearishPoints += 2;
      reasons.push('Price action confirms Lower Highs (LH) and Lower Lows (LL) progression');
    }

    // 4. ADX Trend Strength Check
    const adxData = calculateADX(candles, 14);
    let trendStrength: 'STRONG' | 'MODERATE' | 'WEAK' = 'MODERATE';
    if (adxData) {
      if (adxData.adx >= 30) {
        trendStrength = 'STRONG';
        reasons.push(`ADX confirms strong directional momentum (${adxData.adx})`);
      } else if (adxData.adx < 20) {
        trendStrength = 'WEAK';
        reasons.push(`ADX indicates ranging / low directional strength (${adxData.adx})`);
      }
    }

    let trendDirection: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    if (bullishPoints >= 3 && bullishPoints > bearishPoints) {
      trendDirection = 'BULLISH';
    } else if (bearishPoints >= 3 && bearishPoints > bullishPoints) {
      trendDirection = 'BEARISH';
    } else {
      trendDirection = 'NEUTRAL';
    }

    return {
      trendDirection,
      trendStrength,
      marketStructure,
      reasons,
    };
  }

  /**
   * Identifies swing points (local extrema) to determine HH/HL or LH/LL market structure.
   */
  public static detectMarketStructure(candles: Candle[], lookback: number = 2): MarketStructure {
    if (candles.length < 15) {
      return {
        state: 'UNCERTAIN',
        lastSwingHigh: null,
        lastSwingLow: null,
        details: 'Insufficient data for swing structure',
      };
    }

    const swingHighs: { price: number; time: number; index: number }[] = [];
    const swingLows: { price: number; time: number; index: number }[] = [];

    // Find local peaks and valleys
    for (let i = lookback; i < candles.length - lookback; i++) {
      const c = candles[i];
      let isHigh = true;
      let isLow = true;

      for (let j = 1; j <= lookback; j++) {
        if (candles[i - j].high >= c.high || candles[i + j].high >= c.high) isHigh = false;
        if (candles[i - j].low <= c.low || candles[i + j].low <= c.low) isLow = false;
      }

      if (isHigh) swingHighs.push({ price: c.high, time: c.time, index: i });
      if (isLow) swingLows.push({ price: c.low, time: c.time, index: i });
    }

    const lastHigh = swingHighs.length > 0 ? swingHighs[swingHighs.length - 1].price : null;
    const lastLow = swingLows.length > 0 ? swingLows[swingLows.length - 1].price : null;

    if (swingHighs.length < 2 || swingLows.length < 2) {
      return {
        state: 'UNCERTAIN',
        lastSwingHigh: lastHigh,
        lastSwingLow: lastLow,
        details: 'Accumulating swing points',
      };
    }

    const h2 = swingHighs[swingHighs.length - 1].price;
    const h1 = swingHighs[swingHighs.length - 2].price;
    const l2 = swingLows[swingLows.length - 1].price;
    const l1 = swingLows[swingLows.length - 2].price;

    const isHigherHigh = h2 > h1;
    const isHigherLow = l2 > l1;
    const isLowerHigh = h2 < h1;
    const isLowerLow = l2 < l1;

    if (isHigherHigh && isHigherLow) {
      return {
        state: 'BULLISH_STRUCTURE',
        lastSwingHigh: h2,
        lastSwingLow: l2,
        details: `Bullish HH (${h2.toFixed(5)}) & HL (${l2.toFixed(5)}) established`,
      };
    }

    if (isLowerHigh && isLowerLow) {
      return {
        state: 'BEARISH_STRUCTURE',
        lastSwingHigh: h2,
        lastSwingLow: l2,
        details: `Bearish LH (${h2.toFixed(5)}) & LL (${l2.toFixed(5)}) established`,
      };
    }

    return {
      state: 'RANGING_STRUCTURE',
      lastSwingHigh: h2,
      lastSwingLow: l2,
      details: `Mixed swing structure (H: ${h2.toFixed(5)}, L: ${l2.toFixed(5)}) - ranging/indecisive`,
    };
  }
}
