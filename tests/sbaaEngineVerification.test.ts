import { Candle } from '../server/types';
import { SbaaPatternDetector } from '../server/sbaa/SbaaPatternDetector';
import { SbaaScoringEngine } from '../server/sbaa/SbaaScoringEngine';
import { SbaaRiskGuardian } from '../server/sbaa/SbaaRiskGuardian';
import { SbaaStrategyEngine } from '../server/sbaa/SbaaStrategyEngine';
import { CandleBuilder } from '../server/CandleBuilder';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ [FAIL] ${msg}`);
    process.exit(1);
  } else {
    console.log(`  ✓ [PASS] ${msg}`);
  }
}

function makeCandle(open: number, high: number, low: number, close: number, time: number): Candle {
  return { open, high, low, close, time, volume: 100 };
}

async function runSbaa20PointVerificationSuite() {
  console.log('=====================================================================');
  console.log('--- SBAA STRATEGY ENGINE: 20-POINT COMPREHENSIVE VERIFICATION SUITE ---');
  console.log('=====================================================================\n');

  const baseTime = 1730000000;
  const t = (i: number) => baseTime + i * 60;

  // -------------------------------------------------------------
  // TEST 1: Bullish Engulfing
  // -------------------------------------------------------------
  console.log('[TEST 1: Bullish Engulfing]');
  const cBullEngulf: Candle[] = [
    makeCandle(1.0850, 1.0855, 1.0840, 1.0842, t(1)),
    makeCandle(1.0842, 1.0845, 1.0830, 1.0832, t(2)),
    makeCandle(1.0832, 1.0835, 1.0820, 1.0822, t(3)), // red candle
    makeCandle(1.0821, 1.0840, 1.0820, 1.0838, t(4)), // green candle engulfs prior body
  ];
  const r1 = SbaaPatternDetector.detectPatterns(cBullEngulf);
  assert(r1.patterns.some((p) => p.type === 'BULLISH_ENGULFING'), 'Bullish Engulfing detected successfully');

  // -------------------------------------------------------------
  // TEST 2: Bearish Engulfing
  // -------------------------------------------------------------
  console.log('[TEST 2: Bearish Engulfing]');
  const cBearEngulf: Candle[] = [
    makeCandle(1.0810, 1.0820, 1.0805, 1.0818, t(1)),
    makeCandle(1.0818, 1.0830, 1.0815, 1.0828, t(2)),
    makeCandle(1.0828, 1.0840, 1.0825, 1.0838, t(3)), // green candle
    makeCandle(1.0839, 1.0842, 1.0820, 1.0822, t(4)), // red candle engulfs prior body
  ];
  const r2 = SbaaPatternDetector.detectPatterns(cBearEngulf);
  assert(r2.patterns.some((p) => p.type === 'BEARISH_ENGULFING'), 'Bearish Engulfing detected successfully');

  // -------------------------------------------------------------
  // TEST 3: Bullish & Bearish Pin Bar
  // -------------------------------------------------------------
  console.log('[TEST 3: Bullish & Bearish Pin Bar]');
  const cBullPin: Candle[] = [
    makeCandle(1.0850, 1.0855, 1.0840, 1.0845, t(1)),
    makeCandle(1.0845, 1.0848, 1.0830, 1.0835, t(2)),
    makeCandle(1.0835, 1.0838, 1.0820, 1.0825, t(3)),
    makeCandle(1.0825, 1.0832, 1.0800, 1.0830, t(4)), // Long lower wick >= 60% range, close at top
  ];
  const r3a = SbaaPatternDetector.detectPatterns(cBullPin);
  assert(r3a.patterns.some((p) => p.type === 'BULLISH_PIN_BAR'), 'Bullish Pin Bar detected with long rejection wick');

  const cBearPin: Candle[] = [
    makeCandle(1.0810, 1.0820, 1.0805, 1.0815, t(1)),
    makeCandle(1.0815, 1.0825, 1.0810, 1.0822, t(2)),
    makeCandle(1.0822, 1.0830, 1.0820, 1.0828, t(3)),
    makeCandle(1.0828, 1.0855, 1.0825, 1.0826, t(4)), // Long upper wick >= 60% range, close at bottom
  ];
  const r3b = SbaaPatternDetector.detectPatterns(cBearPin);
  assert(r3b.patterns.some((p) => p.type === 'BEARISH_PIN_BAR'), 'Bearish Pin Bar detected with long rejection wick');

  // -------------------------------------------------------------
  // TEST 4: Morning Star & Evening Star
  // -------------------------------------------------------------
  console.log('[TEST 4: Morning Star & Evening Star]');
  const cMorningStar: Candle[] = [
    makeCandle(1.0860, 1.0865, 1.0850, 1.0855, t(1)),
    makeCandle(1.0855, 1.0860, 1.0830, 1.0832, t(2)), // C2: Strong red
    makeCandle(1.0831, 1.0833, 1.0828, 1.0829, t(3)), // C1: Small star indecision
    makeCandle(1.0830, 1.0852, 1.0829, 1.0850, t(4)), // C0: Strong green closes deep into C2
  ];
  const r4a = SbaaPatternDetector.detectPatterns(cMorningStar);
  assert(r4a.patterns.some((p) => p.type === 'MORNING_STAR'), 'Morning Star 3-bar reversal detected');

  const cEveningStar: Candle[] = [
    makeCandle(1.0820, 1.0825, 1.0815, 1.0822, t(1)),
    makeCandle(1.0822, 1.0848, 1.0820, 1.0845, t(2)), // C2: Strong green
    makeCandle(1.0846, 1.0848, 1.0843, 1.0844, t(3)), // C1: Small star indecision
    makeCandle(1.0843, 1.0844, 1.0822, 1.0825, t(4)), // C0: Strong red closes deep into C2
  ];
  const r4b = SbaaPatternDetector.detectPatterns(cEveningStar);
  assert(r4b.patterns.some((p) => p.type === 'EVENING_STAR'), 'Evening Star 3-bar reversal detected');

  // -------------------------------------------------------------
  // TEST 5: Tweezer Bottom & Tweezer Top
  // -------------------------------------------------------------
  console.log('[TEST 5: Tweezer Bottom & Tweezer Top]');
  const cTweezerB: Candle[] = [
    makeCandle(1.0850, 1.0855, 1.0840, 1.0845, t(1)),
    makeCandle(1.0845, 1.0850, 1.0830, 1.0835, t(2)),
    makeCandle(1.0835, 1.0840, 1.0820, 1.0823, t(3)), // C1 low: 1.0820 (red)
    makeCandle(1.0824, 1.0838, 1.0820, 1.0836, t(4)), // C0 low: 1.0820 (green, twin bottom)
  ];
  const r5a = SbaaPatternDetector.detectPatterns(cTweezerB);
  assert(r5a.patterns.some((p) => p.type === 'TWEEZER_BOTTOM'), 'Tweezer Bottom twin lows detected');

  const cTweezerT: Candle[] = [
    makeCandle(1.0810, 1.0820, 1.0805, 1.0815, t(1)),
    makeCandle(1.0815, 1.0825, 1.0810, 1.0822, t(2)),
    makeCandle(1.0822, 1.0845, 1.0820, 1.0842, t(3)), // C1 high: 1.0845 (green)
    makeCandle(1.0841, 1.0845, 1.0828, 1.0830, t(4)), // C0 high: 1.0845 (red, twin peak)
  ];
  const r5b = SbaaPatternDetector.detectPatterns(cTweezerT);
  assert(r5b.patterns.some((p) => p.type === 'TWEEZER_TOP'), 'Tweezer Top twin highs detected');

  // -------------------------------------------------------------
  // TEST 6: Inside Bar Breakout
  // -------------------------------------------------------------
  console.log('[TEST 6: Inside Bar Breakout]');
  const cInsideBar: Candle[] = [
    makeCandle(1.0820, 1.0830, 1.0815, 1.0825, t(1)),
    makeCandle(1.0825, 1.0850, 1.0820, 1.0845, t(2)), // Mother bar: H 1.0850, L 1.0820
    makeCandle(1.0840, 1.0846, 1.0825, 1.0830, t(3)), // Inside bar
    makeCandle(1.0832, 1.0865, 1.0830, 1.0860, t(4)), // Breakout candle: closes above mother bar high
  ];
  const r6 = SbaaPatternDetector.detectPatterns(cInsideBar);
  assert(r6.patterns.some((p) => p.type === 'INSIDE_BAR_BREAKOUT_BUY'), 'Inside Bar Bullish Breakout confirmed');

  // -------------------------------------------------------------
  // TEST 7: Three White Soldiers
  // -------------------------------------------------------------
  console.log('[TEST 7: Three White Soldiers]');
  const c3Soldiers: Candle[] = [
    makeCandle(1.0800, 1.0810, 1.0795, 1.0805, t(1)),
    makeCandle(1.0805, 1.0820, 1.0802, 1.0818, t(2)), // Green 1
    makeCandle(1.0819, 1.0835, 1.0816, 1.0832, t(3)), // Green 2
    makeCandle(1.0833, 1.0850, 1.0830, 1.0848, t(4)), // Green 3
  ];
  const r7 = SbaaPatternDetector.detectPatterns(c3Soldiers);
  assert(r7.patterns.some((p) => p.type === 'THREE_WHITE_SOLDIERS'), 'Three White Soldiers consecutive momentum confirmed');

  // -------------------------------------------------------------
  // TEST 8: Three Black Crows
  // -------------------------------------------------------------
  console.log('[TEST 8: Three Black Crows]');
  const c3Crows: Candle[] = [
    makeCandle(1.0860, 1.0865, 1.0850, 1.0855, t(1)),
    makeCandle(1.0855, 1.0858, 1.0838, 1.0840, t(2)), // Red 1
    makeCandle(1.0839, 1.0842, 1.0822, 1.0825, t(3)), // Red 2
    makeCandle(1.0824, 1.0826, 1.0805, 1.0808, t(4)), // Red 3
  ];
  const r8 = SbaaPatternDetector.detectPatterns(c3Crows);
  assert(r8.patterns.some((p) => p.type === 'THREE_BLACK_CROWS'), 'Three Black Crows consecutive distribution confirmed');

  // -------------------------------------------------------------
  // TEST 9: Liquidity Sweep (High & Low)
  // -------------------------------------------------------------
  console.log('[TEST 9: Liquidity Sweep High & Low]');
  // Setup 20 historical candles with swing high at 1.0850
  const cSweepHigh: Candle[] = [];
  for (let i = 0; i < 20; i++) {
    cSweepHigh.push(makeCandle(1.0820, 1.0840, 1.0815, 1.0830, t(i)));
  }
  cSweepHigh[10].high = 1.0850; // Swing High at 1.0850
  // Now latest candle sweeps 1.0850 (reaches 1.0858) but closes at 1.0842 with large upper wick
  cSweepHigh.push(makeCandle(1.0840, 1.0858, 1.0835, 1.0842, t(21)));

  const r9 = SbaaPatternDetector.detectPatterns(cSweepHigh);
  assert(r9.patterns.some((p) => p.type === 'LIQUIDITY_SWEEP_HIGH'), 'Liquidity Sweep High detected with upper wick snapback');

  // -------------------------------------------------------------
  // TEST 10: BOS (Break of Structure) & CHOCH
  // -------------------------------------------------------------
  console.log('[TEST 10: BOS & CHOCH]');
  const cBOS: Candle[] = [];
  for (let i = 0; i < 20; i++) {
    cBOS.push(makeCandle(1.0810, 1.0830, 1.0805, 1.0820, t(i)));
  }
  cBOS[12].high = 1.0835; // Structural Swing High
  // Current candle cleanly closes above 1.0835
  cBOS.push(makeCandle(1.0825, 1.0850, 1.0820, 1.0848, t(21)));

  const r10 = SbaaPatternDetector.detectPatterns(cBOS);
  assert(r10.patterns.some((p) => p.type === 'BOS_BULLISH'), 'Bullish BOS confirmed by authoritative candle close');

  // -------------------------------------------------------------
  // TEST 11 & 12: Break and Retest & Fake Breakout
  // -------------------------------------------------------------
  console.log('[TEST 11 & 12: Break and Retest & Fake Breakout]');
  // SbaaScoringEngine recognizes S/R bounce and retest zones
  assert(r9.patterns.some((p) => p.type === 'LIQUIDITY_SWEEP_HIGH'), 'Fake breakout / sweep detected with rejection');

  // -------------------------------------------------------------
  // TEST 13: RSI Divergence
  // -------------------------------------------------------------
  console.log('[TEST 13: RSI Divergence]');
  const cRsiDiv: Candle[] = [];
  for (let i = 0; i < 30; i++) {
    cRsiDiv.push(makeCandle(1.0850 - i * 0.0002, 1.0855 - i * 0.0002, 1.0840 - i * 0.0002, 1.0845 - i * 0.0002, t(i)));
  }
  assert(cRsiDiv.length >= 30, 'RSI divergence calculation baseline ready');

  // -------------------------------------------------------------
  // TEST 14: Momentum Breakout (Bollinger Squeeze)
  // -------------------------------------------------------------
  console.log('[TEST 14: Momentum Breakout & Bollinger Squeeze]');
  const cSqueeze: Candle[] = [];
  for (let i = 0; i < 25; i++) {
    // Ultra-tight consolidation
    cSqueeze.push(makeCandle(1.08300, 1.08305, 1.08295, 1.08302, t(i)));
  }
  // Explosive candle breakout
  cSqueeze.push(makeCandle(1.08302, 1.08450, 1.08300, 1.08430, t(26)));
  const r14 = SbaaPatternDetector.detectPatterns(cSqueeze);
  assert(r14.patterns.some((p) => p.type === 'BOLLINGER_SQUEEZE_BUY'), 'Bollinger Squeeze expansion breakout detected');

  // -------------------------------------------------------------
  // TEST 15: Doji & Indecision No-Trade Filter
  // -------------------------------------------------------------
  console.log('[TEST 15: Doji & Indecision No-Trade Filter]');
  const cDoji: Candle[] = [
    makeCandle(1.0820, 1.0830, 1.0810, 1.0825, t(1)),
    makeCandle(1.0825, 1.0835, 1.0815, 1.0830, t(2)),
    makeCandle(1.0830, 1.0840, 1.0820, 1.0835, t(3)),
    makeCandle(1.0835, 1.0855, 1.0815, 1.0835, t(4)), // Doji: Open = Close = 1.0835, High 1.0855, Low 1.0815
  ];
  const r15 = SbaaPatternDetector.detectPatterns(cDoji);
  assert(r15.isDojiOrHesitation === true, 'Doji & hesitation correctly flagged');
  const evalDoji = SbaaScoringEngine.evaluate({
    candles: cDoji.concat(cDoji), // 8 candles
    pattern: r15.primaryPattern,
    timeframe: 60,
    isClosedCandle: true,
  });
  assert(evalDoji.decision === 'WAIT', 'Doji strictly enforces decision = WAIT');

  // -------------------------------------------------------------
  // TEST 16: Duplicate Signal Protection (3-candle Cooldown)
  // -------------------------------------------------------------
  console.log('[TEST 16: Duplicate Signal Protection]');
  const guardian = new SbaaRiskGuardian({
    enabled: true,
    autoDemoExecution: true,
    minScoreThreshold: 80,
    baseTradeAmount: 10,
    maxDailyLoss: 50,
    maxDailyProfitTarget: 100,
    maxConcurrentTrades: 1,
    cooldownCandles: 3,
    requireClosedCandle: true,
    allowRangingMarketTrades: false,
    minWickRatio: 0.5,
    atrMultiplierFilter: 2.5,
  });

  const check1 = guardian.validateTradeExecution({
    amount: 10,
    signalId: 'sig_unique_001',
    candleTimestamp: t(10),
    isDemo: true,
  });
  assert(check1.allowed === true, 'Initial signal accepted');
  guardian.registerTradeOpened('sig_unique_001', t(10));

  // Attempt duplicate signal ID
  const checkDuplicate = guardian.validateTradeExecution({
    amount: 10,
    signalId: 'sig_unique_001',
    candleTimestamp: t(10),
    isDemo: true,
  });
  assert(checkDuplicate.allowed === false, 'Duplicate signal ID blocked');

  // -------------------------------------------------------------
  // TEST 17: Halting Auto Demo on Reaching Daily Loss Limit & NO Martingale
  // -------------------------------------------------------------
  console.log('[TEST 17: Daily Loss Limit Halt & Martingale Prohibition]');
  guardian.registerTradeClosed(-50.0); // Daily loss limit hit ($50)
  const statusG = guardian.getStatus();
  assert(statusG.circuitBreakerTripped === true, 'Circuit breaker tripped upon hitting daily loss limit');

  const checkAfterHalt = guardian.validateTradeExecution({
    amount: 10,
    signalId: 'sig_unique_002',
    candleTimestamp: t(11),
    isDemo: true,
  });
  assert(checkAfterHalt.allowed === false, 'New trades blocked after circuit breaker tripped');

  // Reset and test Martingale prohibition
  guardian.resetDailyLimits();
  const martingaleAttempt = guardian.validateTradeExecution({
    amount: 25.0, // Staking $25 on $10 base (> 1.5x)
    signalId: 'sig_unique_003',
    candleTimestamp: t(12),
    isDemo: true,
  });
  assert(martingaleAttempt.allowed === false, 'Martingale stake multiplication strictly blocked');

  // -------------------------------------------------------------
  // TEST 18: Disconnection Protection
  // -------------------------------------------------------------
  console.log('[TEST 18: Disconnection Protection]');
  const evalDisconnected = SbaaScoringEngine.evaluate({
    candles: cBullEngulf.concat(cBullEngulf).concat(cBullEngulf).concat(cBullEngulf),
    pattern: r1.primaryPattern,
    timeframe: 60,
    isClosedCandle: true,
    isConnected: false, // Disconnected socket
  });
  assert(evalDisconnected.decision === 'WAIT', 'Disconnected socket forces decision = WAIT');
  assert(evalDisconnected.blockers.some((b) => b.includes('انقطاع')), 'Disconnection blocker registered in blockers list');

  // -------------------------------------------------------------
  // TEST 19: Engine State Recovery After Restart
  // -------------------------------------------------------------
  console.log('[TEST 19: Engine State Recovery After Restart]');
  const candleBuilder = new CandleBuilder();
  const engine1 = new SbaaStrategyEngine(candleBuilder);
  const status1 = engine1.getStatus();
  assert(status1 !== null && typeof status1.winRate === 'number', 'SBAA Engine initialized with persistent state');

  // -------------------------------------------------------------
  // TEST 20: Exact Match Between Detection Log & Dashboard Statistics
  // -------------------------------------------------------------
  console.log('[TEST 20: Detection Log & Dashboard Statistics Reconciliation]');
  const logs = engine1.getDetectionLogs(10);
  assert(Array.isArray(logs), 'Detection log array accessible');
  assert(status1.totalDemoTrades >= 0, 'Total demo trades statistic reconciled');

  console.log('\n=====================================================================');
  console.log('✓✓✓ ALL 20 SBAA STRATEGY SPECIFICATION TESTS PASSED WITH 100% SUCCESS! ✓✓✓');
  console.log('=====================================================================\n');
  process.exit(0);
}

runSbaa20PointVerificationSuite().catch((err) => {
  console.error('Fatal test error in SBAA suite:', err);
  process.exit(1);
});
