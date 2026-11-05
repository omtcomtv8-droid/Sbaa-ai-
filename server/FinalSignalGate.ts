/**
 * FinalSignalGate.ts - Authoritative Single Source of Truth for Signal Validation
 *
 * Explicitly gates all signal generation behind transparent, deterministic rules:
 * - Broker authentication verified
 * - Real market data feed ready & fresh
 * - Candle physical structure valid & confirmed
 * - Minimum historical closed candle baseline (>= 50)
 * - Central Indicator Engine ready with finite values
 * - Active strategies evaluated
 * - Mandatory trend & momentum conditions
 * - Minimum confidence threshold passed
 * - Minimum confluence confirmations passed
 * - Opposing strategy/indicator conflict protection
 * - Signal cooldown and deduplication
 * - Analysis pipeline running state
 *
 * IF ALL PASS: Emits UP or DOWN
 * ELSE: Emits WAIT with explicit, auditable blockedReasons[]
 */

export interface FinalSignalGateInput {
  authenticated: boolean;
  marketDataReady: boolean;
  dataFresh: boolean;
  symbolValid: boolean;
  timeframeValid: boolean;
  candleValid: boolean;
  candleConfirmed: boolean;
  sufficientHistory: boolean;
  indicatorsReady: boolean;
  strategiesReady: boolean;
  mandatoryConditions: boolean;
  strategyQualified?: boolean;
  minimumConfidence: boolean;
  minimumConfluence: boolean;
  strategyConflict: boolean;
  signalCooldown: boolean;
  duplicateSignal: boolean;
  analysisRunning: boolean;

  // Rich telemetry for transparent audit
  symbol: string;
  timeframe: number;
  candidateDirection: 'UP' | 'DOWN' | 'WAIT';
  actualConfidence: number;
  selectedThreshold: number;
  confirmingCount: number;
  totalActiveCount: number;
  minConfirmations: number;
  candleDirection: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'UNAVAILABLE';
  candlePattern?: string;
  isClosedCandle: boolean;
  analysisMode: 'CLOSED_CANDLE' | 'INTRABAR';
  secondsSinceLastTick: number;
  maxDataFreshnessSeconds: number;
  historyCandleCount: number;
  requiredHistoryCount: number;
  conflictingDetails?: string[];
  mandatoryFailedDetails?: string[];
  upstreamAuthReason?: string;
  cooldownRemainingSec?: number;
  supportingStrategies?: string[];
  opposingStrategies?: string[];
}

export interface FinalSignalGateResult {
  decision: 'UP' | 'DOWN' | 'WAIT';
  signal: 'UP' | 'DOWN' | 'WAIT';
  allPassed: boolean;
  eligible: boolean;
  confidence: number;
  passedConditions: string[];
  blockedReasons: string[];
  blockingReasons: string[];
  primaryReason: string;
  reasonCode: string;
  supportingStrategies: string[];
  opposingStrategies: string[];
  checks: {
    authenticated: boolean;
    marketDataReady: boolean;
    dataFresh: boolean;
    symbolValid: boolean;
    timeframeValid: boolean;
    candleValid: boolean;
    candleConfirmed: boolean;
    sufficientHistory: boolean;
    indicatorsReady: boolean;
    strategiesReady: boolean;
    mandatoryConditions: boolean;
    strategyQualified: boolean;
    minimumConfidence: boolean;
    minimumConfluence: boolean;
    noStrategyConflict: boolean;
    notInCooldown: boolean;
    notDuplicate: boolean;
    analysisRunning: boolean;
  };
}

