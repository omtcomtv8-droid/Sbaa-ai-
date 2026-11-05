import { Candle, StrategyResult } from '../types';
import { calculateADX } from '../indicators';

export interface AdxTrendConfig {
  enabled: boolean;
  period: number;
  threshold: number;
  weight: number;
}

export class AdxTrendStrategy {
  public static evaluate(
    candles: Candle[],
    config: AdxTrendConfig = { enabled: true, period: 14, threshold: 25, weight: 1.3 }
  ): StrategyResult {
    const candleTimestamp = candles.length > 0 ? candles[candles.length - 1].time : 0;

    if (!config.enabled) {
      return {
        strategyId: 'adx_trend',
        strategyName: 'ADX Trend Strength',
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

    if (candles.length < config.period * 2 + 5) {
      return {
        strategyId: 'adx_trend',
        strategyName: 'ADX Trend Strength',
        signal: 'WAIT',
        score: 0,
        weight: config.weight,
        reasons: [`Accumulating candles for ADX (${candles.length}/${config.period * 2 + 5})`],
        candleTimestamp,
        dataValid: false,
        bullishScore: 0,
        bearishScore: 0,
        percentage: 0,
        direction: 'NEUTRAL',
        conditions: [],
      };
    }

    const adxData = calculateADX(candles, config.period);

    if (!adxData) {
      return {
        strategyId: 'adx_trend',
        strategyName: 'ADX Trend Strength',
        signal: 'WAIT',
        score: 0,
        weight: config.weight,
        reasons: ['Calculating ADX'],
        candleTimestamp,
        dataValid: false,
        bullishScore: 0,
        bearishScore: 0,
        percentage: 0,
        direction: 'NEUTRAL',
        conditions: [],
      };
    }

    const isStrongTrend = adxData.adx >= config.threshold;
    const isBullishDI = adxData.plusDI > adxData.minusDI;
    const isBearishDI = adxData.minusDI > adxData.plusDI;

    const conditions = [
      { name: `ADX (${adxData.adx.toFixed(1)}) >= ${config.threshold} (Strong Trend)`, satisfied: isStrongTrend, weight: 40 },
      { name: `+DI (${adxData.plusDI.toFixed(1)}) > -DI (${adxData.minusDI.toFixed(1)})`, satisfied: isBullishDI, weight: 60 },
      { name: `-DI (${adxData.minusDI.toFixed(1)}) > +DI (${adxData.plusDI.toFixed(1)})`, satisfied: isBearishDI, weight: 60 },
    ];

    let bullishScore = 0;
    if (isStrongTrend) bullishScore += 40;
    if (isBullishDI) bullishScore += 60;

    let bearishScore = 0;
    if (isStrongTrend) bearishScore += 40;
    if (isBearishDI) bearishScore += 60;

    if (isStrongTrend && isBullishDI) {
      return {
        strategyId: 'adx_trend',
        strategyName: 'ADX Trend Strength',
        signal: 'UP',
        score: (bullishScore / 100) * config.weight * 2,
        weight: config.weight,
        reasons: [
          `Strong Bullish Trend: ADX ${adxData.adx.toFixed(1)} > ${config.threshold} with +DI (${adxData.plusDI.toFixed(1)}) dominant over -DI (${adxData.minusDI.toFixed(1)})`,
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

    if (isStrongTrend && isBearishDI) {
      return {
        strategyId: 'adx_trend',
        strategyName: 'ADX Trend Strength',
        signal: 'DOWN',
        score: -(bearishScore / 100) * config.weight * 2,
        weight: config.weight,
        reasons: [
          `Strong Bearish Trend: ADX ${adxData.adx.toFixed(1)} > ${config.threshold} with -DI (${adxData.minusDI.toFixed(1)}) dominant over +DI (${adxData.plusDI.toFixed(1)})`,
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
      strategyId: 'adx_trend',
      strategyName: 'ADX Trend Strength',
      signal: 'WAIT',
      score: 0,
      weight: config.weight,
      reasons: [`ADX (${adxData.adx.toFixed(1)}) below threshold ${config.threshold}: Market in non-trending/ranging phase`],
      candleTimestamp,
      dataValid: true,
      bullishScore: 20,
      bearishScore: 20,
      percentage: Math.max(bullishScore, bearishScore),
      direction: 'NEUTRAL',
      conditions,
    };
  }
}
