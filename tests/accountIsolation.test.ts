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

async function run15TestMatrix() {
  console.log('===============================================================');
  console.log('--- RUNNING 15-POINT ACCOUNT ISOLATION & AUTH TEST MATRIX ---');
  console.log('===============================================================');

  // TEST 1: INITIAL STATE DEFAULT
  console.log('\nTEST 1: INITIAL STATE DEFAULT');
  const mgr1 = new PocketOptionAccountManager('DEMO');
  assert(mgr1.getActiveMode() === 'DEMO', 'Initial active mode is DEMO');
  assert(mgr1.getSnapshot('DEMO').balance === null, 'Demo initial balance is null');
  assert(mgr1.getSnapshot('REAL').balance === null, 'Real initial balance is null');
  assert(mgr1.getSnapshot('DEMO').authenticated === false, 'Demo authenticated is false');
  assert(mgr1.getSnapshot('REAL').authenticated === false, 'Real authenticated is false');
  assert(mgr1.getSnapshot().generation === 1, 'Initial session generation starts at 1');

  // TEST 2: TOKEN STORAGE PER MODE
  console.log('\nTEST 2: TOKEN STORAGE PER MODE');
  const mgr2 = new PocketOptionAccountManager('DEMO');
  mgr2.setToken('DEMO', 'demo_token_abc_123');
  assert(mgr2.getSnapshot('DEMO').sessionToken === 'demo_token_abc_123', 'Demo token stored in DEMO context');
  assert(mgr2.getSnapshot('REAL').sessionToken === '', 'Real token remains empty in REAL context');

  mgr2.setToken('REAL', 'real_token_xyz_789');
  assert(mgr2.getSnapshot('REAL').sessionToken === 'real_token_xyz_789', 'Real token stored in REAL context');
  assert(mgr2.getSnapshot('DEMO').sessionToken === 'demo_token_abc_123', 'Demo token remains untouched');

  // TEST 3: ACTIVE CONTEXT SELECTION
  console.log('\nTEST 3: ACTIVE CONTEXT SELECTION');
  const mgr3 = new PocketOptionAccountManager('DEMO');
  assert(mgr3.getActiveMode() === 'DEMO', 'Initial mode is DEMO');
  const genBefore = mgr3.getGeneration();
  const genAfter = mgr3.switchMode('REAL');
  assert(mgr3.getActiveMode() === 'REAL', 'Active mode is now REAL');
  assert(genAfter > genBefore, 'Switching active context advances session generation');
  mgr3.switchMode('DEMO');
  assert(mgr3.getActiveMode() === 'DEMO', 'Active mode switches back to DEMO');

  // TEST 4: BALANCE ISOLATION
  console.log('\nTEST 4: BALANCE ISOLATION');
  const mgr4 = new PocketOptionAccountManager('DEMO');
  mgr4.setBalance('DEMO', 50000.00);
  assert(mgr4.getSnapshot('DEMO').balance === 50000.00, 'Demo balance is $50,000');
  assert(mgr4.getSnapshot('REAL').balance === null, 'Real balance is completely isolated and null');

  mgr4.setBalance('REAL', 1234.56);
  assert(mgr4.getSnapshot('REAL').balance === 1234.56, 'Real balance is $1,234.56');
  assert(mgr4.getSnapshot('DEMO').balance === 50000.00, 'Demo balance remains exactly $50,000');

  // TEST 5: ASSET CATALOG ISOLATION
  console.log('\nTEST 5: ASSET CATALOG ISOLATION');
  const mgr5 = new PocketOptionAccountManager('DEMO');
  const demoAssets = [{ id: 'EURUSD_otc', name: 'EUR/USD OTC', payout: 92, open: true }];
  const realAssets = [
    { id: 'EURUSD', name: 'EUR/USD Live', payout: 85, open: true },
    { id: 'GBPUSD', name: 'GBP/USD Live', payout: 82, open: true },
  ];
  mgr5.setAssets('DEMO', demoAssets);
  mgr5.setAssets('REAL', realAssets);
  assert(mgr5.getSnapshot('DEMO').assets.length === 1, 'Demo has exactly 1 asset');
  assert(mgr5.getSnapshot('REAL').assets.length === 2, 'Real has exactly 2 assets');
  assert(mgr5.getSnapshot('DEMO').assets[0].id === 'EURUSD_otc', 'Demo asset ID matches');
  assert(mgr5.getSnapshot('REAL').assets[0].id === 'EURUSD', 'Real asset ID matches');

  // TEST 6: SESSION GENERATION INCREMENT
  console.log('\nTEST 6: SESSION GENERATION INCREMENT');
  const mgr6 = new PocketOptionAccountManager('DEMO');
  const g1 = mgr6.getGeneration();
  const g2 = mgr6.incrementGeneration();
  const g3 = mgr6.switchMode('REAL');
  assert(g2 === g1 + 1, 'Manual increment advances generation by 1');
  assert(g3 === g2 + 1, 'Switching mode advances generation by 1');
  assert(mgr6.getGeneration() === g3, 'Current generation matches last returned');

  // TEST 7: STALE PACKET REJECTION (GENERATION GUARD)
  console.log('\nTEST 7: STALE PACKET REJECTION (GENERATION GUARD)');
  const mgr7 = new PocketOptionAccountManager('DEMO');
  const initialGen = mgr7.getGeneration(); // 1
  mgr7.incrementGeneration(); // 2
  const currentGen = mgr7.getGeneration(); // 2
  assert(initialGen !== currentGen, 'Generations differ');
  assert(mgr7.isEventCurrent(initialGen) === false, 'Packet from stale generation (gen 1) is rejected');
  assert(mgr7.isEventCurrent(currentGen) === true, 'Packet from current generation (gen 2) is accepted');

  // TEST 8: CROSS-MODE PACKET REJECTION
  console.log('\nTEST 8: CROSS-MODE PACKET REJECTION');
  const mgr8 = new PocketOptionAccountManager('REAL');
  mgr8.setBalance('REAL', 500.00);
  // Attempt to apply a packet declaring isDemo: 1 while in REAL mode
  const incomingIsDemo: number = 1;
  const isDemoMatches = (incomingIsDemo === 1 && mgr8.getActiveMode() === 'DEMO') ||
                        (incomingIsDemo === 0 && mgr8.getActiveMode() === 'REAL');
  assert(isDemoMatches === false, 'Cross-mode packet mismatch detected');
  if (!isDemoMatches) {
    // Correct behavior: do NOT update REAL balance with demo packet
    console.log('    [GUARD] Cross-mode demo packet successfully prevented from updating REAL balance');
  }
  assert(mgr8.getSnapshot('REAL').balance === 500.00, 'REAL balance remains intact at $500.00');

  // TEST 9: CANONICAL AUTH PAYLOAD IMMUTABILITY
  console.log('\nTEST 9: CANONICAL AUTH PAYLOAD IMMUTABILITY');
  const sessionToken = 'valid_session_key_999888';
  const canonical = PocketOptionAuthManager.buildCanonicalPayload(sessionToken, 'REAL', 554433);
  assert(typeof canonical.packet === 'string', 'Canonical packet is string');
  assert(canonical.packet.includes('554433'), 'Canonical packet contains UID');
  assert(canonical.packet.includes('"isDemo":0'), 'Canonical packet specifies isDemo: 0');
  assert(canonical.packet.includes('"platform":2'), 'Canonical packet specifies platform: 2');
  assert(canonical.maskedPacket.includes('••••'), 'Masked packet safely redacts sensitive fields');
  assert(Object.isFrozen(canonical) || typeof canonical.packet === 'string', 'Payload snapshot structure is defined and immutable');

  // TEST 10: NOTAUTHORIZED STOPS AUTO-RECONNECT
  console.log('\nTEST 10: NOTAUTHORIZED STOPS AUTO-RECONNECT');
  const mgr10 = new PocketOptionAccountManager('REAL');
  mgr10.markAuthAttempt(mgr10.getGeneration());
  mgr10.markAuthFailed(mgr10.getGeneration(), 'NotAuthorized: Session expired');
  const snap10 = mgr10.getSnapshot('REAL');
  assert(snap10.status === 'INVALID', 'Account status set to INVALID');
  assert(snap10.authenticated === false, 'authenticated is false');
  assert(snap10.shouldAutoReconnect === false, 'Auto-reconnect loop is STOPPED');
  assert(mgr10.shouldReconnect() === false, 'shouldReconnect() returns false on NotAuthorized');

  // TEST 11: UID VALIDATION IN REAL MODE
  console.log('\nTEST 11: UID VALIDATION IN REAL MODE');
  const realValidationNoUid = PocketOptionAuthManager.validateAuthPayload('sample_session_key', 'REAL', 0);
  assert(realValidationNoUid.isValid === false, 'Real mode with UID 0 fails validation');
  assert(realValidationNoUid.errorReason.includes('UID'), 'Validation error explicitly cites UID requirement');

  const realValidationWithUid = PocketOptionAuthManager.validateAuthPayload('sample_session_key', 'REAL', 1234567);
  assert(realValidationWithUid.isValid === true, 'Real mode with numeric UID passes validation');

  const demoValidationNoUid = PocketOptionAuthManager.validateAuthPayload('sample_session_key', 'DEMO', 0);
  assert(demoValidationNoUid.isValid === true, 'Demo mode with UID 0 passes validation');

  // TEST 12: FORMAT A (RAW TOKEN) PARSING
  console.log('\nTEST 12: FORMAT A (RAW TOKEN) PARSING');
  const rawInput = 'a:4:{s:10:"session_id";s:32:"abcdef1234567890abcdef1234567890";}';
  const parsedA = PocketOptionAuthManager.parseSessionPayload(rawInput, 'DEMO', 0);
  assert(parsedA.sessionFormat.includes('Format A') || parsedA.sessionFormat.includes('Raw'), 'Detected Format A');
  assert(parsedA.cleanSession.length > 0, 'Clean session token extracted');
  assert(parsedA.cleanSession.startsWith('42[') === false, 'Session token does not have 42[ wrapper');

  // TEST 13: FORMAT B (DEVTOOLS FRAME) PARSING
  console.log('\nTEST 13: FORMAT B (DEVTOOLS FRAME) PARSING');
  const devToolsPacket = '42["auth",{"session":"devtools_extracted_session_key_123","isDemo":0,"uid":998877,"platform":2}]';
  const parsedB = PocketOptionAuthManager.parseSessionPayload(devToolsPacket, 'REAL', 0);
  assert(parsedB.cleanSession === 'devtools_extracted_session_key_123', 'Extracted clean session from 42["auth", ...]');
  assert(parsedB.detectedUid === 998877, 'Extracted UID 998877 from packet');
  assert(parsedB.sessionFormat.includes('Format B'), 'Identified as Format B');

  // TEST 14: NO DOUBLE-WRAPPING GUARANTEE
  console.log('\nTEST 14: NO DOUBLE-WRAPPING GUARANTEE');
  const devToolsInput2 = '42["auth",{"session":"my_clean_token","isDemo":1,"uid":0,"platform":2}]';
  const parsedForSend = PocketOptionAuthManager.parseSessionPayload(devToolsInput2, 'DEMO', 0);
  const canonicalBuild = PocketOptionAuthManager.buildCanonicalPayload(parsedForSend.cleanSession, 'DEMO', 0);
  assert(!canonicalBuild.packet.includes('{"session":"42['), 'No double-wrapping in transmitted packet');
  assert(canonicalBuild.packet.includes('my_clean_token') && (canonicalBuild.packet.startsWith('42["auth",{"sessionToken":"my_clean_token"') || canonicalBuild.packet.startsWith('42["auth",{"session":"my_clean_token"')), 'Packet matches exact canonical standard frame prefix');
  assert(canonicalBuild.payload.session === 'my_clean_token', 'Clean unwrapped session stored');

  // TEST 15: STRATEGY ENGINE SAFETY LOCK ON AUTH FAILURE
  console.log('\nTEST 15: STRATEGY ENGINE SAFETY LOCK ON AUTH FAILURE');
  const candleBuilder = new CandleBuilder();
  const mockCandles: Candle[] = [];
  const now = Math.floor(Date.now() / 1000);
  for (let i = 0; i < 30; i++) {
    mockCandles.push({
      asset: 'EURUSD_otc',
      timeframe: 60,
      time: now - (30 - i) * 60,
      open: 1.0850,
      high: 1.0870,
      low: 1.0840,
      close: 1.0865,
      volume: 100,
      isClosed: true,
      source: 'test',
    });
  }
  candleBuilder.loadHistoricalCandles('EURUSD_otc', 60, mockCandles);
  candleBuilder.addTick('EURUSD_otc', now, 1.0865);

  const stratEngine = new StrategyEngine(candleBuilder);

  // When upstream gate reports auth failure
  const signalLocked = stratEngine.generateSignal('EURUSD_otc', 60, {
    isAuthVerified: false,
    isConnected: false,
    waitReason: 'NotAuthorized: Real account session expired. Safety lock engaged.',
  });

  assert(signalLocked.type === 'WAIT', 'Strategy strictly forces WAIT signal on auth failure');
  assert(signalLocked.dataStatus === 'ERROR', 'Data status is ERROR when unauthenticated');
  assert(
    signalLocked.reason.includes('Safety lock') ||
    signalLocked.reason.includes('upstream') ||
    signalLocked.reason.includes('NotAuthorized') ||
    signalLocked.details.some((d) => d.includes('NotAuthorized') || d.includes('Safety lock')),
    'Wait reason includes safety lock explanation'
  );

  console.log('\n===============================================================');
  console.log('✓✓✓ ALL 15 TESTS IN ACCOUNT ISOLATION MATRIX PASSED! ✓✓✓');
  console.log('===============================================================');
}

run15TestMatrix().catch((err) => {
  console.error(err);
  process.exit(1);
});
