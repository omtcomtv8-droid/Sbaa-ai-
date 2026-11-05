import { Candle, StrategyResult, SignalType } from '../types';

export interface VolumeFlowParams {
  period: number;
  weight?: number;
}

/**
 * Institutional Volume Flow & Money Flow Accumulation Strategy (Rule 10 Compliance)
 * Calculates Chaikin Money Flow (CMF) to measure whether institutional volume
 * is accumulating (buying) or distributing (selling).
 */
export class VolumeFlowStrategy {
  public static readonly ID = 'volume_flow';
  public static readonly NAME = 'Volume Flow & Accumulation (CMF)';

  public static evaluate(candles: Candle[], params?: Partial<VolumeFlowParams>): StrategyResult {
    const period = params?.period || 14;
    const weight = params?.weight || 1.35;
    const candleTimestamp = candles.length > 0 ? candles[candles.length - 1].time : 0;

    if (candles.length < period + 2) {
      return {
        strategyId: this.ID,
        strategyName: this.NAME,
        signal: 'WAIT',
        direction: 'WAIT',
        confidence: 0,
        score: 0,
        weight,
        reasons: ['Insufficient candle data for Volume Flow evaluation'],
        candleTimestamp,
        dataValid: false,
        bullishScore: 0,
        bearishScore: 0,
        percentage: 0,
      };
    }

    const n = candles.length;
    const slice = candles.slice(n - period);

    let sumMfv = 0;
    let sumVol = 0;

    for (const c of slice) {
      const vol = c.volume && c.volume > 0 ? c.volume : Math.max(1, Math.round((c.high - c.low) * 100000));
      const range = c.high - c.low;
      let mfm = 0; // Money Flow Multiplier: ((Close - Low) - (High - Close)) / (High - Low)
      if (range > 0) {
        mfm = ((c.close - c.low) - (c.high - c.close)) / range;
      }
      sumMfv += mfm * vol;
      sumVol += vol;
    }

    const cmf = sumVol > 0 ? sumMfv / sumVol : 0; // Chaikin Money Flow: typically between -0.5 and +0.5
    const lastCandle = candles[n - 1];
    const isGreenCandle = lastCandle.close >= lastCandle.open;

    let direction: 'UP' | 'DOWN' | 'WAIT' = 'WAIT';
    let signal: SignalType = 'WAIT';
    let confidence = 0;
    let score = 0;
    const reasons: string[] = [];

    if (cmf > 0.08) {
      direction = 'UP';
      signal = 'UP';
      confidence = Math.min(95, Math.round(55 + cmf * 120));
      score = weight;
      reasons.push(
        `Strong Institutional Inflow (CMF: +${cmf.toFixed(3)})`,
        isGreenCandle ? 'Volume accumulation confirmed with bullish candle close' : 'Accumulation absorbs selling pressure'
      );
    } else if (cmf < -0.08) {
      direction = 'DOWN';
      signal = 'DOWN';
      confidence = Math.min(95, Math.round(55 + Math.abs(cmf) * 120));
      score = -weight;
      reasons.push(
        `Strong Institutional Outflow (CMF: ${cmf.toFixed(3)})`,
        !isGreenCandle ? 'Volume distribution confirmed with bearish candle close' : 'Distribution caps upside bounce'
      );
    } else {
      direction = 'WAIT';
      signal = 'WAIT';
      confidence = 40;
      score = 0;
      reasons.push(`Neutral Volume Pressure (CMF: ${cmf.toFixed(3)}), awaiting volume expansion`);
    }

    return {
      strategyId: this.ID,
      strategyName: this.NAME,
      signal,
      direction,
      confidence,
      score,
      weight,
      reasons,
      candleTimestamp,
      dataValid: true,
      bullishScore: direction === 'UP' ? confidence : 0,
      bearishScore: direction === 'DOWN' ? confidence : 0,
      percentage: confidence,
      indicatorValues: {
        cmf: Number(cmf.toFixed(4)),
        volumeAccumulation: cmf > 0 ? 1 : 0,
      },
    };
  }
}
