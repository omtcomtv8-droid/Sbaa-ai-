import { Candle, IndicatorMetrics, SupportResistanceLevel } from './types';
import {
  calculateRSI,
  calculateEMA,
  calculateSMA,
  calculateBollingerBands,
  calculateMACD,
  calculateADX,
  calculateATR,
  calculateStochastic,
  calculateROC,
  calculateHighestHigh,
  calculateLowestLow,
} from './indicators';
import { SupportResistanceEngine } from './SupportResistanceEngine';
import { IndicatorValidation, IndicatorValidationResult } from './IndicatorValidation';
import { MarketDataStore } from './MarketDataStore';

export interface IndicatorEngineOutput {
  indicators: IndicatorMetrics | null;
  validation: IndicatorValidationResult;
  status: 'READY' | 'COLLECTING_DATA' | 'DATA_NOT_READY' | 'ERROR';
  statusMessage: string;
  indicatorStatuses: Record<string, any>;
  srLevels: SupportResistanceLevel[];
  crossovers: {
    smaCrossover: 'BULLISH_CROSS' | 'BEARISH_CROSS' | 'NEUTRAL' | 'WAIT';
    emaCrossover: 'BULLISH_CROSS' | 'BEARISH_CROSS' | 'NEUTRAL' | 'WAIT';
    macdCrossover: 'BULLISH_CROSS' | 'BEARISH_CROSS' | 'NEUTRAL' | 'WAIT';
    rsiReversal: 'BULLISH_REVERSAL' | 'BEARISH_REVERSAL' | 'NEUTRAL' | 'WAIT';
    rsiMomentum: 'BULLISH_MOMENTUM' | 'BEARISH_MOMENTUM' | 'NEUTRAL' | 'WAIT';
    maAlignment: 'BULLISH_STACK' | 'BEARISH_STACK' | 'MIXED' | 'WAIT';
  };
}

export class CentralIndicatorEngine {
  private lastCalculatedOutput: IndicatorEngineOutput | null = null;
  private lastCalculationTime: number | null = null;

