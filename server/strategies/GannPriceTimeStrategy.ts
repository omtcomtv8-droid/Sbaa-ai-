import { Candle, StrategyResult, GannPriceTimeConfig, GannAnalysisData, GannLevel, GannAngle } from '../types';

export class GannPriceTimeStrategy {
  private static readonly CANONICAL_GANN_CYCLES = [7, 14, 21, 30, 45, 60, 90, 144, 180];

  public static evaluate(
    candles: Candle[],
    config: GannPriceTimeConfig = { enabled: true, lookback: 60, weight: 1.3 }
  ): StrategyResult {
    const candleTimestamp = candles.length > 0 ? candles[candles.length - 1].time : 0;

    if (!config.enabled) {
      return {
        strategyId: 'gann_price_time',
        strategyName: 'W.D. Gann Price/Time',
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

    const minCandles = Math.min(30, config.lookback);
    if (candles.length < minCandles) {
      return {
        strategyId: 'gann_price_time',
        strategyName: 'W.D. Gann Price/Time',
        signal: 'WAIT',
        score: 0,
        weight: config.weight,
        reasons: [`Accumulating candles for Gann analysis (${candles.length}/${minCandles})`],
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
    const n = slice.length;
    const currentCandle = slice[n - 1];
    const prevCandle = slice[n - 2];
    const currentPrice = currentCandle.close;

    // 1. Detect Significant Swing Highs & Swing Lows (Fractal pivots)
    const swingHighs: { price: number; time: number; index: number }[] = [];
    const swingLows: { price: number; time: number; index: number }[] = [];

    const pivotWindow = 2;
    for (let i = pivotWindow; i < n - pivotWindow; i++) {
      let isHigh = true;
      let isLow = true;
      for (let j = 1; j <= pivotWindow; j++) {
        if (slice[i - j].high >= slice[i].high || slice[i + j].high > slice[i].high) isHigh = false;
        if (slice[i - j].low <= slice[i].low || slice[i + j].low < slice[i].low) isLow = false;
      }
      if (isHigh) swingHighs.push({ price: slice[i].high, time: slice[i].time, index: i });
      if (isLow) swingLows.push({ price: slice[i].low, time: slice[i].time, index: i });
    }

    // Find absolute highest high and lowest low in slice to anchor Gann grid
    let maxHighPrice = -Infinity;
    let maxHighIndex = 0;
    let minLowPrice = Infinity;
    let minLowIndex = 0;

    for (let i = 0; i < n; i++) {
      if (slice[i].high > maxHighPrice) {
        maxHighPrice = slice[i].high;
        maxHighIndex = i;
      }
      if (slice[i].low < minLowPrice) {
        minLowPrice = slice[i].low;
        minLowIndex = i;
      }
    }

    const range = maxHighPrice - minLowPrice;
    if (range <= 0) {
      return {
        strategyId: 'gann_price_time',
        strategyName: 'W.D. Gann Price/Time',
        signal: 'WAIT',
        score: 0,
        weight: config.weight,
        reasons: ['Zero price volatility / flat range across lookback'],
        candleTimestamp,
        dataValid: false,
        bullishScore: 0,
        bearishScore: 0,
        percentage: 0,
        direction: 'NEUTRAL',
        conditions: [],
      };
    }

    const anchorHigh = { price: maxHighPrice, time: slice[maxHighIndex].time, candleIndex: maxHighIndex };
    const anchorLow = { price: minLowPrice, time: slice[minLowIndex].time, candleIndex: minLowIndex };

    // Dominant Trend: If low occurred before high, structural impulse was bullish; otherwise bearish
    const dominantTrend: 'BULLISH' | 'BEARISH' | 'CONSOLIDATION' =
      anchorLow.candleIndex < anchorHigh.candleIndex
        ? currentPrice > minLowPrice + 0.4 * range
          ? 'BULLISH'
          : 'CONSOLIDATION'
        : currentPrice < maxHighPrice - 0.4 * range
        ? 'BEARISH'
        : 'CONSOLIDATION';

    // Primary anchor for angles and elapsed time: in uptrend angles project from anchorLow, in downtrend from anchorHigh
    const isFromLow = dominantTrend === 'BULLISH' || (dominantTrend === 'CONSOLIDATION' && anchorLow.candleIndex < anchorHigh.candleIndex);
    const activeAnchor = isFromLow ? anchorLow : anchorHigh;
    const elapsedBars = Math.max(1, (n - 1) - activeAnchor.candleIndex);

    // 2. Gann Divisions of Price (The 8ths of Range)
    const gannLevels: GannLevel[] = [
      { fraction: '0/8 (0%)', price: Number(minLowPrice.toFixed(5)), type: 'MAJOR_LOW' },
      { fraction: '1/8 (12.5%)', price: Number((minLowPrice + 0.125 * range).toFixed(5)), type: 'INTERMEDIATE' },
      { fraction: '2/8 (25%)', price: Number((minLowPrice + 0.25 * range).toFixed(5)), type: 'INTERMEDIATE' },
      { fraction: '3/8 (37.5%)', price: Number((minLowPrice + 0.375 * range).toFixed(5)), type: 'INTERMEDIATE' },
      { fraction: '4/8 (50% Equilibrium)', price: Number((minLowPrice + 0.5 * range).toFixed(5)), type: 'EQUILIBRIUM' },
      { fraction: '5/8 (62.5%)', price: Number((minLowPrice + 0.625 * range).toFixed(5)), type: 'INTERMEDIATE' },
      { fraction: '6/8 (75%)', price: Number((minLowPrice + 0.75 * range).toFixed(5)), type: 'INTERMEDIATE' },
      { fraction: '7/8 (87.5%)', price: Number((minLowPrice + 0.875 * range).toFixed(5)), type: 'INTERMEDIATE' },
      { fraction: '8/8 (100%)', price: Number(maxHighPrice.toFixed(5)), type: 'MAJOR_HIGH' },
    ];

    const equilibrium50 = minLowPrice + 0.5 * range;
    const level38 = minLowPrice + 0.375 * range;
    const level62 = minLowPrice + 0.625 * range;

    // 3. Gann Price/Time Angles (1x1, 2x1, 1x2)
    const baseCycleBars = Math.max(10, Math.abs(anchorHigh.candleIndex - anchorLow.candleIndex));
    const priceUnit = range / baseCycleBars;

    const angle1x1Value = isFromLow
      ? anchorLow.price + priceUnit * elapsedBars
      : anchorHigh.price - priceUnit * elapsedBars;
    const angle2x1Value = isFromLow
      ? anchorLow.price + 2 * priceUnit * elapsedBars
      : anchorHigh.price - 2 * priceUnit * elapsedBars;
    const angle1x2Value = isFromLow
      ? anchorLow.price + 0.5 * priceUnit * elapsedBars
      : anchorHigh.price - 0.5 * priceUnit * elapsedBars;

    const angles: GannAngle[] = [
      {
        name: '1x1 (Balance Angle)',
        slope: priceUnit,
        currentValue: Number(angle1x1Value.toFixed(5)),
        anchorPrice: activeAnchor.price,
        anchorTime: activeAnchor.time,
        direction: isFromLow ? 'ASCENDING' : 'DESCENDING',
      },
      {
        name: '2x1 (Fast Angle)',
        slope: 2 * priceUnit,
        currentValue: Number(angle2x1Value.toFixed(5)),
        anchorPrice: activeAnchor.price,
        anchorTime: activeAnchor.time,
        direction: isFromLow ? 'ASCENDING' : 'DESCENDING',
      },
      {
        name: '1x2 (Support/Resistance Angle)',
        slope: 0.5 * priceUnit,
        currentValue: Number(angle1x2Value.toFixed(5)),
        anchorPrice: activeAnchor.price,
        anchorTime: activeAnchor.time,
        direction: isFromLow ? 'ASCENDING' : 'DESCENDING',
      },
    ];

    // 4. Gann Time Cycles Elapsed
    const cycles = config.cycleIntervals || GannPriceTimeStrategy.CANONICAL_GANN_CYCLES;
    let nearestTimeCycle = cycles[0];
    let minCycleDist = Infinity;
    for (const c of cycles) {
      const dist = Math.abs(elapsedBars - c);
      if (dist < minCycleDist) {
        minCycleDist = dist;
        nearestTimeCycle = c;
      }
    }
    const isCycleAligned = minCycleDist <= 3; // Within 3 bars of a major Gann cycle

    // 5. Square of Price and Time
    const priceTravelRatio = Math.abs(currentPrice - activeAnchor.price) / range;
    const timeTravelRatio = elapsedBars / baseCycleBars;
    const priceTimeSquareRatio = Number(
      (priceTravelRatio / Math.max(0.01, timeTravelRatio)).toFixed(2)
    );
    const isPriceTimeSquared =
      Math.abs(priceTimeSquareRatio - 1.0) <= 0.18 ||
      Math.abs(priceTimeSquareRatio - 0.5) <= 0.12 ||
      Math.abs(priceTimeSquareRatio - 2.0) <= 0.25;

    // 6. Level Interaction & Breakout Analysis
    const isAbove50 = currentPrice >= equilibrium50;
    const isAbove1x1 = currentPrice >= angle1x1Value;
    const isCandleCloseBullish = currentCandle.close > currentCandle.open && currentCandle.close > prevCandle.close;
    const isCandleCloseBearish = currentCandle.close < currentCandle.open && currentCandle.close < prevCandle.close;

    // Nearest Gann Level
    let nearestLevel = gannLevels[0];
    let minLevelDist = Infinity;
    for (const gl of gannLevels) {
      const d = Math.abs(currentPrice - gl.price);
      if (d < minLevelDist) {
        minLevelDist = d;
        nearestLevel = gl;
      }
    }

    const levelInteraction =
      minLevelDist / range < 0.03
        ? `Testing Gann ${nearestLevel.fraction} at ${nearestLevel.price.toFixed(5)}`
        : currentPrice > equilibrium50
        ? `Trading in upper Gann quadrant above 50% Equilibrium (${equilibrium50.toFixed(5)})`
        : `Trading in lower Gann quadrant below 50% Equilibrium (${equilibrium50.toFixed(5)})`;

    // 7. Objective Conditions Verification
    const bullishConditions = [
      {
        name: `Dominant Gann Market Structure Bullish (Anchor Low ${anchorLow.price.toFixed(5)} respected)`,
        satisfied: dominantTrend === 'BULLISH' || (isFromLow && currentPrice > level38),
        weight: 25,
      },
      {
        name: `Price holding above Gann 1x1 Geometric Angle (${angle1x1Value.toFixed(5)})`,
        satisfied: isAbove1x1,
        weight: 25,
      },
      {
        name: `Price positioned above 50% Gann Equilibrium (${equilibrium50.toFixed(5)})`,
        satisfied: isAbove50,
        weight: 20,
      },
      {
        name: `Gann Time Cycle Alignment (${elapsedBars} bars elapsed, cycle ${nearestTimeCycle} window)`,
        satisfied: isCycleAligned || isPriceTimeSquared,
        weight: 15,
      },
      {
        name: `Candle Close Confirmation (Closed above previous candle close)`,
        satisfied: isCandleCloseBullish,
        weight: 15,
      },
    ];

    const bearishConditions = [
      {
        name: `Dominant Gann Market Structure Bearish (Anchor High ${anchorHigh.price.toFixed(5)} respected)`,
        satisfied: dominantTrend === 'BEARISH' || (!isFromLow && currentPrice < level62),
        weight: 25,
      },
      {
        name: `Price broken below Gann 1x1 Geometric Angle (${angle1x1Value.toFixed(5)})`,
        satisfied: !isAbove1x1,
        weight: 25,
      },
      {
        name: `Price positioned below 50% Gann Equilibrium (${equilibrium50.toFixed(5)})`,
        satisfied: !isAbove50,
        weight: 20,
      },
      {
        name: `Gann Time Cycle Alignment (${elapsedBars} bars elapsed, cycle ${nearestTimeCycle} window)`,
        satisfied: isCycleAligned || isPriceTimeSquared,
        weight: 15,
      },
      {
        name: `Candle Close Confirmation (Closed below previous candle close)`,
        satisfied: isCandleCloseBearish,
        weight: 15,
      },
    ];

    const bullishScore = bullishConditions.reduce((acc, c) => acc + (c.satisfied ? c.weight : 0), 0);
    const bearishScore = bearishConditions.reduce((acc, c) => acc + (c.satisfied ? c.weight : 0), 0);

    const gannData: GannAnalysisData = {
      anchorHigh,
      anchorLow,
      range: Number(range.toFixed(5)),
      elapsedBars,
      dominantTrend,
      gannLevels,
      angles,
      priceTimeSquareRatio,
      isPriceTimeSquared,
      nearestTimeCycle,
      barsToCycle: minCycleDist,
      levelInteraction,
      currentStatus: `Gann Range: ${range.toFixed(5)} | 50% Eq: ${equilibrium50.toFixed(5)} | 1x1: ${angle1x1Value.toFixed(5)} | Bars: ${elapsedBars}`,
    };

    // Strict decision thresholds (no forced signals)
    if (bullishScore >= 70 && bullishScore > bearishScore + 20 && isCandleCloseBullish) {
      return {
        strategyId: 'gann_price_time',
        strategyName: 'W.D. Gann Price/Time',
        signal: 'UP',
        score: (bullishScore / 100) * config.weight * 2,
        weight: config.weight,
        reasons: [
          `Gann price/time structure confirms bullish expansion: price (${currentPrice.toFixed(5)}) holds above 1x1 angle (${angle1x1Value.toFixed(5)})`,
          `Price trading above 50% equilibrium level (${equilibrium50.toFixed(5)}) with ${elapsedBars} bars elapsed from anchor`,
          isPriceTimeSquared
            ? `Price/Time squared (ratio: ${priceTimeSquareRatio}): mathematical harmonic turning point validated`
            : `Gann time interval active: ${minCycleDist} bar(s) from cycle ${nearestTimeCycle}`,
        ],
        candleTimestamp,
        dataValid: true,
        bullishScore,
        bearishScore,
        percentage: bullishScore,
        direction: 'BULLISH',
        conditions: bullishConditions,
        gannData,
      };
    }

    if (bearishScore >= 70 && bearishScore > bullishScore + 20 && isCandleCloseBearish) {
      return {
        strategyId: 'gann_price_time',
        strategyName: 'W.D. Gann Price/Time',
        signal: 'DOWN',
        score: (bearishScore / 100) * config.weight * 2,
        weight: config.weight,
        reasons: [
          `Gann price/time structure confirms bearish expansion: price (${currentPrice.toFixed(5)}) broke below 1x1 angle (${angle1x1Value.toFixed(5)})`,
          `Price trading below 50% equilibrium level (${equilibrium50.toFixed(5)}) with ${elapsedBars} bars elapsed from anchor`,
          isPriceTimeSquared
            ? `Price/Time squared (ratio: ${priceTimeSquareRatio}): cyclical distribution phase validated`
            : `Gann time interval active: ${minCycleDist} bar(s) from cycle ${nearestTimeCycle}`,
        ],
        candleTimestamp,
        dataValid: true,
        bullishScore,
        bearishScore,
        percentage: bearishScore,
        direction: 'BEARISH',
        conditions: bearishConditions,
        gannData,
      };
    }

    // Default WAIT when conditions lack objective mathematical confluence
    const reasons: string[] = [
      `WAIT — Gann price/time structure in consolidation between 8th divisions`,
      `Current price (${currentPrice.toFixed(5)}) relative to 50% equilibrium (${equilibrium50.toFixed(5)}) and 1x1 angle (${angle1x1Value.toFixed(5)})`,
      `Score insufficient for confirmed entry (Bullish: ${bullishScore}%, Bearish: ${bearishScore}% — 70% required)`,
    ];

    return {
      strategyId: 'gann_price_time',
      strategyName: 'W.D. Gann Price/Time',
      signal: 'WAIT',
      score: 0,
      weight: config.weight,
      reasons,
      candleTimestamp,
      dataValid: true,
      bullishScore,
      bearishScore,
      percentage: Math.max(bullishScore, bearishScore),
      direction: 'NEUTRAL',
      conditions: bullishScore >= bearishScore ? bullishConditions : bearishConditions,
      gannData,
    };
  }
}
