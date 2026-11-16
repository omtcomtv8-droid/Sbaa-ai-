import { Candle, StrategyResult, StrategyCondition } from '../types';
import { calculateEMA } from '../indicators';

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

    const c1Bear = currPrice < ema9;
    const c2Bear = ema9 < ema21;
    const c3Bear = ema21 < ema50;

    const bullishConditions: StrategyCondition[] = [
      { id: 'ma_bull_fast', name: `EMA 9 (${ema9.toFixed(5)}) > EMA 21 (${ema21.toFixed(5)})`, satisfied: c2Bull, weight: 35, isMandatory: true },
      { id: 'ma_bull_slow', name: `EMA 21 (${ema21.toFixed(5)}) > EMA 50 (${ema50.toFixed(5)})`, satisfied: c3Bull, weight: 35, isMandatory: true },
      { id: 'ma_bull_price', name: `Price (${currPrice.toFixed(5)}) > EMA 9 (${ema9.toFixed(5)})`, satisfied: c1Bull, weight: 30 },
    ];

    const bearishConditions: StrategyCondition[] = [
      { id: 'ma_bear_fast', name: `EMA 9 (${ema9.toFixed(5)}) < EMA 21 (${ema21.toFixed(5)})`, satisfied: c2Bear, weight: 35, isMandatory: true },
      { id: 'ma_bear_slow', name: `EMA 21 (${ema21.toFixed(5)}) < EMA 50 (${ema50.toFixed(5)})`, satisfied: c3Bear, weight: 35, isMandatory: true },
      { id: 'ma_bear_price', name: `Price (${currPrice.toFixed(5)}) < EMA 9 (${ema9.toFixed(5)})`, satisfied: c1Bear, weight: 30 },
    ];

    const bullishScore = bullishConditions.reduce((acc, c) => acc + (c.satisfied ? c.weight : 0), 0);
    const bearishScore = bearishConditions.reduce((acc, c) => acc + (c.satisfied ? c.weight : 0), 0);

    if (c2Bull && c3Bull && bullishScore >= 70) {
      return {
        strategyId: 'ma_alignment',
        strategyName: 'MA Alignment Trend',
        signal: 'UP',
        score: (bullishScore / 100) * config.weight * 2,
        weight: config.weight,
        reasons: [
          `Strong Bullish Stack: Price ${c1Bull ? '>' : '~'} EMA9 > EMA21 > EMA50`,
          `EMA9: ${ema9.toFixed(5)}, EMA21: ${ema21.toFixed(5)}, EMA50: ${ema50.toFixed(5)}`,
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

    if (c2Bear && c3Bear && bearishScore >= 70) {
      return {
        strategyId: 'ma_alignment',
        strategyName: 'MA Alignment Trend',
        signal: 'DOWN',
        score: -(bearishScore / 100) * config.weight * 2,
        weight: config.weight,
        reasons: [
          `Strong Bearish Stack: Price ${c1Bear ? '<' : '~'} EMA9 < EMA21 < EMA50`,
          `EMA9: ${ema9.toFixed(5)}, EMA21: ${ema21.toFixed(5)}, EMA50: ${ema50.toFixed(5)}`,
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
      conditions: bullishScore >= bearishScore ? bullishConditions : bearishConditions,
    };
  }
}