  /**
   * Executes centralized indicator computation pipeline:
   * MarketDataStore -> CentralIndicatorEngine -> IndicatorValidation
   */
  public compute(marketStore: MarketDataStore): IndicatorEngineOutput {
    const asset = marketStore.getActiveAsset();
    const timeframe = marketStore.getTimeframe();
    const closedCandles = marketStore.getClosedCandles();
    const count = closedCandles.length;
    const now = Date.now();

    const minRequiredForSMA50 = 50;

    // Minimum warmup gate
    if (count < minRequiredForSMA50) {
      const output: IndicatorEngineOutput = {
        indicators: null,
        validation: {
          isValid: false,
          errors: [`Collecting closed candles: ${count}/${minRequiredForSMA50} required for stable statistical calculations`],
          validatedCount: 0,
        },
        status: 'COLLECTING_DATA',
        statusMessage: `Collecting Data: ${count} / ${minRequiredForSMA50} closed candles`,
        indicatorStatuses: this.buildCollectingStatuses(count, minRequiredForSMA50),
        srLevels: [],
        crossovers: {
          smaCrossover: 'WAIT',
          emaCrossover: 'WAIT',
          macdCrossover: 'WAIT',
          rsiReversal: 'WAIT',
          rsiMomentum: 'WAIT',
          maAlignment: 'WAIT',
        },
      };

      this.lastCalculatedOutput = output;
      marketStore.setIndicatorStatus('COLLECTING_DATA');
      return output;
    }

    const closes = closedCandles.map((c) => c.close);
    const lastClose = closes[closes.length - 1];

    // 1. Moving Averages
    const ema9 = calculateEMA(closes, 9);
    const ema21 = calculateEMA(closes, 21);
    const sma20 = calculateSMA(closes, 20);
    const sma50 = calculateSMA(closes, 50);

    // Previous values for crossover detection
    const prevCloses = closes.slice(0, -1);
    const prevEma9 = calculateEMA(prevCloses, 9);
    const prevEma21 = calculateEMA(prevCloses, 21);
    const prevSma20 = calculateSMA(prevCloses, 20);
    const prevSma50 = calculateSMA(prevCloses, 50);

    // 2. Oscillators & Bands
    const rsi = calculateRSI(closes, 14);
    const prevRsi = calculateRSI(prevCloses, 14);
    const bollinger = calculateBollingerBands(closes, 20, 2);
    const macd = calculateMACD(closes, 12, 26, 9);
    const adx = calculateADX(closedCandles, 14);
    const atrObj = calculateATR(closedCandles, 14);
    const stochastic = calculateStochastic(closedCandles, 14, 3);
    const roc = calculateROC(closes, 12);
    const highestHigh = calculateHighestHigh(closedCandles, 20);
    const lowestLow = calculateLowestLow(closedCandles, 20);

    // 3. Support / Resistance
    const srLevels = SupportResistanceEngine.calculateLevels(closedCandles);

    // 4. Crossovers & Alignment
    let emaCrossover: 'BULLISH_CROSS' | 'BEARISH_CROSS' | 'NEUTRAL' | 'WAIT' = 'NEUTRAL';
    if (ema9 !== null && ema21 !== null && prevEma9 !== null && prevEma21 !== null) {
      if (prevEma9 <= prevEma21 && ema9 > ema21) emaCrossover = 'BULLISH_CROSS';
      else if (prevEma9 >= prevEma21 && ema9 < ema21) emaCrossover = 'BEARISH_CROSS';
    }

    let smaCrossover: 'BULLISH_CROSS' | 'BEARISH_CROSS' | 'NEUTRAL' | 'WAIT' = 'NEUTRAL';
    if (sma20 !== null && sma50 !== null && prevSma20 !== null && prevSma50 !== null) {
      if (prevSma20 <= prevSma50 && sma20 > sma50) smaCrossover = 'BULLISH_CROSS';
      else if (prevSma20 >= prevSma50 && sma20 < sma50) smaCrossover = 'BEARISH_CROSS';
    }

    let macdCrossover: 'BULLISH_CROSS' | 'BEARISH_CROSS' | 'NEUTRAL' | 'WAIT' = 'NEUTRAL';
    if (macd !== null) {
      if (macd.histogram > 0) macdCrossover = 'BULLISH_CROSS';
      else if (macd.histogram < 0) macdCrossover = 'BEARISH_CROSS';
    }

    let rsiReversal: 'BULLISH_REVERSAL' | 'BEARISH_REVERSAL' | 'NEUTRAL' | 'WAIT' = 'NEUTRAL';
    if (rsi !== null && prevRsi !== null) {
      if (prevRsi <= 30 && rsi > 30) rsiReversal = 'BULLISH_REVERSAL';
      else if (prevRsi >= 70 && rsi < 70) rsiReversal = 'BEARISH_REVERSAL';
    }

    let rsiMomentum: 'BULLISH_MOMENTUM' | 'BEARISH_MOMENTUM' | 'NEUTRAL' | 'WAIT' = 'NEUTRAL';
    if (rsi !== null) {
      if (rsi >= 55) rsiMomentum = 'BULLISH_MOMENTUM';
      else if (rsi <= 45) rsiMomentum = 'BEARISH_MOMENTUM';
    }

    let maAlignment: 'BULLISH_STACK' | 'BEARISH_STACK' | 'MIXED' | 'WAIT' = 'MIXED';
    if (ema9 !== null && ema21 !== null && sma20 !== null && sma50 !== null) {
      if (ema9 > ema21 && ema21 > sma50 && lastClose > ema9) {
        maAlignment = 'BULLISH_STACK';
      } else if (ema9 < ema21 && ema21 < sma50 && lastClose < ema9) {
        maAlignment = 'BEARISH_STACK';
      }
    }

    // Assemble metrics object
    const metrics: IndicatorMetrics = {
      rsi,
      emaFast: ema9,
      emaSlow: ema21,
      sma: sma20,
      bollinger,
      macd,
      atr: atrObj ? atrObj.currentATR : null,
      atrAverage: atrObj ? atrObj.averageATR : null,
      volatilityState: atrObj ? atrObj.volatilityState : 'NORMAL',
      adx,
      stochastic,
      momentumROC: roc,
      highestHigh,
      lowestLow,
      pattern: null,
      sentiment: null,
      // Enhanced properties
      ...( {
        ema9,
        ema21,
        sma20,
        sma50,
      } as any ),
    };

    // Run strict mathematical validation (Item 11)
    const validation = IndicatorValidation.validateIndicators(metrics);

    const isEngineReady = validation.isValid;
    const status = isEngineReady ? 'READY' : 'DATA_NOT_READY';
    const statusMessage = isEngineReady
      ? 'All required indicators validated and active'
      : `Indicator validation warning: ${validation.errors.join('; ')}`;

    // Build rich individual statuses for UI (replacing "..." placeholders, Item 9)
    const indicatorStatuses = this.buildDetailedStatuses(metrics, count, isEngineReady);

    const output: IndicatorEngineOutput = {
      indicators: metrics,
      validation,
      status,
      statusMessage,
      indicatorStatuses,
      srLevels: [...srLevels.supports, ...srLevels.resistances],
      crossovers: {
        smaCrossover: isEngineReady ? smaCrossover : 'WAIT',
        emaCrossover: isEngineReady ? emaCrossover : 'WAIT',
        macdCrossover: isEngineReady ? macdCrossover : 'WAIT',
        rsiReversal: isEngineReady ? rsiReversal : 'WAIT',
        rsiMomentum: isEngineReady ? rsiMomentum : 'WAIT',
        maAlignment: isEngineReady ? maAlignment : 'WAIT',
      },
    };

    this.lastCalculatedOutput = output;
    this.lastCalculationTime = now;
    marketStore.setIndicatorStatus(status, now);

    // Requirement 22: Console diagnostics
    console.log(
      `[DATA] symbol=${asset} timeframe=${timeframe}s historicalCandles=${marketStore.getDiagnostics().historicalCandlesLoaded} closedCandles=${count}`
    );
    console.log(
      `[INDICATORS] EMA9=${ema9} EMA21=${ema21} SMA20=${sma20} SMA50=${sma50} RSI=${rsi} MACD=${macd?.histogram} ADX=${adx?.adx}`
    );
    console.log(
      `[VALIDATION] historyReady=${count >= 50} indicatorsReady=${validation.isValid} signalReady=${isEngineReady}`
    );

    return output;
  }

