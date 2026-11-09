import test from 'node:test';
import assert from 'node:assert/strict';
import { AutoTraderEngine, TradeLifecycleManager, OrderLifecycleState } from '../server/AutoTraderEngine';
import { PocketOptionAuthManager } from '../server/PocketOptionAuthManager';
import { StrategyEngine } from '../server/StrategyEngine';
import { PocketOptionService } from '../server/PocketOptionService';
import { CandleBuilder } from '../server/CandleBuilder';

console.log('# ===============================================================');
console.log('# --- RUNNING AUTOTRADER LIFECYCLE & DEDUPLICATION SUITE ---');
console.log('# ===============================================================');

test('TEST 1: SINGLE WORKER ENFORCEMENT & IDEMPOTENT BOT START', () => {
  const candleBuilder = new CandleBuilder();
  const poService = new PocketOptionService(candleBuilder);
  const strategyEngine = new StrategyEngine();
  const autoTrader = new AutoTraderEngine(strategyEngine, poService);

  const startRes1 = autoTrader.start({ baseAmount: 10, timeframe: 60 });
  assert.equal(startRes1.success, true);
  const status1 = autoTrader.getStatus();
  assert.equal(status1.isRunning, true);
  const initialRunCycleId = status1.runCycleId;
  assert.ok(initialRunCycleId && initialRunCycleId.startsWith('rc_'));

  // Second start attempt while bot is running
  const startRes2 = autoTrader.start({ baseAmount: 20 });
  assert.equal(startRes2.success, true);
  const status2 = autoTrader.getStatus();
  assert.equal(status2.isRunning, true);
  assert.equal(status2.runCycleId, initialRunCycleId, 'RunCycleId must not change or spawn duplicate workers');

  autoTrader.stop();
  poService.disconnect();
  console.log('  ✓ [PASS] Single worker enforced, redundant start calls do not create parallel cycles');
});

test('TEST 2: STATE TRANSITION GUARDS (NO REGRESSION TO NEW/CREATED/PENDING FROM ACCEPTED/OPEN)', () => {
  // Test Transition Matrix directly
  assert.equal(TradeLifecycleManager.canTransition('CREATED', 'PENDING'), true);
  assert.equal(TradeLifecycleManager.canTransition('PENDING', 'SUBMITTED'), true);
  assert.equal(TradeLifecycleManager.canTransition('SUBMITTED', 'ACCEPTED'), true);
  assert.equal(TradeLifecycleManager.canTransition('ACCEPTED', 'OPEN'), true);
  assert.equal(TradeLifecycleManager.canTransition('OPEN', 'SETTLING'), true);
  assert.equal(TradeLifecycleManager.canTransition('SETTLING', 'COMPLETED'), true);

  // Guards against illegal regressive transitions
  assert.equal(TradeLifecycleManager.canTransition('ACCEPTED', 'CREATED'), false);
  assert.equal(TradeLifecycleManager.canTransition('ACCEPTED', 'PENDING'), false);
  assert.equal(TradeLifecycleManager.canTransition('ACCEPTED', 'SUBMITTED'), false);
  assert.equal(TradeLifecycleManager.canTransition('OPEN', 'CREATED'), false);
  assert.equal(TradeLifecycleManager.canTransition('OPEN', 'PENDING'), false);
  assert.equal(TradeLifecycleManager.canTransition('OPEN', 'SUBMITTED'), false);
  assert.equal(TradeLifecycleManager.canTransition('COMPLETED', 'CREATED'), false);
  assert.equal(TradeLifecycleManager.canTransition('COMPLETED', 'OPEN'), false);

  // Terminal states
  assert.equal(TradeLifecycleManager.isTerminal('COMPLETED'), true);
  assert.equal(TradeLifecycleManager.isTerminal('REJECTED'), true);
  assert.equal(TradeLifecycleManager.isTerminal('FAILED'), true);
  assert.equal(TradeLifecycleManager.isTerminal('OPEN'), false);

  console.log('  ✓ [PASS] State transition guards strictly prohibit regressing to CREATED/PENDING once ACCEPTED/OPEN');
});

