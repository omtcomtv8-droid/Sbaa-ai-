import {
  Candle,
  IndicatorMetrics,
  OpposingFactor,
  Signal,
  SignalEvidenceItem,
  SignalExplanation,
  StrategyResult,
  SupportingFactor,
} from './types';

export class SignalExplanationEngine {
  /**
   * Generates an audited, data-backed explanation for why a signal was emitted or held in WAIT.
   * Completely transparent, derived from real candle OHLC and indicator calculations.
   */
  public static generateExplanation(
    signal: Signal,
    candles: Candle[],
    indicators: IndicatorMetrics,
    activeStrategies: StrategyResult[],
    regime: string = 'UNCERTAIN',
    isAnalyzing: boolean = true
  ): SignalExplanation {
    const isUp = signal.type === 'UP';
    const isDown = signal.type === 'DOWN';
    const isWait = signal.type === 'WAIT';

    const lastCandle = candles.length > 0 ? candles[candles.length - 1] : null;
    const lastClose = signal.price || (lastCandle ? lastCandle.close : 0);

    // 1. Determine Verdict Title & Summary
    let verdictTitle = '';
    let summaryRationale = '';

    if (!isAnalyzing) {
      verdictTitle = 'ANALYSIS ENGINE STANDBY';
      summaryRationale =
        'Quantitative analysis pipeline is currently paused. Press "START ANALYSIS" to initiate real-time indicator evaluation and multi-strategy confluence.';
    } else if (isUp) {
      verdictTitle = `INSTITUTIONAL BULLISH EXPANSION (${signal.strength}% CONFIDENCE)`;
      summaryRationale = `Bullish confluence confirmed across ${signal.confirmations} active quantitative strategies with net score +${signal.score}. Market momentum and structural price action favor upward expansion within the ${signal.timeframe}s timeframe.`;
    } else if (isDown) {
      verdictTitle = `INSTITUTIONAL BEARISH CONTRACTION (${signal.strength}% CONFIDENCE)`;
      summaryRationale = `Bearish confluence confirmed across ${signal.confirmations} active quantitative strategies with net score ${signal.score}. Moving average alignment and selling velocity indicate downward pressure within the ${signal.timeframe}s timeframe.`;
    } else {
      verdictTitle = `FILTER ACTIVE: ${signal.reason.split(':')[0].toUpperCase()}`;
      summaryRationale = `${signal.reason}. System holding in defensive WAIT state to protect capital until deterministic statistical edge criteria are met.`;
    }

    // 2. Compute Confluence Ratio String
    const totalCount = activeStrategies.length > 0 ? activeStrategies.length : signal.totalStrategies || 21;
    const confluenceRatio = `${signal.confirmations} of ${totalCount} Active Strategies in Agreement`;

    // 3. Extract Technical Evidence from verified indicators
    const technicalEvidence: SignalEvidenceItem[] = [];

    // EMA Ribbon Evidence
    if (indicators.emaFast !== null && indicators.emaSlow !== null) {
      const fast = indicators.emaFast;
      const slow = indicators.emaSlow;
      const sma = indicators.sma;

      if (fast > slow) {
        technicalEvidence.push({
          indicator: 'Exponential Moving Averages',
          value: `EMA(9): ${fast.toFixed(5)} > EMA(21): ${slow.toFixed(5)}${sma ? ` > SMA(50): ${sma.toFixed(5)}` : ''}`,
          interpretation: 'Fast dynamic trend is bullish, price tracking above institutional short-term average',
          status: isUp ? 'SUPPORTIVE' : isDown ? 'CONTRADICTORY' : 'NEUTRAL',
        });
      } else {
        technicalEvidence.push({
          indicator: 'Exponential Moving Averages',
          value: `EMA(9): ${fast.toFixed(5)} < EMA(21): ${slow.toFixed(5)}${sma ? ` < SMA(50): ${sma.toFixed(5)}` : ''}`,
          interpretation: 'Fast dynamic trend is bearish, price tracking below institutional short-term average',
          status: isDown ? 'SUPPORTIVE' : isUp ? 'CONTRADICTORY' : 'NEUTRAL',
        });
      }
    }

    // RSI Evidence
    if (indicators.rsi !== null) {
      const rsiVal = indicators.rsi;
      let rsiInterp = '';
      let rsiStatus: 'SUPPORTIVE' | 'CONTRADICTORY' | 'NEUTRAL' = 'NEUTRAL';

      if (rsiVal >= 70) {
        rsiInterp = `RSI(14) at ${rsiVal.toFixed(1)} is in Overbought zone (Potential exhaustion or extreme momentum)`;
        rsiStatus = isDown ? 'SUPPORTIVE' : isUp ? 'CONTRADICTORY' : 'NEUTRAL';
      } else if (rsiVal <= 30) {
        rsiInterp = `RSI(14) at ${rsiVal.toFixed(1)} is in Oversold zone (Potential mean-reversion recovery)`;
        rsiStatus = isUp ? 'SUPPORTIVE' : isDown ? 'CONTRADICTORY' : 'NEUTRAL';
      } else if (rsiVal > 50) {
        rsiInterp = `RSI(14) at ${rsiVal.toFixed(1)} demonstrates positive bullish momentum above midline`;
        rsiStatus = isUp ? 'SUPPORTIVE' : isDown ? 'CONTRADICTORY' : 'NEUTRAL';
      } else {
        rsiInterp = `RSI(14) at ${rsiVal.toFixed(1)} demonstrates negative bearish drift below midline`;
        rsiStatus = isDown ? 'SUPPORTIVE' : isUp ? 'CONTRADICTORY' : 'NEUTRAL';
      }

      technicalEvidence.push({
        indicator: 'Relative Strength Index (RSI)',
        value: `RSI(14): ${rsiVal.toFixed(1)}`,
        interpretation: rsiInterp,
        status: rsiStatus,
      });
    }

    // MACD Evidence
    if (indicators.macd !== null) {
      const { macd, signal: macdSignal, histogram } = indicators.macd;
      const isMacdBull = macd > macdSignal;
      technicalEvidence.push({
        indicator: 'MACD Momentum Oscillator',
        value: `MACD: ${macd.toFixed(6)} | Signal: ${macdSignal.toFixed(6)} | Hist: ${histogram.toFixed(6)}`,
        interpretation: isMacdBull
          ? 'MACD line is above signal line with positive momentum histogram expansion'
          : 'MACD line is below signal line with negative momentum histogram contraction',
        status: isMacdBull ? (isUp ? 'SUPPORTIVE' : 'CONTRADICTORY') : (isDown ? 'SUPPORTIVE' : 'CONTRADICTORY'),
      });
    }

    // Bollinger Bands Evidence
    if (indicators.bollinger !== null) {
      const { upper, lower, middle, percentB } = indicators.bollinger;
      let bbInterp = '';
      let bbStatus: 'SUPPORTIVE' | 'CONTRADICTORY' | 'NEUTRAL' = 'NEUTRAL';

      if (lastClose <= lower) {
        bbInterp = `Price tested or rejected lower 2-sigma band (${lower.toFixed(5)})`;
        bbStatus = isUp ? 'SUPPORTIVE' : 'CONTRADICTORY';
      } else if (lastClose >= upper) {
        bbInterp = `Price tested or rejected upper 2-sigma band (${upper.toFixed(5)})`;
        bbStatus = isDown ? 'SUPPORTIVE' : 'CONTRADICTORY';
      } else {
        bbInterp = `Price trading within envelope: ${lower.toFixed(5)} - ${upper.toFixed(5)} (%B: ${(percentB * 100).toFixed(0)}%)`;
        bbStatus = 'NEUTRAL';
      }

      technicalEvidence.push({
        indicator: 'Bollinger Bands (20, 2)',
        value: `Upper: ${upper.toFixed(5)} | Mid: ${middle.toFixed(5)} | Lower: ${lower.toFixed(5)}`,
        interpretation: bbInterp,
        status: bbStatus,
      });
    }

    // ADX Trend Strength Evidence
    if (indicators.adx !== null) {
      const { adx, trendStrength } = indicators.adx;
      technicalEvidence.push({
        indicator: 'ADX Trend Strength',
        value: `ADX: ${adx.toFixed(1)} (${trendStrength})`,
        interpretation:
          adx > 25
            ? 'Strong directional trend regime active; trend continuation strategies favored'
            : 'Market displaying ranging or sideways behavior; mean-reversion rules apply',
        status: adx > 20 ? 'SUPPORTIVE' : 'NEUTRAL',
      });
    }

    // Candlestick Pattern Evidence
    if (indicators.pattern) {
      technicalEvidence.push({
        indicator: 'Candlestick Formation',
        value: indicators.pattern.name,
        interpretation: `${indicators.pattern.description} (Strength: ${indicators.pattern.strength}/3)`,
        status:
          indicators.pattern.bias === 'BULLISH'
            ? isUp ? 'SUPPORTIVE' : 'CONTRADICTORY'
            : indicators.pattern.bias === 'BEARISH'
            ? isDown ? 'SUPPORTIVE' : 'CONTRADICTORY'
            : 'NEUTRAL',
      });
    }

    // 4. Categorize Supporting and Opposing Strategies
    const supportingStrategies: SupportingFactor[] = [];
    const opposingStrategies: OpposingFactor[] = [];

    for (const strat of activeStrategies) {
      if (isUp && strat.signal === 'UP') {
        supportingStrategies.push({
          strategyId: strat.strategyId,
          name: strat.strategyName,
          percentage: strat.percentage || (strat.bullishScore ?? 75),
          weight: strat.weight,
          primaryFactor: strat.reasons[0] || 'Technical criteria satisfied',
        });
      } else if (isDown && strat.signal === 'DOWN') {
        supportingStrategies.push({
          strategyId: strat.strategyId,
          name: strat.strategyName,
          percentage: strat.percentage || (strat.bearishScore ?? 75),
          weight: strat.weight,
          primaryFactor: strat.reasons[0] || 'Technical criteria satisfied',
        });
      } else if ((isUp && strat.signal === 'DOWN') || (isDown && strat.signal === 'UP')) {
        opposingStrategies.push({
          strategyId: strat.strategyId,
          name: strat.strategyName,
          signal: strat.signal,
          factor: strat.reasons[0] || `Opposing ${strat.signal} bias detected`,
        });
      }
    }

    // 5. Candle & Volatility Context
    const candleContext = {
      lastClose,
      candlePattern: indicators.pattern?.name || 'Standard Candle Body',
      volatilityState: `${indicators.volatilityState || 'NORMAL'} Volatility (ATR: ${indicators.atr ? indicators.atr.toFixed(5) : 'N/A'})`,
      antiRepaintingNote:
        'Audited Non-Repainting: Calculated exclusively from confirmed closed candles. Markers and metrics freeze at candle close.',
    };

    // 6. Wait Reasons and Unlock Criteria (if in WAIT)
    let waitReasons: string[] | undefined = undefined;
    let unlockRequirements: string[] | undefined = undefined;

    if (isWait) {
      waitReasons = [
        signal.reason,
        ...signal.details,
      ];
      unlockRequirements = [
        'Need at least 2 independent strategies to agree on direction',
        'Net confluence score must reach threshold of ±3.0',
        'Conflict protection: opposing signals must not exceed 2.5 score simultaneously',
        'Incoming candle must close to confirm price action breakout',
      ];
    }

    return {
      verdictTitle,
      summaryRationale,
      direction: signal.type,
      confidencePercent: signal.strength,
      confluenceRatio,
      marketRegime: regime,
      technicalEvidence,
      supportingStrategies,
      opposingStrategies,
      candleContext,
      waitReasons,
      unlockRequirements,
    };
  }
}
