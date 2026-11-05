import { Candle, IndicatorMetrics } from './types';

/**
 * Calculates Relative Strength Index (RSI) using Wilder's smoothed moving average.
 * Formula:
 * RS = Smoothed Average Gain / Smoothed Average Loss
 * RSI = 100 - (100 / (1 + RS))
 */
export function calculateRSI(closes: number[], period: number = 14): number | null {
  if (closes.length <= period) return null;

  let gains = 0;
  let losses = 0;

  // Initial sum for the first period
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  // Wilder's smoothing for subsequent candles
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) {
      avgGain = (avgGain * (period - 1) + diff) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.abs(diff)) / period;
    }
  }

  if (avgLoss === 0) return 100;
  if (avgGain === 0) return 0;
  const rs = avgGain / avgLoss;
  return Number((100 - 100 / (1 + rs)).toFixed(2));
}

/**
 * Calculates Exponential Moving Average (EMA) series.
 * Multiplier k = 2 / (period + 1)
 */
export function calculateEMASeries(values: number[], period: number): number[] {
  if (values.length < period) return [];

  const k = 2 / (period + 1);
  const result: number[] = [];

  // Initial SMA for first period elements
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += values[i];
  }
  let prevEMA = sum / period;
  result.push(prevEMA);

  for (let i = period; i < values.length; i++) {
    const currentEMA = values[i] * k + prevEMA * (1 - k);
    result.push(currentEMA);
    prevEMA = currentEMA;
  }

  return result;
}

export function calculateEMA(values: number[], period: number): number | null {
  const series = calculateEMASeries(values, period);
  if (series.length === 0) return null;
  return Number(series[series.length - 1].toFixed(5));
}

/**
 * Calculates Simple Moving Average (SMA).
 */
export function calculateSMA(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  const sum = slice.reduce((a, b) => a + b, 0);
  return Number((sum / period).toFixed(5));
}

/**
 * Calculates Bollinger Bands (Upper, Middle, Lower, Bandwidth, %B).
 */
export function calculateBollingerBands(
  closes: number[],
  period: number = 20,
  stdDevMultiplier: number = 2
): { upper: number; middle: number; lower: number; bandwidth: number; percentB: number } | null {
  if (closes.length < period) return null;

  const slice = closes.slice(-period);
  const middle = slice.reduce((a, b) => a + b, 0) / period;

  const variance = slice.reduce((sum, val) => sum + Math.pow(val - middle, 2), 0) / period;
  const stdDev = Math.sqrt(variance);

  const upper = middle + stdDevMultiplier * stdDev;
  const lower = middle - stdDevMultiplier * stdDev;
  const lastClose = closes[closes.length - 1];

  const bandRange = upper - lower;
  const bandwidth = middle > 0 ? bandRange / middle : 0;
  const percentB = bandRange > 0 ? (lastClose - lower) / bandRange : 0.5;

  return {
    upper: Number(upper.toFixed(5)),
    middle: Number(middle.toFixed(5)),
    lower: Number(lower.toFixed(5)),
    bandwidth: Number(bandwidth.toFixed(5)),
    percentB: Number(percentB.toFixed(4)),
  };
}

/**
 * Calculates Moving Average Convergence Divergence (MACD).
 */
export function calculateMACD(
  closes: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): { macd: number; signal: number; histogram: number } | null {
  if (closes.length < slowPeriod + signalPeriod) return null;

  const fastEMA = calculateEMASeries(closes, fastPeriod);
  const slowEMA = calculateEMASeries(closes, slowPeriod);

  const offset = slowPeriod - fastPeriod;
  const macdLine: number[] = [];

  for (let i = 0; i < slowEMA.length; i++) {
    const fVal = fastEMA[i + offset];
    const sVal = slowEMA[i];
    macdLine.push(fVal - sVal);
  }

  const signalLine = calculateEMASeries(macdLine, signalPeriod);
  if (signalLine.length === 0) return null;

  const latestMACD = macdLine[macdLine.length - 1];
  const latestSignal = signalLine[signalLine.length - 1];
  const histogram = latestMACD - latestSignal;

  return {
    macd: Number(latestMACD.toFixed(5)),
    signal: Number(latestSignal.toFixed(5)),
    histogram: Number(histogram.toFixed(5)),
  };
}

