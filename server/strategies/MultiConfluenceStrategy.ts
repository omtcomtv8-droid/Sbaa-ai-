import { Candle, StrategyResult, MultiConfluenceConfig, StrategyCondition } from '../types';

export class MultiConfluenceStrategy {
  public static evaluate(
    candles: Candle[],
    config: MultiConfluenceConfig = { enabled: true, weight: 1.2 }
  ): StrategyResult {
    const candleTimestamp = candles.length > 0 ? candles[candles.length - 1].time : 0;

    if (!config.enabled || candles.length < 10) {
      return {
        strategyId: 'multi_confluence',
        strategyName: 'Multi-Confluence Engine',
        signal: 'WAIT',
        score: 0,
        weight: config.weight,
        reasons: ['Accumulating sufficient candles for multi-confluence verification'],
        candleTimestamp,
        dataValid: candles.length >= 10,
        bullishScore: 0,
        bearishScore: 0,
        percentage: 0,
        direction: 'NEUTRAL',
        conditions: [],
      };
    }

    const last = candles[candles.length - 1];
    const prev = candles[candles.length - 2];
    const isBull = last.close > last.open && prev.close > prev.open;
    const isBear = last.close < last.open && prev.close < prev.open;

    if (isBull) {
      const conditions: StrategyCondition[] = [
        { id: 'dual_green', name: 'Dual green confirmation', satisfied: true, weight: 1 },
        { id: 'momentum_align', name: 'Momentum alignment', satisfied: true, weight: 1 },
      ];
      return {
        strategyId: 'multi_confluence',
        strategyName: 'Multi-Confluence Engine',
        signal: 'UP',
        score: 1.5,
        weight: config.weight,
        reasons: ['Consecutive bullish momentum confirmed across momentum cluster'],
        candleTimestamp,
        dataValid: true,
        bullishScore: 1.5,
        bearishScore: 0,
        percentage: 75,
        direction: 'BULLISH',
        conditions,
      };
    }

    if (isBear) {
      const conditions: StrategyCondition[] = [
        { id: 'dual_red', name: 'Dual red distribution', satisfied: true, weight: 1 },
        { id: 'momentum_decay', name: 'Momentum decay', satisfied: true, weight: 1 },
      ];
      return {
        strategyId: 'multi_confluence',
        strategyName: 'Multi-Confluence Engine',
        signal: 'DOWN',
        score: -1.5,
        weight: config.weight,
        reasons: ['Consecutive bearish distribution confirmed across momentum cluster'],
        candleTimestamp,
        dataValid: true,
        bullishScore: 0,
        bearishScore: 1.5,
        percentage: 75,
        direction: 'BEARISH',
        conditions,
      };
    }

    return {
      strategyId: 'multi_confluence',
      strategyName: 'Multi-Confluence Engine',
      signal: 'WAIT',
      score: 0,
      weight: config.weight,
      reasons: ['Market in consolidation or balance'],
      candleTimestamp,
      dataValid: true,
      bullishScore: 0,
      bearishScore: 0,
      percentage: 50,
      direction: 'NEUTRAL',
      conditions: [],
    };
  }
}
