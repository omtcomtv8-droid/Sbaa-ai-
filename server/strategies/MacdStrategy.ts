import { Candle, MacdConfig, StrategyResult } from '../types';
import { calculateMACD } from '../indicators';

export class MacdStrategy {
  public static evaluate(candles: Candle[], config: MacdConfig): StrategyResult {
    const candleTimestamp = candles.length > 0 ? candles[candles.length - 1].time : 0;

    if (!config.enabled) {
      return {
        strategyId: 'macd',
        strategyName: 'MACD Momentum',
        signal: 'WAIT',
        score: 0,
        weight: config.weight,
        reasons: ['Strategy disabled in settings'],
        candleTimestamp,
        dataValid: true,
      };
    }

    if (candles.length < config.slowPeriod + config.signalPeriod + 5) {
      return {
        strategyId: 'macd',
        strategyName: 'MACD Momentum',
        signal: 'WAIT',
        score: 0,
        weight: config.weight,
        reasons: [`Accumulating candles for MACD (${config.fastPeriod}, ${config.slowPeriod}, ${config.signalPeriod})`],
        candleTimestamp,
        dataValid: false,
      };
    }

    const closes = candles.map((c) => c.close);
    const macdData = calculateMACD(closes, config.fastPeriod, config.slowPeriod, config.signalPeriod);

    if (!macdData) {
      return {
        strategyId: 'macd',
        strategyName: 'MACD Momentum',
        signal: 'WAIT',
        score: 0,
        weight: config.weight,
        reasons: ['MACD calculating'],
        candleTimestamp,
        dataValid: false,
      };
    }

    // Previous MACD to check crossover
    const prevCloses = closes.slice(0, -1);
    const prevMacd = calculateMACD(prevCloses, config.fastPeriod, config.slowPeriod, config.signalPeriod);

    const isBullishCrossover =
      prevMacd !== null && prevMacd.macd <= prevMacd.signal && macdData.macd > macdData.signal;
    const isBearishCrossover =
      prevMacd !== null && prevMacd.macd >= prevMacd.signal && macdData.macd < macdData.signal;

    // Bullish Crossover or Expanding Positive Histogram
    if (isBullishCrossover) {
      return {
        strategyId: 'macd',
        strategyName: 'MACD Momentum',
        signal: 'UP',
        score: config.weight * 2,
        weight: config.weight,
        reasons: [
          `MACD Bullish Crossover: MACD line (${macdData.macd}) crossed above Signal (${macdData.signal})`,
          `Positive histogram impulse (+${macdData.histogram})`,
        ],
        candleTimestamp,
        dataValid: true,
      };
    }

    if (isBearishCrossover) {
      return {
        strategyId: 'macd',
        strategyName: 'MACD Momentum',
        signal: 'DOWN',
        score: -config.weight * 2,
        weight: config.weight,
        reasons: [
          `MACD Bearish Crossover: MACD line (${macdData.macd}) crossed below Signal (${macdData.signal})`,
          `Negative histogram impulse (${macdData.histogram})`,
        ],
        candleTimestamp,
        dataValid: true,
      };
    }

    // Strong continuing momentum
    if (macdData.histogram > 0 && macdData.macd > macdData.signal && macdData.macd > 0) {
      return {
        strategyId: 'macd',
        strategyName: 'MACD Momentum',
        signal: 'UP',
        score: config.weight * 1,
        weight: config.weight,
        reasons: [
          `MACD Bullish Histogram Expansion above zero line (+${macdData.histogram})`,
        ],
        candleTimestamp,
        dataValid: true,
      };
    }

    if (macdData.histogram < 0 && macdData.macd < macdData.signal && macdData.macd < 0) {
      return {
        strategyId: 'macd',
        strategyName: 'MACD Momentum',
        signal: 'DOWN',
        score: -config.weight * 1,
        weight: config.weight,
        reasons: [
          `MACD Bearish Histogram Expansion below zero line (${macdData.histogram})`,
        ],
        candleTimestamp,
        dataValid: true,
      };
    }

    return {
      strategyId: 'macd',
      strategyName: 'MACD Momentum',
      signal: 'WAIT',
      score: 0,
      weight: config.weight,
      reasons: [`MACD converging without directional crossover (Hist: ${macdData.histogram})`],
      candleTimestamp,
      dataValid: true,
    };
  }
}