/**
 * Calculates Average True Range (ATR) and volatility regime.
 * TR = max(high - low, abs(high - closePrev), abs(low - closePrev))
 */
export function calculateATR(
  candles: Candle[],
  period: number = 14
): { currentATR: number; averageATR: number; volatilityState: 'HIGH' | 'NORMAL' | 'LOW' } | null {
  if (candles.length <= period) return null;

  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const curr = candles[i];
    const prev = candles[i - 1];
    const tr = Math.max(
      curr.high - curr.low,
      Math.abs(curr.high - prev.close),
      Math.abs(curr.low - prev.close)
    );
    trs.push(tr);
  }

  if (trs.length < period) return null;

  // Wilder's smoothing for ATR
  let atr = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
  const atrHistory: number[] = [atr];

  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period;
    atrHistory.push(atr);
  }

  // Baseline 20-period average of ATR to determine volatility state
  const benchmarkPeriod = Math.min(20, atrHistory.length);
  const recentSlice = atrHistory.slice(-benchmarkPeriod);
  const avgAtr = recentSlice.reduce((a, b) => a + b, 0) / benchmarkPeriod;

  const currentATR = Number(atr.toFixed(5));
  const averageATR = Number(avgAtr.toFixed(5));

  let volatilityState: 'HIGH' | 'NORMAL' | 'LOW' = 'NORMAL';
  if (currentATR > averageATR * 1.35) {
    volatilityState = 'HIGH';
  } else if (currentATR < averageATR * 0.7) {
    volatilityState = 'LOW';
  }

  return {
    currentATR,
    averageATR,
    volatilityState,
  };
}

/**
 * Calculates Average Directional Index (ADX), +DI, -DI, and trend strength.
 */
export function calculateADX(
  candles: Candle[],
  period: number = 14
): { adx: number; plusDI: number; minusDI: number; trendStrength: 'TRENDING' | 'WEAK_TREND' | 'RANGING' } | null {
  if (candles.length <= period * 2) return null;

  const trs: number[] = [];
  const plusDMs: number[] = [];
  const minusDMs: number[] = [];

  for (let i = 1; i < candles.length; i++) {
    const curr = candles[i];
    const prev = candles[i - 1];

    const upMove = curr.high - prev.high;
    const downMove = prev.low - curr.low;

    plusDMs.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDMs.push(downMove > upMove && downMove > 0 ? downMove : 0);

    const tr = Math.max(
      curr.high - curr.low,
      Math.abs(curr.high - prev.close),
      Math.abs(curr.low - prev.close)
    );
    trs.push(tr);
  }

  // Initial sums
  let smoothTR = trs.slice(0, period).reduce((a, b) => a + b, 0);
  let smoothPlusDM = plusDMs.slice(0, period).reduce((a, b) => a + b, 0);
  let smoothMinusDM = minusDMs.slice(0, period).reduce((a, b) => a + b, 0);

  const dxList: number[] = [];

  for (let i = period; i < trs.length; i++) {
    smoothTR = smoothTR - smoothTR / period + trs[i];
    smoothPlusDM = smoothPlusDM - smoothPlusDM / period + plusDMs[i];
    smoothMinusDM = smoothMinusDM - smoothMinusDM / period + minusDMs[i];

    const plusDI = smoothTR > 0 ? (smoothPlusDM / smoothTR) * 100 : 0;
    const minusDI = smoothTR > 0 ? (smoothMinusDM / smoothTR) * 100 : 0;
    const diSum = plusDI + minusDI;
    const dx = diSum > 0 ? (Math.abs(plusDI - minusDI) / diSum) * 100 : 0;
    dxList.push(dx);
  }

  if (dxList.length < period) return null;

  // Final ADX is smoothed DX
  const adxSeries = calculateEMASeries(dxList, period);
  if (adxSeries.length === 0) return null;

  const adxVal = Number(adxSeries[adxSeries.length - 1].toFixed(2));
  const lastPlusDI = Number(((smoothPlusDM / (smoothTR || 1)) * 100).toFixed(2));
  const lastMinusDI = Number(((smoothMinusDM / (smoothTR || 1)) * 100).toFixed(2));

  let trendStrength: 'TRENDING' | 'WEAK_TREND' | 'RANGING' = 'RANGING';
  if (adxVal >= 25) {
    trendStrength = 'TRENDING';
  } else if (adxVal >= 20) {
    trendStrength = 'WEAK_TREND';
  }

  return {
    adx: adxVal,
    plusDI: lastPlusDI,
    minusDI: lastMinusDI,
    trendStrength,
  };
}

