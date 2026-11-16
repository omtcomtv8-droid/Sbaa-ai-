import { Candle, StrategyResult, StrategyCondition } from '../types';
import { calculateCCI } from '../indicators';

export interface CciConfig {
  enabled: boolean;
  period: number;
  threshold: number;
  weight: number;
}

export class CciStrategy {
  public static evaluate(
    candles: Candle[],
    config: CciConfig = { enabled: true, period: 20, threshold: 100, weight: 1.1 }
  ): StrategyResult {
    const candleTimestamp = candles.length > 0 ? candles[candles.length - 1].time : 0;

    if (!config.enabled) {
      return {
        strategyId: 'cci_strategy',
        strategyName: 'CCI Momentum',
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

    if (candles.length < config.period + 3) {
      return {
        strategyId: 'cci_strategy',
        strategyName: 'CCI Momentum',
        signal: 'WAIT',
        score: 0,
        weight: config.weight,
        reasons: [`Accumulating candles for CCI (${candles.length}/${config.period + 3})`],
        candleTimestamp,
        dataValid: false,
        bullishScore: 0,
        bearishScore: 0,
        percentage: 0,
        direction: 'NEUTRAL',
        conditions: [],
      };
    }

    const cci = calculateCCI(candles, config.period);
    const prevCci = calculateCCI(candles.slice(0, -1), config.period);

    if (cci === null || prevCci === null) {
      return {
        strategyId: 'cci_strategy',
        strategyName: 'CCI Momentum',
        signal: 'WAIT',
        score: 0,
        weight: config.weight,
        reasons: ['Calculating CCI'],
        candleTimestamp,
        dataValid: false,
        bullishScore: 0,
        bearishScore: 0,
        percentage: 0,
        direction: 'NEUTRAL',
        conditions: [],
      };
    }

    const th = config.threshold;
    const isBullishRebound = prevCci <= -th && cci > -th;
    const isBullishSurge = cci > th && cci > prevCci;
    const isBearishRebound = prevCci >= th && cci < th;
    const isBearishDrop = cci < -th && cci < prevCci;

    const isBullSignal = isBullishRebound || isBullishSurge;
    const isBearSignal = isBearishRebound || isBearishDrop;

    const bullishConditions: StrategyCondition[] = [
      {
        id: 'cci_bull_trigger',
        name: `CCI Bullish Rebound (> -${th}) or Surge (> +${th})`,
        satisfied: isBullSignal,
        weight: 80,
        isMandatory: true,
      },
      {
        id: 'cci_bull_slope',
        name: `CCI Expanding Upward (${prevCci.toFixed(1)} -> ${cci.toFixed(1)})`,
        satisfied: cci > prevCci,
        weight: 20,
      },
    ];

    const bearishConditions: StrategyCondition[] = [
      {
        id: 'cci_bear_trigger',
        name: `CCI Bearish Drop (< +${th}) or Plunge (< -${th})`,
        satisfied: isBearSignal,
        weight: 80,
        isMandatory: true,
      },
      {
        id: 'cci_bear_slope',
        name: `CCI Expanding Downward (${prevCci.toFixed(1)} -> ${cci.toFixed(1)})`,
        satisfied: cci < prevCci,
        weight: 20,
      },
    ];

    const bullishScore = bullishConditions.reduce((acc, c) => acc + (c.satisfied ? c.weight : 0), 0);
    const bearishScore = bearishConditions.reduce((acc, c) => acc + (c.satisfied ? c.weight : 0), 0);

    if (isBullSignal && !isBearSignal) {
      return {
        strategyId: 'cci_strategy',
        strategyName: 'CCI Momentum',
        signal: 'UP',
        score: (bullishScore / 100) * config.weight * 2,
        weight: config.weight,
        reasons: [
          `CCI (${cci.toFixed(1)}) bullish ${isBullishRebound ? `rebound above -${th}` : `surge above +${th}`}`,
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

    if (isBearSignal && !isBullSignal) {
      return {
        strategyId: 'cci_strategy',
        strategyName: 'CCI Momentum',
        signal: 'DOWN',
        score: -(bearishScore / 100) * config.weight * 2,
        weight: config.weight,
        reasons: [
          `CCI (${cci.toFixed(1)}) bearish ${isBearishRebound ? `rejection below +${th}` : `plunge below -${th}`}`,
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
      strategyId: 'cci_strategy',
      strategyName: 'CCI Momentum',
      signal: 'WAIT',
      score: 0,
      weight: config.weight,
      reasons: [`CCI (${cci.toFixed(1)}) hovering in neutral channel (-${th} to +${th})`],
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
