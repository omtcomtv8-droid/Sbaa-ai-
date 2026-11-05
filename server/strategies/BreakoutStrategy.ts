import { BreakoutConfig, Candle, StrategyResult } from '../types';
import { calculateATR, calculateHighestHigh, calculateLowestLow } from '../indicators';

export class BreakoutStrategy {
  public static evaluate(candles: Candle[], config: BreakoutConfig): StrategyResult {
    const candleTimestamp = candles.length > 0 ? candles[candles.length - 1].time : 0;

    if (!config.enabled) {
      return {
        strategyId: 'breakout',
        strategyName: 'Volatility Breakout',
        signal: 'WAIT',
        score: 0,
        weight: config.weight,
        reasons: ['Strategy disabled in settings'],
        candleTimestamp,
        dataValid: true,
      };
    }

    if (candles.length < config.lookback + 5) {
      return {
        strategyId: 'breakout',
        strategyName: 'Volatility Breakout',
        signal: 'WAIT',
        score: 0,
        weight: config.weight,
        reasons: [`Accumulating candles for Breakout lookback (${config.lookback})`],
        candleTimestamp,
        dataValid: false,
      };
    }

    const curr = candles[candles.length - 1];
    const prevCandles = candles.slice(0, -1);

    const highestHigh = calculateHighestHigh(prevCandles, config.lookback);
    const lowestLow = calculateLowestLow(prevCandles, config.lookback);
    const atrData = calculateATR(candles, 14);

    if (highestHigh === null || lowestLow === null) {
      return {
        strategyId: 'breakout',
        strategyName: 'Volatility Breakout',
        signal: 'WAIT',
        score: 0,
        weight: config.weight,
        reasons: ['Breakout levels calculating'],
        candleTimestamp,
        dataValid: false,
      };
    }

    const currRange = curr.high - curr.low;
    const isRangeExpanding = atrData ? currRange >= atrData.currentATR * config.atrFilterMultiplier : true;

    // Bullish Breakout: Closed cleanly above previous N-period highest high with range expansion
    if (curr.close > highestHigh && curr.close > curr.open && isRangeExpanding) {
      return {
        strategyId: 'breakout',
        strategyName: 'Volatility Breakout',
        signal: 'UP',
        score: config.weight * 2,
        weight: config.weight,
        reasons: [
          `Bullish Breakout: Candle closed (${curr.close.toFixed(5)}) above ${config.lookback}-period resistance (${highestHigh.toFixed(5)})`,
          `ATR Volatility expansion confirmed (${(currRange / (atrData?.currentATR || 1)).toFixed(2)}x ATR)`,
        ],
        candleTimestamp,
        dataValid: true,
      };
    }

    // Bearish Breakdown: Closed cleanly below previous N-period lowest low with range expansion
    if (curr.close < lowestLow && curr.close < curr.open && isRangeExpanding) {
      return {
        strategyId: 'breakout',
        strategyName: 'Volatility Breakout',
        signal: 'DOWN',
        score: -config.weight * 2,
        weight: config.weight,
        reasons: [
          `Bearish Breakdown: Candle closed (${curr.close.toFixed(5)}) below ${config.lookback}-period support (${lowestLow.toFixed(5)})`,
          `ATR Volatility expansion confirmed (${(currRange / (atrData?.currentATR || 1)).toFixed(2)}x ATR)`,
        ],
        candleTimestamp,
        dataValid: true,
      };
    }

    return {
      strategyId: 'breakout',
      strategyName: 'Volatility Breakout',
      signal: 'WAIT',
      score: 0,
      weight: config.weight,
      reasons: [
        `Inside ${config.lookback}-period breakout boundaries (Resistance: ${highestHigh.toFixed(5)}, Support: ${lowestLow.toFixed(5)})`,
      ],
      candleTimestamp,
      dataValid: true,
    };
  }
}
