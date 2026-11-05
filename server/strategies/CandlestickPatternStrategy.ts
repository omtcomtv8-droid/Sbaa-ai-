import { Candle, CandlestickConfig, StrategyResult } from '../types';
import { CandlestickPatternEngine } from '../CandlestickPatternEngine';
import { TrendAnalysisEngine } from '../TrendAnalysisEngine';

export class CandlestickPatternStrategy {
  public static evaluate(candles: Candle[], config: CandlestickConfig): StrategyResult {
    const candleTimestamp = candles.length > 0 ? candles[candles.length - 1].time : 0;

    if (!config.enabled) {
      return {
        strategyId: 'candlestick_pattern',
        strategyName: 'Candlestick Patterns',
        signal: 'WAIT',
        score: 0,
        weight: config.weight,
        reasons: ['Strategy disabled in settings'],
        candleTimestamp,
        dataValid: true,
      };
    }

    if (candles.length < 5) {
      return {
        strategyId: 'candlestick_pattern',
        strategyName: 'Candlestick Patterns',
        signal: 'WAIT',
        score: 0,
        weight: config.weight,
        reasons: ['Accumulating candles for pattern detection'],
        candleTimestamp,
        dataValid: false,
      };
    }

    const pattern = CandlestickPatternEngine.detect(candles);

    if (!pattern) {
      return {
        strategyId: 'candlestick_pattern',
        strategyName: 'Candlestick Patterns',
        signal: 'WAIT',
        score: 0,
        weight: config.weight,
        reasons: ['No distinct high-probability candlestick pattern detected on last closed candle'],
        candleTimestamp,
        dataValid: true,
      };
    }

    if (pattern.strength < config.minPatternStrength) {
      return {
        strategyId: 'candlestick_pattern',
        strategyName: 'Candlestick Patterns',
        signal: 'WAIT',
        score: 0,
        weight: config.weight,
        reasons: [`Pattern ${pattern.name} detected but strength (${pattern.strength}) below required threshold (${config.minPatternStrength})`],
        candleTimestamp,
        dataValid: true,
      };
    }

    // Context filter with trend if enabled
    if (config.requireTrendAlignment) {
      const trend = TrendAnalysisEngine.analyze(candles, 9, 21, 50);
      if (pattern.bias === 'BULLISH' && trend.trendDirection === 'BEARISH') {
        return {
          strategyId: 'candlestick_pattern',
          strategyName: 'Candlestick Patterns',
          signal: 'WAIT',
          score: 0,
          weight: config.weight,
          reasons: [`Bullish pattern (${pattern.name}) filtered out due to prevailing bearish trend context`],
          candleTimestamp,
          dataValid: true,
        };
      }
      if (pattern.bias === 'BEARISH' && trend.trendDirection === 'BULLISH') {
        return {
          strategyId: 'candlestick_pattern',
          strategyName: 'Candlestick Patterns',
          signal: 'WAIT',
          score: 0,
          weight: config.weight,
          reasons: [`Bearish pattern (${pattern.name}) filtered out due to prevailing bullish trend context`],
          candleTimestamp,
          dataValid: true,
        };
      }
    }

    if (pattern.bias === 'BULLISH') {
      return {
        strategyId: 'candlestick_pattern',
        strategyName: 'Candlestick Patterns',
        signal: 'UP',
        score: config.weight * pattern.strength,
        weight: config.weight,
        reasons: [
          `Pattern Confirmed: ${pattern.name} (Strength: ${pattern.strength}/3)`,
          pattern.description,
        ],
        candleTimestamp,
        dataValid: true,
      };
    }

    if (pattern.bias === 'BEARISH') {
      return {
        strategyId: 'candlestick_pattern',
        strategyName: 'Candlestick Patterns',
        signal: 'DOWN',
        score: -config.weight * pattern.strength,
        weight: config.weight,
        reasons: [
          `Pattern Confirmed: ${pattern.name} (Strength: ${pattern.strength}/3)`,
          pattern.description,
        ],
        candleTimestamp,
        dataValid: true,
      };
    }

    return {
      strategyId: 'candlestick_pattern',
      strategyName: 'Candlestick Patterns',
      signal: 'WAIT',
      score: 0,
      weight: config.weight,
      reasons: [`Pattern detected (${pattern.name}) denotes market indecision / neutral stance`],
      candleTimestamp,
      dataValid: true,
    };
  }
}