/**
 * Calculates Stochastic Oscillator (%K and %D).
 */
export function calculateStochastic(
  candles: Candle[],
  kPeriod: number = 14,
  dPeriod: number = 3
): { k: number; d: number } | null {
  if (candles.length < kPeriod + dPeriod) return null;

  const kValues: number[] = [];

  for (let i = kPeriod - 1; i < candles.length; i++) {
    const window = candles.slice(i - kPeriod + 1, i + 1);
    const highest = Math.max(...window.map((c) => c.high));
    const lowest = Math.min(...window.map((c) => c.low));
    const currentClose = candles[i].close;

    const k = highest > lowest ? ((currentClose - lowest) / (highest - lowest)) * 100 : 50;
    kValues.push(k);
  }

  if (kValues.length < dPeriod) return null;

  const d = kValues.slice(-dPeriod).reduce((a, b) => a + b, 0) / dPeriod;

  return {
    k: Number(kValues[kValues.length - 1].toFixed(2)),
    d: Number(d.toFixed(2)),
  };
}

/**
 * Calculates Price Rate of Change (ROC) / Momentum percentage.
 */
export function calculateROC(closes: number[], period: number = 12): number | null {
  if (closes.length <= period) return null;
  const curr = closes[closes.length - 1];
  const prev = closes[closes.length - 1 - period];
  if (prev === 0) return null;
  return Number((((curr - prev) / prev) * 100).toFixed(3));
}

/**
 * Calculates Highest High over lookback.
 */
export function calculateHighestHigh(candles: Candle[], lookback: number): number | null {
  if (candles.length < lookback) return null;
  const slice = candles.slice(-lookback);
  return Number(Math.max(...slice.map((c) => c.high)).toFixed(5));
}

/**
 * Calculates Lowest Low over lookback.
 */
export function calculateLowestLow(candles: Candle[], lookback: number): number | null {
  if (candles.length < lookback) return null;
  const slice = candles.slice(-lookback);
  return Number(Math.min(...slice.map((c) => c.low)).toFixed(5));
}

/**
 * Calculates Weighted Moving Average (WMA).
 * Weights increase linearly: 1, 2, ..., period.
 */
export function calculateWMA(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  let weightSum = 0;
  let weightedSum = 0;
  for (let i = 0; i < period; i++) {
    const weight = i + 1;
    weightedSum += slice[i] * weight;
    weightSum += weight;
  }
  return Number((weightedSum / weightSum).toFixed(5));
}

/**
 * Calculates Hull Moving Average (HMA).
 * HMA = WMA(2*WMA(n/2) - WMA(n)), sqrt(n))
 */
