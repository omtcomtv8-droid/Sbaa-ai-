import { Candle, StrategyResult, StrategyCondition } from '../types';

export class PivotPointStrategy {
  public static evaluate(candles: Candle[], config = { enabled: true, weight: 1.0 }): StrategyResult {
    const candleTimestamp = candles.length > 0 ? candles[candles.length - 1].time : 0;

    if (!config.enabled) {
      return {
        strategyId: 'pivot_point',
        strategyName: 'Standard Floor Pivots',
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

    if (candles.length < 20) {
      return {
        strategyId: 'pivot_point',
        strategyName: 'Standard Floor Pivots',
        signal: 'WAIT',
        score: 0,
        weight: config.weight,
        reasons: [`Accumulating candles for multi-bar Floor Pivots (${candles.length}/20)`],
        candleTimestamp,
        dataValid: false,
        bullishScore: 0,
        bearishScore: 0,
        percentage: 0,
        direction: 'NEUTRAL',
        conditions: [],
      };
    }

    const lastCandle = candles[candles.length - 1];
    const prevCandle = candles[candles.length - 2];

    // Group completed candles prior to current UTC day if multi-day data exists; otherwise use prior completed rolling session block
    const currentDayKey = Math.floor(lastCandle.time / 86400);
    const priorCandles = candles.slice(0, -1);
    const prevDayCandles = priorCandles.filter((c) => Math.floor(c.time / 86400) < currentDayKey);

    let sessionCandles: Candle[];
    if (prevDayCandles.length >= 6) {
      const latestCompletedDay = Math.floor(prevDayCandles[prevDayCandles.length - 1].time / 86400);
      sessionCandles = prevDayCandles.filter((c) => Math.floor(c.time / 86400) === latestCompletedDay);
    } else {
      // Intraday rolling prior session block strictly preceding recent bars
      const blockSize = Math.min(24, Math.max(8, Math.floor(priorCandles.length / 2)));
      const endIdx = Math.max(blockSize, priorCandles.length - 1);
      sessionCandles = priorCandles.slice(Math.max(0, endIdx - blockSize), endIdx);
    }

    const sessionHigh = Math.max(...sessionCandles.map((c) => c.high));
    const sessionLow = Math.min(...sessionCandles.map((c) => c.low));
    const sessionClose = sessionCandles[sessionCandles.length - 1].close;

    const pivot = (sessionHigh + sessionLow + sessionClose) / 3;
    const r1 = 2 * pivot - sessionLow;
    const s1 = 2 * pivot - sessionHigh;

    const isCrossAbovePivot = prevCandle.close <= pivot && lastCandle.close > pivot && lastCandle.close < r1;
    const isS1Bounce = (lastCandle.low <= s1 || prevCandle.low <= s1) && lastCandle.close > s1;
    const isBullCandle = lastCandle.close > lastCandle.open && lastCandle.close > prevCandle.close;

    const isCrossBelowPivot = prevCandle.close >= pivot && lastCandle.close < pivot && lastCandle.close > s1;
    const isR1Reject = (lastCandle.high >= r1 || prevCandle.high >= r1) && lastCandle.close < r1;
    const isBearCandle = lastCandle.close < lastCandle.open && lastCandle.close < prevCandle.close;

    const bullTrigger = (isCrossAbovePivot || isS1Bounce) && isBullCandle;
    const bearTrigger = (isCrossBelowPivot || isR1Reject) && isBearCandle;

    const bullishConditions: StrategyCondition[] = [
      {
        id: 'piv_bull_level',
        name: isS1Bounce
          ? `Support S1 Bounce (${s1.toFixed(5)})`
          : `Breakout Above Session Pivot (${pivot.toFixed(5)}) < R1 (${r1.toFixed(5)})`,
        satisfied: isCrossAbovePivot || isS1Bounce,
        weight: 60,
        isMandatory: true,
      },
      {
        id: 'piv_bull_candle',
        name: `Bullish Rejection/Breakout Candle Close`,
        satisfied: isBullCandle,
        weight: 40,
        isMandatory: true,
      },
    ];

    const bearishConditions: StrategyCondition[] = [
      {
        id: 'piv_bear_level',
        name: isR1Reject
          ? `Resistance R1 Rejection (${r1.toFixed(5)})`
          : `Breakdown Below Session Pivot (${pivot.toFixed(5)}) > S1 (${s1.toFixed(5)})`,
        satisfied: isCrossBelowPivot || isR1Reject,
        weight: 60,
        isMandatory: true,
      },
      {
        id: 'piv_bear_candle',
        name: `Bearish Rejection/Breakdown Candle Close`,
        satisfied: isBearCandle,
        weight: 40,
        isMandatory: true,
      },
    ];

    const bullishScore = bullishConditions.reduce((acc, c) => acc + (c.satisfied ? c.weight : 0), 0);
    const bearishScore = bearishConditions.reduce((acc, c) => acc + (c.satisfied ? c.weight : 0), 0);

    if (bullTrigger) {
      return {
        strategyId: 'pivot_point',
        strategyName: 'Standard Floor Pivots',
        signal: 'UP',
        score: (bullishScore / 100) * config.weight * 2,
        weight: config.weight,
        reasons: [
          isS1Bounce
            ? `Floor Pivot S1 (${s1.toFixed(5)}) bullish bounce targeting PP (${pivot.toFixed(5)})`
            : `Price crossed above Floor Pivot PP (${pivot.toFixed(5)}) targeting R1 (${r1.toFixed(5)})`,
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

    if (bearTrigger) {
      return {
        strategyId: 'pivot_point',
        strategyName: 'Standard Floor Pivots',
        signal: 'DOWN',
        score: -(bearishScore / 100) * config.weight * 2,
        weight: config.weight,
        reasons: [
          isR1Reject
            ? `Floor Pivot R1 (${r1.toFixed(5)}) bearish rejection targeting PP (${pivot.toFixed(5)})`
            : `Price crossed below Floor Pivot PP (${pivot.toFixed(5)}) targeting S1 (${s1.toFixed(5)})`,
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
      strategyId: 'pivot_point',
      strategyName: 'Standard Floor Pivots',
      signal: 'WAIT',
      score: 0,
      weight: config.weight,
      reasons: [`Price inside Floor Pivot range (S1: ${s1.toFixed(5)}, PP: ${pivot.toFixed(5)}, R1: ${r1.toFixed(5)})`],
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
