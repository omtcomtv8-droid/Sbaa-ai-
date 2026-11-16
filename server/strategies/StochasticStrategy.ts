import { Candle, StrategyResult, StrategyCondition } from '../types';
import { calculateStochastic } from '../indicators';

export interface StochasticConfig {
  enabled: boolean;
  kPeriod: number;
  dPeriod: number;
  overbought: number;
  oversold: number;
  weight: number;
}

export class StochasticStrategy {
  public static evaluate(
    candles: Candle[],
    config: StochasticConfig = {
      enabled: true,
      kPeriod: 14,
      dPeriod: 3,
      overbought: 80,
      oversold: 20,
      weight: 1.2,
    }
  ): StrategyResult {
    const candleTimestamp = candles.length > 0 ? candles[candles.length - 1].time : 0;

    if (!config.enabled) {
      return {
        strategyId: 'stochastic',
        strategyName: 'Stochastic Oscillator',
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

    if (candles.length < config.kPeriod + config.dPeriod + 3) {
      return {
        strategyId: 'stochastic',
        strategyName: 'Stochastic Oscillator',
        signal: 'WAIT',
        score: 0,
        weight: config.weight,
        reasons: [`Accumulating candles for Stochastic (${candles.length}/${config.kPeriod + config.dPeriod + 3})`],
        candleTimestamp,
        dataValid: false,
        bullishScore: 0,
        bearishScore: 0,
        percentage: 0,
        direction: 'NEUTRAL',
        conditions: [],
      };
    }

    const stochCurr = calculateStochastic(candles, config.kPeriod, config.dPeriod);
    const stochPrev = calculateStochastic(candles.slice(0, -1), config.kPeriod, config.dPeriod);

    if (!stochCurr || !stochPrev) {
      return {
        strategyId: 'stochastic',
        strategyName: 'Stochastic Oscillator',
        signal: 'WAIT',
        score: 0,
        weight: config.weight,
        reasons: ['Calculating Stochastic %K / %D'],
        candleTimestamp,
        dataValid: false,
        bullishScore: 0,
        bearishScore: 0,
        percentage: 0,
        direction: 'NEUTRAL',
        conditions: [],
      };
    }

    const isBullishCross = stochPrev.k <= stochPrev.d && stochCurr.k > stochCurr.d + 0.5;
    const isBearishCross = stochPrev.k >= stochPrev.d && stochCurr.k < stochCurr.d - 0.5;
    const isBullZone = stochCurr.k < 50;
    const isBearZone = stochCurr.k > 50;
    const isOversold = stochCurr.k <= config.oversold || stochPrev.k <= config.oversold;
    const isOverbought = stochCurr.k >= config.overbought || stochPrev.k >= config.overbought;

    const bullishConditions: StrategyCondition[] = [
      { id: 'stoch_bull_cross', name: `%K (${stochCurr.k.toFixed(1)}) Crossed Above %D (${stochCurr.d.toFixed(1)})`, satisfied: isBullishCross, weight: 55, isMandatory: true },
      { id: 'stoch_bull_mid', name: `%K in Lower Half (< 50)`, satisfied: isBullZone, weight: 20, isMandatory: true },
      { id: 'stoch_oversold', name: `Extreme Oversold Origin (<= ${config.oversold})`, satisfied: isOversold, weight: 25, isMandatory: false },
    ];

    const bearishConditions: StrategyCondition[] = [
      { id: 'stoch_bear_cross', name: `%K (${stochCurr.k.toFixed(1)}) Crossed Below %D (${stochCurr.d.toFixed(1)})`, satisfied: isBearishCross, weight: 55, isMandatory: true },
      { id: 'stoch_bear_mid', name: `%K in Upper Half (> 50)`, satisfied: isBearZone, weight: 20, isMandatory: true },
      { id: 'stoch_overbought', name: `Extreme Overbought Origin (>= ${config.overbought})`, satisfied: isOverbought, weight: 25, isMandatory: false },
    ];

    const bullishScore = bullishConditions.reduce((acc, c) => acc + (c.satisfied ? c.weight : 0), 0);
    const bearishScore = bearishConditions.reduce((acc, c) => acc + (c.satisfied ? c.weight : 0), 0);

    if (isBullishCross && isBullZone) {
      return {
        strategyId: 'stochastic',
        strategyName: 'Stochastic Oscillator',
        signal: 'UP',
        score: (bullishScore / 100) * config.weight * 2,
        weight: config.weight,
        reasons: [
          `Bullish Stochastic Cross: %K (${stochCurr.k.toFixed(1)}) crossed above %D (${stochCurr.d.toFixed(1)})`,
          isOversold ? `Triggered from oversold region (<= ${config.oversold})` : '',
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

    if (isBearishCross && isBearZone) {
      return {
        strategyId: 'stochastic',
        strategyName: 'Stochastic Oscillator',
        signal: 'DOWN',
        score: -(bearishScore / 100) * config.weight * 2,
        weight: config.weight,
        reasons: [
          `Bearish Stochastic Cross: %K (${stochCurr.k.toFixed(1)}) crossed below %D (${stochCurr.d.toFixed(1)})`,
          isOverbought ? `Triggered from overbought region (>= ${config.overbought})` : '',
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
      strategyId: 'stochastic',
      strategyName: 'Stochastic Oscillator',
      signal: 'WAIT',
      score: 0,
      weight: config.weight,
      reasons: [`Stochastic %K (${stochCurr.k.toFixed(1)}) and %D (${stochCurr.d.toFixed(1)}) in consolidation`],
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