export function calculateHMA(values: number[], period: number): number | null {
  if (values.length < period + Math.round(Math.sqrt(period))) return null;
  const halfPeriod = Math.floor(period / 2);
  const sqrtPeriod = Math.round(Math.sqrt(period));

  // Compute intermediate 2*WMA(n/2) - WMA(n) for the required tail
  const rawDiff: number[] = [];
  for (let i = values.length - sqrtPeriod; i < values.length; i++) {
    const subValues = values.slice(0, i + 1);
    const wmaHalf = calculateWMA(subValues, halfPeriod);
    const wmaFull = calculateWMA(subValues, period);
    if (wmaHalf === null || wmaFull === null) return null;
    rawDiff.push(2 * wmaHalf - wmaFull);
  }

  return calculateWMA(rawDiff, sqrtPeriod);
}

/**
 * Calculates Williams %R.
 * Formula: %R = (Highest High - Close) / (Highest High - Lowest Low) * -100
 * Range: 0 to -100 (-20 overbought, -80 oversold)
 */
export function calculateWilliamsR(candles: Candle[], period: number = 14): number | null {
  if (candles.length < period) return null;
  const slice = candles.slice(-period);
  const highestHigh = Math.max(...slice.map((c) => c.high));
  const lowestLow = Math.min(...slice.map((c) => c.low));
  const currentClose = slice[slice.length - 1].close;

  const range = highestHigh - lowestLow;
  if (range === 0) return -50;

  const wr = ((highestHigh - currentClose) / range) * -100;
  return Number(wr.toFixed(2));
}

/**
 * Calculates Commodity Channel Index (CCI).
 * Typical Price (TP) = (H + L + C) / 3
 * CCI = (TP - SMA(TP)) / (0.015 * Mean Deviation)
 */
export function calculateCCI(candles: Candle[], period: number = 20): number | null {
  if (candles.length < period) return null;
  const slice = candles.slice(-period);
  const tps = slice.map((c) => (c.high + c.low + c.close) / 3);

  const smaTP = tps.reduce((a, b) => a + b, 0) / period;
  const meanDeviation = tps.reduce((acc, tp) => acc + Math.abs(tp - smaTP), 0) / period;

  if (meanDeviation === 0) return 0;
  const lastTP = tps[tps.length - 1];
  const cci = (lastTP - smaTP) / (0.015 * meanDeviation);
  return Number(cci.toFixed(2));
}

/**
 * Calculates Parabolic SAR.
 */
export function calculateParabolicSAR(
  candles: Candle[],
  step: number = 0.02,
  maxStep: number = 0.2
): { sar: number; trend: 'UP' | 'DOWN' } | null {
  if (candles.length < 5) return null;

  let isUpTrend = candles[1].close > candles[0].close;
  let ep = isUpTrend ? candles[0].high : candles[0].low;
  let sar = isUpTrend ? candles[0].low : candles[0].high;
  let af = step;

  for (let i = 1; i < candles.length; i++) {
    const prevCandle = candles[i - 1];
    const currCandle = candles[i];

    sar = sar + af * (ep - sar);

    if (isUpTrend) {
      if (currCandle.low < sar) {
        // Trend reverses to DOWN
        isUpTrend = false;
        sar = ep;
        ep = currCandle.low;
        af = step;
      } else {
        if (currCandle.high > ep) {
          ep = currCandle.high;
          af = Math.min(af + step, maxStep);
        }
      }
    } else {
      if (currCandle.high > sar) {
        // Trend reverses to UP
        isUpTrend = true;
        sar = ep;
        ep = currCandle.high;
        af = step;
      } else {
        if (currCandle.low < ep) {
          ep = currCandle.low;
          af = Math.min(af + step, maxStep);
        }
      }
    }
  }

  return {
    sar: Number(sar.toFixed(5)),
    trend: isUpTrend ? 'UP' : 'DOWN',
  };
}

/**
 * Calculates Ichimoku Kinko Hyo components.
 * Tenkan-sen (Conversion Line): (9-period high + 9-period low) / 2
 * Kijun-sen (Base Line): (26-period high + 26-period low) / 2
 * Senkou Span A: (Tenkan + Kijun) / 2
 * Senkou Span B: (52-period high + 52-period low) / 2
 */
