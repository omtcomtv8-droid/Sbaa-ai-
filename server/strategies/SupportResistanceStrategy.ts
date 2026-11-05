import { Candle, StrategyResult, SupportResistanceConfig } from '../types';
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
      };
    }

    const { nearestSupport, nearestResistance, isTestingSupport, isTestingResistance } =
      SupportResistanceEngine.calculateLevels(candles, config.lookback, config.clusterTolerancePercent);

    const curr = candles[candles.length - 1];
    const prev = candles[candles.length - 2];

    // Support Bounce: Current or previous low reached support and closed bullish green above support
    if (nearestSupport && (isTestingSupport || (curr.low <= nearestSupport.price && curr.close > nearestSupport.price))) {
      if (curr.close > curr.open) {
        return {
          strategyId: 'support_resistance',
          strategyName: 'Support / Resistance',
          signal: 'UP',
          score: config.weight * 2,
          weight: config.weight,
          reasons: [
            `Support Zone Bounce at ${nearestSupport.price.toFixed(5)} (${nearestSupport.touches} touches, strength ${nearestSupport.strength}/5)`,
            `Bullish candle close confirms demand absorption at support`,
          ],
          candleTimestamp,
          dataValid: true,
        };
      }
    }

    // Resistance Rejection: Current or previous high reached resistance and closed bearish red below resistance
    if (nearestResistance && (isTestingResistance || (curr.high >= nearestResistance.price && curr.close < nearestResistance.price))) {
      if (curr.close < curr.open) {
        return {
          strategyId: 'support_resistance',
          strategyName: 'Support / Resistance',
          signal: 'DOWN',
          score: -config.weight * 2,
          weight: config.weight,
          reasons: [
            `Resistance Zone Rejection at ${nearestResistance.price.toFixed(5)} (${nearestResistance.touches} touches, strength ${nearestResistance.strength}/5)`,
            `Bearish candle close confirms supply overhead at resistance`,
          ],
          candleTimestamp,
          dataValid: true,
        };
      }
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
    };
  }
}
