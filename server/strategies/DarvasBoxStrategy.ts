import { Candle, StrategyResult, DarvasBoxConfig, DarvasBoxData, DarvasBox } from '../types';

export class DarvasBoxStrategy {
  public static evaluate(
    candles: Candle[],
    config: DarvasBoxConfig = { enabled: true, lookback: 60, weight: 1.3, consolidationCandlesRequired: 3 }
  ): StrategyResult {
    const candleTimestamp = candles.length > 0 ? candles[candles.length - 1].time : 0;

    if (!config.enabled) {
      return {
        strategyId: 'darvas_box',
        strategyName: 'Nicolas Darvas Box',
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

    const minCandles = Math.min(10, config.lookback);
    if (candles.length < minCandles) {
      return {
        strategyId: 'darvas_box',
        strategyName: 'Nicolas Darvas Box',
        signal: 'WAIT',
        score: 0,
        weight: config.weight,
        reasons: [`Accumulating candles for Darvas Box formation (${candles.length}/${minCandles})`],
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
    const reqConsecutive = config.consolidationCandlesRequired || 3;

    // Scan through candles to discover historical and active Darvas boxes
    const discoveredBoxes: DarvasBox[] = [];
    let i = 0;

    while (i < n - reqConsecutive) {
      // Step 1: Detect potential peak high
      const peakHigh = slice[i].high;
      const peakTime = slice[i].time;
      let topConfirmed = true;

      // Check next reqConsecutive candles to ensure none exceed peakHigh
      for (let j = 1; j <= reqConsecutive; j++) {
        if (i + j >= n || slice[i + j].high > peakHigh) {
          topConfirmed = false;
          break;
        }
      }

      if (!topConfirmed) {
        i++;
        continue;
      }

      // Top is confirmed at peakHigh
      const topLevel = peakHigh;
      let bottomConfirmed = false;
      let bottomLevel = Infinity;
      let bottomIndex = i + reqConsecutive;
      let boxConfirmedIndex = -1;

      // Step 2: Track consolidation low and verify bottom
      for (let k = i + reqConsecutive; k < n; k++) {
        if (slice[k].high > topLevel) {
          // Breakout happened before bottom could confirm or during formation
          break;
        }

        if (slice[k].low < bottomLevel) {
          bottomLevel = slice[k].low;
          bottomIndex = k;
          // Test if bottom holds for reqConsecutive candles
          let holds = true;
          for (let m = 1; m <= reqConsecutive; m++) {
            if (bottomIndex + m >= n) {
              holds = false;
              break;
            }
            if (slice[bottomIndex + m].low < bottomLevel) {
              holds = false;
              break;
            }
          }
          if (holds) {
            bottomConfirmed = true;
            boxConfirmedIndex = bottomIndex + reqConsecutive;
            break;
          }
        }
      }

      if (topConfirmed && bottomConfirmed && bottomLevel < topLevel) {
        // Calculate number of candles inside this box
        let candlesInside = 0;
        let breakoutStatus: 'INSIDE' | 'BREAKOUT_UP' | 'BREAKDOWN_DOWN' | 'FAILED_BREAKOUT' = 'INSIDE';
        let breakoutPrice: number | undefined;
        let breakoutCandleTime: number | undefined;

        for (let b = i; b < n; b++) {
          const c = slice[b];
          if (c.close <= topLevel && c.close >= bottomLevel) {
            candlesInside++;
          } else if (c.close > topLevel) {
            breakoutStatus = 'BREAKOUT_UP';
            breakoutPrice = c.close;
            breakoutCandleTime = c.time;
            // Check for failed breakout
            if (b < n - 1 && slice[b + 1].close < topLevel) {
              breakoutStatus = 'FAILED_BREAKOUT';
            }
            break;
          } else if (c.close < bottomLevel) {
            breakoutStatus = 'BREAKDOWN_DOWN';
            breakoutPrice = c.close;
            breakoutCandleTime = c.time;
            break;
          }
        }

        const spread = topLevel - bottomLevel;
        const spreadPercent = Number(((spread / bottomLevel) * 100).toFixed(2));

        discoveredBoxes.push({
          id: `darvas-${peakTime}-${bottomLevel.toFixed(4)}`,
          upper: Number(topLevel.toFixed(5)),
          lower: Number(bottomLevel.toFixed(5)),
          spread: Number(spread.toFixed(5)),
          spreadPercent,
          creationTime: peakTime,
          confirmedTime: slice[Math.min(n - 1, boxConfirmedIndex)].time,
          candlesInside,
          isConfirmed: true,
          breakoutStatus,
          breakoutPrice,
          breakoutCandleTime,
        });

        // Advance index past this box's confirmation
        i = Math.max(i + reqConsecutive, boxConfirmedIndex);
      } else {
        i++;
      }
    }

    // Active box is the most recent discovered box, or fallback to latest range box
    let activeBox: DarvasBox | null =
      discoveredBoxes.length > 0 ? discoveredBoxes[discoveredBoxes.length - 1] : null;

    // If no complete 3-bar box formed yet, build the active forming box from recent 20 candles
    if (!activeBox) {
      const recentWindow = slice.slice(-20);
      const recentHigh = Math.max(...recentWindow.map((c) => c.high));
      const recentLow = Math.min(...recentWindow.map((c) => c.low));
      const spread = recentHigh - recentLow;
      activeBox = {
        id: `darvas-forming-${recentWindow[0].time}`,
        upper: Number(recentHigh.toFixed(5)),
        lower: Number(recentLow.toFixed(5)),
        spread: Number(spread.toFixed(5)),
        spreadPercent: Number(((spread / Math.max(1e-5, recentLow)) * 100).toFixed(2)),
        creationTime: recentWindow[0].time,
        confirmedTime: currentCandle.time,
        candlesInside: recentWindow.filter((c) => c.close <= recentHigh && c.close >= recentLow).length,
        isConfirmed: false,
        breakoutStatus: 'INSIDE',
      };
    }

    // Determine current price position relative to active box
    let currentPriceRelativeToBox: 'ABOVE' | 'INSIDE' | 'BELOW' | 'NO_BOX' = 'INSIDE';
    if (currentPrice > activeBox.upper) {
      currentPriceRelativeToBox = 'ABOVE';
    } else if (currentPrice < activeBox.lower) {
      currentPriceRelativeToBox = 'BELOW';
    } else {
      currentPriceRelativeToBox = 'INSIDE';
    }

    // Breakout confirmation: candle close strictly beyond boundary
    const isBullishBreakout = currentCandle.close > activeBox.upper;
    const isPreviousInside = prevCandle.close <= activeBox.upper && prevCandle.close >= activeBox.lower;
    const isFreshBullishBreakout = isBullishBreakout && (isPreviousInside || prevCandle.close <= activeBox.upper);

    const isBearishBreakdown = currentCandle.close < activeBox.lower;
    const isFreshBearishBreakdown = isBearishBreakdown && (isPreviousInside || prevCandle.close >= activeBox.lower);

    // Failed breakout detection
    const isFailedBreakout =
      prevCandle.high > activeBox.upper && currentCandle.close <= activeBox.upper;

    let breakoutStatus: 'INSIDE' | 'BREAKOUT_UP' | 'BREAKDOWN_DOWN' | 'FAILED_BREAKOUT' | 'FORMING' =
      'INSIDE';
    if (!activeBox.isConfirmed) {
      breakoutStatus = 'FORMING';
    } else if (isFailedBreakout) {
      breakoutStatus = 'FAILED_BREAKOUT';
    } else if (isBullishBreakout) {
      breakoutStatus = 'BREAKOUT_UP';
    } else if (isBearishBreakdown) {
      breakoutStatus = 'BREAKDOWN_DOWN';
    } else {
      breakoutStatus = 'INSIDE';
    }

    // Evidence & Conditions
    const conditions = [
      {
        name: `Upper Boundary (Resistance) established at ${activeBox.upper.toFixed(5)} (${reqConsecutive} candles held)`,
        satisfied: activeBox.isConfirmed,
        weight: 30,
      },
      {
        name: `Lower Boundary (Support) established at ${activeBox.lower.toFixed(5)} (${reqConsecutive} candles held)`,
        satisfied: activeBox.isConfirmed,
        weight: 30,
      },
      {
        name: `Consolidation Volume/Candle Containment (${activeBox.candlesInside} candles validated inside box)`,
        satisfied: activeBox.candlesInside >= 3,
        weight: 20,
      },
      {
        name: `Candle Close Confirmation outside Box Boundary (Close: ${currentPrice.toFixed(5)})`,
        satisfied: isBullishBreakout || isBearishBreakdown,
        weight: 20,
      },
    ];

    const evidenceNotes = [
      `Active Darvas Box: [${activeBox.lower.toFixed(5)} - ${activeBox.upper.toFixed(5)}] (Spread: ${activeBox.spread.toFixed(5)}, ${activeBox.spreadPercent}%)`,
      `Box confirmation status: ${activeBox.isConfirmed ? 'CONFIRMED' : 'FORMING (Awaiting 3-candle confirmation)'}`,
      `Candles inside active box: ${activeBox.candlesInside}`,
      `Current price relative to box: ${currentPriceRelativeToBox} (${currentPrice.toFixed(5)})`,
      `Breakout status: ${breakoutStatus}`,
    ];

    const darvasData: DarvasBoxData = {
      activeBox,
      historicalBoxes: discoveredBoxes,
      currentPriceRelativeToBox,
      breakoutStatus,
      candlesInsideActiveBox: activeBox.candlesInside,
      lastConfirmedStructure: `Darvas Box [${activeBox.lower.toFixed(5)} - ${activeBox.upper.toFixed(5)}] ${activeBox.isConfirmed ? '(Confirmed)' : '(Forming)'}`,
      evidenceNotes,
    };

    let bullishScore = 20;
    let bearishScore = 20;

    // 1. Valid Bullish Breakout
    if (activeBox.isConfirmed && isFreshBullishBreakout) {
      bullishScore = 90;
      bearishScore = 10;
      return {
        strategyId: 'darvas_box',
        strategyName: 'Nicolas Darvas Box',
        signal: 'UP',
        score: (bullishScore / 100) * config.weight * 2,
        weight: config.weight,
        reasons: [
          `Darvas breakout detected: current candle closed (${currentPrice.toFixed(5)}) strictly above confirmed upper box boundary (${activeBox.upper.toFixed(5)})`,
          `Consolidation box confirmed across ${activeBox.candlesInside} candles with spread of ${activeBox.spreadPercent}%`,
          `Breakout candle close confirmed (open: ${currentCandle.open.toFixed(5)}, close: ${currentPrice.toFixed(5)})`,
        ],
        candleTimestamp,
        dataValid: true,
        bullishScore,
        bearishScore,
        percentage: bullishScore,
        direction: 'BULLISH',
        conditions,
        darvasData,
      };
    }

    // 2. Valid Bearish Breakdown
    if (activeBox.isConfirmed && isFreshBearishBreakdown) {
      bearishScore = 90;
      bullishScore = 10;
      return {
        strategyId: 'darvas_box',
        strategyName: 'Nicolas Darvas Box',
        signal: 'DOWN',
        score: (bearishScore / 100) * config.weight * 2,
        weight: config.weight,
        reasons: [
          `Darvas breakdown detected: current candle closed (${currentPrice.toFixed(5)}) strictly below confirmed lower box boundary (${activeBox.lower.toFixed(5)})`,
          `Support containment breached after ${activeBox.candlesInside} candles of consolidation`,
          `Breakdown candle close confirmed (open: ${currentCandle.open.toFixed(5)}, close: ${currentPrice.toFixed(5)})`,
        ],
        candleTimestamp,
        dataValid: true,
        bullishScore,
        bearishScore,
        percentage: bearishScore,
        direction: 'BEARISH',
        conditions,
        darvasData,
      };
    }

    // 3. Inside Box or Forming Box -> WAIT
    const waitReason = !activeBox.isConfirmed
      ? 'WAIT — Darvas Box is currently forming; awaiting 3-candle consolidation confirmation.'
      : isFailedBreakout
      ? 'WAIT — Failed Darvas breakout: candle closed back inside box range.'
      : `Price is inside the Darvas Box [${activeBox.lower.toFixed(5)} - ${activeBox.upper.toFixed(5)}] — WAIT.`;

    return {
      strategyId: 'darvas_box',
      strategyName: 'Nicolas Darvas Box',
      signal: 'WAIT',
      score: 0,
      weight: config.weight,
      reasons: [
        waitReason,
        `Current price: ${currentPrice.toFixed(5)} (${currentPriceRelativeToBox} box)`,
        `Box boundaries: Resistance ${activeBox.upper.toFixed(5)}, Support ${activeBox.lower.toFixed(5)}`,
        `Candles contained: ${activeBox.candlesInside}`,
      ],
      candleTimestamp,
      dataValid: true,
      bullishScore,
      bearishScore,
      percentage: Math.max(bullishScore, bearishScore),
      direction: 'NEUTRAL',
      conditions,
      darvasData,
    };
  }
}