  public getLastOutput(): IndicatorEngineOutput | null {
    return this.lastCalculatedOutput;
  }

  private buildCollectingStatuses(count: number, minRequired: number): Record<string, any> {
    return {
      rsi: {
        name: 'RSI (14 Wilder)',
        status: 'COLLECTING_DATA',
        candlesAvailable: count,
        candlesRequired: 14,
        direction: 'WAIT',
        formattedValues: { status: 'Collecting Data', candles: `${count} / 14` },
      },
      macd: {
        name: 'MACD (12, 26, 9)',
        status: 'COLLECTING_DATA',
        candlesAvailable: count,
        candlesRequired: 35,
        direction: 'WAIT',
        formattedValues: { status: 'Collecting Data', candles: `${count} / 35` },
      },
      adx: {
        name: 'ADX Trend (14)',
        status: 'COLLECTING_DATA',
        candlesAvailable: count,
        candlesRequired: 28,
        direction: 'WAIT',
        formattedValues: { status: 'Collecting Data', candles: `${count} / 28` },
      },
      bollinger: {
        name: 'Bollinger Bands (20, 2)',
        status: 'COLLECTING_DATA',
        candlesAvailable: count,
        candlesRequired: 20,
        direction: 'WAIT',
        formattedValues: { status: 'Collecting Data', candles: `${count} / 20` },
      },
      movingAverages: {
        name: 'Moving Averages (EMA 9/21, SMA 20/50)',
        status: 'COLLECTING_DATA',
        candlesAvailable: count,
        candlesRequired: minRequired,
        direction: 'WAIT',
        formattedValues: { status: 'Collecting Data', candles: `${count} / ${minRequired}` },
      },
    };
  }

