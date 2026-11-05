import { Candle, StrategyResult, StrategyCondition } from '../types';

export class PivotPointStrategy {
  public static evaluate(candles: Candle[], config = { enabled: true, weight: 1.0 }): StrategyResult {
    const candleTimestamp = candles.length > 0 ? candles[candles.length - 1].time : 0;

    if (!config.enabled || candles.length < 15) {
      return {
        strategyId: 'pivot_point',
        strategyName: 'Standard Floor Pivots',
        signal: 'WAIT',
        score: 0,
        weight: config.weight,
        reasons: ['Accumulating candles for Floor Pivots calculation'],
        candleTimestamp,
        dataValid: candles.length >= 15,
        bullishScore: 0,
        bearishScore: 0,
        percentage: 0,
        direction: 'NEUTRAL',
        conditions: [],
      };
    }

    const prevCandle = candles[candles.length - 2];
    const lastCandle = candles[candles.length - 1];

    const pivot = (prevCandle.high + prevCandle.low + prevCandle.close) / 3;
    const r1 = 2 * pivot - prevCandle.low;
    const s1 = 2 * pivot - prevCandle.high;

    if (lastCandle.close > pivot && prevCandle.close <= pivot) {
      const conditions: StrategyCondition[] = [
        { id: 'above_pivot', name: 'Above central pivot', satisfied: true, weight: 1 },
        { id: 'target_r1', name: 'Targeting R1', satisfied: true, weight: 1 },
      ];
      return {
        strategyId: 'pivot_point',
        strategyName: 'Standard Floor Pivots',
        signal: 'UP',
        score: 1.1,
        weight: config.weight,
        reasons: [`Price crossed above central pivot ${pivot.toFixed(5)} targeting R1 ${r1.toFixed(5)}`],
        candleTimestamp,
        dataValid: true,
        bullishScore: 1.1,
        bearishScore: 0,
        percentage: 65,
        direction: 'BULLISH',
        conditions,
      };
    }

    if (lastCandle.close < pivot && prevCandle.close >= pivot) {
      const conditions: StrategyCondition[] = [
        { id: 'below_pivot', name: 'Below central pivot', satisfied: true, weight: 1 },
        { id: 'target_s1', name: 'Targeting S1', satisfied: true, weight: 1 },
      ];
      return {
        strategyId: 'pivot_point',
        strategyName: 'Standard Floor Pivots',
        signal: 'DOWN',
        score: -1.1,
        weight: config.weight,
        reasons: [`Price crossed below central pivot ${pivot.toFixed(5)} targeting S1 ${s1.toFixed(5)}`],
        candleTimestamp,
        dataValid: true,
        bullishScore: 0,
        bearishScore: 1.1,
        percentage: 65,
        direction: 'BEARISH',
        conditions,
      };
    }

    return {
      strategyId: 'pivot_point',
      strategyName: 'Standard Floor Pivots',
      signal: 'WAIT',
      score: 0,
      weight: config.weight,
      reasons: ['Price hovering near central pivot equilibrium'],
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