export function calculateIchimoku(candles: Candle[]): {
  tenkan: number;
  kijun: number;
  senkouSpanA: number;
  senkouSpanB: number;
  cloudColor: 'BULLISH' | 'BEARISH';
} | null {
  if (candles.length < 52) return null;

  const getMid = (slice: Candle[]) => {
    const h = Math.max(...slice.map((c) => c.high));
    const l = Math.min(...slice.map((c) => c.low));
    return (h + l) / 2;
  };

  const tenkan = getMid(candles.slice(-9));
  const kijun = getMid(candles.slice(-26));
  const senkouSpanA = (tenkan + kijun) / 2;
  const senkouSpanB = getMid(candles.slice(-52));

  return {
    tenkan: Number(tenkan.toFixed(5)),
    kijun: Number(kijun.toFixed(5)),
    senkouSpanA: Number(senkouSpanA.toFixed(5)),
    senkouSpanB: Number(senkouSpanB.toFixed(5)),
    cloudColor: senkouSpanA >= senkouSpanB ? 'BULLISH' : 'BEARISH',
  };
}

/**
 * Calculates Standard Pivot Points (P, R1, S1, R2, S2, R3, S3).
 */
export function calculatePivotPoints(candles: Candle[]): {
  pivot: number;
  r1: number;
  s1: number;
  r2: number;
  s2: number;
  r3: number;
  s3: number;
} | null {
  if (candles.length < 2) return null;
  const prev = candles[candles.length - 2];
  const high = prev.high;
  const low = prev.low;
  const close = prev.close;

  const pivot = (high + low + close) / 3;
  const r1 = 2 * pivot - low;
  const s1 = 2 * pivot - high;
  const r2 = pivot + (high - low);
  const s2 = pivot - (high - low);
  const r3 = high + 2 * (pivot - low);
  const s3 = low - 2 * (high - pivot);

  return {
    pivot: Number(pivot.toFixed(5)),
    r1: Number(r1.toFixed(5)),
    s1: Number(s1.toFixed(5)),
    r2: Number(r2.toFixed(5)),
    s2: Number(s2.toFixed(5)),
    r3: Number(r3.toFixed(5)),
    s3: Number(s3.toFixed(5)),
  };
}

/**
 * Calculates Fibonacci Retracement levels between swing high and swing low.
 */
export function calculateFibonacciRetracements(
  high: number,
  low: number
): {
  level0: number;
  level236: number;
  level382: number;
  level500: number;
  level618: number;
  level786: number;
  level100: number;
} {
  const diff = high - low;
  return {
    level0: Number(high.toFixed(5)),
    level236: Number((high - 0.236 * diff).toFixed(5)),
    level382: Number((high - 0.382 * diff).toFixed(5)),
    level500: Number((high - 0.5 * diff).toFixed(5)),
    level618: Number((high - 0.618 * diff).toFixed(5)),
    level786: Number((high - 0.786 * diff).toFixed(5)),
    level100: Number(low.toFixed(5)),
  };
}

/**
 * Calculates On-Balance Volume (OBV).
 */
export function calculateOBV(candles: Candle[]): number | null {
  if (candles.length === 0) return null;
  let obv = 0;
  for (let i = 1; i < candles.length; i++) {
    const curr = candles[i];
    const prev = candles[i - 1];
    if (curr.close > prev.close) {
      obv += curr.volume;
    } else if (curr.close < prev.close) {
      obv -= curr.volume;
    }
  }
  return obv;
}

/**
 * Calculates Volume Weighted Average Price (VWAP).
 */
export function calculateVWAP(candles: Candle[]): number | null {
  if (candles.length === 0) return null;
  let cumTypicalVol = 0;
  let cumVol = 0;

  for (const c of candles) {
    const tp = (c.high + c.low + c.close) / 3;
    cumTypicalVol += tp * c.volume;
    cumVol += c.volume;
  }

  if (cumVol === 0) return null;
  return Number((cumTypicalVol / cumVol).toFixed(5));
}
