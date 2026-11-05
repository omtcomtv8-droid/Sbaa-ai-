import { Candle, StrategyResult, ElliottWaveConfig, ElliottWaveData, ElliottWavePoint } from '../types';

interface PivotPoint {
  type: 'PEAK' | 'TROUGH';
  price: number;
  time: number;
  candleIndex: number;
}

export class ElliottWaveStrategy {
  public static evaluate(
    candles: Candle[],
    config: ElliottWaveConfig = { enabled: true, lookback: 80, weight: 1.3, strictWave4Territory: true }
  ): StrategyResult {
    const candleTimestamp = candles.length > 0 ? candles[candles.length - 1].time : 0;

    if (!config.enabled) {
      return {
        strategyId: 'elliott_wave',
        strategyName: 'Ralph Nelson Elliott Wave',
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

    const minCandles = Math.min(18, config.lookback);
    if (candles.length < minCandles) {
      return {
        strategyId: 'elliott_wave',
        strategyName: 'Ralph Nelson Elliott Wave',
        signal: 'WAIT',
        score: 0,
        weight: config.weight,
        reasons: [`Accumulating candles for Elliott Wave structure (${candles.length}/${minCandles})`],
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

    // 1. Detect Real Alternating Swings (Peaks and Troughs)
    const rawPivots: PivotPoint[] = [];
    const window = 1;

    for (let i = window; i < n - window; i++) {
      let isHigh = true;
      let isLow = true;
      for (let j = 1; j <= window; j++) {
        if (slice[i - j].high >= slice[i].high || slice[i + j].high > slice[i].high) isHigh = false;
        if (slice[i - j].low <= slice[i].low || slice[i + j].low < slice[i].low) isLow = false;
      }
      if (isHigh) rawPivots.push({ type: 'PEAK', price: slice[i].high, time: slice[i].time, candleIndex: i });
      else if (isLow) rawPivots.push({ type: 'TROUGH', price: slice[i].low, time: slice[i].time, candleIndex: i });
    }

    // Filter to strictly alternating pivots
    const pivots: PivotPoint[] = [];
    for (const p of rawPivots) {
      if (pivots.length === 0) {
        pivots.push(p);
      } else {
        const last = pivots[pivots.length - 1];
        if (last.type === p.type) {
          // Keep the more extreme pivot
          if (p.type === 'PEAK' && p.price > last.price) {
            pivots[pivots.length - 1] = p;
          } else if (p.type === 'TROUGH' && p.price < last.price) {
            pivots[pivots.length - 1] = p;
          }
        } else {
          pivots.push(p);
        }
      }
    }

    // Require at least 4 confirmed pivots to evaluate wave sequences
    if (pivots.length < 4) {
      return {
        strategyId: 'elliott_wave',
        strategyName: 'Ralph Nelson Elliott Wave',
        signal: 'WAIT',
        score: 0,
        weight: config.weight,
        reasons: ['WAIT — Insufficient confirmed swing pivots to establish structural Elliott Wave sequence'],
        candleTimestamp,
        dataValid: false,
        bullishScore: 0,
        bearishScore: 0,
        percentage: 0,
        direction: 'NEUTRAL',
        conditions: [],
      };
    }

    // 2. Evaluate Potential Impulse vs Corrective Structures
    const recentPivots = pivots.slice(-6); // Up to 6 pivots (P0 through P5)
    const numPivots = recentPivots.length;

    // Check for Bullish Impulse (Trough -> Peak -> Trough -> Peak -> Trough -> Peak)
    let isBullishImpulseCandidate = false;
    let isBearishImpulseCandidate = false;

    // Find the longest valid sequence ending near current price
    let bullishRules: { rule: string; passed: boolean; note: string }[] = [];
    let bearishRules: { rule: string; passed: boolean; note: string }[] = [];

    // Bullish 5-Wave Test
    // P0=Trough, P1=Peak, P2=Trough, P3=Peak, P4=Trough, (P5 optional)
    const troughStartIndex = recentPivots.findIndex((p) => p.type === 'TROUGH');
    let bullWaves: ElliottWavePoint[] = [];
    let bearWaves: ElliottWavePoint[] = [];

    if (troughStartIndex !== -1 && numPivots - troughStartIndex >= 3) {
      const seq = recentPivots.slice(troughStartIndex);
      const p0 = seq[0]; // Trough
      const p1 = seq.length > 1 ? seq[1] : null; // Peak
      const p2 = seq.length > 2 ? seq[2] : null; // Trough
      const p3 = seq.length > 3 ? seq[3] : null; // Peak
      const p4 = seq.length > 4 ? seq[4] : null; // Trough
      const p5 = seq.length > 5 ? seq[5] : null; // Peak

      if (p1 && p2) {
        isBullishImpulseCandidate = true;
        bullWaves.push({ label: '0', price: p0.price, time: p0.time, candleIndex: p0.candleIndex, type: 'TROUGH' });
        bullWaves.push({ label: '1', price: p1.price, time: p1.time, candleIndex: p1.candleIndex, type: 'PEAK' });

        const w1Len = p1.price - p0.price;
        const w2Retrace = (p1.price - p2.price) / Math.max(1e-5, w1Len);
        const w2Rule = p2.price > p0.price && w2Retrace < 1.0;
        bullishRules.push({
          rule: 'Rule 1: Wave 2 never retraces 100% of Wave 1',
          passed: w2Rule,
          note: `Wave 2 retracement: ${(w2Retrace * 100).toFixed(1)}% (Low ${p2.price.toFixed(5)} > Base ${p0.price.toFixed(5)})`,
        });
        bullWaves.push({
          label: '2',
          price: p2.price,
          time: p2.time,
          candleIndex: p2.candleIndex,
          type: 'TROUGH',
          retracementOrExtension: Number(w2Retrace.toFixed(3)),
        });

        if (p3) {
          const w3Len = p3.price - p2.price;
          const w3ExceedsW1 = p3.price > p1.price;
          const w3NotShortest = w3Len >= w1Len * 0.8; // Structural strength
          bullishRules.push({
            rule: 'Rule 2: Wave 3 exceeds Wave 1 high and shows impulsive expansion',
            passed: w3ExceedsW1 && w3NotShortest,
            note: `Wave 3 peak (${p3.price.toFixed(5)}) vs Wave 1 (${p1.price.toFixed(5)}), Length ratio: ${(w3Len / Math.max(1e-5, w1Len)).toFixed(2)}x`,
          });
          bullWaves.push({
            label: '3',
            price: p3.price,
            time: p3.time,
            candleIndex: p3.candleIndex,
            type: 'PEAK',
            retracementOrExtension: Number((w3Len / Math.max(1e-5, w1Len)).toFixed(3)),
          });

          if (p4) {
            const w4Overlap = p4.price < p1.price;
            const w4Rule = config.strictWave4Territory ? !w4Overlap : p4.price >= p1.price * 0.998;
            bullishRules.push({
              rule: 'Rule 3: Wave 4 does not enter price territory of Wave 1',
              passed: w4Rule,
              note: `Wave 4 trough (${p4.price.toFixed(5)}) vs Wave 1 top (${p1.price.toFixed(5)})`,
            });
            bullWaves.push({
              label: '4',
              price: p4.price,
              time: p4.time,
              candleIndex: p4.candleIndex,
              type: 'TROUGH',
            });

            if (p5) {
              const w5Rule = p5.price > p4.price;
              bullishRules.push({
                rule: 'Rule 4: Wave 5 terminates impulse in trend direction',
                passed: w5Rule,
                note: `Wave 5 peak (${p5.price.toFixed(5)}) above Wave 4 low`,
              });
              bullWaves.push({
                label: '5',
                price: p5.price,
                time: p5.time,
                candleIndex: p5.candleIndex,
                type: 'PEAK',
              });
            }
          }
        }
      }
    }

    // Bearish 5-Wave Test
    // P0=Peak, P1=Trough, P2=Peak, P3=Trough, P4=Peak, (P5 optional)
    const peakStartIndex = recentPivots.findIndex((p) => p.type === 'PEAK');
    if (peakStartIndex !== -1 && numPivots - peakStartIndex >= 3) {
      const seq = recentPivots.slice(peakStartIndex);
      const p0 = seq[0]; // Peak
      const p1 = seq.length > 1 ? seq[1] : null; // Trough
      const p2 = seq.length > 2 ? seq[2] : null; // Peak
      const p3 = seq.length > 3 ? seq[3] : null; // Trough
      const p4 = seq.length > 4 ? seq[4] : null; // Peak
      const p5 = seq.length > 5 ? seq[5] : null; // Trough

      if (p1 && p2) {
        isBearishImpulseCandidate = true;
        bearWaves.push({ label: '0', price: p0.price, time: p0.time, candleIndex: p0.candleIndex, type: 'PEAK' });
        bearWaves.push({ label: '1', price: p1.price, time: p1.time, candleIndex: p1.candleIndex, type: 'TROUGH' });

        const w1Len = p0.price - p1.price;
        const w2Retrace = (p2.price - p1.price) / Math.max(1e-5, w1Len);
        const w2Rule = p2.price < p0.price && w2Retrace < 1.0;
        bearishRules.push({
          rule: 'Rule 1: Bearish Wave 2 never retraces 100% of Wave 1',
          passed: w2Rule,
          note: `Wave 2 retracement: ${(w2Retrace * 100).toFixed(1)}% (High ${p2.price.toFixed(5)} < Peak ${p0.price.toFixed(5)})`,
        });
        bearWaves.push({
          label: '2',
          price: p2.price,
          time: p2.time,
          candleIndex: p2.candleIndex,
          type: 'PEAK',
          retracementOrExtension: Number(w2Retrace.toFixed(3)),
        });

        if (p3) {
          const w3Len = p2.price - p3.price;
          const w3ExceedsW1 = p3.price < p1.price;
          const w3NotShortest = w3Len >= w1Len * 0.8;
          bearishRules.push({
            rule: 'Rule 2: Bearish Wave 3 breaks below Wave 1 low and shows impulsive expansion',
            passed: w3ExceedsW1 && w3NotShortest,
            note: `Wave 3 low (${p3.price.toFixed(5)}) vs Wave 1 (${p1.price.toFixed(5)}), Length ratio: ${(w3Len / Math.max(1e-5, w1Len)).toFixed(2)}x`,
          });
          bearWaves.push({
            label: '3',
            price: p3.price,
            time: p3.time,
            candleIndex: p3.candleIndex,
            type: 'TROUGH',
            retracementOrExtension: Number((w3Len / Math.max(1e-5, w1Len)).toFixed(3)),
          });

          if (p4) {
            const w4Overlap = p4.price > p1.price;
            const w4Rule = config.strictWave4Territory ? !w4Overlap : p4.price <= p1.price * 1.002;
            bearishRules.push({
              rule: 'Rule 3: Bearish Wave 4 does not enter price territory of Wave 1',
              passed: w4Rule,
              note: `Wave 4 peak (${p4.price.toFixed(5)}) vs Wave 1 low (${p1.price.toFixed(5)})`,
            });
            bearWaves.push({
              label: '4',
              price: p4.price,
              time: p4.time,
              candleIndex: p4.candleIndex,
              type: 'PEAK',
            });

            if (p5) {
              const w5Rule = p5.price < p4.price;
              bearishRules.push({
                rule: 'Rule 4: Bearish Wave 5 terminates impulse in trend direction',
                passed: w5Rule,
                note: `Wave 5 low (${p5.price.toFixed(5)}) below Wave 4 peak`,
              });
              bearWaves.push({
                label: '5',
                price: p5.price,
                time: p5.time,
                candleIndex: p5.candleIndex,
                type: 'TROUGH',
              });
            }
          }
        }
      }
    }

    // Calculate actual rule verification scores
    const bullPassed = bullishRules.filter((r) => r.passed).length;
    const bullTotal = Math.max(1, bullishRules.length);
    const bullRuleScore = Math.round((bullPassed / bullTotal) * 100);

    const bearPassed = bearishRules.filter((r) => r.passed).length;
    const bearTotal = Math.max(1, bearishRules.length);
    const bearRuleScore = Math.round((bearPassed / bearTotal) * 100);

    // Candle close confirmation
    const isBullCandle = currentCandle.close > currentCandle.open && currentCandle.close > prevCandle.close;
    const isBearCandle = currentCandle.close < currentCandle.open && currentCandle.close < prevCandle.close;

    // Determine current structural wave position and counts
    let primaryCount = 'Unconfirmed Market Structure';
    let alternativeCount = 'Alternative: Complex Ranging Consolidation';
    let currentWaveDesc = 'Indeterminate Consolidation';
    let dominantTrend: 'IMPULSE_BULLISH' | 'IMPULSE_BEARISH' | 'CORRECTIVE_ABC' | 'AMBIGUOUS' = 'AMBIGUOUS';
    let structureStatus: 'VALID_IMPULSE' | 'VALID_CORRECTION' | 'AMBIGUOUS_STRUCTURE' | 'INVALIDATED' = 'AMBIGUOUS_STRUCTURE';
    let confidenceScore = 0;
    let selectedWaves: ElliottWavePoint[] = [];
    let selectedRules: { rule: string; passed: boolean; note: string }[] = [];

    if (bullRuleScore >= 75 && bullRuleScore > bearRuleScore) {
      dominantTrend = 'IMPULSE_BULLISH';
      confidenceScore = bullRuleScore;
      selectedWaves = bullWaves;
      selectedRules = bullishRules;
      const lastLabel = bullWaves[bullWaves.length - 1]?.label;

      if (lastLabel === '2') {
        currentWaveDesc = 'Wave 3 Expansion Emerging';
        primaryCount = 'Bullish Impulse — Wave 3 Expansion';
        alternativeCount = 'Alternative: Extended Wave 1 Leading Diagonal';
        structureStatus = 'VALID_IMPULSE';
      } else if (lastLabel === '3') {
        currentWaveDesc = 'Wave 3 Apex / Wave 4 Consolidation Pending';
        primaryCount = 'Bullish Impulse — Wave 3 Continuation';
        alternativeCount = 'Alternative: Truncated Wave 3 with Flat Correction';
        structureStatus = 'VALID_IMPULSE';
      } else if (lastLabel === '4') {
        currentWaveDesc = 'Wave 4 Pullback Holding Above Wave 1';
        primaryCount = 'Bullish Impulse — Wave 5 Terminal Motive';
        alternativeCount = 'Alternative: Complex Double Zigzag in Wave 4';
        structureStatus = 'VALID_IMPULSE';
      } else if (lastLabel === '5') {
        currentWaveDesc = 'Wave 5 Motive Complete — Corrective ABC Impending';
        primaryCount = 'Bullish Cycle Complete — Corrective Cycle Phase';
        alternativeCount = 'Alternative: Wave 5 Extension';
        structureStatus = 'VALID_IMPULSE';
      }
    } else if (bearRuleScore >= 75 && bearRuleScore > bullRuleScore) {
      dominantTrend = 'IMPULSE_BEARISH';
      confidenceScore = bearRuleScore;
      selectedWaves = bearWaves;
      selectedRules = bearishRules;
      const lastLabel = bearWaves[bearWaves.length - 1]?.label;

      if (lastLabel === '2') {
        currentWaveDesc = 'Bearish Wave 3 Expansion Emerging';
        primaryCount = 'Bearish Impulse — Wave 3 Expansion';
        alternativeCount = 'Alternative: Leading Diagonal Bearish Pattern';
        structureStatus = 'VALID_IMPULSE';
      } else if (lastLabel === '3') {
        currentWaveDesc = 'Bearish Wave 3 Apex / Wave 4 Pullback Pending';
        primaryCount = 'Bearish Impulse — Wave 3 Continuation';
        alternativeCount = 'Alternative: Truncated Wave 3 with Complex Consolidation';
        structureStatus = 'VALID_IMPULSE';
      } else if (lastLabel === '4') {
        currentWaveDesc = 'Bearish Wave 4 Pullback Holding Below Wave 1 Low';
        primaryCount = 'Bearish Impulse — Wave 5 Downward Extension';
        alternativeCount = 'Alternative: Expanded Flat Wave 4';
        structureStatus = 'VALID_IMPULSE';
      } else if (lastLabel === '5') {
        currentWaveDesc = 'Bearish Wave 5 Motive Complete — Corrective Bounce Impending';
        primaryCount = 'Bearish Motive Complete — Corrective Phase';
        alternativeCount = 'Alternative: Extended Wave 5 Capitulation';
        structureStatus = 'VALID_IMPULSE';
      }
    } else {
      dominantTrend = 'AMBIGUOUS';
      confidenceScore = Math.max(bullRuleScore, bearRuleScore);
      structureStatus = 'AMBIGUOUS_STRUCTURE';
      primaryCount = 'Ambiguous Wave Count — Insufficient Structural Evidence';
      alternativeCount = 'Alternative: Choppy Consolidation / Corrective Triangle';
      currentWaveDesc = 'Unconfirmed Waves';
      selectedWaves = bullWaves.length >= bearWaves.length ? bullWaves : bearWaves;
      selectedRules = bullWaves.length >= bearWaves.length ? bullishRules : bearishRules;
    }

    const elliottData: ElliottWaveData = {
      primaryCount,
      alternativeCount,
      currentWave: currentWaveDesc,
      dominantTrend,
      confidenceScore,
      rulesChecked: selectedRules,
      waves: selectedWaves,
      structureStatus,
      lastConfirmedStructure: `${primaryCount} (${selectedWaves.length} swing points confirmed)`,
    };

    // Objective Conditions for Signal
    const conditions = selectedRules.map((r) => ({
      name: `${r.rule}: ${r.note}`,
      satisfied: r.passed,
      weight: Math.round(100 / Math.max(1, selectedRules.length)),
    }));

    // Trade Signal Verification (Strict rules, no forcing)
    // Bullish Entry:
    // 1. Valid Bullish Impulse count with >= 80% rule satisfaction
    // 2. Currently emerging from Wave 2 (start of Wave 3) or Wave 4 (start of Wave 5)
    // 3. Candle close is bullish
    const lastBullWave = bullWaves[bullWaves.length - 1]?.label;
    const isBullTradeSetup =
      dominantTrend === 'IMPULSE_BULLISH' &&
      bullRuleScore >= 75 &&
      (lastBullWave === '2' || lastBullWave === '4') &&
      isBullCandle;

    if (isBullTradeSetup) {
      const signalReason =
        lastBullWave === '2'
          ? `Possible Wave 3 continuation detected: confirmed Wave 2 retracement (${bullishRules[0]?.note}) held strictly above Wave 0 base with breakout candle close.`
          : `Possible Wave 5 continuation detected: confirmed Wave 4 pullback held above Wave 1 territory (${bullishRules[2]?.note}) with bullish reversal candle.`;

      return {
        strategyId: 'elliott_wave',
        strategyName: 'Ralph Nelson Elliott Wave',
        signal: 'UP',
        score: (bullRuleScore / 100) * config.weight * 2,
        weight: config.weight,
        reasons: [
          signalReason,
          `Primary Count: ${primaryCount}`,
          `Alternative Count: ${alternativeCount}`,
          `Structural Evidence Confidence: ${confidenceScore}% based on ${bullPassed}/${bullTotal} verified rules`,
        ],
        candleTimestamp,
        dataValid: true,
        bullishScore: bullRuleScore,
        bearishScore: bearRuleScore,
        percentage: bullRuleScore,
        direction: 'BULLISH',
        conditions,
        elliottData,
      };
    }

    // Bearish Entry:
    // 1. Valid Bearish Impulse count with >= 80% rule satisfaction
    // 2. Currently emerging from Bearish Wave 2 or Wave 4
    // 3. Candle close is bearish
    const lastBearWave = bearWaves[bearWaves.length - 1]?.label;
    const isBearTradeSetup =
      dominantTrend === 'IMPULSE_BEARISH' &&
      bearRuleScore >= 75 &&
      (lastBearWave === '2' || lastBearWave === '4') &&
      isBearCandle;

    if (isBearTradeSetup) {
      const signalReason =
        lastBearWave === '2'
          ? `Possible Bearish Wave 3 continuation detected: confirmed Wave 2 retracement held below Wave 0 peak with breakdown candle close.`
          : `Possible Bearish Wave 5 continuation detected: confirmed Wave 4 held below Wave 1 low with bearish continuation candle.`;

      return {
        strategyId: 'elliott_wave',
        strategyName: 'Ralph Nelson Elliott Wave',
        signal: 'DOWN',
        score: (bearRuleScore / 100) * config.weight * 2,
        weight: config.weight,
        reasons: [
          signalReason,
          `Primary Count: ${primaryCount}`,
          `Alternative Count: ${alternativeCount}`,
          `Structural Evidence Confidence: ${confidenceScore}% based on ${bearPassed}/${bearTotal} verified rules`,
        ],
        candleTimestamp,
        dataValid: true,
        bullishScore: bullRuleScore,
        bearishScore: bearRuleScore,
        percentage: bearRuleScore,
        direction: 'BEARISH',
        conditions,
        elliottData,
      };
    }

    // Default WAIT: When market structure is ambiguous or not in an actionable trade phase
    const waitReason =
      structureStatus === 'AMBIGUOUS_STRUCTURE'
        ? 'WAIT — Elliott Wave structure is not sufficiently confirmed.'
        : `WAIT — Market currently in ${currentWaveDesc}; awaiting actionable wave breakout.`;

    return {
      strategyId: 'elliott_wave',
      strategyName: 'Ralph Nelson Elliott Wave',
      signal: 'WAIT',
      score: 0,
      weight: config.weight,
      reasons: [
        waitReason,
        `Primary Count: ${primaryCount}`,
        `Alternative Count: ${alternativeCount}`,
        `Confidence based on structural evidence: ${confidenceScore}% (${selectedRules.filter((r) => r.passed).length}/${selectedRules.length} rules verified)`,
      ],
      candleTimestamp,
      dataValid: true,
      bullishScore: bullRuleScore,
      bearishScore: bearRuleScore,
      percentage: confidenceScore,
      direction: 'NEUTRAL',
      conditions,
      elliottData,
    };
  }
}
