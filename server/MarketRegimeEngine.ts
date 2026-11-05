import { Candle, MarketRegime } from './types';
import { calculateADX, calculateATR, calculateBollingerBands, calculateEMA, calculateSMA } from './indicators';
import { TrendAnalysisEngine } from './TrendAnalysisEngine';

export interface MarketRegimeResult {
  regime: MarketRegime;
  label: string;
  description: string;
  recommendedStrategies: string[];
  adxValue: number | null;
  volatilityState: 'HIGH' | 'NORMAL' | 'LOW';
  bandwidth: number | null;
}

export class MarketRegimeEngine {
  /**
   * Classifies current market state objectively from real candle data.
   */
  public static detect(candles: Candle[]): MarketRegimeResult {
    if (candles.length < 20) {
      return {
        regime: 'UNCERTAIN',
        label: 'Awaiting History',
        description: 'Accumulating closed candle data to establish market baseline.',
        recommendedStrategies: ['None (Accumulating Data)'],
        adxValue: null,
        volatilityState: 'NORMAL',
        bandwidth: null,
      };
    }

    const closes = candles.map((c) => c.close);
    const adxData = calculateADX(candles, 14);
    const atrData = calculateATR(candles, 14);
    const bb = calculateBollingerBands(closes, 20, 2);
    const trendAnalysis = TrendAnalysisEngine.analyze(candles, 9, 21, 50);

    const isTrendingAdx = adxData ? adxData.adx >= 25 : false;
    const isRangingAdx = adxData ? adxData.adx < 20 : false;
    const volatilityState = atrData?.volatilityState ?? 'NORMAL';
    const isBandwidthSqueezed = bb ? bb.bandwidth < 0.001 : false;

    // 1. High Volatility Extreme
    if (volatilityState === 'HIGH') {
      return {
        regime: 'HIGH_VOLATILITY',
        label: 'High Volatility',
        description: 'ATR expanding significantly above average. Price impulses are swift; wide stops and momentum required.',
        recommendedStrategies: ['Breakout Strategy', 'MACD Momentum'],
        adxValue: adxData?.adx ?? null,
        volatilityState: 'HIGH',
        bandwidth: bb?.bandwidth ?? null,
      };
    }

    // 2. Low Volatility / Squeeze
    if (volatilityState === 'LOW' || isBandwidthSqueezed) {
      return {
        regime: 'LOW_VOLATILITY',
        label: 'Low Volatility (Squeeze)',
        description: 'Bollinger bandwidth compressed and ATR depressed. Market coiling for an impending volatility breakout.',
        recommendedStrategies: ['Breakout Strategy (Coiling)', 'Support/Resistance Range'],
        adxValue: adxData?.adx ?? null,
        volatilityState: 'LOW',
        bandwidth: bb?.bandwidth ?? null,
      };
    }

    // 3. Strong Bullish Trend
    if (trendAnalysis.trendDirection === 'BULLISH' && (isTrendingAdx || trendAnalysis.trendStrength === 'STRONG')) {
      return {
        regime: 'TRENDING_UP',
        label: 'Trending Up (Bullish)',
        description: 'Fast EMA above Slow EMA with confirmed Higher Highs/Lows and strong directional strength.',
        recommendedStrategies: ['EMA Trend Following', 'Pullback to EMA/Support', 'MACD Bullish Continuation'],
        adxValue: adxData?.adx ?? null,
        volatilityState: 'NORMAL',
        bandwidth: bb?.bandwidth ?? null,
      };
    }

    // 4. Strong Bearish Trend
    if (trendAnalysis.trendDirection === 'BEARISH' && (isTrendingAdx || trendAnalysis.trendStrength === 'STRONG')) {
      return {
        regime: 'TRENDING_DOWN',
        label: 'Trending Down (Bearish)',
        description: 'Fast EMA below Slow EMA with confirmed Lower Highs/Lows and sustained downward distribution.',
        recommendedStrategies: ['EMA Trend Following', 'Rally to Resistance Pullback', 'MACD Bearish Continuation'],
        adxValue: adxData?.adx ?? null,
        volatilityState: 'NORMAL',
        bandwidth: bb?.bandwidth ?? null,
      };
    }

    // 5. Ranging / Range-Bound
    if (isRangingAdx || trendAnalysis.marketStructure.state === 'RANGING_STRUCTURE') {
      return {
        regime: 'RANGING',
        label: 'Range-Bound / Consolidating',
        description: 'Price oscillating within horizontal boundaries without clear directional dominance.',
        recommendedStrategies: ['Bollinger Band Bounce', 'RSI Overbought/Oversold Reversal', 'Support/Resistance Boundaries'],
        adxValue: adxData?.adx ?? null,
        volatilityState: 'NORMAL',
        bandwidth: bb?.bandwidth ?? null,
      };
    }

    // 6. Uncertain / Transition
    return {
      regime: 'UNCERTAIN',
      label: 'Market Indecision / Transition',
      description: 'Mixed technical indicators and neutral market structure. Higher risk of false breakout whipsaws.',
      recommendedStrategies: ['Multi-Indicator Confluence (High Threshold)'],
      adxValue: adxData?.adx ?? null,
      volatilityState: 'NORMAL',
      bandwidth: bb?.bandwidth ?? null,
    };
  }
}
