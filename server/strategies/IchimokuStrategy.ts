import { Candle, StrategyResult, StrategyCondition } from '../types';

export class IchimokuStrategy {
  public static evaluate(candles: Candle[], config = { enabled: true, weight: 1.0 }): StrategyResult {
    const candleTimestamp = candles.length > 0 ? candles[candles.length - 1].time : 0;

    if (!config.enabled || candles.length < 26) {
      return {
        strategyId: 'ichimoku_cloud',
        strategyName: 'Ichimoku Cloud',
        signal: 'WAIT',
        score: 0,
        weight: config.weight,
        reasons: ['Accumulating candles for Ichimoku Cloud (need at least 26)'],
        candleTimestamp,
        dataValid: candles.length >= 26,
        bullishScore: 0,
        bearishScore: 0,
        percentage: 0,
        direction: 'NEUTRAL',
        conditions: [],
      };
    }

    const tenkanCandles = candles.slice(-9);
    const kijunCandles = candles.slice(-26);

    const tenkanHigh = Math.max(...tenkanCandles.map((c) => c.high));
    const tenkanLow = Math.min(...tenkanCandles.map((c) => c.low));
    const tenkan = (tenkanHigh + tenkanLow) / 2;

    const kijunHigh = Math.max(...kijunCandles.map((c) => c.high));
    const kijunLow = Math.min(...kijunCandles.map((c) => c.low));
    const kijun = (kijunHigh + kijunLow) / 2;

    const last = candles[candles.length - 1];

    if (last.close > tenkan && tenkan > kijun) {
      const conditions: StrategyCondition[] = [
        { id: 'tk_cross', name: 'TK Bullish Cross', satisfied: true, weight: 1 },
        { id: 'cloud_above', name: 'Above Kijun equilibrium', satisfied: true, weight: 1 },
      ];
      return {
        strategyId: 'ichimoku_cloud',
        strategyName: 'Ichimoku Cloud',
        signal: 'UP',
        score: 1.2,
        weight: config.weight,
        reasons: ['Price above Tenkan-sen and Tenkan above Kijun (TK Bull Cross)'],
        candleTimestamp,
        dataValid: true,
        bullishScore: 1.2,
        bearishScore: 0,
        percentage: 70,
        direction: 'BULLISH',
        conditions,
      };
    }

    if (last.close < tenkan && tenkan < kijun) {
      const conditions: StrategyCondition[] = [
        { id: 'tk_cross', name: 'TK Bearish Cross', satisfied: true, weight: 1 },
        { id: 'cloud_below', name: 'Below Kijun equilibrium', satisfied: true, weight: 1 },
      ];
      return {
        strategyId: 'ichimoku_cloud',
        strategyName: 'Ichimoku Cloud',
        signal: 'DOWN',
        score: -1.2,
        weight: config.weight,
        reasons: ['Price below Tenkan-sen and Tenkan below Kijun (TK Bear Cross)'],
        candleTimestamp,
        dataValid: true,
        bullishScore: 0,
        bearishScore: 1.2,
        percentage: 70,
        direction: 'BEARISH',
        conditions,
      };
    }

    return {
      strategyId: 'ichimoku_cloud',
      strategyName: 'Ichimoku Cloud',
      signal: 'WAIT',
      score: 0,
      weight: config.weight,
      reasons: ['Inside equilibrium range / Cloud neutral'],
      candleTimestamp,
      dataValid: true,
      bullishScore: 0,
      bearishScore: 0,
      percentage: 50,
      direction: 'NEUTRAL',
      conditions: [],
    };
  }
}
