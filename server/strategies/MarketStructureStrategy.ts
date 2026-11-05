import { Candle, MarketStructureConfig, StrategyResult } from '../types';
import { TrendAnalysisEngine } from '../TrendAnalysisEngine';

export class MarketStructureStrategy {
  public static evaluate(candles: Candle[], config: MarketStructureConfig): StrategyResult {
    const candleTimestamp = candles.length > 0 ? candles[candles.length - 1].time : 0;

    if (!config.enabled) {
      return {
        strategyId: 'market_structure',
        strategyName: 'Market Structure',
        signal: 'WAIT',
        score: 0,
        weight: config.weight,
        reasons: ['Strategy disabled in settings'],
        candleTimestamp,
        dataValid: true,
      };
    }

    if (candles.length < 20) {
      return {
        strategyId: 'market_structure',
        strategyName: 'Market Structure',
        signal: 'WAIT',
        score: 0,
        weight: config.weight,
        reasons: ['Accumulating candles for swing structure analysis'],
        candleTimestamp,
        dataValid: false,
      };
    }

    const structure = TrendAnalysisEngine.detectMarketStructure(candles, config.swingLookback);

    if (structure.state === 'BULLISH_STRUCTURE') {
      return {
        strategyId: 'market_structure',
        strategyName: 'Market Structure',
        signal: 'UP',
        score: config.weight * 2,
        weight: config.weight,
        reasons: [
          'Confirmed Bullish Market Structure: Higher Highs (HH) & Higher Lows (HL)',
          structure.details,
        ],
        candleTimestamp,
        dataValid: true,
      };
    }

    if (structure.state === 'BEARISH_STRUCTURE') {
      return {
        strategyId: 'market_structure',
        strategyName: 'Market Structure',
        signal: 'DOWN',
        score: -config.weight * 2,
        weight: config.weight,
        reasons: [
          'Confirmed Bearish Market Structure: Lower Highs (LH) & Lower Lows (LL)',
          structure.details,
        ],
        candleTimestamp,
        dataValid: true,
      };
    }

    return {
      strategyId: 'market_structure',
      strategyName: 'Market Structure',
      signal: 'WAIT',
      score: 0,
      weight: config.weight,
      reasons: [
        'Market structure neutral or transitioning (mixed swing highs/lows)',
        structure.details,
      ],
      candleTimestamp,
      dataValid: true,
    };
  }
}
