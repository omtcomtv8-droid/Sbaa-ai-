import { Candle, StrategyResult, StrategyCondition } from '../types';
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
    let high = -Infinity;
    let highIdx = 0;
    let low = Infinity;
    let lowIdx = 0;

    for (let i = 0; i < slice.length; i++) {
      if (slice[i].high > high) {
        high = slice[i].high;
        highIdx = i;
      }
      if (slice[i].low < low) {
        low = slice[i].low;
        lowIdx = i;
      }
    }

    const curr = candles[candles.length - 1];
    const prev = candles[candles.length - 2];
    const currPrice = curr.close;
    const diff = high - low;

    if (diff <= 0) {
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
    // Index comparison determines primary swing direction (zero timestamp/index bug)
    const isUptrendSwing = lowIdx < highIdx;
    const isDowntrendSwing = highIdx < lowIdx;

    const zoneTol = diff * 0.04;
    // Bullish pullback into 50%-61.8% retracement from swing high: [level618, level500]
    const bullZoneLow = fib.level618 - zoneTol;
    const bullZoneHigh = fib.level500 + zoneTol;
    const isInBullGoldenPocket =
      (currPrice >= bullZoneLow && currPrice <= bullZoneHigh) ||
      (curr.low >= bullZoneLow && curr.low <= bullZoneHigh && currPrice > fib.level618);

    // Bearish pullback into 50%-61.8% retracement from swing low: [level500, low + 0.618*diff (=level382)]
    const bearZoneLow = fib.level500 - zoneTol;
    const bearZoneHigh = fib.level382 + zoneTol;
    const isInBearGoldenPocket =
      (currPrice >= bearZoneLow && currPrice <= bearZoneHigh) ||
      (curr.high >= bearZoneLow && curr.high <= bearZoneHigh && currPrice < fib.level382);

    const isBullishCandle = curr.close > curr.open && curr.close > prev.close;
    const isBearishCandle = curr.close < curr.open && curr.close < prev.close;

    const isBullishBounce = isUptrendSwing && isInBullGoldenPocket && isBullishCandle;
    const isBearishRejection = isDowntrendSwing && isInBearGoldenPocket && isBearishCandle;

    const bullishConditions: StrategyCondition[] = [
      {
        id: 'fib_bull_swing',
        name: `Primary Upswing Detected (Low@${lowIdx} -> High@${highIdx})`,
        satisfied: isUptrendSwing,
        weight: 25,
        isMandatory: true,
      },
      {
        id: 'fib_bull_zone',
        name: `Price tested 50%-61.8% Golden Pocket (${fib.level618.toFixed(5)}-${fib.level500.toFixed(5)})`,
        satisfied: isInBullGoldenPocket,
        weight: 45,
        isMandatory: true,
      },
      {
        id: 'fib_bull_candle',
        name: `Bullish Rebound Candle Confirmation`,
        satisfied: isBullishCandle,
        weight: 30,
        isMandatory: true,
      },
    ];

    const bearishConditions: StrategyCondition[] = [
      {
        id: 'fib_bear_swing',
        name: `Primary Downswing Detected (High@${highIdx} -> Low@${lowIdx})`,
        satisfied: isDowntrendSwing,
        weight: 25,
        isMandatory: true,
      },
      {
        id: 'fib_bear_zone',
        name: `Price tested 50%-61.8% Retrace (${fib.level500.toFixed(5)}-${fib.level382.toFixed(5)})`,
        satisfied: isInBearGoldenPocket,
        weight: 45,
        isMandatory: true,
      },
      {
        id: 'fib_bear_candle',
        name: `Bearish Rejection Candle Confirmation`,
        satisfied: isBearishCandle,
        weight: 30,
        isMandatory: true,
      },
    ];

    const bullishScore = bullishConditions.reduce((acc, c) => acc + (c.satisfied ? c.weight : 0), 0);
    const bearishScore = bearishConditions.reduce((acc, c) => acc + (c.satisfied ? c.weight : 0), 0);

    if (isBullishBounce) {
      return {
        strategyId: 'fibonacci',
        strategyName: 'Fibonacci Golden Zone',
        signal: 'UP',
        score: (bullishScore / 100) * config.weight * 2,
        weight: config.weight,
        reasons: [
          `Fibonacci 50%-61.8% Golden Pocket Rebound (${fib.level618.toFixed(5)} - ${fib.level500.toFixed(5)})`,
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

    if (isBearishRejection) {
      return {
        strategyId: 'fibonacci',
        strategyName: 'Fibonacci Golden Zone',
        signal: 'DOWN',
        score: -(bearishScore / 100) * config.weight * 2,
        weight: config.weight,
        reasons: [
          `Fibonacci 50%-61.8% Golden Pocket Rejection (${fib.level500.toFixed(5)} - ${fib.level382.toFixed(5)})`,
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
      strategyId: 'fibonacci',
      strategyName: 'Fibonacci Golden Zone',
      signal: 'WAIT',
      score: 0,
      weight: config.weight,
      reasons: [`Price outside immediate Fibonacci Golden Pocket reversal zone`],
      candleTimestamp,
      dataValid: true,
      bullishScore,
      bearishScore,
      percentage: Math.max(bullishScore, bearishScore),
      direction: 'NEUTRAL',
      conditions: isUptrendSwing ? bullishConditions : bearishConditions,
    };
  }
}
