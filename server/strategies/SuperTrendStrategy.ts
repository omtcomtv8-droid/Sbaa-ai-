import { Candle, StrategyResult, StrategyCondition } from '../types';
import { calculateATR } from '../indicators';

export class SuperTrendStrategy {
  public static evaluate(
    candles: Candle[],
    config = { enabled: true, period: 10, multiplier: 3, weight: 1.1 }
  ): StrategyResult {
    const candleTimestamp = candles.length > 0 ? candles[candles.length - 1].time : 0;

    if (!config.enabled || candles.length < config.period + 5) {
      return {
        strategyId: 'supertrend',
        strategyName: 'SuperTrend Dynamic Volatility',
        signal: 'WAIT',
        score: 0,
        weight: config.weight,
        reasons: [`Accumulating candles for SuperTrend (${candles.length}/${config.period + 5})`],
        candleTimestamp,
        dataValid: candles.length >= config.period + 5,
        bullishScore: 0,
        bearishScore: 0,
        percentage: 0,
        direction: 'NEUTRAL',
        conditions: [],
      };
    }

    const atr = calculateATR(candles, config.period);
    if (!atr) {
      return {
        strategyId: 'supertrend',
        strategyName: 'SuperTrend Dynamic Volatility',
        signal: 'WAIT',
        score: 0,
        weight: config.weight,
        reasons: ['ATR calculation pending'],
        candleTimestamp,
        dataValid: false,
        bullishScore: 0,
        bearishScore: 0,
        percentage: 0,
        direction: 'NEUTRAL',
        conditions: [],
      };
    }

    const last = candles[candles.length - 1];
    const prev = candles[candles.length - 2];
    const hl2 = (last.high + last.low) / 2;
    const atrNum = Number(atr);
    const upperBand = hl2 + config.multiplier * atrNum;
    const lowerBand = hl2 - config.multiplier * atrNum;

    if (last.close > upperBand || (last.close > prev.close && last.close > hl2)) {
      const conditions: StrategyCondition[] = [
        { id: 'supertrend_bull', name: 'SuperTrend Bullish Shift', satisfied: true, weight: 1 },
        { id: 'vol_expansion_up', name: 'Volatility expansion above band', satisfied: true, weight: 1 },
      ];
      return {
        strategyId: 'supertrend',
        strategyName: 'SuperTrend Dynamic Volatility',
        signal: 'UP',
        score: 1.25,
        weight: config.weight,
        reasons: ['Price breaking out above SuperTrend dynamic resistance'],
        candleTimestamp,
        dataValid: true,
        bullishScore: 1.25,
        bearishScore: 0,
        percentage: 75,
        direction: 'BULLISH',
        conditions,
      };
    }

    if (last.close < lowerBand || (last.close < prev.close && last.close < hl2)) {
      const conditions: StrategyCondition[] = [
        { id: 'supertrend_bear', name: 'SuperTrend Bearish Shift', satisfied: true, weight: 1 },
        { id: 'vol_expansion_down', name: 'Volatility compression below band', satisfied: true, weight: 1 },
      ];
      return {
        strategyId: 'supertrend',
        strategyName: 'SuperTrend Dynamic Volatility',
        signal: 'DOWN',
        score: -1.25,
        weight: config.weight,
        reasons: ['Price breaking down below SuperTrend dynamic support'],
        candleTimestamp,
        dataValid: true,
        bullishScore: 0,
        bearishScore: 1.25,
        percentage: 75,
        direction: 'BEARISH',
        conditions,
      };
    }

    return {
      strategyId: 'supertrend',
      strategyName: 'SuperTrend Dynamic Volatility',
      signal: 'WAIT',
      score: 0,
      weight: config.weight,
      reasons: ['Price tracking inside SuperTrend envelope'],
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
