import { Candle, RsiMomentumConfig, StrategyResult } from '../types';
import { calculateRSI } from '../indicators';

export class RsiMomentumStrategy {
  public static evaluate(candles: Candle[], config: RsiMomentumConfig): StrategyResult {
    const candleTimestamp = candles.length > 0 ? candles[candles.length - 1].time : 0;

    if (!config.enabled) {
      return {
        strategyId: 'rsi_momentum',
        strategyName: 'RSI Momentum',
        signal: 'WAIT',
        score: 0,
        weight: config.weight,
        reasons: ['Strategy disabled in settings'],
        candleTimestamp,
        dataValid: true,
      };
    }

    if (candles.length < config.period + 5) {
      return {
        strategyId: 'rsi_momentum',
        strategyName: 'RSI Momentum',
        signal: 'WAIT',
        score: 0,
        weight: config.weight,
        reasons: [`Accumulating candles for RSI ${config.period}`],
        candleTimestamp,
        dataValid: false,
      };
    }

    const closes = candles.map((c) => c.close);
    const rsi = calculateRSI(closes, config.period);

    if (rsi === null) {
      return {
        strategyId: 'rsi_momentum',
        strategyName: 'RSI Momentum',
        signal: 'WAIT',
        score: 0,
        weight: config.weight,
        reasons: ['RSI calculating'],
        candleTimestamp,
        dataValid: false,
      };
    }

    // Previous RSI to detect hook / divergence
    const prevCloses = closes.slice(0, -1);
    const prevRsi = calculateRSI(prevCloses, config.period);

    // Deep Oversold Reversal Hook: was below oversold and is now curling upwards
    if (prevRsi !== null && prevRsi <= config.oversold && rsi > prevRsi) {
      return {
        strategyId: 'rsi_momentum',
        strategyName: 'RSI Momentum',
        signal: 'UP',
        score: config.weight * 2,
        weight: config.weight,
        reasons: [
          `RSI Oversold Momentum Recovery at ${rsi} (Threshold: ≤ ${config.oversold})`,
          `RSI hooked upward from previous ${prevRsi}`,
        ],
        candleTimestamp,
        dataValid: true,
      };
    }

    // Deep Overbought Rejection Hook: was above overbought and is now curling downwards
    if (prevRsi !== null && prevRsi >= config.overbought && rsi < prevRsi) {
      return {
        strategyId: 'rsi_momentum',
        strategyName: 'RSI Momentum',
        signal: 'DOWN',
        score: -config.weight * 2,
        weight: config.weight,
        reasons: [
          `RSI Overbought Rejection at ${rsi} (Threshold: ≥ ${config.overbought})`,
          `RSI hooked downward from previous ${prevRsi}`,
        ],
        candleTimestamp,
        dataValid: true,
      };
    }

    // Strong Bearish Momentum Continuation (RSI pinned oversold)
    if (rsi <= config.oversold) {
      return {
        strategyId: 'rsi_momentum',
        strategyName: 'RSI Momentum',
        signal: 'DOWN',
        score: -config.weight * 2,
        weight: config.weight,
        reasons: [
          `RSI Strong Bearish Momentum Expansion at ${rsi} (Threshold: ≤ ${config.oversold})`,
        ],
        candleTimestamp,
        dataValid: true,
      };
    }

    // Strong Bullish Momentum Continuation (RSI pinned overbought)
    if (rsi >= config.overbought) {
      return {
        strategyId: 'rsi_momentum',
        strategyName: 'RSI Momentum',
        signal: 'UP',
        score: config.weight * 2,
        weight: config.weight,
        reasons: [
          `RSI Strong Bullish Momentum Expansion at ${rsi} (Threshold: ≥ ${config.overbought})`,
        ],
        candleTimestamp,
        dataValid: true,
      };
    }

    // Centerline Trend Bias (50 line)
    if (rsi > 55 && prevRsi !== null && prevRsi <= 55) {
      return {
        strategyId: 'rsi_momentum',
        strategyName: 'RSI Momentum',
        signal: 'UP',
        score: config.weight * 1,
        weight: config.weight,
        reasons: [`RSI bullish centerline expansion crossed above 50 (${rsi})`],
        candleTimestamp,
        dataValid: true,
      };
    }

    if (rsi < 45 && prevRsi !== null && prevRsi >= 45) {
      return {
        strategyId: 'rsi_momentum',
        strategyName: 'RSI Momentum',
        signal: 'DOWN',
        score: -config.weight * 1,
        weight: config.weight,
        reasons: [`RSI bearish centerline expansion crossed below 50 (${rsi})`],
        candleTimestamp,
        dataValid: true,
      };
    }

    return {
      strategyId: 'rsi_momentum',
      strategyName: 'RSI Momentum',
      signal: 'WAIT',
      score: 0,
      weight: config.weight,
      reasons: [`RSI within neutral oscillator equilibrium (${rsi})`],
      candleTimestamp,
      dataValid: true,
    };
  }
}