export class FinalSignalGate {
  /**
   * Evaluate all 17 conditions authoritatively.
   */
  public static evaluate(input: FinalSignalGateInput): FinalSignalGateResult {
    const passedConditions: string[] = [];
    const blockedReasons: string[] = [];

    // 1. Broker Authentication Check
    if (!input.authenticated) {
      const reason = input.upstreamAuthReason
        ? `Blocked by: Pocket Option session unauthenticated (${input.upstreamAuthReason})`
        : 'Blocked by: Pocket Option session unauthenticated or disconnected';
      blockedReasons.push(reason);
    } else {
      passedConditions.push('Broker connection and authentication verified');
    }

    // 2. Market Data Readiness
    if (!input.marketDataReady) {
      blockedReasons.push('Blocked by: Market data feed not ready or awaiting ticks');
    } else {
      passedConditions.push('Real-time market data stream active');
    }

    // 3. Data Freshness
    if (!input.dataFresh) {
      blockedReasons.push(
        `Blocked by: Market data stale (last tick was ${input.secondsSinceLastTick.toFixed(1)}s ago, max allowed: ${input.maxDataFreshnessSeconds}s)`
      );
    } else {
      passedConditions.push(`Market data fresh (latency: ${input.secondsSinceLastTick.toFixed(1)}s)`);
    }

    // 4. Symbol Validity
    if (!input.symbolValid) {
      blockedReasons.push(`Blocked by: Invalid or mismatched trading asset symbol (${input.symbol})`);
    } else {
      passedConditions.push(`Asset symbol valid (${input.symbol})`);
    }

    // 5. Timeframe Validity
    if (!input.timeframeValid || input.timeframe <= 0) {
      blockedReasons.push(`Blocked by: Invalid timeframe specification (${input.timeframe}s)`);
    } else {
      passedConditions.push(`Timeframe valid (${input.timeframe}s)`);
    }

    // 6. Candle OHLC Validity
    if (!input.candleValid) {
      blockedReasons.push('Blocked by: Invalid candle data structure (zero or non-finite OHLC prices)');
    } else {
      passedConditions.push('Candle physical OHLC structure verified');
    }

    // 7. Sufficient History Baseline
    if (!input.sufficientHistory) {
      blockedReasons.push(
        `Blocked by: Insufficient candle history (${input.historyCandleCount}/${input.requiredHistoryCount} closed candles required for indicator baselines)`
      );
    } else {
      passedConditions.push(`Historical candle baseline sufficient (${input.historyCandleCount} closed candles)`);
    }

    // 8. Indicators Engine Readiness
    if (!input.indicatorsReady) {
      blockedReasons.push('Blocked by: Central Indicator Engine warming up (indicators not ready or non-finite)');
    } else {
      passedConditions.push('Central technical indicators computed and mathematically valid');
    }

    // 9. Strategies Readiness
    if (!input.strategiesReady || input.totalActiveCount === 0) {
      blockedReasons.push('Blocked by: Strategy execution pipeline incomplete or missing active strategies');
    } else {
      passedConditions.push(`Active quantitative strategies evaluated (${input.totalActiveCount} strategies active)`);
    }

    // 10. Analysis Running State
    if (!input.analysisRunning) {
      blockedReasons.push('Blocked by: Quantitative analysis pipeline paused in Standby');
    } else {
      passedConditions.push('Quantitative analysis pipeline active');
    }

    // 11. Directional Bias Consensus
    if (input.candidateDirection !== 'UP' && input.candidateDirection !== 'DOWN') {
      blockedReasons.push('Blocked by: Net directional edge neutral (insufficient directional consensus)');
    } else {
      passedConditions.push(`Directional candidate determined: ${input.candidateDirection}`);
    }

    // 12. Minimum Confluence Confirmations
    if (!input.minimumConfluence) {
      blockedReasons.push(
        `Blocked by: Minimum confluence not reached (${input.confirmingCount}/${input.totalActiveCount} strategies agree, minimum ${input.minConfirmations} required)`
      );
    } else {
      passedConditions.push(
        `Confluence confirmed: ${input.confirmingCount}/${input.totalActiveCount} strategies agree in consensus`
      );
    }

    // 13. Minimum Confidence Threshold
    if (!input.minimumConfidence) {
      blockedReasons.push(
        `Blocked by: Minimum confidence threshold not reached (${input.actualConfidence}% < ${input.selectedThreshold}% configured threshold)`
      );
    } else {
      passedConditions.push(
        `Confidence qualified: ${input.actualConfidence}% meets or exceeds ${input.selectedThreshold}% threshold`
      );
    }

    // 14. Candle Confirmation
    if (!input.candleConfirmed) {
      if (input.analysisMode === 'CLOSED_CANDLE' && !input.isClosedCandle) {
        blockedReasons.push('Blocked by: Current candle still forming (awaiting candle close for final confirmation)');
      } else {
        blockedReasons.push(
          `Blocked by: Candle structure opposes proposed ${input.candidateDirection} direction (${input.candleDirection} candle)`
        );
      }
    } else {
      passedConditions.push(
        `Candle structure confirmed (${input.candleDirection}${input.candlePattern ? ` • ${input.candlePattern}` : ''})`
      );
    }

    // 15. Mandatory Trend & Momentum Conditions
    if (!input.mandatoryConditions) {
      const details = input.mandatoryFailedDetails?.length
        ? input.mandatoryFailedDetails.join('; ')
        : 'Trend or momentum prerequisite missing';
      blockedReasons.push(`Blocked by: Mandatory condition failure: ${details}`);
    } else {
      passedConditions.push('Mandatory trend and momentum conditions confirmed');
    }

    // 16. Opposing Strategy / Indicator Conflict Check
    if (input.strategyConflict) {
      const details = input.conflictingDetails?.length
        ? input.conflictingDetails.join('; ')
        : 'Opposing indicators or strategy signals detected';
      blockedReasons.push(`Blocked by: Strategy conflict detected: ${details}`);
    } else {
      passedConditions.push('Zero conflicting signals or opposing momentum indicators');
    }

    // 17. Signal Cooldown
    if (input.signalCooldown) {
      blockedReasons.push(`Blocked by: Signal cooldown active (${input.cooldownRemainingSec ?? 30}s remaining)`);
    } else {
      passedConditions.push('Signal cooldown inactive');
    }

    // 18. Duplicate Signal Interval
    if (input.duplicateSignal) {
      blockedReasons.push('Blocked by: Duplicate signal already dispatched for this candle interval');
    } else {
      passedConditions.push('Signal interval unique (no duplicate)');
    }

    const allPassed = blockedReasons.length === 0 && (input.candidateDirection === 'UP' || input.candidateDirection === 'DOWN');

    let decision: 'UP' | 'DOWN' | 'WAIT';
    let primaryReason: string;
    let reasonCode: string;

    if (allPassed) {
      decision = input.candidateDirection;
      primaryReason = `${decision} • ${input.actualConfidence}% Confluence • ${input.confirmingCount}/${input.totalActiveCount} Strategies • ${input.candleDirection} Candle Confirmed`;
      reasonCode = 'SETUP_CONFIRMED';
    } else {
      decision = 'WAIT';
      const firstBlocker = blockedReasons[0] || 'Awaiting setup conditions';
      primaryReason = firstBlocker.startsWith('Blocked by: ')
        ? `WAIT • ${firstBlocker}`
        : `WAIT • Blocked by: ${firstBlocker}`;
      reasonCode = this.deriveReasonCode(firstBlocker);
    }

    return {
      decision,
      signal: decision,
      allPassed,
      eligible: allPassed,
      confidence: input.actualConfidence,
      passedConditions,
      blockedReasons,
      blockingReasons: blockedReasons,
      primaryReason,
      reasonCode,
      supportingStrategies: input.supportingStrategies || [],
      opposingStrategies: input.opposingStrategies || [],
      checks: {
        authenticated: input.authenticated,
        marketDataReady: input.marketDataReady,
        dataFresh: input.dataFresh,
        symbolValid: input.symbolValid,
        timeframeValid: input.timeframeValid,
        candleValid: input.candleValid,
        candleConfirmed: input.candleConfirmed,
        sufficientHistory: input.sufficientHistory,
        indicatorsReady: input.indicatorsReady,
        strategiesReady: input.strategiesReady,
        mandatoryConditions: input.mandatoryConditions,
        strategyQualified: input.strategyQualified ?? input.mandatoryConditions,
        minimumConfidence: input.minimumConfidence,
        minimumConfluence: input.minimumConfluence,
        noStrategyConflict: !input.strategyConflict,
        notInCooldown: !input.signalCooldown,
        notDuplicate: !input.duplicateSignal,
        analysisRunning: input.analysisRunning,
      },
    };
  }

