import { Candle, StrategyResult } from '../types';
import { calculateFibonacciRetracements } from '../indicators';

export interface FibonacciConfig {
  enabled: boolean;
  lookback: number;
  weight: number;
}

export class FibonacciRetracementStrategy {
  public static evaluate(
    candles: Candle[],
    config: FibonacciConfig = { enabled: true, lookback: 40, weight: 1.2 }
  ): StrategyResult {
    const candleTimestamp = candles.length > 0 ? candles[candles.length - 1].time : 0;

    if (!config.enabled) {
      return {
        strategyId: 'fibonacci',
        strategyName: 'Fibonacci Golden Zone',
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

    if (candles.length < config.lookback) {
      return {
        strategyId: 'fibonacci',
        strategyName: 'Fibonacci Golden Zone',
        signal: 'WAIT',
        score: 0,
        weight: config.weight,
        reasons: [`Accumulating candles for Fibonacci (${candles.length}/${config.lookback})`],
        candleTimestamp,
        dataValid: false,
        bullishScore: 0,
        bearishScore: 0,
        percentage: 0,
        direction: 'NEUTRAL',
        conditions: [],
      };
    }

    const slice = candles.slice(-config.lookback);
    const high = Math.max(...slice.map((c) => c.high));
    const low = Math.min(...slice.map((c) => c.low));
    const currPrice = candles[candles.length - 1].close;

    if (high <= low) {
      return {
        strategyId: 'fibonacci',
        strategyName: 'Fibonacci Golden Zone',
        signal: 'WAIT',
        score: 0,
        weight: config.weight,
        reasons: ['Insufficient range for Fibonacci'],
        candleTimestamp,
        dataValid: false,
        bullishScore: 0,
        bearishScore: 0,
        percentage: 0,
        direction: 'NEUTRAL',
        conditions: [],
      };
    }

    const fib = calculateFibonacciRetracements(high, low);
    // Golden pocket is between 50.0% and 61.8%
    const isUptrendSwing = slice[slice.length - 1].time > slice.findIndex((c) => c.low === low);

    const distToGoldenPocket = Math.min(
      Math.abs(currPrice - fib.level500),
      Math.abs(currPrice - fib.level618)
    ) / (high - low);

    const isInGoldenPocket = distToGoldenPocket < 0.04;
    const isBullishBounce = isInGoldenPocket && currPrice > candles[candles.length - 2].close;
    const isBearishRejection = isInGoldenPocket && currPrice < candles[candles.length - 2].close;

    const conditions = [
      { name: `Price in Fibonacci 50% - 61.8% Golden Pocket (${fib.level500.toFixed(4)} - ${fib.level618.toFixed(4)})`, satisfied: isInGoldenPocket, weight: 60 },
      { name: `Bullish Rebound Candle`, satisfied: isBullishBounce, weight: 40 },
      { name: `Bearish Rejection Candle`, satisfied: isBearishRejection, weight: 40 },
    ];

    let bullishScore = isInGoldenPocket ? (isBullishBounce ? 85 : 55) : 15;
    let bearishScore = isInGoldenPocket ? (isBearishRejection ? 85 : 55) : 15;

    if (isBullishBounce && isUptrendSwing) {
      return {
        strategyId: 'fibonacci',
        strategyName: 'Fibonacci Golden Zone',
        signal: 'UP',
        score: (bullishScore / 100) * config.weight * 2,
        weight: config.weight,
        reasons: [
          `Fibonacci 61.8% Rebound: Price reacted favorably at Golden Pocket (${fib.level618.toFixed(5)})`,
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

    if (isBearishRejection && !isUptrendSwing) {
      return {
        strategyId: 'fibonacci',
        strategyName: 'Fibonacci Golden Zone',
        signal: 'DOWN',
        score: -(bearishScore / 100) * config.weight * 2,
        weight: config.weight,
        reasons: [
          `Fibonacci 61.8% Rejection: Price rejected downward at Golden Pocket (${fib.level618.toFixed(5)})`,
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
      strategyId: 'fibonacci',
      strategyName: 'Fibonacci Golden Zone',
      signal: 'WAIT',
      score: 0,
      weight: config.weight,
      reasons: [`Price outside immediate Fibonacci key reversal zones`],
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
