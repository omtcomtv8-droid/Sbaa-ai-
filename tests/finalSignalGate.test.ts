import { FinalSignalGate, FinalSignalGateInput } from '../server/FinalSignalGate';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`TEST FAILED: ${msg}`);
  }
  console.log(`✓ [PASS] ${msg}`);
}

console.log('=== RUNNING FINAL SIGNAL GATE COMPREHENSIVE TESTS ===');

const baseInput: FinalSignalGateInput = {
  authenticated: true,
  marketDataReady: true,
  dataFresh: true,
  symbolValid: true,
  timeframeValid: true,
  candleValid: true,
  candleConfirmed: true,
  sufficientHistory: true,
  indicatorsReady: true,
  strategiesReady: true,
  mandatoryConditions: true,
  minimumConfidence: true,
  minimumConfluence: true,
  strategyConflict: false,
  signalCooldown: false,
  duplicateSignal: false,
  analysisRunning: true,

  symbol: 'EURUSD_otc',
  timeframe: 60,
  candidateDirection: 'UP',
  actualConfidence: 92,
  selectedThreshold: 85,
  confirmingCount: 6,
  totalActiveCount: 8,
  minConfirmations: 3,
  candleDirection: 'BULLISH',
  candlePattern: 'Bullish Engulfing',
  isClosedCandle: true,
  analysisMode: 'CLOSED_CANDLE',
  secondsSinceLastTick: 0.5,
  maxDataFreshnessSeconds: 5,
  historyCandleCount: 100,
  requiredHistoryCount: 50,
};

// 1. All conditions pass -> UP signal confirmed
{
  const result = FinalSignalGate.evaluate({ ...baseInput });
  assert(result.decision === 'UP', 'All valid conditions produce UP signal');
  assert(result.allPassed === true, 'allPassed is true');
  assert(result.blockedReasons.length === 0, 'No blocked reasons');
  assert(result.primaryReason.includes('92% Confluence'), 'Reason contains confluence');
  assert(result.reasonCode === 'SETUP_CONFIRMED', 'reasonCode is SETUP_CONFIRMED');
}

// 2. 92% confidence but threshold is 95% -> WAIT with transparent explanation
{
  const result = FinalSignalGate.evaluate({
    ...baseInput,
    actualConfidence: 92,
    selectedThreshold: 95,
    minimumConfidence: false,
  });
  assert(result.decision === 'WAIT', 'Confidence below threshold produces WAIT');
  assert(result.allPassed === false, 'allPassed is false');
  assert(result.blockedReasons.length > 0, 'Has blocked reason');
  assert(
    result.blockedReasons[0].includes('Minimum confidence threshold not reached (92% < 95%'),
    'Explains 92% < 95% explicitly'
  );
  assert(result.reasonCode === 'CONFIDENCE_BELOW_THRESHOLD', 'Reason code matches');
}

// 3. 92% confidence and threshold is 85%, but candle still forming in CLOSED_CANDLE mode
{
  const result = FinalSignalGate.evaluate({
    ...baseInput,
    actualConfidence: 92,
    selectedThreshold: 85,
    isClosedCandle: false,
    candleConfirmed: false,
    analysisMode: 'CLOSED_CANDLE',
  });
  assert(result.decision === 'WAIT', 'Forming candle produces WAIT in CLOSED_CANDLE mode');
  assert(result.allPassed === false, 'allPassed is false');
  assert(
    result.blockedReasons.some((r) => r.includes('Current candle still forming (awaiting candle close')),
    'Explains awaiting candle close'
  );
  assert(result.reasonCode === 'AWAITING_CANDLE_CLOSE', 'Reason code is AWAITING_CANDLE_CLOSE');
}

// 4. Broker unauthenticated -> WAIT with UPSTREAM_AUTH_LOCKED
{
  const result = FinalSignalGate.evaluate({
    ...baseInput,
    authenticated: false,
    upstreamAuthReason: 'Socket awaiting authorization frame',
  });
  assert(result.decision === 'WAIT', 'Unauthenticated produces WAIT');
  assert(result.reasonCode === 'UPSTREAM_AUTH_LOCKED', 'Reason code is UPSTREAM_AUTH_LOCKED');
  assert(
    result.blockedReasons.some((r) => r.includes('Pocket Option session unauthenticated')),
    'Explains unauthenticated session'
  );
}

// 5. Stale market data -> WAIT with DATA_STALE
{
  const result = FinalSignalGate.evaluate({
    ...baseInput,
    dataFresh: false,
    secondsSinceLastTick: 12.4,
    maxDataFreshnessSeconds: 5,
  });
  assert(result.decision === 'WAIT', 'Stale data produces WAIT');
  assert(result.reasonCode === 'DATA_STALE', 'Reason code is DATA_STALE');
  assert(
    result.blockedReasons.some((r) => r.includes('12.4s ago')),
    'Includes exact tick latency'
  );
}

// 6. Insufficient history -> WAIT with INSUFFICIENT_HISTORY
{
  const result = FinalSignalGate.evaluate({
    ...baseInput,
    sufficientHistory: false,
    historyCandleCount: 12,
    requiredHistoryCount: 50,
  });
  assert(result.decision === 'WAIT', 'Insufficient history produces WAIT');
  assert(result.reasonCode === 'INSUFFICIENT_HISTORY', 'Reason code is INSUFFICIENT_HISTORY');
  assert(
    result.blockedReasons.some((r) => r.includes('12/50')),
    'Includes exact candle count'
  );
}

// 7. Strategy conflict -> WAIT with CONFLICT_DETECTED
{
  const result = FinalSignalGate.evaluate({
    ...baseInput,
    strategyConflict: true,
    conflictingDetails: ['RSI oversold opposes DOWN momentum'],
  });
  assert(result.decision === 'WAIT', 'Conflict produces WAIT');
  assert(result.reasonCode === 'CONFLICT_DETECTED', 'Reason code is CONFLICT_DETECTED');
}

// 8. Strategy not qualified -> WAIT with mandatory conditions blocker
{
  const result = FinalSignalGate.evaluate({
    ...baseInput,
    mandatoryConditions: false,
    strategyQualified: false,
    mandatoryFailedDetails: ['Mandatory condition failed: EMA Fast > Slow'],
  });
  assert(result.decision === 'WAIT', 'Unqualified strategy produces WAIT');
  assert(result.blockedReasons.some((r) => r.includes('Mandatory condition failed: EMA Fast > Slow')), 'Blocker cites mandatory condition explicitly');
  assert(result.reasonCode === 'MANDATORY_CONDITION_FAILED', 'Reason code is MANDATORY_CONDITION_FAILED');
}

// 9. High confidence setup with candle unconfirmed -> WAIT with transparent blocker
{
  const result = FinalSignalGate.evaluate({
    ...baseInput,
    candleConfirmed: false,
    isClosedCandle: false,
    analysisMode: 'CLOSED_CANDLE',
    supportingStrategies: ['EMA Trend Following', 'RSI Momentum'],
  });
  assert(result.decision === 'WAIT', 'Unconfirmed candle produces WAIT despite high confidence');
  assert(result.supportingStrategies.length === 2, 'Supporting strategies tracked transparently');
  assert(result.reasonCode === 'AWAITING_CANDLE_CLOSE', 'Reason code is AWAITING_CANDLE_CLOSE');
}

console.log('=== ALL FINAL SIGNAL GATE TESTS PASSED SUCCESSFULLY! ===');
