import { Candle, StrategyResult, StrategyCondition } from '../types';
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
    const sarPrev1 = calculateParabolicSAR(candles.slice(0, -1), config.step, config.maxStep);
    const sarPrev2 = candles.length >= 7 ? calculateParabolicSAR(candles.slice(0, -2), config.step, config.maxStep) : null;
    const sarPrev3 = candles.length >= 8 ? calculateParabolicSAR(candles.slice(0, -3), config.step, config.maxStep) : null;

    if (!sarCurr || !sarPrev1) {
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

    const last = candles[candles.length - 1];
    const prev = candles[candles.length - 2];

    const isBullishFlip = sarPrev1.trend === 'DOWN' && sarCurr.trend === 'UP';
    const isBearishFlip = sarPrev1.trend === 'UP' && sarCurr.trend === 'DOWN';

    // Early impulse: flip happened 1-2 bars ago and price still accelerating with candle close
    const isRecentBullFlip =
      sarCurr.trend === 'UP' &&
      ((sarPrev2 && sarPrev2.trend === 'DOWN') || (sarPrev3 && sarPrev3.trend === 'DOWN'));
    const isRecentBearFlip =
      sarCurr.trend === 'DOWN' &&
      ((sarPrev2 && sarPrev2.trend === 'UP') || (sarPrev3 && sarPrev3.trend === 'UP'));

    const isBullEarlyCont = isRecentBullFlip && last.close > last.open && last.close > prev.close;
    const isBearEarlyCont = isRecentBearFlip && last.close < last.open && last.close < prev.close;

    const isUpTrend = sarCurr.trend === 'UP';
    const bullTrigger = isBullishFlip || isBullEarlyCont;
    const bearTrigger = isBearishFlip || isBearEarlyCont;

    const bullishConditions: StrategyCondition[] = [
      {
        id: 'psar_bull_dots',
        name: `SAR Dots Plotted Below Price (${sarCurr.sar.toFixed(5)})`,
        satisfied: isUpTrend,
        weight: 40,
        isMandatory: true,
      },
      {
        id: 'psar_bull_flip',
        name: `Bullish Flip Emergence or Early Momentum`,
        satisfied: bullTrigger,
        weight: 45,
        isMandatory: true,
      },
      {
        id: 'psar_bull_candle',
        name: `Bullish Candle Confirmation`,
        satisfied: last.close > last.open,
        weight: 15,
      },
    ];

    const bearishConditions: StrategyCondition[] = [
      {
        id: 'psar_bear_dots',
        name: `SAR Dots Plotted Above Price (${sarCurr.sar.toFixed(5)})`,
        satisfied: !isUpTrend,
        weight: 40,
        isMandatory: true,
      },
      {
        id: 'psar_bear_flip',
        name: `Bearish Flip Emergence or Early Momentum`,
        satisfied: bearTrigger,
        weight: 45,
        isMandatory: true,
      },
      {
        id: 'psar_bear_candle',
        name: `Bearish Candle Confirmation`,
        satisfied: last.close < last.open,
        weight: 15,
      },
    ];

    const bullishScore = bullishConditions.reduce((acc, c) => acc + (c.satisfied ? c.weight : 0), 0);
    const bearishScore = bearishConditions.reduce((acc, c) => acc + (c.satisfied ? c.weight : 0), 0);

    if (isUpTrend && bullTrigger) {
      return {
        strategyId: 'parabolic_sar',
        strategyName: 'Parabolic SAR',
        signal: 'UP',
        score: (bullishScore / 100) * config.weight * 2,
        weight: config.weight,
        reasons: [
          isBullishFlip
            ? `Parabolic SAR Bullish Flip: Price crossed above SAR (${sarCurr.sar.toFixed(5)})`
            : `Parabolic SAR early bullish impulse trailing at ${sarCurr.sar.toFixed(5)}`,
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

    if (!isUpTrend && bearTrigger) {
      return {
        strategyId: 'parabolic_sar',
        strategyName: 'Parabolic SAR',
        signal: 'DOWN',
        score: -(bearishScore / 100) * config.weight * 2,
        weight: config.weight,
        reasons: [
          isBearishFlip
            ? `Parabolic SAR Bearish Flip: Price crossed below SAR (${sarCurr.sar.toFixed(5)})`
            : `Parabolic SAR early bearish impulse trailing at ${sarCurr.sar.toFixed(5)}`,
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
      strategyId: 'parabolic_sar',
      strategyName: 'Parabolic SAR',
      signal: 'WAIT',
      score: 0,
      weight: config.weight,
      reasons: [`Parabolic SAR in mature ${sarCurr.trend} trend (${sarCurr.sar.toFixed(5)}) — awaiting reversal flip`],
      candleTimestamp,
      dataValid: true,
      bullishScore,
      bearishScore,
      percentage: Math.max(bullishScore, bearishScore),
      direction: 'NEUTRAL',
      conditions: isUpTrend ? bullishConditions : bearishConditions,
    };
  }
}
