import { Candle, StrategyResult } from '../types';
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
    const isOversold = stochCurr.k <= config.oversold;
    const isOverbought = stochCurr.k >= config.overbought;

    const bullishConditions = [
      { name: `%K <= ${config.oversold} (Oversold)`, satisfied: isOversold, weight: 35, isMandatory: true },
      { name: `%K Crossed Above %D`, satisfied: isBullishCross, weight: 65, isMandatory: true },
    ];

    const bearishConditions = [
      { name: `%K >= ${config.overbought} (Overbought)`, satisfied: isOverbought, weight: 35, isMandatory: true },
      { name: `%K Crossed Below %D`, satisfied: isBearishCross, weight: 65, isMandatory: true },
    ];

    let bullishScore = 0;
    if (isOversold) bullishScore += 35;
    if (isBullishCross) bullishScore += 65;

    let bearishScore = 0;
    if (isOverbought) bearishScore += 35;
    if (isBearishCross) bearishScore += 65;

    if (isBullishCross && stochCurr.k < 50) {
      return {
        strategyId: 'stochastic',
        strategyName: 'Stochastic Oscillator',
        signal: 'UP',
        score: (bullishScore / 100) * config.weight * 2,
        weight: config.weight,
        reasons: [
          `Bullish Stochastic Cross: %K (${stochCurr.k.toFixed(1)}) crossed above %D (${stochCurr.d.toFixed(1)})`,
          isOversold ? `Triggered from oversold region (< ${config.oversold})` : '',
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

    if (isBearishCross && stochCurr.k > 50) {
      return {
        strategyId: 'stochastic',
        strategyName: 'Stochastic Oscillator',
        signal: 'DOWN',
        score: -(bearishScore / 100) * config.weight * 2,
        weight: config.weight,
        reasons: [
          `Bearish Stochastic Cross: %K (${stochCurr.k.toFixed(1)}) crossed below %D (${stochCurr.d.toFixed(1)})`,
          isOverbought ? `Triggered from overbought region (> ${config.overbought})` : '',
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
