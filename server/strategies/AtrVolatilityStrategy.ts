import { Candle, StrategyResult } from '../types';
import { calculateATR } from '../indicators';

export interface AtrVolatilityConfig {
  enabled: boolean;
  period: number;
  multiplier: number;
  weight: number;
}

export class AtrVolatilityStrategy {
  public static evaluate(
    candles: Candle[],
    config: AtrVolatilityConfig = { enabled: true, period: 14, multiplier: 1.35, weight: 1.1 }
  ): StrategyResult {
    const candleTimestamp = candles.length > 0 ? candles[candles.length - 1].time : 0;

    if (!config.enabled) {
      return {
        strategyId: 'atr_volatility',
        strategyName: 'ATR Volatility Expansion',
        signal: 'WAIT',
        score: 0,
        weight: config.weight,
        reasons: ['Strategy disabled in settings'],
        candleTimestamp,
        dataValid: true,
        bullishScore: 0,
        bearishScore: 0,
        percentage: 0,
        direction: 'NEUTRAL',
        conditions: [],
      };
    }

    if (candles.length < config.period + 10) {
      return {
        strategyId: 'atr_volatility',
        strategyName: 'ATR Volatility Expansion',
        signal: 'WAIT',
        score: 0,
        weight: config.weight,
        reasons: [`Accumulating candles for ATR (${candles.length}/${config.period + 10})`],
        candleTimestamp,
        dataValid: false,
        bullishScore: 0,
        bearishScore: 0,
        percentage: 0,
        direction: 'NEUTRAL',
        conditions: [],
      };
    }

    const atrData = calculateATR(candles, config.period);
    const curr = candles[candles.length - 1];

    if (!atrData) {
      return {
        strategyId: 'atr_volatility',
        strategyName: 'ATR Volatility Expansion',
        signal: 'WAIT',
        score: 0,
        weight: config.weight,
        reasons: ['Calculating ATR metrics'],
        candleTimestamp,
        dataValid: false,
        bullishScore: 0,
        bearishScore: 0,
        percentage: 0,
        direction: 'NEUTRAL',
        conditions: [],
      };
    }

    const isExpansion = atrData.currentATR > atrData.averageATR * config.multiplier;
    const isBullishCandle = curr.close > curr.open;
    const isBearishCandle = curr.close < curr.open;

    const conditions = [
      { name: `ATR Volatility Expansion (${atrData.currentATR.toFixed(5)} > ${atrData.averageATR.toFixed(5)} * ${config.multiplier})`, satisfied: isExpansion, weight: 50 },
      { name: 'Expansion Directional Candle', satisfied: isBullishCandle || isBearishCandle, weight: 50 },
    ];

    let bullishScore = isExpansion && isBullishCandle ? 80 : 20;
    let bearishScore = isExpansion && isBearishCandle ? 80 : 20;

    if (isExpansion && isBullishCandle) {
      return {
        strategyId: 'atr_volatility',
        strategyName: 'ATR Volatility Expansion',
        signal: 'UP',
        score: (bullishScore / 100) * config.weight * 2,
        weight: config.weight,
        reasons: [
          `ATR Volatility Expansion Bullish: Current ATR (${atrData.currentATR.toFixed(5)}) > Avg ATR (${atrData.averageATR.toFixed(5)})`,
        ],
        candleTimestamp,
        dataValid: true,
        bullishScore,
        bearishScore,
        percentage: bullishScore,
        direction: 'BULLISH',
        conditions,
      };
    }

    if (isExpansion && isBearishCandle) {
      return {
        strategyId: 'atr_volatility',
        strategyName: 'ATR Volatility Expansion',
        signal: 'DOWN',
        score: -(bearishScore / 100) * config.weight * 2,
        weight: config.weight,
        reasons: [
          `ATR Volatility Expansion Bearish: Current ATR (${atrData.currentATR.toFixed(5)}) > Avg ATR (${atrData.averageATR.toFixed(5)})`,
        ],
        candleTimestamp,
        dataValid: true,
        bullishScore,
        bearishScore,
        percentage: bearishScore,
        direction: 'BEARISH',
        conditions,
      };
    }

    return {
      strategyId: 'atr_volatility',
      strategyName: 'ATR Volatility Expansion',
      signal: 'WAIT',
      score: 0,
      weight: config.weight,
      reasons: [`ATR in normal/low volatility regime (${atrData.volatilityState})`],
      candleTimestamp,
      dataValid: true,
      bullishScore: 30,
      bearishScore: 30,
      percentage: Math.max(bullishScore, bearishScore),
      direction: 'NEUTRAL',
      conditions,
    };
  }
}
