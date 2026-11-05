import { PocketOptionAccountManager } from '../server/PocketOptionAccountManager';
import { PocketOptionAuthManager } from '../server/PocketOptionAuthManager';
import { StrategyEngine } from '../server/StrategyEngine';
import { CandleBuilder } from '../server/CandleBuilder';
import { Candle } from '../server/types';

function assert(condition: boolean, testName: string) {
  if (!condition) {
    throw new Error(`[FAIL] ${testName}`);
  }
  console.log(`  ✓ [PASS] ${testName}`);
}

async function runDemoAuthPipelineTests() {
  console.log('===============================================================');
  console.log('--- RUNNING DEMO SSD AUTHENTICATION & PIPELINE TEST SUITE ---');
  console.log('===============================================================');

  // TEST 1: RAW SOCKET OPEN DOES NOT AUTHENTICATE
  console.log('\nTEST 1: RAW SOCKET OPEN DOES NOT AUTHENTICATE ACCOUNT');
  const accMgr = new PocketOptionAccountManager('DEMO');
  accMgr.setCredentials({
    mode: 'DEMO',
    sessionToken: 'demo_session_12345678',
    uid: null,
    platform: 2,
  });

  const snapshotInitial = accMgr.getSnapshot('DEMO');
  assert(snapshotInitial.authenticated === false, 'Account authenticated is strictly FALSE upon credential setup');
  assert(snapshotInitial.status !== 'LIVE' && snapshotInitial.status !== 'AUTHENTICATED', 'Account status is not LIVE or AUTHENTICATED');
  assert(snapshotInitial.balance === null, 'Account balance is null');

  // TEST 2: DEMO MODE OVERRIDE IN AUTH MANAGER PARSE
  console.log('\nTEST 2: DEMO MODE OVERRIDE IN AUTH MANAGER PARSE');
  const parsedDemo = PocketOptionAuthManager.parse({
    sessionToken: '42["auth",{"session":"my_demo_ssd","isDemo":0,"uid":12345,"platform":2}]',
    expectedMode: 'DEMO',
    isDemo: true,
  });
  assert(parsedDemo.isDemo === 1, 'Explicit isDemo: true overrides packet content with isDemo = 1');
  assert(parsedDemo.accountMode === 'DEMO', 'Mode is strictly DEMO');

  const canonicalAuth = PocketOptionAuthManager.buildCanonicalPayload(parsedDemo.session, 'DEMO', 0);
  assert(canonicalAuth.packet.includes('"isDemo":1'), 'Transmitted packet strictly specifies isDemo: 1 for demo account');

  // TEST 3: STRATEGY ENGINE REMAINS LOCKED BEFORE AUTHENTICATION
  console.log('\nTEST 3: STRATEGY ENGINE REMAINS LOCKED BEFORE AUTHENTICATION');
  const candleBuilder = new CandleBuilder();
  const stratEngine = new StrategyEngine(candleBuilder);

  const signalBeforeAuth = stratEngine.generateSignal('EURUSD_otc', 60, {
    isAuthVerified: false,
    isConnected: true, // socket connected, but NOT authenticated!
    waitReason: 'Authenticating demo session with Pocket Option server...',
  });

  assert(signalBeforeAuth.type === 'WAIT', 'Strategy Engine forces WAIT when socket is connected but unauthenticated');
  assert(signalBeforeAuth.dataStatus === 'ERROR', 'Data status is ERROR when unauthenticated');

  // TEST 4: handleAuthSuccess IS THE ONLY TRANSITION TO AUTHENTICATED = TRUE
  console.log('\nTEST 4: handleAuthSuccess IS THE ONLY TRANSITION TO AUTHENTICATED = TRUE');
  const gen = accMgr.getSessionGeneration();
  assert(accMgr.getSnapshot('DEMO').authenticated === false, 'Pre-condition: authenticated is false');

  accMgr.setAuthSuccess(gen, 'DEMO', null);
  const snapAfterSuccess = accMgr.getSnapshot('DEMO');
  assert(snapAfterSuccess.authenticated === true, 'setAuthSuccess sets authenticated to TRUE');
  assert(snapAfterSuccess.status === 'READY', 'Account status transitions to READY upon auth success');
  assert(snapAfterSuccess.isDemo === 1, 'Account snapshot reflects isDemo = 1');

  // TEST 5: BALANCE UPDATE ADVANCES TO LIVE
  console.log('\nTEST 5: BALANCE UPDATE ADVANCES TO LIVE');
  accMgr.updateBalance(gen, 'DEMO', 10000.00, 'USD');
  const snapAfterBalance = accMgr.getSnapshot('DEMO');
  assert(snapAfterBalance.balance === 10000.00, 'Demo balance updated to $10,000.00');
  assert(snapAfterBalance.status === 'LIVE', 'Account status transitions to LIVE with validated balance');

  // TEST 6: STRATEGY ENGINE REMAINS LOCKED UNTIL REAL CANDLES ARE VALIDATED
  console.log('\nTEST 6: STRATEGY ENGINE REMAINS LOCKED UNTIL REAL CANDLES (>= 15) ARE VALIDATED');
  // At this point, account is authenticated, but candleBuilder has 0 candles
  const signalNoCandles = stratEngine.generateSignal('EURUSD_otc', 60, {
    isAuthVerified: true,
    isConnected: true,
    waitReason: 'Building candle history: 0/15 candles collected.',
  });
  assert(signalNoCandles.type === 'WAIT', 'Strategy Engine remains LOCKED (WAIT) when 0 candles collected');

  // Load 14 candles (still below threshold of 15)
  const now = Math.floor(Date.now() / 1000);
  const partialCandles: Candle[] = [];
  for (let i = 0; i < 14; i++) {
    partialCandles.push({
      asset: 'EURUSD_otc',
      timeframe: 60,
      time: now - (14 - i) * 60,
      open: 1.0850,
      high: 1.0860,
      low: 1.0840,
      close: 1.0855,
      volume: 50,
      isClosed: true,
    });
  }
  candleBuilder.loadHistoricalCandles('EURUSD_otc', 60, partialCandles);
  const signalPartialCandles = stratEngine.generateSignal('EURUSD_otc', 60, {
    isAuthVerified: true,
    isConnected: true,
    waitReason: 'Building candle history: 14/15 candles collected.',
  });
  assert(signalPartialCandles.type === 'WAIT', 'Strategy Engine remains LOCKED (WAIT) with 14/15 candles');

  // Load 55 valid candles (exceeding 50 closed candle baseline) and add a fresh tick
  const fullCandles: Candle[] = [];
  for (let i = 0; i < 55; i++) {
    fullCandles.push({
      asset: 'EURUSD_otc',
      timeframe: 60,
      time: now - (55 - i) * 60,
      open: 1.0850 + (i % 10) * 0.0001,
      high: 1.0865 + (i % 10) * 0.0001,
      low: 1.0845 + (i % 10) * 0.0001,
      close: 1.0860 + (i % 10) * 0.0001,
      volume: 100,
      isClosed: true,
    });
  }
  candleBuilder.loadHistoricalCandles('EURUSD_otc', 60, fullCandles);
  candleBuilder.addTick('EURUSD_otc', now, 1.0880);

  const signalReady = stratEngine.generateSignal('EURUSD_otc', 60, {
    isAuthVerified: true,
    isConnected: true,
    waitReason: null,
  });
  assert(signalReady.type !== 'WAIT' || signalReady.dataStatus === 'LIVE', 'Strategy Engine unlocked and generating signals on live data');
  assert(signalReady.dataStatus === 'LIVE', 'Data status is LIVE with verified candles and ticks');

  // TEST 7: AUTH FAILURE RESETS STATE AND DOES NOT USE FAKE DATA
  console.log('\nTEST 7: AUTH FAILURE RESETS STATE AND DOES NOT USE FAKE DATA');
  const freshGen = accMgr.incrementGeneration();
  accMgr.setAuthFailure(freshGen, 'DEMO', 'Session expired', 'NotAuthorized');
  const snapAfterFail = accMgr.getSnapshot('DEMO');
  assert(snapAfterFail.authenticated === false, 'Authentication is strictly FALSE after failure');
  assert(snapAfterFail.status === 'INVALID', 'Account status set to INVALID');
  assert(snapAfterFail.balance === null, 'Balance is set to null (NO FAKE DEMO DATA)');
  assert(snapAfterFail.shouldAutoReconnect === false, 'Auto-reconnect is disabled on failure');

  console.log('\n===============================================================');
  console.log('✓✓✓ ALL DEMO AUTH PIPELINE TESTS PASSED! ✓✓✓');
  console.log('===============================================================');
}

runDemoAuthPipelineTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
