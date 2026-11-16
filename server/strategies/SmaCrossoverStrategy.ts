import { Candle, StrategyResult, StrategyCondition } from '../types';
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
    const isPriceBelowFast = currPrice < fastSMA;
    const isFastAboveSlow = fastSMA > slowSMA;
    const isFastBelowSlow = fastSMA < slowSMA;

    const bullishConditions: StrategyCondition[] = [
      {
        id: 'sma_bull_price',
        name: `Price (${currPrice.toFixed(5)}) > Fast SMA ${config.fastPeriod} (${fastSMA.toFixed(5)})`,
        satisfied: isPriceAboveFast,
        weight: 35,
        isMandatory: true,
      },
      {
        id: 'sma_bull_stack',
        name: `Fast SMA ${config.fastPeriod} > Slow SMA ${config.slowPeriod} (${slowSMA.toFixed(5)})`,
        satisfied: isFastAboveSlow,
        weight: 40,
        isMandatory: true,
      },
      {
        id: 'sma_bull_cross',
        name: `Fresh Bullish Golden Crossover Trigger`,
        satisfied: isBullishCross,
        weight: 25,
      },
    ];

    const bearishConditions: StrategyCondition[] = [
      {
        id: 'sma_bear_price',
        name: `Price (${currPrice.toFixed(5)}) < Fast SMA ${config.fastPeriod} (${fastSMA.toFixed(5)})`,
        satisfied: isPriceBelowFast,
        weight: 35,
        isMandatory: true,
      },
      {
        id: 'sma_bear_stack',
        name: `Fast SMA ${config.fastPeriod} < Slow SMA ${config.slowPeriod} (${slowSMA.toFixed(5)})`,
        satisfied: isFastBelowSlow,
        weight: 40,
        isMandatory: true,
      },
      {
        id: 'sma_bear_cross',
        name: `Fresh Bearish Death Crossover Trigger`,
        satisfied: isBearishCross,
        weight: 25,
      },
    ];

    const bullishScore = bullishConditions.reduce((acc, c) => acc + (c.satisfied ? c.weight : 0), 0);
    const bearishScore = bearishConditions.reduce((acc, c) => acc + (c.satisfied ? c.weight : 0), 0);

    if ((isBullishCross && isFastAboveSlow && isPriceAboveFast) || (isFastAboveSlow && isPriceAboveFast && bullishScore >= 75)) {
      return {
        strategyId: 'sma_crossover',
        strategyName: 'SMA Crossover',
        signal: 'UP',
        score: (bullishScore / 100) * config.weight * 2,
        weight: config.weight,
        reasons: [
          isBullishCross
            ? `Golden Cross: SMA ${config.fastPeriod} crossed above SMA ${config.slowPeriod}`
            : `Strong Bullish SMA alignment`,
          `Fast SMA (${fastSMA.toFixed(5)}) > Slow SMA (${slowSMA.toFixed(5)})`,
        ],
        candleTimestamp,
        dataValid: true,
        bullishScore,
        bearishScore,
        percentage: bullishScore,
        direction: 'BULLISH',
        conditions: bullishConditions,
      };
    }

    if ((isBearishCross && isFastBelowSlow && isPriceBelowFast) || (isFastBelowSlow && isPriceBelowFast && bearishScore >= 75)) {
      return {
        strategyId: 'sma_crossover',
        strategyName: 'SMA Crossover',
        signal: 'DOWN',
        score: -(bearishScore / 100) * config.weight * 2,
        weight: config.weight,
        reasons: [
          isBearishCross
            ? `Death Cross: SMA ${config.fastPeriod} crossed below SMA ${config.slowPeriod}`
            : `Strong Bearish SMA alignment`,
          `Fast SMA (${fastSMA.toFixed(5)}) < Slow SMA (${slowSMA.toFixed(5)})`,
        ],
        candleTimestamp,
        dataValid: true,
        bullishScore,
        bearishScore,
        percentage: bearishScore,
        direction: 'BEARISH',
        conditions: bearishConditions,
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
      conditions: bullishScore >= bearishScore ? bullishConditions : bearishConditions,
    };
  }
}
