import { Candle, StrategyResult } from '../types';
import { calculateSMA } from '../indicators';

export interface SmaCrossoverConfig {
  enabled: boolean;
  fastPeriod: number;
  slowPeriod: number;
  weight: number;
}

export class SmaCrossoverStrategy {
  public static evaluate(
    candles: Candle[],
    config: SmaCrossoverConfig = { enabled: true, fastPeriod: 10, slowPeriod: 30, weight: 1.2 }
  ): StrategyResult {
    const candleTimestamp = candles.length > 0 ? candles[candles.length - 1].time : 0;

    if (!config.enabled) {
      return {
        strategyId: 'sma_crossover',
        strategyName: 'SMA Crossover',
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

    if (candles.length < config.slowPeriod + 2) {
      return {
        strategyId: 'sma_crossover',
        strategyName: 'SMA Crossover',
        signal: 'WAIT',
        score: 0,
        weight: config.weight,
        reasons: [`Accumulating candles for SMA (${candles.length}/${config.slowPeriod + 2})`],
        candleTimestamp,
        dataValid: false,
        bullishScore: 0,
        bearishScore: 0,
        percentage: 0,
        direction: 'NEUTRAL',
        conditions: [],
      };
    }

    const closes = candles.map((c) => c.close);
    const currPrice = closes[closes.length - 1];
    const fastSMA = calculateSMA(closes, config.fastPeriod);
    const slowSMA = calculateSMA(closes, config.slowPeriod);

    // Previous candle SMAs to check crossover
    const prevCloses = closes.slice(0, -1);
    const prevFastSMA = calculateSMA(prevCloses, config.fastPeriod);
    const prevSlowSMA = calculateSMA(prevCloses, config.slowPeriod);

    if (fastSMA === null || slowSMA === null || prevFastSMA === null || prevSlowSMA === null) {
      return {
        strategyId: 'sma_crossover',
        strategyName: 'SMA Crossover',
        signal: 'WAIT',
        score: 0,
        weight: config.weight,
        reasons: ['Calculating SMAs'],
        candleTimestamp,
        dataValid: false,
        bullishScore: 0,
        bearishScore: 0,
        percentage: 0,
        direction: 'NEUTRAL',
        conditions: [],
      };
    }

    const isBullishCross = prevFastSMA <= prevSlowSMA && fastSMA > slowSMA;
    const isBearishCross = prevFastSMA >= prevSlowSMA && fastSMA < slowSMA;
    const isPriceAboveFast = currPrice > fastSMA;
    const isFastAboveSlow = fastSMA > slowSMA;

    const conditions = [
      { name: `Price (${currPrice.toFixed(4)}) > Fast SMA ${config.fastPeriod}`, satisfied: isPriceAboveFast, weight: 25 },
      { name: `Fast SMA ${config.fastPeriod} > Slow SMA ${config.slowPeriod}`, satisfied: isFastAboveSlow, weight: 35 },
      { name: `Bullish Golden Crossover Trigger`, satisfied: isBullishCross, weight: 40 },
    ];

    let bullishScore = 0;
    if (isPriceAboveFast) bullishScore += 25;
    if (isFastAboveSlow) bullishScore += 35;
    if (isBullishCross) bullishScore += 40;

    let bearishScore = 0;
    if (!isPriceAboveFast) bearishScore += 25;
    if (!isFastAboveSlow) bearishScore += 35;
    if (isBearishCross) bearishScore += 40;

    if (isBullishCross || (isFastAboveSlow && isPriceAboveFast && bullishScore >= 60)) {
      return {
        strategyId: 'sma_crossover',
        strategyName: 'SMA Crossover',
        signal: 'UP',
        score: (bullishScore / 100) * config.weight * 2,
        weight: config.weight,
        reasons: [
          isBullishCross ? `Golden Cross: SMA ${config.fastPeriod} crossed above SMA ${config.slowPeriod}` : `Strong Bullish SMA alignment`,
          `Fast SMA (${fastSMA.toFixed(5)}) > Slow SMA (${slowSMA.toFixed(5)})`,
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

    if (isBearishCross || (!isFastAboveSlow && !isPriceAboveFast && bearishScore >= 60)) {
      return {
        strategyId: 'sma_crossover',
        strategyName: 'SMA Crossover',
        signal: 'DOWN',
        score: -(bearishScore / 100) * config.weight * 2,
        weight: config.weight,
        reasons: [
          isBearishCross ? `Death Cross: SMA ${config.fastPeriod} crossed below SMA ${config.slowPeriod}` : `Strong Bearish SMA alignment`,
          `Fast SMA (${fastSMA.toFixed(5)}) < Slow SMA (${slowSMA.toFixed(5)})`,
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
      strategyId: 'sma_crossover',
      strategyName: 'SMA Crossover',
      signal: 'WAIT',
      score: 0,
      weight: config.weight,
      reasons: [`SMA consolidation (Fast: ${fastSMA.toFixed(5)}, Slow: ${slowSMA.toFixed(5)})`],
      candleTimestamp,
      dataValid: true,
      bullishScore,
      bearishScore,
      percentage: Math.max(bullishScore, bearishScore),
      direction: 'NEUTRAL',
      conditions,
    };
  }
}
