import { Candle, StrategyResult, StrategyCondition } from '../types';
import { calculateIchimoku } from '../indicators';

function getMidpoint(slice: Candle[]): number {
  const high = Math.max(...slice.map((c) => c.high));
  const low = Math.min(...slice.map((c) => c.low));
  return (high + low) / 2;
}

export class IchimokuStrategy {
  public static evaluate(candles: Candle[], config = { enabled: true, weight: 1.0 }): StrategyResult {
    const candleTimestamp = candles.length > 0 ? candles[candles.length - 1].time : 0;

    if (!config.enabled) {
      return {
        strategyId: 'ichimoku_cloud',
        strategyName: 'Ichimoku Cloud',
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

    if (candles.length < 52) {
      return {
        strategyId: 'ichimoku_cloud',
        strategyName: 'Ichimoku Cloud',
        signal: 'WAIT',
        score: 0,
        weight: config.weight,
        reasons: [`Accumulating candles for Ichimoku Kumo Cloud (${candles.length}/52)`],
        candleTimestamp,
        dataValid: false,
        bullishScore: 0,
        bearishScore: 0,
        percentage: 0,
        direction: 'NEUTRAL',
        conditions: [],
      };
    }

    const currIchimoku = calculateIchimoku(candles);
    if (!currIchimoku) {
      return {
        strategyId: 'ichimoku_cloud',
        strategyName: 'Ichimoku Cloud',
        signal: 'WAIT',
        score: 0,
        weight: config.weight,
        reasons: ['Calculating Ichimoku Kumo components'],
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
    const tenkan = currIchimoku.tenkan;
    const kijun = currIchimoku.kijun;

    // Displaced Kumo Cloud & Chikou Span without look-ahead bias:
    // The Kumo active over the current bar t was projected 26 bars earlier from slice ending at index (n - 1 - 26).
    let cloudTop = Math.max(currIchimoku.senkouSpanA, currIchimoku.senkouSpanB);
    let cloudBottom = Math.min(currIchimoku.senkouSpanA, currIchimoku.senkouSpanB);
    let chikouBull = last.close > kijun;
    let chikouBear = last.close < kijun;

    if (candles.length >= 78) {
      const kumoOriginSlice = candles.slice(0, candles.length - 26);
      const tenkanPast = getMidpoint(kumoOriginSlice.slice(-9));
      const kijunPast = getMidpoint(kumoOriginSlice.slice(-26));
      const spanA_t = (tenkanPast + kijunPast) / 2;
      const spanB_t = getMidpoint(kumoOriginSlice.slice(-52));
      cloudTop = Math.max(spanA_t, spanB_t);
      cloudBottom = Math.min(spanA_t, spanB_t);

      // Chikou Span is current close plotted 26 bars back against historical close[n - 1 - 26]
      const histBar26 = candles[candles.length - 27];
      chikouBull = last.close > histBar26.close;
      chikouBear = last.close < histBar26.close;
    }

    const isPriceAboveCloud = last.close > cloudTop;
    const isPriceBelowCloud = last.close < cloudBottom;
    const isBullTk = tenkan > kijun && last.close > tenkan;
    const isBearTk = tenkan < kijun && last.close < tenkan;

    const bullishConditions: StrategyCondition[] = [
      {
        id: 'ichi_tk_bull',
        name: `Price (${last.close.toFixed(5)}) > Tenkan (${tenkan.toFixed(5)}) > Kijun (${kijun.toFixed(5)})`,
        satisfied: isBullTk,
        weight: 40,
        isMandatory: true,
      },
      {
        id: 'ichi_kumo_bull',
        name: `Price Above Kumo Cloud Top (${cloudTop.toFixed(5)})`,
        satisfied: isPriceAboveCloud,
        weight: 40,
        isMandatory: true,
      },
      {
        id: 'ichi_chikou_bull',
        name: `Chikou Span & Future Kumo Bullish Confirmation`,
        satisfied: chikouBull && currIchimoku.cloudColor === 'BULLISH',
        weight: 20,
      },
    ];

    const bearishConditions: StrategyCondition[] = [
      {
        id: 'ichi_tk_bear',
        name: `Price (${last.close.toFixed(5)}) < Tenkan (${tenkan.toFixed(5)}) < Kijun (${kijun.toFixed(5)})`,
        satisfied: isBearTk,
        weight: 40,
        isMandatory: true,
      },
      {
        id: 'ichi_kumo_bear',
        name: `Price Below Kumo Cloud Bottom (${cloudBottom.toFixed(5)})`,
        satisfied: isPriceBelowCloud,
        weight: 40,
        isMandatory: true,
      },
      {
        id: 'ichi_chikou_bear',
        name: `Chikou Span & Future Kumo Bearish Confirmation`,
        satisfied: chikouBear && currIchimoku.cloudColor === 'BEARISH',
        weight: 20,
      },
    ];

    const bullishScore = bullishConditions.reduce((acc, c) => acc + (c.satisfied ? c.weight : 0), 0);
    const bearishScore = bearishConditions.reduce((acc, c) => acc + (c.satisfied ? c.weight : 0), 0);

    if (isBullTk && isPriceAboveCloud) {
      return {
        strategyId: 'ichimoku_cloud',
        strategyName: 'Ichimoku Cloud',
        signal: 'UP',
        score: Number(((bullishScore / 100) * config.weight * 2).toFixed(2)),
        weight: config.weight,
        reasons: [
          `Ichimoku Bullish Breakout: Price (${last.close.toFixed(5)}) above Kumo Cloud (${cloudTop.toFixed(5)})`,
          `Tenkan (${tenkan.toFixed(5)}) > Kijun (${kijun.toFixed(5)})${chikouBull ? ' with Chikou Span clear above historical price' : ''}`,
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

    if (isBearTk && isPriceBelowCloud) {
      return {
        strategyId: 'ichimoku_cloud',
        strategyName: 'Ichimoku Cloud',
        signal: 'DOWN',
        score: Number((-(bearishScore / 100) * config.weight * 2).toFixed(2)),
        weight: config.weight,
        reasons: [
          `Ichimoku Bearish Breakdown: Price (${last.close.toFixed(5)}) below Kumo Cloud (${cloudBottom.toFixed(5)})`,
          `Tenkan (${tenkan.toFixed(5)}) < Kijun (${kijun.toFixed(5)})${chikouBear ? ' with Chikou Span clear below historical price' : ''}`,
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
      strategyId: 'ichimoku_cloud',
      strategyName: 'Ichimoku Cloud',
      signal: 'WAIT',
      score: 0,
      weight: config.weight,
      reasons: [`Price inside or conflicting with Ichimoku Kumo Cloud [${cloudBottom.toFixed(5)} - ${cloudTop.toFixed(5)}]`],
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
