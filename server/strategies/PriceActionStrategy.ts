import { Candle, StrategyResult, StrategyCondition } from '../types';

export class PriceActionStrategy {
  public static evaluate(candles: Candle[], config = { enabled: true, weight: 1.1 }): StrategyResult {
    const candleTimestamp = candles.length > 0 ? candles[candles.length - 1].time : 0;

    if (!config.enabled || candles.length < 5) {
      return {
        strategyId: 'price_action',
        strategyName: 'Price Action Wick Dynamics',
        signal: 'WAIT',
        score: 0,
        weight: config.weight,
        reasons: ['Need at least 5 candles for price action pinbar / rejection scan'],
        candleTimestamp,
        dataValid: candles.length >= 5,
        bullishScore: 0,
        bearishScore: 0,
        percentage: 0,
        direction: 'NEUTRAL',
        conditions: [],
      };
    }

    const last = candles[candles.length - 1];
    const totalRange = last.high - last.low;
    if (totalRange <= 0) {
      return {
        strategyId: 'price_action',
        strategyName: 'Price Action Wick Dynamics',
        signal: 'WAIT',
        score: 0,
        weight: config.weight,
        reasons: ['Zero range candle'],
        candleTimestamp,
        dataValid: true,
        bullishScore: 0,
        bearishScore: 0,
        percentage: 50,
        direction: 'NEUTRAL',
        conditions: [],
      };
    }

    const body = Math.abs(last.close - last.open);
    const lowerWick = Math.min(last.open, last.close) - last.low;
    const upperWick = last.high - Math.max(last.open, last.close);

    // Bullish Pinbar / Rejection: lower wick > 60% of total range
    if (lowerWick / totalRange >= 0.6 && body / totalRange <= 0.3) {
      const conditions: StrategyCondition[] = [
        { id: 'lower_shadow', name: 'Long lower shadow', satisfied: true, weight: 1 },
        { id: 'absorption', name: 'Supply absorption', satisfied: true, weight: 1 },
      ];
      return {
        strategyId: 'price_action',
        strategyName: 'Price Action Wick Dynamics',
        signal: 'UP',
        score: 1.3,
        weight: config.weight,
        reasons: ['Bullish rejection wick detected: institutional buying absorbed lower supply'],
        candleTimestamp,
        dataValid: true,
        bullishScore: 1.3,
        bearishScore: 0,
        percentage: 75,
        direction: 'BULLISH',
        conditions,
      };
    }

    // Bearish Pinbar / Rejection: upper wick > 60% of total range
    if (upperWick / totalRange >= 0.6 && body / totalRange <= 0.3) {
      const conditions: StrategyCondition[] = [
        { id: 'upper_shadow', name: 'Long upper shadow', satisfied: true, weight: 1 },
        { id: 'rejection', name: 'Demand rejection', satisfied: true, weight: 1 },
      ];
      return {
        strategyId: 'price_action',
        strategyName: 'Price Action Wick Dynamics',
        signal: 'DOWN',
        score: -1.3,
        weight: config.weight,
        reasons: ['Bearish rejection wick detected: institutional selling rejected higher demand'],
        candleTimestamp,
        dataValid: true,
        bullishScore: 0,
        bearishScore: 1.3,
        percentage: 75,
        direction: 'BEARISH',
        conditions,
      };
    }

    return {
      strategyId: 'price_action',
      strategyName: 'Price Action Wick Dynamics',
      signal: 'WAIT',
      score: 0,
      weight: config.weight,
      reasons: ['Normal candle body without dominant rejection wick'],
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
