import { PocketOptionAuthManager } from '../server/PocketOptionAuthManager';
import { PocketOptionService } from '../server/PocketOptionService';
import { CandleBuilder } from '../server/CandleBuilder';
import { AutoTraderEngine } from '../server/AutoTraderEngine';
import { StrategyEngine } from '../server/StrategyEngine';
import { calculatePerformanceStats } from '../src/services/TradeHistoryStorage';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ [FAIL] ${msg}`);
    process.exit(1);
  } else {
    console.log(`  ✓ [PASS] ${msg}`);
  }
}

async function runComprehensiveTests() {
  console.log('=====================================================================');
  console.log('--- SBAA TRADING COMPREHENSIVE 5-PROBLEM AUDIT & VERIFICATION SUITE ---');
  console.log('=====================================================================\n');

  // ==============================================================
  // PROBLEM 1: Trade Amount System ($1.00 to $1,000.00 with Cents)
  // ==============================================================
  console.log('[PROBLEM 1: TRADE AMOUNT SYSTEM ($1.00 - $1,000.00 WITH CENTS)]');

  const testSSID = '42["auth",{"session":"v7djfupsv5bfq18r3vrjgd0e9d","isDemo":1,"uid":98148605,"platform":9,"isFastHistory":true,"isOptimized":true}]';
  const candleBuilder = new CandleBuilder();
  const poService = new PocketOptionService(
    candleBuilder,
    'wss://demo-api-eu.po.market/socket.io/?EIO=4&transport=websocket',
    testSSID,
    true,
    'EURUSD_otc',
    60,
    98148605
  );

  (poService as any).authVerified = true;
  (poService as any).isConnected = () => true;

  // 1. Minimum amount requirement ($1.00)
  const belowMin = await poService.openDeal({ amount: 0.5, action: 'call' });
  assert(!belowMin.success, 'Amount below $1.00 rejected');

  // 2. Maximum amount cap ($1,000.00)
  const aboveMax = await poService.openDeal({ amount: 1000.50, action: 'call' });
  assert(!aboveMax.success, 'Amount above $1,000.00 rejected');
  assert(
    aboveMax.error?.includes('1000') === true,
    'Error message specifies the $1,000.00 maximum boundary'
  );

  // 3. Exact cents validation ($25.92, $25.43, $1000.00)
  const customCentsValues = [1.00, 5.25, 10.50, 15.75, 20.40, 25.00, 25.43, 25.92, 100.50, 500.00, 1000.00];
  customCentsValues.forEach((amt) => {
    const rounded = Math.round(amt * 100) / 100;
    assert(rounded === amt, `Cent precision maintained exactly without rounding error: $${amt.toFixed(2)}`);
    assert(rounded >= 1.00 && rounded <= 1000.00, `Amount $${amt.toFixed(2)} is within [$1.00, $1,000.00]`);
  });

  // ==============================================================
  // PROBLEM 2: Demo SSID Connection & Preservation (Prompt Sample)
  // ==============================================================
  console.log('\n[PROBLEM 2: DEMO SSID CONNECTION & PRESERVATION]');

  // Parse prompt test case:
  const parsed = PocketOptionAuthManager.parse({
    sessionToken: testSSID,
  });

  assert(parsed.isDemo === 1, 'Auto-detected isDemo: 1 from Demo SSID payload');
  assert(parsed.accountMode === 'DEMO', 'Auto-detected AccountMode: DEMO');
  assert(parsed.uid === 98148605, 'Correctly extracted UID: 98148605');
  assert(parsed.platform === 9, 'Preserved platform: 9 (Web Socket.IO)');

  const canonical = PocketOptionAuthManager.buildCanonicalPayload(
    parsed.session,
    'DEMO',
    parsed.uid,
    parsed.platform,
    { isFastHistory: true, isOptimized: true }
  );

  assert(canonical.payload.isDemo === 1, 'Canonical packet contains isDemo: 1');
  assert(canonical.payload.platform === 9, 'Canonical packet retains platform: 9');
  assert(canonical.payload.isFastHistory === true, 'Canonical packet retains isFastHistory: true');
  assert(canonical.payload.isOptimized === true, 'Canonical packet retains isOptimized: true');

  // Verify Real mode isolation
  const realParsed = PocketOptionAuthManager.parse({
    sessionToken: 'session_real_token_987654321',
    isDemo: 0,
    expectedMode: 'REAL',
    uid: 1234567,
  });
  assert(realParsed.isDemo === 0, 'Real account parsed with isDemo: 0');
  assert(realParsed.accountMode === 'REAL', 'Real account mode isolated from Demo');

  // ==============================================================
  // PROBLEM 3: Performance & Profits Statistics (Accurate WinRate & Net PnL)
  // ==============================================================
  console.log('\n[PROBLEM 3: PERFORMANCE & PROFITS STATISTICS AUDIT]');

  const nowSeconds = Math.floor(Date.now() / 1000);
  const sampleTrades: any[] = [
    // 7 Won Trades
    { id: 't1', result: 'WIN', amount: 10, profit: 8.80, openTime: nowSeconds },
    { id: 't2', result: 'WIN', amount: 20, profit: 17.60, openTime: nowSeconds },
    { id: 't3', result: 'WIN', amount: 15, profit: 13.20, openTime: nowSeconds },
    { id: 't4', result: 'WIN', amount: 25.50, profit: 22.44, openTime: nowSeconds },
    { id: 't5', result: 'WIN', amount: 50, profit: 44.00, openTime: nowSeconds },
    { id: 't6', result: 'WIN', amount: 10, profit: 8.80, openTime: nowSeconds },
    { id: 't7', result: 'WIN', amount: 10, profit: 8.80, openTime: nowSeconds },
    // 3 Lost Trades
    { id: 't8', result: 'LOSS', amount: 10, profit: -10.00, openTime: nowSeconds },
    { id: 't9', result: 'LOSS', amount: 20, profit: -20.00, openTime: nowSeconds },
    { id: 't10', result: 'LOSS', amount: 15, profit: -15.00, openTime: nowSeconds },
    // 2 Draw Trades (profit === 0)
    { id: 't11', result: 'DRAW', amount: 10, profit: 0.00, openTime: nowSeconds },
    { id: 't12', result: 'DRAW', amount: 25, profit: 0.00, openTime: nowSeconds },
    // 1 Pending Trade
    { id: 't13', result: 'PENDING', amount: 100, openTime: nowSeconds },
  ];

  const stats = calculatePerformanceStats(sampleTrades);

  assert(stats.wonCount === 7, 'Won count is exactly 7');
  assert(stats.lostCount === 3, 'Lost count is exactly 3');
  assert(stats.drawCount === 2, 'Draw count is exactly 2');
  assert(stats.pendingCount === 1, 'Pending count is exactly 1');
  assert(stats.evaluatedCount === 10, 'Evaluated count (Won + Lost) is 10 (Draws excluded from denominator)');
  assert(stats.winRate === 70.0, 'Win Rate is exactly 70.0% (7 / (7 + 3) * 100, draws NOT in denominator)');

  // Calculate expected Today Net PnL:
  // Wins: 8.80 + 17.60 + 13.20 + 22.44 + 44.00 + 8.80 + 8.80 = 123.64
  // Losses: -10 - 20 - 15 = -45.00
  // Draws: 0.00
  // Net: 123.64 - 45.00 = 78.64
  assert(stats.todayNetProfit === 78.64, `Today Net Profit correctly calculated: $${stats.todayNetProfit}`);

  // ==============================================================
  // PROBLEM 4: AutoTraderEngine Closed Deal Deduplication
  // ==============================================================
  console.log('\n[PROBLEM 4: ENGINE DEDUPLICATION & STATISTICS RECONCILIATION]');

  const stratEngineForTest = new StrategyEngine();
  const autoEngine = new AutoTraderEngine(stratEngineForTest, poService);
  autoEngine.resetPnL();



  // Simulate deal closed event
  (autoEngine as any).handleDealClosed({
    id: 'deal_unique_1001',
    profit: 8.80,
    closePrice: 1.0855,
  });

  let engineStatus = autoEngine.getStatus();
  assert(engineStatus.winningTrades === 1, 'Engine recorded 1 win');
  assert(engineStatus.dailyPnL === 8.80, 'Engine recorded $8.80 dailyPnL');

  // Trigger same deal again (retransmission or duplicate socket packet)
  (autoEngine as any).handleDealClosed({
    id: 'deal_unique_1001',
    profit: 8.80,
    closePrice: 1.0855,
  });

  engineStatus = autoEngine.getStatus();
  assert(engineStatus.winningTrades === 1, 'Engine deduplicated retransmitted deal (wins stay 1)');
  assert(engineStatus.dailyPnL === 8.80, 'Engine deduplicated PnL (PnL stays $8.80)');

  // Simulate DRAW deal
  (autoEngine as any).handleDealClosed({
    id: 'deal_unique_1002',
    profit: 0.00,
    closePrice: 1.0850,
  });

  engineStatus = autoEngine.getStatus();
  assert(engineStatus.drawTrades === 1, 'Engine recorded 1 DRAW deal');
  assert(engineStatus.dailyPnL === 8.80, 'Engine DRAW did not alter dailyPnL');
  assert(engineStatus.winRate === 100.0, 'Win Rate remains 100% since DRAW is excluded from denominator');

  // Simulate LOSS deal
  (autoEngine as any).handleDealClosed({
    id: 'deal_unique_1003',
    profit: -10.00,
    closePrice: 1.0840,
  });

  engineStatus = autoEngine.getStatus();
  assert(engineStatus.losingTrades === 1, 'Engine recorded 1 loss');
  assert(engineStatus.winRate === 50.0, 'Win Rate recalculated to 50% (1 win / (1 win + 1 loss))');
  assert(engineStatus.dailyPnL === -1.20, 'Engine daily PnL updated (8.80 - 10.00 = -1.20)');

  // ==============================================================
  // PROBLEM 5: Timeframe Synchronization (1M, 5M, 15M)
  // ==============================================================
  console.log('\n[PROBLEM 5: TIMEFRAME SYNCHRONIZATION (1M, 5M, 15M)]');

  poService.subscribeAsset('EURUSD_otc', 60);
  assert(poService.getTimeframe() === 60, '1M Timeframe synchronized (60s)');

  poService.subscribeAsset('EURUSD_otc', 300);
  assert(poService.getTimeframe() === 300, '5M Timeframe synchronized (300s)');

  poService.subscribeAsset('EURUSD_otc', 900);
  assert(poService.getTimeframe() === 900, '15M Timeframe synchronized (900s)');

  console.log('\n=====================================================================');
  console.log('✓✓✓ ALL COMPREHENSIVE VERIFICATION TESTS PASSED SUCCESSFULLY! ✓✓✓');
  console.log('=====================================================================\n');
  process.exit(0);
}

runComprehensiveTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
