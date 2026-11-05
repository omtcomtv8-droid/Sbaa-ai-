import { Candle, StrategyResult } from '../types';
import { calculateEMA, calculateSMA } from '../indicators';

export interface MaAlignmentConfig {
  enabled: boolean;
  weight: number;
}

export class MaAlignmentStrategy {
  public static evaluate(
    candles: Candle[],
    config: MaAlignmentConfig = { enabled: true, weight: 1.4 }
  ): StrategyResult {
    const candleTimestamp = candles.length > 0 ? candles[candles.length - 1].time : 0;

    if (!config.enabled) {
      return {
        strategyId: 'ma_alignment',
        strategyName: 'MA Alignment Trend',
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

    if (candles.length < 55) {
      return {
        strategyId: 'ma_alignment',
        strategyName: 'MA Alignment Trend',
        signal: 'WAIT',
        score: 0,
        weight: config.weight,
        reasons: [`Accumulating candles for multi-MA alignment (${candles.length}/55)`],
        candleTimestamp,
        dataValid: false,
        bullishScore: 0,
        bearishScore: 0,
        percentage: 0,
        direction: 'NEUTRAL',
        conditions: [],
      };
    }

    const closes = candles.map((c) => c.close);
    const currPrice = closes[closes.length - 1];

    const ema9 = calculateEMA(closes, 9);
    const ema21 = calculateEMA(closes, 21);
    const ema50 = calculateEMA(closes, 50);

    if (ema9 === null || ema21 === null || ema50 === null) {
      return {
        strategyId: 'ma_alignment',
        strategyName: 'MA Alignment Trend',
        signal: 'WAIT',
        score: 0,
        weight: config.weight,
        reasons: ['Calculating MAs'],
        candleTimestamp,
        dataValid: false,
        bullishScore: 0,
        bearishScore: 0,
        percentage: 0,
        direction: 'NEUTRAL',
        conditions: [],
      };
    }

    const c1Bull = currPrice > ema9;
    const c2Bull = ema9 > ema21;
    const c3Bull = ema21 > ema50;

    const conditions = [
      { name: `Price (${currPrice.toFixed(4)}) > EMA 9 (${ema9.toFixed(4)})`, satisfied: c1Bull, weight: 30 },
      { name: `EMA 9 > EMA 21 (${ema21.toFixed(4)})`, satisfied: c2Bull, weight: 35 },
      { name: `EMA 21 > EMA 50 (${ema50.toFixed(4)})`, satisfied: c3Bull, weight: 35 },
    ];

    let bullishScore = 0;
    if (c1Bull) bullishScore += 30;
    if (c2Bull) bullishScore += 35;
    if (c3Bull) bullishScore += 35;

    let bearishScore = 0;
    if (!c1Bull) bearishScore += 30;
    if (!c2Bull) bearishScore += 35;
    if (!c3Bull) bearishScore += 35;

    if (bullishScore >= 70) {
      return {
        strategyId: 'ma_alignment',
        strategyName: 'MA Alignment Trend',
        signal: 'UP',
        score: (bullishScore / 100) * config.weight * 2,
        weight: config.weight,
        reasons: [
          `Strong Bullish Stack: Price > EMA9 > EMA21 > EMA50`,
          `EMA9: ${ema9.toFixed(5)}, EMA21: ${ema21.toFixed(5)}, EMA50: ${ema50.toFixed(5)}`,
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

    if (bearishScore >= 70) {
      return {
        strategyId: 'ma_alignment',
        strategyName: 'MA Alignment Trend',
        signal: 'DOWN',
        score: -(bearishScore / 100) * config.weight * 2,
        weight: config.weight,
        reasons: [
          `Strong Bearish Stack: Price < EMA9 < EMA21 < EMA50`,
          `EMA9: ${ema9.toFixed(5)}, EMA21: ${ema21.toFixed(5)}, EMA50: ${ema50.toFixed(5)}`,
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
      strategyId: 'ma_alignment',
      strategyName: 'MA Alignment Trend',
      signal: 'WAIT',
      score: 0,
      weight: config.weight,
      reasons: ['Moving averages entangled or transitioning'],
      candleTimestamp,
      dataValid: true,
      bullishScore,
      bearishScore,
      percentage: Math.max(bullishScore, bearishScore),
      direction: 'NEUTRAL',
      conditions,
    };
  }
}