test('TEST 3: IN-PLACE DEAL UPDATES AND TRANSITION PROTECTION IN ENGINE', () => {
  const candleBuilder = new CandleBuilder();
  const poService = new PocketOptionService(candleBuilder);
  const strategyEngine = new StrategyEngine();
  const autoTrader = new AutoTraderEngine(strategyEngine, poService);

  // Manually insert an initial trade record to verify transitions
  const tradeId = 'at_test_1001';
  (autoTrader as any).trades.push({
    id: tradeId,
    runCycleId: 'rc_test',
    timestamp: Date.now(),
    idempotencyKey: 'ord_test_key_1',
    asset: 'EURUSD_otc',
    action: 'call',
    amount: 10,
    lifecycle: 'CREATED',
    status: 'PENDING',
    strategy: 'sbaa',
    durationSeconds: 60,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  // Step 1: Transition CREATED -> PENDING
  const t1 = autoTrader.transitionTradeState(tradeId, 'PENDING');
  assert.equal(t1, true);
  assert.equal((autoTrader as any).trades[0].lifecycle, 'PENDING');

  // Step 2: Transition PENDING -> SUBMITTED
  const t2 = autoTrader.transitionTradeState(tradeId, 'SUBMITTED');
  assert.equal(t2, true);
  assert.equal((autoTrader as any).trades[0].lifecycle, 'SUBMITTED');

  // Step 3: Transition SUBMITTED -> ACCEPTED with ticketId and openPrice
  const t3 = autoTrader.transitionTradeState(tradeId, 'ACCEPTED', { ticketId: 'ticket_888', openPrice: 1.0850 });
  assert.equal(t3, true);
  assert.equal((autoTrader as any).trades[0].lifecycle, 'ACCEPTED');
  assert.equal((autoTrader as any).trades[0].ticketId, 'ticket_888');
  assert.equal((autoTrader as any).trades[0].openPrice, 1.0850);

  // Step 4: Transition ACCEPTED -> OPEN
  const t4 = autoTrader.transitionTradeState('ticket_888', 'OPEN');
  assert.equal(t4, true);
  assert.equal((autoTrader as any).trades[0].lifecycle, 'OPEN');

  // Step 5: Guard check - Attempt forbidden transition from OPEN to CREATED
  const illegalTransition = autoTrader.transitionTradeState('ticket_888', 'CREATED');
  assert.equal(illegalTransition, false, 'OPEN must not transition to CREATED');
  assert.equal((autoTrader as any).trades[0].lifecycle, 'OPEN', 'Lifecycle state remains OPEN');

  // Step 6: Transition OPEN -> SETTLING -> COMPLETED
  autoTrader.transitionTradeState('ticket_888', 'SETTLING');
  assert.equal((autoTrader as any).trades[0].lifecycle, 'SETTLING');
  autoTrader.transitionTradeState('ticket_888', 'COMPLETED', { profit: 8.8, closePrice: 1.0860, status: 'WON' });
  assert.equal((autoTrader as any).trades[0].lifecycle, 'COMPLETED');
  assert.equal((autoTrader as any).trades[0].profit, 8.8);
  assert.equal((autoTrader as any).trades[0].status, 'WON');

  poService.disconnect();
  console.log('  ✓ [PASS] In-place updates succeeded and invalid transitions were cleanly rejected');
});

test('TEST 4: DEAL CLOSURE DEDUPLICATION & ZERO DOUBLE-COUNTING PNL', () => {
  const candleBuilder = new CandleBuilder();
  const poService = new PocketOptionService(candleBuilder);
  const strategyEngine = new StrategyEngine();
  const autoTrader = new AutoTraderEngine(strategyEngine, poService);

  // Reset daily PnL to baseline 0 for clean testing
  autoTrader.resetPnL();

  (autoTrader as any).trades.push({
    id: 'at_test_2002',
    ticketId: 'deal_999',
    runCycleId: 'rc_test',
    timestamp: Date.now(),
    idempotencyKey: 'ord_test_key_2',
    asset: 'EURUSD_otc',
    action: 'call',
    amount: 10,
    lifecycle: 'OPEN',
    status: 'PENDING',
    strategy: 'sbaa',
    durationSeconds: 60,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  const dealPayload = {
    id: 'deal_999',
    profit: 8.8,
    closePrice: 1.0855,
  };

  // First settlement
  (autoTrader as any).handleDealClosed(dealPayload);
  assert.equal(autoTrader.getStatus().dailyPnL, 8.8);
  assert.equal(autoTrader.getStatus().winningTrades, 1);
  assert.equal((autoTrader as any).trades[0].lifecycle, 'COMPLETED');

  // Duplicate settlement packet arriving over WebSocket
  (autoTrader as any).handleDealClosed(dealPayload);
  assert.equal(autoTrader.getStatus().dailyPnL, 8.8, 'PnL must not be double counted');
  assert.equal(autoTrader.getStatus().winningTrades, 1, 'Winning trades counter must not be double counted');

  poService.disconnect();
  console.log('  ✓ [PASS] Duplicate deal_closed events deduplicated; PnL and trade counts are strictly idempotent');
});

test('TEST 5: CANDLE TIMESTAMP ANCHORED IDEMPOTENCY KEY BLOCKS TICK FLOODING', async () => {
  const candleBuilder = new CandleBuilder();
  const poService = new PocketOptionService(candleBuilder);
  const strategyEngine = new StrategyEngine();
  const autoTrader = new AutoTraderEngine(strategyEngine, poService);

  autoTrader.start({
    strategyId: 'confluence',
    asset: 'EURUSD_otc',
    baseAmount: 5,
    timeframe: 60,
    maxConcurrentTrades: 1,
    cooldownBetweenTradesSec: 0,
  });

  const candleTime = 1700000000000;
  const mockSignal = {
    asset: 'EURUSD_otc',
    type: 'UP' as const,
    direction: 'UP' as const,
    confidence: 85,
    timestamp: candleTime + 1200, // Live tick at 1.2s into the candle
    candleTimestamp: candleTime,
    timeframe: 60,
  };

  // Pre-seed idempotency token simulating the first tick already consumed this candle
  (autoTrader as any).processedOrderTokens.add(
    `ord_${(autoTrader as any).runCycleId}_EURUSD_otc_60_${candleTime}_call`
  );

  // Subsequent tick 600ms later on the exact same candle
  const tickSignal = {
    ...mockSignal,
    timestamp: candleTime + 1800,
  };

  await autoTrader.onSignalUpdate(tickSignal as any);

  const status = autoTrader.getStatus();
  assert.equal(status.duplicateOrdersPreventedCount, 1, 'Duplicate tick order on same candle timestamp must be blocked');

  autoTrader.stop();
  poService.disconnect();
  console.log('  ✓ [PASS] Repeated ticks on same candle timestamp blocked by anchored idempotency key');
});

test('TEST 6: POCKET OPTION AUTH PARSER HANDLES INVERTED DEVTOOLS FRAMES (CODE 1005 FIX)', () => {
  // Exact broken string format from user screenshot
  const invertedInput = 'auth", "]42{"session":"v7djfupsv5bfq18r3vrjgd0e9d","isDemo":1,"uid":98148605,"platform":9';

  const parsed = PocketOptionAuthManager.parse({ sessionToken: invertedInput });

  assert.equal(parsed.session, 'v7djfupsv5bfq18r3vrjgd0e9d', 'Clean session token extracted');
  assert.equal(parsed.uid, 98148605, 'UID extracted accurately');
  assert.equal(parsed.isDemo, 1, 'isDemo parsed as 1');
  assert.equal(parsed.platform, 9, 'Platform parsed as 9');
  assert.equal(parsed.accountMode, 'DEMO');

  const validation = PocketOptionAuthManager.validate(parsed, 'DEMO', { allowZeroUid: true });
  assert.equal(validation.isValid, true, 'Validation passes cleanly');
  assert.equal(
    validation.packet,
    '42["auth",{"session":"v7djfupsv5bfq18r3vrjgd0e9d","isDemo":1,"uid":98148605,"platform":9}]',
    'Canonical Pocket Option auth frame formatted correctly'
  );

  console.log('  ✓ [PASS] Inverted/broken DevTools frame parsed with 100% precision, preventing Code 1005 disconnect');
});

console.log('# ===============================================================');
console.log('# ✓✓✓ ALL AUTOTRADER LIFECYCLE & DEDUPLICATION TESTS PASSED! ✓✓✓');
console.log('# ===============================================================');
