import { Candle, EmaTrendConfig, StrategyResult } from '../types';
import { calculateEMA, calculateSMA } from '../indicators';

export class EmaTrendStrategy {
  public static evaluate(candles: Candle[], config: EmaTrendConfig): StrategyResult {
    const candleTimestamp = candles.length > 0 ? candles[candles.length - 1].time : 0;

    if (!config.enabled) {
      return {
        strategyId: 'ema_trend',
        strategyName: 'EMA Trend',
        signal: 'WAIT',
        score: 0,
        weight: config.weight,
        reasons: ['Strategy disabled in settings'],
        candleTimestamp,
        dataValid: true,
      };
    }

    if (candles.length < Math.max(config.slowPeriod, config.filterPeriod) + 5) {
      return {
        strategyId: 'ema_trend',
        strategyName: 'EMA Trend',
        signal: 'WAIT',
        score: 0,
        weight: config.weight,
        reasons: [`Accumulating candles for EMA ${config.slowPeriod} calculation`],
        candleTimestamp,
        dataValid: false,
      };
    }

    const closes = candles.map((c) => c.close);
    const fast = calculateEMA(closes, config.fastPeriod);
    const slow = calculateEMA(closes, config.slowPeriod);
    const filterSMA = calculateSMA(closes, config.filterPeriod);
    const currentPrice = closes[closes.length - 1];

    if (fast === null || slow === null) {
      return {
        strategyId: 'ema_trend',
        strategyName: 'EMA Trend',
        signal: 'WAIT',
        score: 0,
        weight: config.weight,
        reasons: ['EMAs currently calculating'],
        candleTimestamp,
        dataValid: false,
      };
    }

    const isFastAboveSlow = fast > slow;
    const isPriceAboveFast = currentPrice > fast;
    const isPriceBelowFast = currentPrice < fast;
    const isPriceAboveFilter = filterSMA !== null ? currentPrice > filterSMA : true;
    const isPriceBelowFilter = filterSMA !== null ? currentPrice < filterSMA : true;

    const bullishConditions = [
      {
        name: `Price (${currentPrice.toFixed(5)}) > EMA ${config.fastPeriod} (${fast.toFixed(5)})`,
        satisfied: isPriceAboveFast,
        weight: 35,
        isMandatory: true,
      },
      {
        name: `EMA ${config.fastPeriod} (${fast.toFixed(5)}) > EMA ${config.slowPeriod} (${slow.toFixed(5)})`,
        satisfied: isFastAboveSlow,
        weight: 35,
        isMandatory: true,
      },
      {
        name: filterSMA ? `Price > SMA ${config.filterPeriod} (${filterSMA.toFixed(5)})` : `SMA ${config.filterPeriod} trend confirmation`,
        satisfied: isPriceAboveFilter,
        weight: 30,
        isMandatory: false,
      },
    ];

    const bearishConditions = [
      {
        name: `Price (${currentPrice.toFixed(5)}) < EMA ${config.fastPeriod} (${fast.toFixed(5)})`,
        satisfied: isPriceBelowFast,
        weight: 35,
        isMandatory: true,
      },
      {
        name: `EMA ${config.fastPeriod} (${fast.toFixed(5)}) < EMA ${config.slowPeriod} (${slow.toFixed(5)})`,
        satisfied: !isFastAboveSlow,
        weight: 35,
        isMandatory: true,
      },
      {
        name: filterSMA ? `Price < SMA ${config.filterPeriod} (${filterSMA.toFixed(5)})` : `SMA ${config.filterPeriod} trend confirmation`,
        satisfied: isPriceBelowFilter,
        weight: 30,
        isMandatory: false,
      },
    ];

    let bullishScore = 0;
    if (isPriceAboveFast) bullishScore += 35;
    if (isFastAboveSlow) bullishScore += 35;
    if (isPriceAboveFilter) bullishScore += 30;

    let bearishScore = 0;
    if (isPriceBelowFast) bearishScore += 35;
    if (!isFastAboveSlow) bearishScore += 35;
    if (isPriceBelowFilter) bearishScore += 30;

    // Bullish Alignment
    if (isFastAboveSlow && isPriceAboveFast && isPriceAboveFilter) {
      return {
        strategyId: 'ema_trend',
        strategyName: 'EMA Trend',
        signal: 'UP',
        score: Number(((bullishScore / 100) * config.weight * 2).toFixed(1)),
        weight: config.weight,
        reasons: [
          `Bullish EMA Alignment: Price (${currentPrice.toFixed(5)}) > EMA ${config.fastPeriod} (${fast.toFixed(5)}) > EMA ${config.slowPeriod} (${slow.toFixed(5)})`,
          filterSMA ? `Price confirmed above baseline SMA ${config.filterPeriod} (${filterSMA.toFixed(5)})` : '',
        ].filter(Boolean),
        candleTimestamp,
        dataValid: true,
        bullishScore,
        bearishScore,
        percentage: bullishScore,
        direction: 'BULLISH',
        conditions: bullishConditions,
      };
    }

    // Bearish Alignment
    if (!isFastAboveSlow && isPriceBelowFast && isPriceBelowFilter) {
      return {
        strategyId: 'ema_trend',
        strategyName: 'EMA Trend',
        signal: 'DOWN',
        score: Number(-((bearishScore / 100) * config.weight * 2).toFixed(1)),
        weight: config.weight,
        reasons: [
          `Bearish EMA Alignment: Price (${currentPrice.toFixed(5)}) < EMA ${config.fastPeriod} (${fast.toFixed(5)}) < EMA ${config.slowPeriod} (${slow.toFixed(5)})`,
          filterSMA ? `Price confirmed below baseline SMA ${config.filterPeriod} (${filterSMA.toFixed(5)})` : '',
        ].filter(Boolean),
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
      strategyId: 'ema_trend',
      strategyName: 'EMA Trend',
      signal: 'WAIT',
      score: 0,
      weight: config.weight,
      reasons: [`EMA crossover consolidation (EMA ${config.fastPeriod}: ${fast.toFixed(5)}, EMA ${config.slowPeriod}: ${slow.toFixed(5)})`],
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
