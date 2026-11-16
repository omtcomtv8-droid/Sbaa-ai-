import { Candle, StrategyResult, MultiConfluenceConfig, StrategyCondition } from '../types';
import {
  calculateADX,
  calculateBollingerBands,
  calculateEMA,
  calculateMACD,
  calculateRSI,
  calculateStochastic,
} from '../indicators';

export class MultiConfluenceStrategy {
  public static evaluate(
    candles: Candle[],
    config: MultiConfluenceConfig = { enabled: true, weight: 1.2 }
  ): StrategyResult {
    const candleTimestamp = candles.length > 0 ? candles[candles.length - 1].time : 0;

    if (!config.enabled) {
      return {
        strategyId: 'multi_confluence',
        strategyName: 'Multi-Confluence Engine',
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

    if (candles.length < 40) {
      return {
        strategyId: 'multi_confluence',
        strategyName: 'Multi-Confluence Engine',
        signal: 'WAIT',
        score: 0,
        weight: config.weight,
        reasons: [`Accumulating candles for 6-indicator confluence (${candles.length}/40)`],
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
    const last = candles[candles.length - 1];

    const ema9 = calculateEMA(closes, 9);
    const ema21 = calculateEMA(closes, 21);
    const rsi = calculateRSI(closes, 14);
    const macd = calculateMACD(closes, 12, 26, 9);
    const bb = calculateBollingerBands(closes, 20, 2);
    const stoch = calculateStochastic(candles, 14, 3);
    const adx = calculateADX(candles, 14);

    if (
      ema9 === null ||
      ema21 === null ||
      rsi === null ||
      macd === null ||
      bb === null ||
      stoch === null ||
      adx === null
    ) {
      return {
        strategyId: 'multi_confluence',
        strategyName: 'Multi-Confluence Engine',
        signal: 'WAIT',
        score: 0,
        weight: config.weight,
        reasons: ['Calculating multi-indicator confluence factors'],
        candleTimestamp,
        dataValid: false,
        bullishScore: 0,
        bearishScore: 0,
        percentage: 0,
        direction: 'NEUTRAL',
        conditions: [],
      };
    }

    // 6 Independent Quantitative Indicators (14 pts each = 84 pts)
    const emaBull = ema9 > ema21 && last.close > ema9;
    const macdBull = macd.macd > macd.signal && macd.histogram > 0;
    const rsiBull = rsi > 52 && rsi < 75;
    const stochBull = stoch.k > stoch.d && stoch.k < 82;
    const bbBull = bb.percentB > 0.5 && bb.percentB < 0.95;
    const adxBull = adx.adx >= 18 && adx.plusDI > adx.minusDI;

    const emaBear = ema9 < ema21 && last.close < ema9;
    const macdBear = macd.macd < macd.signal && macd.histogram < 0;
    const rsiBear = rsi < 48 && rsi > 25;
    const stochBear = stoch.k < stoch.d && stoch.k > 18;
    const bbBear = bb.percentB < 0.5 && bb.percentB > 0.05;
    const adxBear = adx.adx >= 18 && adx.minusDI > adx.plusDI;

    const bullFactors = [emaBull, macdBull, rsiBull, stochBull, bbBull, adxBull].filter(Boolean).length;
    const bearFactors = [emaBear, macdBear, rsiBear, stochBear, bbBear, adxBear].filter(Boolean).length;

    const isBullCandle = last.close > last.open;
    const isBearCandle = last.close < last.open;

    const bullGate = bullFactors >= 4 && isBullCandle;
    const bearGate = bearFactors >= 4 && isBearCandle;

    const bullishConditions: StrategyCondition[] = [
      { id: 'mc_bull_gate', name: `>= 4/6 Bullish Factors (${bullFactors}/6) & Bullish Close`, satisfied: bullGate, weight: 16, isMandatory: true },
      { id: 'mc_ema_bull', name: `EMA9 (${ema9.toFixed(5)}) > EMA21 (${ema21.toFixed(5)}) & Price > EMA9`, satisfied: emaBull, weight: 14 },
      { id: 'mc_macd_bull', name: `MACD (${macd.macd.toFixed(5)}) > Signal & Positive Histogram`, satisfied: macdBull, weight: 14 },
      { id: 'mc_rsi_bull', name: `RSI (${rsi.toFixed(1)}) in Bullish Zone (52-75)`, satisfied: rsiBull, weight: 14 },
      { id: 'mc_stoch_bull', name: `Stochastic %K (${stoch.k.toFixed(1)}) > %D (${stoch.d.toFixed(1)})`, satisfied: stochBull, weight: 14 },
      { id: 'mc_bb_bull', name: `Bollinger %B (${(bb.percentB * 100).toFixed(1)}%) Upper Half`, satisfied: bbBull, weight: 14 },
      { id: 'mc_adx_bull', name: `ADX (${adx.adx.toFixed(1)}) >= 18 with +DI > -DI`, satisfied: adxBull, weight: 14 },
    ];

    const bearishConditions: StrategyCondition[] = [
      { id: 'mc_bear_gate', name: `>= 4/6 Bearish Factors (${bearFactors}/6) & Bearish Close`, satisfied: bearGate, weight: 16, isMandatory: true },
      { id: 'mc_ema_bear', name: `EMA9 (${ema9.toFixed(5)}) < EMA21 (${ema21.toFixed(5)}) & Price < EMA9`, satisfied: emaBear, weight: 14 },
      { id: 'mc_macd_bear', name: `MACD (${macd.macd.toFixed(5)}) < Signal & Negative Histogram`, satisfied: macdBear, weight: 14 },
      { id: 'mc_rsi_bear', name: `RSI (${rsi.toFixed(1)}) in Bearish Zone (25-48)`, satisfied: rsiBear, weight: 14 },
      { id: 'mc_stoch_bear', name: `Stochastic %K (${stoch.k.toFixed(1)}) < %D (${stoch.d.toFixed(1)})`, satisfied: stochBear, weight: 14 },
      { id: 'mc_bb_bear', name: `Bollinger %B (${(bb.percentB * 100).toFixed(1)}%) Lower Half`, satisfied: bbBear, weight: 14 },
      { id: 'mc_adx_bear', name: `ADX (${adx.adx.toFixed(1)}) >= 18 with -DI > +DI`, satisfied: adxBear, weight: 14 },
    ];

    const bullishScore = bullishConditions.reduce((acc, c) => acc + (c.satisfied ? c.weight : 0), 0);
    const bearishScore = bearishConditions.reduce((acc, c) => acc + (c.satisfied ? c.weight : 0), 0);

    if (bullGate && bullishScore >= 72 && bullishScore > bearishScore + 15) {
      return {
        strategyId: 'multi_confluence',
        strategyName: 'Multi-Confluence Engine',
        signal: 'UP',
        score: Number(((bullishScore / 100) * config.weight * 2).toFixed(2)),
        weight: config.weight,
        reasons: [
          `6-Indicator Bullish Confluence (${bullFactors}/6 factors aligned, ${bullishScore}%)`,
          `Confirmed by bullish candle close (RSI: ${rsi.toFixed(1)}, ADX: ${adx.adx.toFixed(1)})`,
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

    if (bearGate && bearishScore >= 72 && bearishScore > bullishScore + 15) {
      return {
        strategyId: 'multi_confluence',
        strategyName: 'Multi-Confluence Engine',
        signal: 'DOWN',
        score: Number((-(bearishScore / 100) * config.weight * 2).toFixed(2)),
        weight: config.weight,
        reasons: [
          `6-Indicator Bearish Confluence (${bearFactors}/6 factors aligned, ${bearishScore}%)`,
          `Confirmed by bearish candle close (RSI: ${rsi.toFixed(1)}, ADX: ${adx.adx.toFixed(1)})`,
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
      strategyId: 'multi_confluence',
      strategyName: 'Multi-Confluence Engine',
      signal: 'WAIT',
      score: 0,
      weight: config.weight,
      reasons: [`Multi-Confluence mixed (${bullFactors}/6 Bull, ${bearFactors}/6 Bear) — awaiting >= 4/6 alignment`],
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
