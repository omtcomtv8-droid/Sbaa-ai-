import { Candle, StrategyResult, SupportResistanceConfig, StrategyCondition } from '../types';
import { SupportResistanceEngine } from '../SupportResistanceEngine';

export class SupportResistanceStrategy {
  public static evaluate(candles: Candle[], config: SupportResistanceConfig): StrategyResult {
    const candleTimestamp = candles.length > 0 ? candles[candles.length - 1].time : 0;

    if (!config.enabled) {
      return {
        strategyId: 'support_resistance',
        strategyName: 'Support / Resistance',
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

    if (candles.length < 25) {
      return {
        strategyId: 'support_resistance',
        strategyName: 'Support / Resistance',
        signal: 'WAIT',
        score: 0,
        weight: config.weight,
        reasons: ['Accumulating historical candles for S/R zones'],
        candleTimestamp,
        dataValid: false,
        bullishScore: 0,
        bearishScore: 0,
        percentage: 0,
        direction: 'NEUTRAL',
        conditions: [],
      };
    }

    const { nearestSupport, nearestResistance, isTestingSupport, isTestingResistance } =
      SupportResistanceEngine.calculateLevels(candles, config.lookback, config.clusterTolerancePercent);

    const curr = candles[candles.length - 1];
    const prev = candles[candles.length - 2];

    const supportTouched = Boolean(
      nearestSupport && (isTestingSupport || (curr.low <= nearestSupport.price && curr.close > nearestSupport.price))
    );
    const supportConfirmClose = curr.close > curr.open && curr.close > prev.close;
    const supportStrong = Boolean(nearestSupport && nearestSupport.strength >= 2);

    const resistanceTouched = Boolean(
      nearestResistance && (isTestingResistance || (curr.high >= nearestResistance.price && curr.close < nearestResistance.price))
    );
    const resistanceConfirmClose = curr.close < curr.open && curr.close < prev.close;
    const resistanceStrong = Boolean(nearestResistance && nearestResistance.strength >= 2);

    const bullishConditions: StrategyCondition[] = [
      {
        id: 'sr_support_touch',
        name: nearestSupport ? `Support Zone Tested (${nearestSupport.price.toFixed(5)})` : 'Nearest Support Zone Tested',
        satisfied: supportTouched,
        weight: 45,
        isMandatory: true,
      },
      {
        id: 'sr_support_bounce',
        name: `Bullish Rejection Close Above Support`,
        satisfied: supportConfirmClose,
        weight: 35,
        isMandatory: true,
      },
      {
        id: 'sr_support_strength',
        name: `Multi-Touch Institutional Support Strength (>= 2)`,
        satisfied: supportStrong,
        weight: 20,
      },
    ];

    const bearishConditions: StrategyCondition[] = [
      {
        id: 'sr_resistance_touch',
        name: nearestResistance ? `Resistance Zone Tested (${nearestResistance.price.toFixed(5)})` : 'Nearest Resistance Zone Tested',
        satisfied: resistanceTouched,
        weight: 45,
        isMandatory: true,
      },
      {
        id: 'sr_resistance_reject',
        name: `Bearish Rejection Close Below Resistance`,
        satisfied: resistanceConfirmClose,
        weight: 35,
        isMandatory: true,
      },
      {
        id: 'sr_resistance_strength',
        name: `Multi-Touch Institutional Resistance Strength (>= 2)`,
        satisfied: resistanceStrong,
        weight: 20,
      },
    ];

    const bullishScore = bullishConditions.reduce((acc, c) => acc + (c.satisfied ? c.weight : 0), 0);
    const bearishScore = bearishConditions.reduce((acc, c) => acc + (c.satisfied ? c.weight : 0), 0);

    if (supportTouched && supportConfirmClose && nearestSupport) {
      return {
        strategyId: 'support_resistance',
        strategyName: 'Support / Resistance',
        signal: 'UP',
        score: (bullishScore / 100) * config.weight * 2,
        weight: config.weight,
        reasons: [
          `Support Zone Bounce at ${nearestSupport.price.toFixed(5)} (${nearestSupport.touches} touches, strength ${nearestSupport.strength}/5)`,
          `Bullish candle close confirms demand absorption at support`,
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

    if (resistanceTouched && resistanceConfirmClose && nearestResistance) {
      return {
        strategyId: 'support_resistance',
        strategyName: 'Support / Resistance',
        signal: 'DOWN',
        score: -(bearishScore / 100) * config.weight * 2,
        weight: config.weight,
        reasons: [
          `Resistance Zone Rejection at ${nearestResistance.price.toFixed(5)} (${nearestResistance.touches} touches, strength ${nearestResistance.strength}/5)`,
          `Bearish candle close confirms supply overhead at resistance`,
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
      strategyId: 'support_resistance',
      strategyName: 'Support / Resistance',
      signal: 'WAIT',
      score: 0,
      weight: config.weight,
      reasons: [
        nearestSupport ? `Nearest Support: ${nearestSupport.price.toFixed(5)} (${nearestSupport.distancePercent.toFixed(2)}% below)` : 'No immediate support nearby',
        nearestResistance ? `Nearest Resistance: ${nearestResistance.price.toFixed(5)} (${nearestResistance.distancePercent.toFixed(2)}% above)` : 'No immediate resistance nearby',
      ],
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
