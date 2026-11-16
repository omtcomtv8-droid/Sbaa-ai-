import { Candle, StrategyResult, SignalType, StrategyCondition } from '../types';

export interface VolumeFlowParams {
  enabled?: boolean;
  period: number;
  weight?: number;
}

/**
 * Institutional Volume Flow & Money Flow Accumulation Strategy
 * Calculates Chaikin Money Flow (CMF) with scale-invariant tick-activity proxy
 * when FX spot feeds report zero/unit volume.
 */
export class VolumeFlowStrategy {
  public static readonly ID = 'volume_flow';
  public static readonly NAME = 'Volume Flow & Accumulation (CMF)';

  public static evaluate(candles: Candle[], params?: Partial<VolumeFlowParams>): StrategyResult {
    const period = params?.period || 14;
    const weight = params?.weight || 1.35;
    const enabled = params?.enabled !== false;
    const candleTimestamp = candles.length > 0 ? candles[candles.length - 1].time : 0;

    if (!enabled) {
      return {
        strategyId: this.ID,
        strategyName: this.NAME,
        signal: 'WAIT',
        direction: 'NEUTRAL',
        confidence: 0,
        score: 0,
        weight,
        reasons: ['Strategy disabled in settings'],
        candleTimestamp,
        dataValid: true,
        bullishScore: 0,
        bearishScore: 0,
        percentage: 0,
        conditions: [],
      };
    }

    if (candles.length < period + 2) {
      return {
        strategyId: this.ID,
        strategyName: this.NAME,
        signal: 'WAIT',
        direction: 'NEUTRAL',
        confidence: 0,
        score: 0,
        weight,
        reasons: ['Insufficient candle data for Volume Flow evaluation'],
        candleTimestamp,
        dataValid: false,
        bullishScore: 0,
        bearishScore: 0,
        percentage: 0,
        conditions: [],
      };
    }

    const n = candles.length;
    const slice = candles.slice(n - period);
    const hasRealVolume = slice.some((c) => typeof c.volume === 'number' && c.volume > 1);

    let sumMfv = 0;
    let sumVol = 0;

    for (const c of slice) {
      // Scale-invariant range activity proxy for spot FX feeds where exchange volume === 0
      const rangeProxy = Math.max(0.0001, ((c.high - c.low) / Math.max(c.open, 1e-8)) * 100000);
      const vol = hasRealVolume && c.volume && c.volume > 0 ? c.volume : rangeProxy;
      const range = c.high - c.low;
      let mfm = 0;
      if (range > 0) {
        mfm = ((c.close - c.low) - (c.high - c.close)) / range;
      }
      sumMfv += mfm * vol;
      sumVol += vol;
    }

    const cmf = sumVol > 0 ? sumMfv / sumVol : 0;
    const lastCandle = candles[n - 1];
    const isBullCandle = lastCandle.close > lastCandle.open;
    const isBearCandle = lastCandle.close < lastCandle.open;

    const isBullFlow = cmf > 0.10;
    const isBearFlow = cmf < -0.10;

    const bullStrength = Math.min(40, Math.round(Math.max(0, cmf - 0.10) * 100));
    const bearStrength = Math.min(40, Math.round(Math.max(0, Math.abs(cmf) - 0.10) * 100));

    const bullishConditions: StrategyCondition[] = [
      {
        id: 'vf_bull_cmf',
        name: `CMF Inflow (${cmf.toFixed(3)}) > +0.10`,
        satisfied: isBullFlow,
        weight: 50,
        isMandatory: true,
      },
      {
        id: 'vf_bull_close',
        name: `Bullish Candle Accumulation Close`,
        satisfied: isBullCandle,
        weight: 30,
        isMandatory: true,
      },
      {
        id: 'vf_bull_strong',
        name: `Strong Money Flow Expansion (CMF > +0.20)`,
        satisfied: cmf > 0.20,
        weight: 20,
      },
    ];

    const bearishConditions: StrategyCondition[] = [
      {
        id: 'vf_bear_cmf',
        name: `CMF Outflow (${cmf.toFixed(3)}) < -0.10`,
        satisfied: isBearFlow,
        weight: 50,
        isMandatory: true,
      },
      {
        id: 'vf_bear_close',
        name: `Bearish Candle Distribution Close`,
        satisfied: isBearCandle,
        weight: 30,
        isMandatory: true,
      },
      {
        id: 'vf_bear_strong',
        name: `Strong Money Flow Outflow (CMF < -0.20)`,
        satisfied: cmf < -0.20,
        weight: 20,
      },
    ];

    const bullishScore = bullishConditions.reduce((acc, c) => acc + (c.satisfied ? c.weight : 0), 0);
    const bearishScore = bearishConditions.reduce((acc, c) => acc + (c.satisfied ? c.weight : 0), 0);

    let signal: SignalType = 'WAIT';
    let direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    let confidence = 0;
    let score = 0;
    const reasons: string[] = [];

    if (isBullFlow && isBullCandle) {
      direction = 'BULLISH';
      signal = 'UP';
      confidence = Math.max(bullishScore, Math.min(95, 65 + bullStrength));
      score = (bullishScore / 100) * weight * 2;
      reasons.push(
        `Strong ${hasRealVolume ? 'Volume' : 'Price-Flow'} Accumulation (CMF: +${cmf.toFixed(3)})`,
        'Accumulation confirmed with bullish candle close'
      );
    } else if (isBearFlow && isBearCandle) {
      direction = 'BEARISH';
      signal = 'DOWN';
      confidence = Math.max(bearishScore, Math.min(95, 65 + bearStrength));
      score = -(bearishScore / 100) * weight * 2;
      reasons.push(
        `Strong ${hasRealVolume ? 'Volume' : 'Price-Flow'} Distribution (CMF: ${cmf.toFixed(3)})`,
        'Distribution confirmed with bearish candle close'
      );
    } else {
      direction = 'NEUTRAL';
      signal = 'WAIT';
      confidence = Math.max(bullishScore, bearishScore);
      score = 0;
      reasons.push(`Neutral Volume Flow (CMF: ${cmf.toFixed(3)}), awaiting aligned close & flow > 0.10`);
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
      bullishScore,
      bearishScore,
      percentage: confidence,
      conditions: cmf >= 0 ? bullishConditions : bearishConditions,
      indicatorValues: {
        cmf: Number(cmf.toFixed(4)),
        volumeAccumulation: cmf > 0 ? 1 : 0,
        usedRangeProxy: hasRealVolume ? 0 : 1,
      },
    };
  }
}
