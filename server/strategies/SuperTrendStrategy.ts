import { Candle, StrategyResult, StrategyCondition } from '../types';

export interface SuperTrendConfig {
  enabled: boolean;
  period: number;
  multiplier: number;
  weight: number;
}

export class SuperTrendStrategy {
  public static evaluate(
    candles: Candle[],
    config: SuperTrendConfig = { enabled: true, period: 10, multiplier: 3, weight: 1.1 }
  ): StrategyResult {
    const candleTimestamp = candles.length > 0 ? candles[candles.length - 1].time : 0;

    if (!config.enabled) {
      return {
        strategyId: 'supertrend',
        strategyName: 'SuperTrend Dynamic Volatility',
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

    const period = Math.max(2, config.period || 10);
    const multiplier = Math.max(0.5, config.multiplier || 3);

    if (candles.length < period + 5) {
      return {
        strategyId: 'supertrend',
        strategyName: 'SuperTrend Dynamic Volatility',
        signal: 'WAIT',
        score: 0,
        weight: config.weight,
        reasons: [`Accumulating candles for SuperTrend (${candles.length}/${period + 5})`],
        candleTimestamp,
        dataValid: false,
        bullishScore: 0,
        bearishScore: 0,
        percentage: 0,
        direction: 'NEUTRAL',
        conditions: [],
      };
    }

    // Compute chronological Wilder ATR and canonical recursive SuperTrend bands
    const trs: number[] = [];
    for (let i = 1; i < candles.length; i++) {
      const c = candles[i];
      const p = candles[i - 1];
      trs.push(Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close)));
    }

    let atr = trs.slice(0, period).reduce((sum, v) => sum + v, 0) / period;
    const initCandle = candles[period];
    const initHl2 = (initCandle.high + initCandle.low) / 2;
    let finalUpper = initHl2 + multiplier * atr;
    let finalLower = initHl2 - multiplier * atr;
    let trend: 1 | -1 = initCandle.close >= initHl2 ? 1 : -1;
    let prevTrend: 1 | -1 = trend;
    let barsSinceFlip = period;

    for (let idx = period + 1; idx < candles.length; idx++) {
      const c = candles[idx];
      const p = candles[idx - 1];
      const tr = trs[idx - 1];
      atr = (atr * (period - 1) + tr) / period;

      const hl2 = (c.high + c.low) / 2;
      const basicUpper = hl2 + multiplier * atr;
      const basicLower = hl2 - multiplier * atr;

      finalUpper = basicUpper < finalUpper || p.close > finalUpper ? basicUpper : finalUpper;
      finalLower = basicLower > finalLower || p.close < finalLower ? basicLower : finalLower;

      prevTrend = trend;
      if (trend === 1) {
        if (c.close < finalLower) {
          trend = -1;
          barsSinceFlip = 0;
        } else {
          barsSinceFlip += 1;
        }
      } else {
        if (c.close > finalUpper) {
          trend = 1;
          barsSinceFlip = 0;
        } else {
          barsSinceFlip += 1;
        }
      }
    }

    const last = candles[candles.length - 1];
    const prev = candles[candles.length - 2];
    const activeLine = trend === 1 ? finalLower : finalUpper;

    const isBullFlip = prevTrend === -1 && trend === 1;
    const isBearFlip = prevTrend === 1 && trend === -1;
    const isEarlyBullCont = trend === 1 && barsSinceFlip <= 3 && last.close > last.open && last.close > prev.close;
    const isEarlyBearCont = trend === -1 && barsSinceFlip <= 3 && last.close < last.open && last.close < prev.close;

    const bullTrigger = isBullFlip || isEarlyBullCont;
    const bearTrigger = isBearFlip || isEarlyBearCont;

    const bullishConditions: StrategyCondition[] = [
      {
        id: 'st_bull_regime',
        name: `SuperTrend Bullish Regime (Close ${last.close.toFixed(5)} > Band ${finalLower.toFixed(5)})`,
        satisfied: trend === 1 && last.close > finalLower,
        weight: 45,
        isMandatory: true,
      },
      {
        id: 'st_bull_trigger',
        name: `Fresh Bullish SuperTrend Flip or Early Impulse (${barsSinceFlip} bars)`,
        satisfied: bullTrigger,
        weight: 40,
        isMandatory: true,
      },
      {
        id: 'st_bull_close',
        name: `Bullish Candle Confirmation`,
        satisfied: last.close > last.open,
        weight: 15,
      },
    ];

    const bearishConditions: StrategyCondition[] = [
      {
        id: 'st_bear_regime',
        name: `SuperTrend Bearish Regime (Close ${last.close.toFixed(5)} < Band ${finalUpper.toFixed(5)})`,
        satisfied: trend === -1 && last.close < finalUpper,
        weight: 45,
        isMandatory: true,
      },
      {
        id: 'st_bear_trigger',
        name: `Fresh Bearish SuperTrend Flip or Early Impulse (${barsSinceFlip} bars)`,
        satisfied: bearTrigger,
        weight: 40,
        isMandatory: true,
      },
      {
        id: 'st_bear_close',
        name: `Bearish Candle Confirmation`,
        satisfied: last.close < last.open,
        weight: 15,
      },
    ];

    const bullishScore = bullishConditions.reduce((acc, c) => acc + (c.satisfied ? c.weight : 0), 0);
    const bearishScore = bearishConditions.reduce((acc, c) => acc + (c.satisfied ? c.weight : 0), 0);

    if (trend === 1 && bullTrigger) {
      return {
        strategyId: 'supertrend',
        strategyName: 'SuperTrend Dynamic Volatility',
        signal: 'UP',
        score: Number(((bullishScore / 100) * config.weight * 2).toFixed(2)),
        weight: config.weight,
        reasons: [
          isBullFlip
            ? `SuperTrend flipped BULLISH at ${finalLower.toFixed(5)} (ATR=${atr.toFixed(5)})`
            : `SuperTrend early bullish continuation (${barsSinceFlip} bar(s) after flip above ${finalLower.toFixed(5)})`,
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

    if (trend === -1 && bearTrigger) {
      return {
        strategyId: 'supertrend',
        strategyName: 'SuperTrend Dynamic Volatility',
        signal: 'DOWN',
        score: Number((-(bearishScore / 100) * config.weight * 2).toFixed(2)),
        weight: config.weight,
        reasons: [
          isBearFlip
            ? `SuperTrend flipped BEARISH at ${finalUpper.toFixed(5)} (ATR=${atr.toFixed(5)})`
            : `SuperTrend early bearish continuation (${barsSinceFlip} bar(s) after flip below ${finalUpper.toFixed(5)})`,
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
      strategyId: 'supertrend',
      strategyName: 'SuperTrend Dynamic Volatility',
      signal: 'WAIT',
      score: 0,
      weight: config.weight,
      reasons: [`SuperTrend (${trend === 1 ? 'Bullish' : 'Bearish'} band @ ${activeLine.toFixed(5)}) — awaiting fresh flip or early impulse`],
      candleTimestamp,
      dataValid: true,
      bullishScore,
      bearishScore,
      percentage: Math.max(bullishScore, bearishScore),
      direction: 'NEUTRAL',
      conditions: trend === 1 ? bullishConditions : bearishConditions,
    };
  }
}
