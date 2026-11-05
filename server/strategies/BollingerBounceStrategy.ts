import { Candle, BollingerBounceConfig, StrategyResult } from '../types';
import { calculateBollingerBands } from '../indicators';

export class BollingerBounceStrategy {
  public static evaluate(candles: Candle[], config: BollingerBounceConfig): StrategyResult {
    const candleTimestamp = candles.length > 0 ? candles[candles.length - 1].time : 0;

    if (!config.enabled) {
      return {
        strategyId: 'bollinger_bounce',
        strategyName: 'Bollinger Reversion',
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
        strategyId: 'bollinger_bounce',
        strategyName: 'Bollinger Reversion',
        signal: 'WAIT',
        score: 0,
        weight: config.weight,
        reasons: [`Accumulating candles for Bollinger (${config.period}, ${config.stdDev})`],
        candleTimestamp,
        dataValid: false,
      };
    }

    const closes = candles.map((c) => c.close);
    const bb = calculateBollingerBands(closes, config.period, config.stdDev);

    if (!bb) {
      return {
        strategyId: 'bollinger_bounce',
        strategyName: 'Bollinger Reversion',
        signal: 'WAIT',
        score: 0,
        weight: config.weight,
        reasons: ['Bollinger Bands calculating'],
        candleTimestamp,
        dataValid: false,
      };
    }

    const curr = candles[candles.length - 1];
    const prev = candles[candles.length - 2];

    // Lower Band Rejection Bounce: Price reached/pierced lower band and closed as a bullish green reversal candle
    const touchedLower = curr.low <= bb.lower || prev.low <= bb.lower;
    const closedBullish = curr.close > curr.open && curr.close > bb.lower;

    if (touchedLower && closedBullish && bb.percentB <= 0.25) {
      return {
        strategyId: 'bollinger_bounce',
        strategyName: 'Bollinger Reversion',
        signal: 'UP',
        score: config.weight * 2,
        weight: config.weight,
        reasons: [
          `Lower Bollinger Band Rejection: Low touched ${bb.lower} with bullish reversal close (${curr.close})`,
          `Bollinger %B at ${(bb.percentB * 100).toFixed(1)}% confirms statistical mean-reversion boundary`,
        ],
        candleTimestamp,
        dataValid: true,
      };
    }

    // Upper Band Rejection Bounce: Price reached/pierced upper band and closed as a bearish red reversal candle
    const touchedUpper = curr.high >= bb.upper || prev.high >= bb.upper;
    const closedBearish = curr.close < curr.open && curr.close < bb.upper;

    if (touchedUpper && closedBearish && bb.percentB >= 0.75) {
      return {
        strategyId: 'bollinger_bounce',
        strategyName: 'Bollinger Reversion',
        signal: 'DOWN',
        score: -config.weight * 2,
        weight: config.weight,
        reasons: [
          `Upper Bollinger Band Rejection: High touched ${bb.upper} with bearish reversal close (${curr.close})`,
          `Bollinger %B at ${(bb.percentB * 100).toFixed(1)}% confirms statistical overextension boundary`,
        ],
        candleTimestamp,
        dataValid: true,
      };
    }

    return {
      strategyId: 'bollinger_bounce',
      strategyName: 'Bollinger Reversion',
      signal: 'WAIT',
      score: 0,
      weight: config.weight,
      reasons: [`Price oscillating inside normal Bollinger envelope (%B: ${(bb.percentB * 100).toFixed(1)}%)`],
      candleTimestamp,
      dataValid: true,
    };
  }
}
