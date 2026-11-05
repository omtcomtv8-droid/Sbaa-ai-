import { Candle, StrategyResult } from '../types';
import { calculateRSI } from '../indicators';

export interface RsiReversalConfig {
  enabled: boolean;
  period: number;
  overbought: number;
  oversold: number;
  weight: number;
}

export class RsiReversalStrategy {
  public static evaluate(
    candles: Candle[],
    config: RsiReversalConfig = {
      enabled: true,
      period: 14,
      overbought: 70,
      oversold: 30,
      weight: 1.3,
    }
  ): StrategyResult {
    const candleTimestamp = candles.length > 0 ? candles[candles.length - 1].time : 0;

    if (!config.enabled) {
      return {
        strategyId: 'rsi_reversal',
        strategyName: 'RSI Reversal',
        signal: 'WAIT',
        score: 0,
        weight: config.weight,
        reasons: ['Strategy disabled in settings'],
        candleTimestamp,
        dataValid: true,
        bullishScore: 0,
        bearishScore: 0,
        percentage: 0,
        direction: 'NEUTRAL',
        conditions: [],
      };
    }

    if (candles.length < config.period + 3) {
      return {
        strategyId: 'rsi_reversal',
        strategyName: 'RSI Reversal',
        signal: 'WAIT',
        score: 0,
        weight: config.weight,
        reasons: [`Accumulating candles for RSI (${candles.length}/${config.period + 3})`],
        candleTimestamp,
        dataValid: false,
        bullishScore: 0,
        bearishScore: 0,
        percentage: 0,
        direction: 'NEUTRAL',
        conditions: [],
      };
    }

    const closes = candles.map((c) => c.close);
    const rsi = calculateRSI(closes, config.period);
    const prevRsi = calculateRSI(closes.slice(0, -1), config.period);

    if (rsi === null || prevRsi === null) {
      return {
        strategyId: 'rsi_reversal',
        strategyName: 'RSI Reversal',
        signal: 'WAIT',
        score: 0,
        weight: config.weight,
        reasons: ['RSI calculating'],
        candleTimestamp,
        dataValid: false,
        bullishScore: 0,
        bearishScore: 0,
        percentage: 0,
        direction: 'NEUTRAL',
        conditions: [],
      };
    }

    const isOversold = rsi <= config.oversold;
    const isExitingOversold = prevRsi <= config.oversold && rsi > prevRsi;
    const isOverbought = rsi >= config.overbought;
    const isExitingOverbought = prevRsi >= config.overbought && rsi < prevRsi;

    const bullishConditions = [
      { name: `RSI Was Oversold <= ${config.oversold}`, satisfied: prevRsi <= config.oversold, weight: 40, isMandatory: true },
      { name: `RSI Hooking Up out of Oversold`, satisfied: isExitingOversold, weight: 60, isMandatory: true },
    ];

    const bearishConditions = [
      { name: `RSI Was Overbought >= ${config.overbought}`, satisfied: prevRsi >= config.overbought, weight: 40, isMandatory: true },
      { name: `RSI Hooking Down out of Overbought`, satisfied: isExitingOverbought, weight: 60, isMandatory: true },
    ];

    let bullishScore = 0;
    if (prevRsi <= config.oversold) bullishScore += 40;
    if (isExitingOversold) bullishScore += 60;

    let bearishScore = 0;
    if (prevRsi >= config.overbought) bearishScore += 40;
    if (isExitingOverbought) bearishScore += 60;

    if (isExitingOversold) {
      return {
        strategyId: 'rsi_reversal',
        strategyName: 'RSI Reversal',
        signal: 'UP',
        score: (bullishScore / 100) * config.weight * 2,
        weight: config.weight,
        reasons: [
          `RSI Mean Reversion Buy: RSI (${rsi.toFixed(1)}) hooked upward from oversold zone (threshold ${config.oversold})`,
        ],
        candleTimestamp,
        dataValid: true,
        bullishScore,
        bearishScore,
        percentage: bullishScore,
        direction: 'BULLISH',
        conditions: bullishConditions,
      };
    }

    if (isExitingOverbought) {
      return {
        strategyId: 'rsi_reversal',
        strategyName: 'RSI Reversal',
        signal: 'DOWN',
        score: -(bearishScore / 100) * config.weight * 2,
        weight: config.weight,
        reasons: [
          `RSI Mean Reversion Sell: RSI (${rsi.toFixed(1)}) hooked downward from overbought zone (threshold ${config.overbought})`,
        ],
        candleTimestamp,
        dataValid: true,
        bullishScore,
        bearishScore,
        percentage: bearishScore,
        direction: 'BEARISH',
        conditions: bearishConditions,
      };
    }

    return {
      strategyId: 'rsi_reversal',
      strategyName: 'RSI Reversal',
      signal: 'WAIT',
      score: 0,
      weight: config.weight,
      reasons: [`RSI (${rsi.toFixed(1)}) in neutral zone (${config.oversold} - ${config.overbought})`],
      candleTimestamp,
      dataValid: true,
      bullishScore,
      bearishScore,
      percentage: Math.max(bullishScore, bearishScore),
      direction: 'NEUTRAL',
      conditions: bullishScore >= bearishScore ? bullishConditions : bearishConditions,
    };
  }
}