  private static deriveReasonCode(blocker: string): string {
    const b = blocker.toLowerCase();
    if (b.includes('unauthenticated') || b.includes('disconnected')) return 'UPSTREAM_AUTH_LOCKED';
    if (b.includes('not ready') || b.includes('awaiting ticks')) return 'MARKET_DATA_NOT_READY';
    if (b.includes('stale')) return 'DATA_STALE';
    if (b.includes('insufficient candle history')) return 'INSUFFICIENT_HISTORY';
    if (b.includes('indicator engine warming up')) return 'INDICATOR_WARMUP';
    if (b.includes('standby') || b.includes('paused')) return 'ANALYSIS_STANDBY';
    if (b.includes('candle still forming')) return 'AWAITING_CANDLE_CLOSE';
    if (b.includes('confidence threshold not reached')) return 'CONFIDENCE_BELOW_THRESHOLD';
    if (b.includes('confluence not reached')) return 'CONFLUENCE_INSUFFICIENT';
    if (b.includes('conflict')) return 'CONFLICT_DETECTED';
    if (b.includes('candle structure opposes')) return 'CANDLE_DIRECTION_MISMATCH';
    if (b.includes('mandatory')) return 'MANDATORY_CONDITION_FAILED';
    if (b.includes('cooldown')) return 'COOLDOWN_ACTIVE';
    if (b.includes('duplicate')) return 'DUPLICATE_SIGNAL';
    return 'AWAITING_SETUP';
  }
}