  private buildDetailedStatuses(m: IndicatorMetrics, count: number, isReady: boolean): Record<string, any> {
    const ema9 = (m as any).ema9 ?? m.emaFast;
    const ema21 = (m as any).ema21 ?? m.emaSlow;
    const sma20 = (m as any).sma20 ?? m.sma;
    const sma50 = (m as any).sma50;

    return {
      rsi: {
        name: 'RSI (14 Wilder)',
        status: isReady && m.rsi !== null ? 'READY' : 'DATA_NOT_READY',
        candlesAvailable: count,
        candlesRequired: 14,
        direction: m.rsi !== null ? (m.rsi <= 30 ? 'BULLISH' : m.rsi >= 70 ? 'BEARISH' : 'NEUTRAL') : 'WAIT',
        formattedValues: {
          value: m.rsi !== null ? m.rsi.toFixed(2) : 'Awaiting Data',
          state: m.rsi !== null ? (m.rsi <= 30 ? 'Oversold' : m.rsi >= 70 ? 'Overbought' : 'Neutral') : 'Unavailable',
        },
      },
      macd: {
        name: 'MACD (12, 26, 9)',
        status: isReady && m.macd ? 'READY' : 'DATA_NOT_READY',
        candlesAvailable: count,
        candlesRequired: 35,
        direction: m.macd ? (m.macd.histogram >= 0 ? 'BULLISH' : 'BEARISH') : 'WAIT',
        formattedValues: {
          macdLine: m.macd ? m.macd.macd.toFixed(5) : 'Awaiting Data',
          signalLine: m.macd ? m.macd.signal.toFixed(5) : 'Awaiting Data',
          histogram: m.macd ? m.macd.histogram.toFixed(5) : 'Awaiting Data',
          state: m.macd ? (m.macd.histogram >= 0 ? '+Bullish' : '-Bearish') : 'Unavailable',
        },
      },
      adx: {
        name: 'ADX Trend (14)',
        status: isReady && m.adx ? 'READY' : 'DATA_NOT_READY',
        candlesAvailable: count,
        candlesRequired: 28,
        direction: m.adx ? (m.adx.plusDI > m.adx.minusDI ? 'BULLISH' : 'BEARISH') : 'WAIT',
        formattedValues: {
          adx: m.adx ? m.adx.adx.toFixed(2) : 'Awaiting Data',
          plusDI: m.adx ? m.adx.plusDI.toFixed(2) : 'Awaiting Data',
          minusDI: m.adx ? m.adx.minusDI.toFixed(2) : 'Awaiting Data',
          trendStrength: m.adx ? m.adx.trendStrength : 'Unavailable',
        },
      },
      bollinger: {
        name: 'Bollinger Bands (20, 2)',
        status: isReady && m.bollinger ? 'READY' : 'DATA_NOT_READY',
        candlesAvailable: count,
        candlesRequired: 20,
        direction: m.bollinger ? (m.bollinger.percentB < 0.2 ? 'BULLISH' : m.bollinger.percentB > 0.8 ? 'BEARISH' : 'NEUTRAL') : 'WAIT',
        formattedValues: {
          upper: m.bollinger ? m.bollinger.upper.toFixed(5) : 'Awaiting Data',
          middle: m.bollinger ? m.bollinger.middle.toFixed(5) : 'Awaiting Data',
          lower: m.bollinger ? m.bollinger.lower.toFixed(5) : 'Awaiting Data',
          percentB: m.bollinger ? (m.bollinger.percentB * 100).toFixed(1) + '%' : 'Awaiting Data',
          bandwidth: m.bollinger ? (m.bollinger.bandwidth * 100).toFixed(2) + '%' : 'Awaiting Data',
        },
      },
      movingAverages: {
        name: 'Moving Averages',
        status: isReady && ema9 !== null && ema21 !== null && sma20 !== null && sma50 !== null ? 'READY' : 'DATA_NOT_READY',
        candlesAvailable: count,
        candlesRequired: 50,
        direction: ema9 !== null && ema21 !== null ? (ema9 > ema21 ? 'BULLISH' : 'BEARISH') : 'WAIT',
        formattedValues: {
          ema9: ema9 !== null ? ema9.toFixed(5) : 'Awaiting Data',
          ema21: ema21 !== null ? ema21.toFixed(5) : 'Awaiting Data',
          sma20: sma20 !== null ? sma20.toFixed(5) : 'Awaiting Data',
          sma50: sma50 !== null ? sma50.toFixed(5) : 'Awaiting Data',
        },
      },
    };
  }
}
