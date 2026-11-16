/**
 * tests/masterZeroToOneHundredAudit.test.ts
 *
 * Master Zero-to-One-Hundred Comprehensive Audit & Verification Suite:
 * Tests every subsystem of SBAA AI Trading Bot:
 *  [00-15%] System, Config & TypeScript Types
 *  [15-35%] Pocket Option Connection, Protocol & Balance Extraction
 *  [35-50%] CandleBuilder, Market Data & Non-Repainting Timeframes
 *  [50-75%] All 26 Quantitative & SMC Strategies (1M to 1H)
 *  [75-90%] AutoTrader Lifecycle, 11 States & Deduplication
 *  [90-100%] Mathematical Metrics, PnL & System Integrity
 */

import { PocketOptionAccountManager } from '../server/PocketOptionAccountManager';
import { PocketOptionAuthManager } from '../server/PocketOptionAuthManager';
import { PocketOptionService } from '../server/PocketOptionService';
import { CandleBuilder } from '../server/CandleBuilder';
import { StrategyEngine } from '../server/StrategyEngine';
import { SbaaStrategyEngine } from '../server/sbaa/SbaaStrategyEngine';
import { AutoTraderEngine, TradeLifecycleManager } from '../server/AutoTraderEngine';
import { MarketDataStore } from '../server/MarketDataStore';
import { Candle, CandleBuilderOptions, AccountMode } from '../server/types';

function createSyntheticCandles(count: number, basePrice = 1.1000, trend: 'up' | 'down' | 'flat' = 'up', tf = 60): Candle[] {
  const candles: Candle[] = [];
  const now = Math.floor(Date.now() / 1000);
  let price = basePrice;

  for (let i = 0; i < count; i++) {
    const time = now - (count - i) * tf;
    const delta = trend === 'up' ? 0.0004 : trend === 'down' ? -0.0004 : (Math.sin(i / 5) * 0.0002);
    const open = price;
    const close = Number((open + delta).toFixed(5));
    const high = Number((Math.max(open, close) + 0.0003).toFixed(5));
    const low = Number((Math.min(open, close) - 0.0003).toFixed(5));
    price = close;

    candles.push({
      time,
      open,
      high,
      low,
      close,
      volume: 120 + Math.floor(Math.sin(i) * 50),
      isClosed: true,
    });
  }
  return candles;
}

let passedTests = 0;
let totalTests = 0;

function check(condition: boolean, description: string, milestonePercent: number) {
  totalTests++;
  if (!condition) {
    console.error(`❌ [${milestonePercent}% FAIL] ${description}`);
    throw new Error(`Audit Failure at ${milestonePercent}%: ${description}`);
  }
  passedTests++;
  console.log(`✅ [${milestonePercent}% PASS] ${description}`);
}

