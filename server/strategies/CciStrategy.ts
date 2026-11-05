import { Candle, StrategyResult } from '../types';
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

    const isBullishRebound = prevCci <= -config.threshold && cci > -config.threshold;
    const isBullishSurge = cci > config.threshold && cci > prevCci;
    const isBearishRebound = prevCci >= config.threshold && cci < config.threshold;
    const isBearishDrop = cci < -config.threshold && cci < prevCci;

    const conditions = [
      { name: `CCI Crossing Up through -${config.threshold}`, satisfied: isBullishRebound, weight: 50 },
      { name: `CCI Bullish Surge > +${config.threshold}`, satisfied: isBullishSurge, weight: 50 },
      { name: `CCI Crossing Down through +${config.threshold}`, satisfied: isBearishRebound, weight: 50 },
      { name: `CCI Bearish Plunge < -${config.threshold}`, satisfied: isBearishDrop, weight: 50 },
    ];

    let bullishScore = 0;
    if (isBullishRebound) bullishScore += 65;
    if (isBullishSurge) bullishScore += 35;
    if (cci > 0) bullishScore += 20;

    let bearishScore = 0;
    if (isBearishRebound) bearishScore += 65;
    if (isBearishDrop) bearishScore += 35;
    if (cci < 0) bearishScore += 20;

    if (isBullishRebound || (cci > 100 && cci > prevCci)) {
      return {
        strategyId: 'cci_strategy',
        strategyName: 'CCI Momentum',
        signal: 'UP',
        score: (Math.min(100, bullishScore) / 100) * config.weight * 2,
        weight: config.weight,
        reasons: [
          `CCI (${cci.toFixed(1)}) bullish reversal/surge above threshold`,
        ],
        candleTimestamp,
        dataValid: true,
        bullishScore: Math.min(100, bullishScore),
        bearishScore: Math.min(100, bearishScore),
        percentage: Math.min(100, bullishScore),
        direction: 'BULLISH',
        conditions,
      };
    }

    if (isBearishRebound || (cci < -100 && cci < prevCci)) {
      return {
        strategyId: 'cci_strategy',
        strategyName: 'CCI Momentum',
        signal: 'DOWN',
        score: -(Math.min(100, bearishScore) / 100) * config.weight * 2,
        weight: config.weight,
        reasons: [
          `CCI (${cci.toFixed(1)}) bearish reversal/plunge below threshold`,
        ],
        candleTimestamp,
        dataValid: true,
        bullishScore: Math.min(100, bullishScore),
        bearishScore: Math.min(100, bearishScore),
        percentage: Math.min(100, bearishScore),
        direction: 'BEARISH',
        conditions,
      };
    }

    return {
      strategyId: 'cci_strategy',
      strategyName: 'CCI Momentum',
      signal: 'WAIT',
      score: 0,
      weight: config.weight,
      reasons: [`CCI (${cci.toFixed(1)}) hovering in neutral channel`],
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
