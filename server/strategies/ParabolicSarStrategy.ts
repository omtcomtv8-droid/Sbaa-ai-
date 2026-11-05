import { Candle, StrategyResult } from '../types';
import { calculateParabolicSAR } from '../indicators';

export interface ParabolicSarConfig {
  enabled: boolean;
  step: number;
  maxStep: number;
  weight: number;
}

export class ParabolicSarStrategy {
  public static evaluate(
    candles: Candle[],
    config: ParabolicSarConfig = { enabled: true, step: 0.02, maxStep: 0.2, weight: 1.1 }
  ): StrategyResult {
    const candleTimestamp = candles.length > 0 ? candles[candles.length - 1].time : 0;

    if (!config.enabled) {
      return {
        strategyId: 'parabolic_sar',
        strategyName: 'Parabolic SAR',
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

    if (candles.length < 10) {
      return {
        strategyId: 'parabolic_sar',
        strategyName: 'Parabolic SAR',
        signal: 'WAIT',
        score: 0,
        weight: config.weight,
        reasons: [`Accumulating candles for SAR (${candles.length}/10)`],
        candleTimestamp,
        dataValid: false,
        bullishScore: 0,
        bearishScore: 0,
        percentage: 0,
        direction: 'NEUTRAL',
        conditions: [],
      };
    }

    const sarCurr = calculateParabolicSAR(candles, config.step, config.maxStep);
    const sarPrev = calculateParabolicSAR(candles.slice(0, -1), config.step, config.maxStep);

    if (!sarCurr || !sarPrev) {
      return {
        strategyId: 'parabolic_sar',
        strategyName: 'Parabolic SAR',
        signal: 'WAIT',
        score: 0,
        weight: config.weight,
        reasons: ['Calculating SAR'],
        candleTimestamp,
        dataValid: false,
        bullishScore: 0,
        bearishScore: 0,
        percentage: 0,
        direction: 'NEUTRAL',
        conditions: [],
      };
    }

    const isBullishFlip = sarPrev.trend === 'DOWN' && sarCurr.trend === 'UP';
    const isBearishFlip = sarPrev.trend === 'UP' && sarCurr.trend === 'DOWN';
    const isUpTrend = sarCurr.trend === 'UP';

    const conditions = [
      { name: `SAR Dots Plotted Below Price (Bullish)`, satisfied: isUpTrend, weight: 40 },
      { name: `Bullish Trend Flip Dot Emergence`, satisfied: isBullishFlip, weight: 60 },
      { name: `SAR Dots Plotted Above Price (Bearish)`, satisfied: !isUpTrend, weight: 40 },
      { name: `Bearish Trend Flip Dot Emergence`, satisfied: isBearishFlip, weight: 60 },
    ];

    let bullishScore = isUpTrend ? (isBullishFlip ? 100 : 70) : 10;
    let bearishScore = !isUpTrend ? (isBearishFlip ? 100 : 70) : 10;

    if (isBullishFlip || (isUpTrend && bullishScore >= 70)) {
      return {
        strategyId: 'parabolic_sar',
        strategyName: 'Parabolic SAR',
        signal: 'UP',
        score: (bullishScore / 100) * config.weight * 2,
        weight: config.weight,
        reasons: [
          isBullishFlip ? `Parabolic SAR Bullish Flip: Price crossed above SAR (${sarCurr.sar})` : `Parabolic SAR Bullish Trend trailing at ${sarCurr.sar}`,
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

    if (isBearishFlip || (!isUpTrend && bearishScore >= 70)) {
      return {
        strategyId: 'parabolic_sar',
        strategyName: 'Parabolic SAR',
        signal: 'DOWN',
        score: -(bearishScore / 100) * config.weight * 2,
        weight: config.weight,
        reasons: [
          isBearishFlip ? `Parabolic SAR Bearish Flip: Price crossed below SAR (${sarCurr.sar})` : `Parabolic SAR Bearish Trend trailing at ${sarCurr.sar}`,
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
      strategyId: 'parabolic_sar',
      strategyName: 'Parabolic SAR',
      signal: 'WAIT',
      score: 0,
      weight: config.weight,
      reasons: ['Parabolic SAR consolidating'],
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