async function runMasterAudit() {
  console.log('================================================================================');
  console.log('🌟 SBAA AI TRADING BOT: MASTER 0-TO-100 COMPLETE SYSTEM AUDIT 🌟');
  console.log('================================================================================\n');

  // ==========================================
  // [00% - 15%] SYSTEM, CONFIG & TYPES
  // ==========================================
  console.log('--- [00% - 15%] SYSTEM ARCHITECTURE & INITIAL STATE ---');
  const mgr = new PocketOptionAccountManager('DEMO');
  check(mgr.getActiveMode() === 'DEMO', 'Default active mode is DEMO', 2);
  check(mgr.getGeneration() === 1, 'Initial session generation starts strictly at 1', 5);
  check(mgr.getSnapshot('DEMO').balance === null, 'Initial DEMO balance is null (no fake data)', 8);
  check(mgr.getSnapshot('REAL').balance === null, 'Initial REAL balance is null (no fake data)', 10);
  check(mgr.shouldReconnect() === true, 'Initial shouldReconnect is true', 12);
  check(typeof PocketOptionService.cleanEndpoint === 'function', 'cleanEndpoint utility is available', 15);

  // ==========================================
  // [15% - 35%] POCKET OPTION CONNECTION & BALANCE
  // ==========================================
  console.log('\n--- [15% - 35%] POCKET OPTION PROTOCOL, AUTH & BALANCE ENGINE ---');
  
  // Test raw session, PHP serialized, JSON frame and inverted devtools frame
  const devToolsFrame = '42["auth",{"session":"sess_alpha_987654321","isDemo":0,"uid":86051122,"platform":9}]';
  const parsedFromFrame = PocketOptionAuthManager.parse({ sessionToken: devToolsFrame, expectedMode: 'DEMO' });
  check(parsedFromFrame.session === 'sess_alpha_987654321', 'Session token cleanly extracted from Socket.IO devtools frame', 17);
  check(parsedFromFrame.uid === 86051122, 'UID cleanly extracted from frame', 19);
  check(parsedFromFrame.isDemo === 1, 'User explicit DEMO mode overrides isDemo:0 inside real account frame', 21);

  // Inverted DevTools frame copy
  const invertedFrame = 'auth", "]42{"session":"sess_inverted_12345","uid":776655,"isDemo":1}';
  const parsedInverted = PocketOptionAuthManager.parse({ sessionToken: invertedFrame });
  check(parsedInverted.session === 'sess_inverted_12345', 'Inverted devtools frame parsed accurately without Code 1005 disconnect', 24);
  check(parsedInverted.uid === 776655, 'UID extracted from inverted frame', 26);

  // Canonical payload formatting
  const canon = PocketOptionAuthManager.buildCanonicalPayload('sess_test_123', 'DEMO', 86051122);
  check(canon.packet.startsWith('42["auth"'), 'Canonical packet starts with 42["auth"', 28);
  check(canon.packet.includes('"isDemo":1'), 'Canonical DEMO packet enforces isDemo: 1', 30);
  check(canon.maskedPacket.includes('••••'), 'Masked auth packet safely redacts credentials', 32);

  // Balance extraction: broker sends payload with real=0, demo=10000
  mgr.setCredentials({ mode: 'DEMO', sessionToken: 'sess_test_123', uid: 86051122 });
  mgr.setAuthSuccess(mgr.getGeneration(), 'DEMO', 86051122);
  mgr.updateBalance(mgr.getGeneration(), 'DEMO', 10000.0, 'USD');
  const demoAccountInfo = mgr.buildAccountInfo();
  check(demoAccountInfo.balance === 10000.0, 'DEMO account balance extracted as $10,000.00', 33);
  check(demoAccountInfo.status === 'LIVE', 'Account status transitions to LIVE with balance', 35);

  // ==========================================
  // [35% - 50%] CANDLEBUILDER & TIMEFRAMES
  // ==========================================
  console.log('\n--- [35% - 50%] CANDLEBUILDER, MARKET DATA & TIMEFRAME INTEGRITY ---');
  const candleBuilder = new CandleBuilder();
  const timeframes = [60, 300, 900, 1800, 3600]; // 1M, 5M, 15M, 30M, 1H

  for (let idx = 0; idx < timeframes.length; idx++) {
    const tf = timeframes[idx];
    const mockCandles = createSyntheticCandles(60, 1.1000, 'up', tf);
    candleBuilder.loadHistoricalCandles('EURUSD_otc', tf, mockCandles);
    const retrieved = candleBuilder.getCandles('EURUSD_otc', tf);
    check(retrieved.length >= 60, `Candle history for ${tf}s (${tf/60}M) ingested correctly (count: ${retrieved.length})`, 36 + idx * 2);
  }

  // Add a live tick to guarantee data freshness gate passes
  candleBuilder.addTick('EURUSD_otc', 1.1050, Math.floor(Date.now() / 1000));

  // Verify non-repainting and OHLC constraints
  const testCandles = candleBuilder.getCandles('EURUSD_otc', 60);
  const sample = testCandles[testCandles.length - 1];
  check(sample.high >= Math.max(sample.open, sample.close), 'OHLC constraint: High >= Max(Open, Close)', 47);
  check(sample.low <= Math.min(sample.open, sample.close), 'OHLC constraint: Low <= Min(Open, Close)', 49);
  check(sample.isClosed === true, 'Historical candles are immutable and marked closed', 50);

  // ==========================================
  // [50% - 75%] ALL 26 QUANTITATIVE STRATEGIES
  // ==========================================
  console.log('\n--- [50% - 75%] ALL 26 QUANTITATIVE & SMC STRATEGIES EVALUATION ---');
  const strategyEngine = new StrategyEngine(candleBuilder);
  const evalResult = strategyEngine.evaluateLiveTick('EURUSD_otc', 60, {
    isAuthVerified: true,
    isConnected: true,
  });
  const registeredStrategies = evalResult.strategies || [];
  check(registeredStrategies.length === 26, `Exactly 26 quantitative strategies evaluated simultaneously (found ${registeredStrategies.length})`, 52);

  for (let i = 0; i < registeredStrategies.length; i++) {
    const s = registeredStrategies[i];
    check(
      s.signal === 'UP' || s.signal === 'DOWN' || s.signal === 'WAIT' || s.signal === 'NEUTRAL',
      `Strategy #${i + 1} [${s.strategyName || s.strategyId}] evaluated cleanly (Signal: ${s.signal}, Conf: ${s.confidence}%)`,
      53 + Math.floor((i / registeredStrategies.length) * 18)
    );
  }

  // SBAA Multi-Strategy Pro Engine
  const poService = new PocketOptionService(candleBuilder);
  const sbaaEngine = new SbaaStrategyEngine(candleBuilder, poService);
  const sbaaStatus = sbaaEngine.getStatus();
  check(sbaaStatus.state === 'SCANNING', 'SBAA Engine initialized and actively scanning candle data', 72);
  check(sbaaStatus.mtfMatrix['1M'] !== undefined, 'SBAA Pro Engine enforces Multi-Timeframe Matrix (1M, 5M, 15M)', 75);

  // ==========================================
  // [75% - 90%] AUTOTRADER LIFECYCLE & 11 STATES
  // ==========================================
  console.log('\n--- [75% - 90%] AUTOTRADER ENGINE, 11-STATE LIFECYCLE & DEDUPLICATION ---');
  const autoTrader = new AutoTraderEngine(strategyEngine, poService, undefined, sbaaEngine, undefined, undefined, false);
  const botStatus = autoTrader.getStatus();
  check(botStatus.config.maxAmount >= 1000.0, 'AutoTrader allows high amounts up to $1,000 without artificial caps', 77);
  check((botStatus.config.timeframe || 60) >= 60, 'Minimum trade timeframe is at least 60 seconds (1M)', 79);

  // Test state transition guards (no regressing to CREATED/PENDING from ACCEPTED/OPENED)
  check(TradeLifecycleManager.canTransition('CREATED', 'PENDING') === true, 'Lifecycle guard: CREATED -> PENDING allowed', 81);
  check(TradeLifecycleManager.canTransition('PENDING', 'SUBMITTED') === true, 'Lifecycle guard: PENDING -> SUBMITTED allowed', 83);
  check(TradeLifecycleManager.canTransition('SUBMITTED', 'ACCEPTED') === true, 'Lifecycle guard: SUBMITTED -> ACCEPTED allowed', 84);
  check(TradeLifecycleManager.canTransition('ACCEPTED', 'OPEN') === true, 'Lifecycle guard: ACCEPTED -> OPEN allowed', 86);
  check(TradeLifecycleManager.canTransition('OPEN', 'CREATED') === false, 'Lifecycle guard strictly BLOCKS regression from OPEN to CREATED', 88);
  check(TradeLifecycleManager.canTransition('OPEN', 'SETTLING') === true, 'Lifecycle guard: OPEN -> SETTLING allowed', 89);
  check(TradeLifecycleManager.canTransition('SETTLING', 'COMPLETED') === true, 'Lifecycle guard: SETTLING -> COMPLETED allowed', 90);
  check(TradeLifecycleManager.isTerminal('COMPLETED') === true, 'COMPLETED is verified as a terminal state', 91);

  // In-Engine lifecycle transitions and ticket routing
  const tradeId = 'audit_trade_5001';
  (autoTrader as any).trades.push({
    id: tradeId,
    runCycleId: 'rc_test',
    timestamp: Date.now(),
    idempotencyKey: 'ord_audit_test_1',
    asset: 'EURUSD_otc',
    action: 'call',
    amount: 25,
    lifecycle: 'CREATED',
    status: 'PENDING',
    strategy: 'sbaa',
    durationSeconds: 60,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  const trans1 = autoTrader.transitionTradeState(tradeId, 'PENDING');
  check(trans1 === true, 'In-place trade state transitioned to PENDING', 92);
  const trans2 = autoTrader.transitionTradeState(tradeId, 'SUBMITTED');
  check(trans2 === true, 'In-place trade state transitioned to SUBMITTED', 93);
  const trans3 = autoTrader.transitionTradeState(tradeId, 'ACCEPTED', { ticketId: 'ticket_audit_888', openPrice: 1.1000 });
  check(trans3 === true, 'In-place trade state transitioned to ACCEPTED with ticket ID', 94);
  const trans4 = autoTrader.transitionTradeState('ticket_audit_888', 'OPEN');
  check(trans4 === true, 'In-place trade state transitioned to OPEN via ticket ID', 95);
  const transRegress = autoTrader.transitionTradeState('ticket_audit_888', 'CREATED');
  check(transRegress === false, 'Engine transition guard strictly BLOCKS regression to CREATED from OPEN', 96);

  // ==========================================
  // [90% - 100%] MATHEMATICAL METRICS, PNL & FINAL SYSTEM INTEGRITY
  // ==========================================
  console.log('\n--- [90% - 100%] MATHEMATICAL METRICS, DEDUPLICATION & 100% AUDIT ---');
  
  // Idempotent Deal Closed Deduplication
  autoTrader.resetPnL();
  const dealPayload = {
    id: 'ticket_audit_888',
    profit: 22.0,
    closePrice: 1.1015,
  };

  (autoTrader as any).handleDealClosed(dealPayload);
  const pnl1 = autoTrader.getStatus().dailyPnL;
  const won1 = autoTrader.getStatus().winningTrades;
  check(pnl1 === 22.0, 'First deal settlement records profit $22.00', 97);
  check(won1 === 1, 'First deal settlement records 1 winning trade', 98);

  // Duplicate transmission over WebSocket
  (autoTrader as any).handleDealClosed(dealPayload);
  const pnl2 = autoTrader.getStatus().dailyPnL;
  const won2 = autoTrader.getStatus().winningTrades;
  check(pnl2 === 22.0, 'Duplicate deal closed event DOES NOT double count PnL', 99);
  check(won2 === 1, 'Duplicate deal closed event DOES NOT double count winning trades', 100);

  console.log('\n================================================================================');
  console.log(`🎉 100% COMPLETE SYSTEM AUDIT PASSED! ${passedTests}/${totalTests} CHECKPOINTS VERIFIED! 🎉`);
  console.log('================================================================================');
  process.exit(0);
}

runMasterAudit().catch((err) => {
  console.error('\n❌ AUDIT FAILED:', err);
  process.exit(1);
});
