import test from 'node:test';
import assert from 'node:assert/strict';
import { Candle } from '../server/types';
import { AutoTraderEngine } from '../server/AutoTraderEngine';
import { StrategyEngine } from '../server/StrategyEngine';
import { PocketOptionService } from '../server/PocketOptionService';
import { CandleBuilder } from '../server/CandleBuilder';
import { SbaaStrategyEngine } from '../server/sbaa/SbaaStrategyEngine';

console.log('# ===============================================================');
console.log('# --- RUNNING MULTI-TRADE SEQUENTIAL EXECUTION VERIFICATION ---');
console.log('# ===============================================================');

function makeCandle(open: number, high: number, low: number, close: number, timeSec: number): Candle {
  return { open, high, low, close, time: timeSec, volume: 120, isClosed: true };
}

function buildBaselineCandles(count: number, startTimeSec: number, stepSec: number): Candle[] {
  const candles: Candle[] = [];
  for (let i = 0; i < count; i++) {
    const wave = Math.sin(i * 0.4) * 0.0006;
    const base = 1.085 + wave;
    candles.push(makeCandle(base, base + 0.0005, base - 0.0005, base + 0.0001, startTimeSec + i * stepSec));
  }
  return candles;
}

function configureConnectedBrokerMock(
  poService: PocketOptionService,
  opts?: {
    balance?: number;
    rejectNextOrder?: boolean;
    onOpenDealSent?: (payload: any, seq: number) => void;
  }
) {
  const sentPackets: string[] = [];
  let seq = 0;

  (poService as any).authVerified = true;
  (poService as any).subsystems.websocket = 'connected';
  (poService as any).subsystems.auth = 'success';
  (poService as any).subsystems.account = 'LIVE';
  (poService as any).accountManager.setCredentials({
    mode: 'REAL',
    sessionToken: 'test_real_session_123456',
    uid: 99887766,
    platform: 9,
  });
  (poService as any).accountManager.setAuthSuccess((poService as any).accountManager.getSessionGeneration(), 'REAL', 99887766);
  (poService as any).accountManager.updateBalance((poService as any).accountManager.getSessionGeneration(), 'REAL', opts?.balance ?? 500, 'USD');
  (poService as any).accountInfo = (poService as any).accountManager.buildAccountInfo();
  (poService as any).ws = {
    readyState: 1,
    send: (d: string) => sentPackets.push(d),
    removeAllListeners: () => {},
    on: () => {},
    close: () => {},
    terminate: () => {},
  };

  (poService as any).sendPacket = (data: string) => {
    sentPackets.push(data);
    if (data.startsWith('42["openOrder",')) {
      seq++;
      const jsonStr = data.slice('42["openOrder",'.length, -1);
      const parsed = JSON.parse(jsonStr);
      if (opts?.onOpenDealSent) {
        opts.onOpenDealSent(parsed, seq);
      } else if (opts?.rejectNextOrder) {
        setTimeout(() => {
          (poService as any).processDealFailure([{ requestId: parsed.requestId, error: 'Simulated rejection' }]);
        }, 10);
      } else {
        const dealId = `real_ticket_${seq}_${parsed.requestId}`;
        setTimeout(() => {
          (poService as any).processDealSuccess([
            {
              id: dealId,
              requestId: parsed.requestId,
              asset: parsed.asset,
              amount: parsed.amount,
              command: parsed.action,
              openPrice: 1.0855,
              openTimestamp: Math.floor(Date.now() / 1000),
              closeTimestamp: Math.floor(Date.now() / 1000) + parsed.time,
              percentProfit: 88,
            },
          ]);
        }, 10);
      }
    }
  };

  return { sentPackets, getOrderCount: () => seq };
}

test('TEST 1: PocketOptionService parses successcloseOrder, updateClosedDeals, binary attachment arrays & updateOpenedDeals', async () => {
  const candleBuilder = new CandleBuilder();
  const poService = new PocketOptionService(candleBuilder);
  const mock = configureConnectedBrokerMock(poService);

  const opened: any[] = [];
  const closed: any[] = [];
  poService.onDealOpened((d) => opened.push(d));
  poService.onDealClosed((d) => closed.push(d));

  // Simulate opening Deal #1 via Pocket Option 451 binary header + Buffer attachment array
  const reqId1 = 10001;
  (poService as any).pendingDealOrders.set(reqId1, {
    resolve: () => {},
    timer: setTimeout(() => {}, 5000),
    params: { asset: 'EURUSD_otc', amount: 10, action: 'call', time: 60, isDemo: 0, requestId: reqId1 },
  });
  const connId = 'conn_test_1';
  const gen = (poService as any).accountManager.getSessionGeneration();
  (poService as any).activeConnectionId = connId;

  (poService as any).handleBinaryHeader('451-["successopenOrder",{"_placeholder":true,"num":0}]', connId, gen);
  (poService as any).handleBinaryAttachment(
    Buffer.from(
      JSON.stringify([
        {
          id: 'po_deal_101',
          requestId: reqId1,
          asset: 'EURUSD_otc',
          amount: 10,
          command: 'call',
          openPrice: 1.0842,
          openTimestamp: Math.floor(Date.now() / 1000),
          closeTimestamp: Math.floor(Date.now() / 1000) + 60,
        },
      ])
    ),
    connId,
    gen
  );

  assert.equal(opened.length, 1, 'successopenOrder array unwrapping should emit onDealOpened');
  assert.equal(poService.getActiveDeals().length, 1);

  // Pre-session historical close pushed via updateClosedDeals must NOT emit onDealClosed
  (poService as any).handleEventPayload(
    'updateClosedDeals',
    [
      {
        id: 'old_hist_deal_999',
        asset: 'EURUSD_otc',
        amount: 5,
        profit: 4.4,
        openTimestamp: 1600000000,
        closeTimestamp: 1600000060,
      },
    ],
    connId,
    gen
  );
  assert.equal(closed.length, 0, 'Pre-session updateClosedDeals history must not emit live close events');
  assert.equal(poService.getDealsHistory().length, 1, 'Pre-session deal stored in history');

  // Close Deal #1 via 451-["successcloseOrder", ...] binary attachment array
  (poService as any).handleBinaryHeader('451-["successcloseOrder",{"_placeholder":true,"num":0}]', connId, gen);
  (poService as any).handleBinaryAttachment(
    Buffer.from(
      JSON.stringify([
        {
          id: 'po_deal_101',
          asset: 'EURUSD_otc',
          amount: 10,
          profit: 8.8,
          closePrice: 1.0849,
          closeTimestamp: Math.floor(Date.now() / 1000) + 60,
        },
      ])
    ),
    connId,
    gen
  );

  assert.equal(closed.length, 1, 'successcloseOrder binary array must emit onDealClosed');
  assert.equal(closed[0].id, 'po_deal_101');
  assert.equal(closed[0].profit, 8.8);
  assert.equal(poService.getActiveDeals().length, 0, 'Active deal removed upon closure');

  // Subsequent duplicate arrival in updateClosedDeals must be deduplicated
  (poService as any).handleEventPayload(
    'updateClosedDeals',
    [{ id: 'po_deal_101', asset: 'EURUSD_otc', amount: 10, profit: 8.8, closePrice: 1.0849 }],
    connId,
    gen
  );
  assert.equal(closed.length, 1, 'Duplicate close via updateClosedDeals must not double emit');

  // Verify updateOpenedDeals triggers 42["deals/load"] when an expired active deal is absent from open deals
  (poService as any).activeDeals.set('expired_missing_deal', {
    id: 'expired_missing_deal',
    ticketId: 'expired_missing_deal',
    asset: 'EURUSD_otc',
    amount: 10,
    closeTime: Math.floor(Date.now() / 1000) - 20,
  });
  (poService as any).handleEventPayload('updateOpenedDeals', [], connId, gen);
  assert.ok(mock.sentPackets.includes('42["deals/load"]'), 'Missing expired deal in updateOpenedDeals triggers deals/load');

  for (const [, p] of (poService as any).pendingDealOrders.entries()) {
    clearTimeout(p.timer);
  }
  poService.disconnect();
  console.log('  ✓ [PASS] PocketOptionService close & open-deals events and binary array payloads verified');
});

test('TEST 2: AutoTrader executes sequential Trade #1 -> Trade #2 -> Trade #3 across consecutive closed candles even with stale activeConfirmedSignal', async () => {
  const candleBuilder = new CandleBuilder();
  const poService = new PocketOptionService(candleBuilder);
  const strategyEngine = new StrategyEngine(candleBuilder);
  const sbaaEngine = new SbaaStrategyEngine(candleBuilder, poService);
  const autoTrader = new AutoTraderEngine(strategyEngine, poService, undefined, sbaaEngine, undefined, candleBuilder, false);

  const mock = configureConnectedBrokerMock(poService, { balance: 1000 });

  // Lower AutoTrader minSignalStrength slightly & disable slow hesitation? Wait: use fast evaluateSignal/pipeline by testing full onSignalUpdate!
  const baseSec = Math.floor(Date.now() / 1000) - 30 * 60;
  const candles = buildBaselineCandles(25, baseSec, 60);
  candleBuilder.loadHistoricalCandles('EURUSD_otc', 60, candles);

  autoTrader.resetPnL();
  autoTrader.start({
    strategyId: 'ema_trend',
    asset: 'EURUSD_otc',
    baseAmount: 10,
    timeframe: 60,
    maxConcurrentTrades: 1,
    cooldownBetweenTradesSec: 0,
    tradesBeforeRest: 20,
    minSignalStrength: 50,
  });

  // Patch strategyEngine.evaluateStrategiesOnCandles deterministically to return qualified setups on candles 26, 27, 28
  let currentDirection: 'UP' | 'DOWN' = 'UP';
  (strategyEngine as any).evaluateStrategiesOnCandles = () => [
    {
      strategyId: 'ema_trend',
      strategyName: 'EMA Trend',
      signal: currentDirection,
      score: 88,
      normalizedScore: 88,
      rawScore: 88,
      qualified: true,
      dataValid: true,
      reasons: ['EMA aligned'],
    },
  ];

  // Candle 1 closes
  const c1Time = baseSec + 25 * 60;
  candleBuilder.loadHistoricalCandles('EURUSD_otc', 60, [...candles, makeCandle(1.085, 1.086, 1.0848, 1.0858, c1Time)]);

  // Simulate StrategyEngine returning a signal anchored to C1 (which stays cached as activeConfirmedSignal)
  const signalFromC1: any = {
    id: `sig_${c1Time}`,
    asset: 'EURUSD_otc',
    symbol: 'EURUSD_otc',
    timeframe: 60,
    type: 'UP',
    direction: 'UP',
    confidence: 88,
    strength: 88,
    timestamp: c1Time * 1000,
    candleTimestamp: c1Time,
    dataStatus: 'LIVE',
    strategies: [
      {
        strategyId: 'ema_trend',
        strategyName: 'EMA Trend',
        signal: 'UP',
        score: 88,
        normalizedScore: 88,
        qualified: true,
        dataValid: true,
        reasons: ['EMA aligned'],
      },
    ],
  };

  await autoTrader.onSignalUpdate(signalFromC1);
  assert.equal(mock.getOrderCount(), 1, 'Trade #1 should be dispatched');
  assert.equal(autoTrader.hasActiveOpenTrade(), true, 'Trade #1 should be OPEN');

  // Settle Trade #1 via PocketOption successcloseOrder array payload
  const trade1 = autoTrader.getStatus().recentTrades[0];
  (poService as any).processDealClosed([{ id: trade1.ticketId, asset: 'EURUSD_otc', amount: 10, profit: 8.8, closePrice: 1.0861 }], false);
  assert.equal(autoTrader.hasActiveOpenTrade(), false, 'Trade #1 should now be COMPLETED');

  // Candle 2 closes, BUT upstream signal still carries STALE candleTimestamp from C1 (simulating unexpired activeConfirmedSignal!)
  const c2Time = c1Time + 60;
  currentDirection = 'DOWN';
  candleBuilder.loadHistoricalCandles('EURUSD_otc', 60, [
    ...candles,
    makeCandle(1.085, 1.086, 1.0848, 1.0858, c1Time),
    makeCandle(1.0858, 1.086, 1.0845, 1.0846, c2Time),
  ]);

  await autoTrader.onSignalUpdate(signalFromC1); // Deliberately pass stale C1 signal!
  assert.equal(mock.getOrderCount(), 2, 'Trade #2 MUST execute on Candle #2 even when upstream signal still carries C1 timestamp');
  assert.equal(autoTrader.hasActiveOpenTrade(), true, 'Trade #2 is now OPEN');

  // Settle Trade #2 via updateClosedDeals array payload
  const trade2 = autoTrader.getStatus().recentTrades[0];
  assert.notEqual(trade2.ticketId, trade1.ticketId);
  (poService as any).handleEventPayload(
    'updateClosedDeals',
    [{ id: trade2.ticketId, asset: 'EURUSD_otc', amount: 10, profit: 8.8, closePrice: 1.0842 }],
    (poService as any).activeConnectionId,
    (poService as any).accountManager.getSessionGeneration()
  );
  assert.equal(autoTrader.hasActiveOpenTrade(), false, 'Trade #2 settled via updateClosedDeals');

  // Candle 3 closes
  const c3Time = c2Time + 60;
  currentDirection = 'UP';
  candleBuilder.loadHistoricalCandles('EURUSD_otc', 60, [
    ...candles,
    makeCandle(1.085, 1.086, 1.0848, 1.0858, c1Time),
    makeCandle(1.0858, 1.086, 1.0845, 1.0846, c2Time),
    makeCandle(1.0846, 1.0859, 1.0844, 1.0857, c3Time),
  ]);

  await autoTrader.onSignalUpdate({ ...signalFromC1, candleTimestamp: c3Time, timestamp: c3Time * 1000 });
  assert.equal(mock.getOrderCount(), 3, 'Trade #3 MUST execute sequentially after Trade #2 settles');

  const finalStatus = autoTrader.getStatus();
  assert.equal(finalStatus.totalTrades, 3);
  assert.equal(finalStatus.winningTrades, 2);
  assert.equal(finalStatus.dailyPnL, 17.6);

  autoTrader.stop();
  poService.disconnect();
  console.log('  ✓ [PASS] Sequential multi-trade execution (#1 -> #2 -> #3) succeeded cleanly');
});

test('TEST 3: Missed broker close packet recovery unblocks Trade #2 and reconciles late broker close accurately', async () => {
  const candleBuilder = new CandleBuilder();
  const poService = new PocketOptionService(candleBuilder);
  const strategyEngine = new StrategyEngine(candleBuilder);
  const autoTrader = new AutoTraderEngine(strategyEngine, poService, undefined, undefined, undefined, candleBuilder, false);

  const mock = configureConnectedBrokerMock(poService, { balance: 1000 });
  const baseSec = Math.floor(Date.now() / 1000) - 30 * 60;
  const candles = buildBaselineCandles(25, baseSec, 60);
  candleBuilder.loadHistoricalCandles('EURUSD_otc', 60, candles);

  autoTrader.resetPnL();
  autoTrader.start({
    strategyId: 'ema_trend',
    asset: 'EURUSD_otc',
    baseAmount: 10,
    timeframe: 60,
    maxConcurrentTrades: 1,
    cooldownBetweenTradesSec: 0,
    tradesBeforeRest: 20,
    minSignalStrength: 50,
  });

  (strategyEngine as any).evaluateStrategiesOnCandles = () => [
    {
      strategyId: 'ema_trend',
      strategyName: 'EMA Trend',
      signal: 'UP',
      score: 85,
      normalizedScore: 85,
      qualified: true,
      dataValid: true,
      reasons: ['Trend'],
    },
  ];

  // Insert Trade #1 that expired 20s ago and had NO close packet received from broker
  const c1Time = baseSec + 25 * 60;
  const expiredCreatedAt = Date.now() - 80_000; // 60s expiry + 20s overdue
  (autoTrader as any).trades.push({
    id: 'at_missed_1',
    ticketId: 'missed_ticket_1',
    runCycleId: (autoTrader as any).runCycleId,
    timestamp: expiredCreatedAt,
    candleTimestamp: c1Time,
    idempotencyKey: `ord_${(autoTrader as any).runCycleId}_EURUSD_otc_60_${c1Time}_call`,
    asset: 'EURUSD_otc',
    action: 'call',
    amount: 10,
    lifecycle: 'OPEN',
    status: 'PENDING',
    strategy: 'ema_trend',
    durationSeconds: 60,
    createdAt: expiredCreatedAt,
    updatedAt: expiredCreatedAt,
  });
  (autoTrader as any).totalTrades = 1;

  // Before reconciliation, ensure activeDeals does not list it (server already settled it, packet dropped)
  assert.equal(autoTrader.hasActiveOpenTrade(), false, 'reconcileActiveTrades must auto-settle missed overdue trade');
  const settledTrade = (autoTrader as any).trades.find((t: any) => t.id === 'at_missed_1');
  assert.equal(settledTrade.lifecycle, 'COMPLETED');
  assert.equal(settledTrade.status, 'DRAW');
  assert.equal(autoTrader.getStatus().drawTrades, 1);

  // Now Trade #2 on Candle 2 should execute unblocked!
  const c2Time = c1Time + 60;
  candleBuilder.loadHistoricalCandles('EURUSD_otc', 60, [...candles, makeCandle(1.085, 1.086, 1.0848, 1.0859, c2Time)]);
  await autoTrader.onSignalUpdate({
    id: `sig_${c2Time}`,
    asset: 'EURUSD_otc',
    timeframe: 60,
    type: 'UP',
    direction: 'UP',
    confidence: 85,
    timestamp: c2Time * 1000,
    candleTimestamp: c2Time,
    dataStatus: 'LIVE',
    strategies: [{ strategyId: 'ema_trend', strategyName: 'EMA Trend', signal: 'UP', score: 85, normalizedScore: 85, qualified: true, dataValid: true, reasons: [] }],
  } as any);

  assert.equal(mock.getOrderCount(), 1, 'Trade #2 executed after missed-packet recovery');

  // If the delayed real close packet for missed_ticket_1 later arrives, it must update PnL accurately without leaving drawTrades inflated
  (autoTrader as any).handleDealClosed({ id: 'missed_ticket_1', asset: 'EURUSD_otc', profit: 8.8, closePrice: 1.0862 });
  assert.equal(autoTrader.getStatus().drawTrades, 0, 'Temporary auto-settle DRAW count replaced by actual WIN');
  assert.equal(autoTrader.getStatus().winningTrades, 1);
  assert.equal(autoTrader.getStatus().dailyPnL, 8.8);
  assert.equal(settledTrade.status, 'WON');

  autoTrader.stop();
  poService.disconnect();
  console.log('  ✓ [PASS] Missed close packet recovery & late reconciliation passed');
});

test('TEST 4: Pre-flight abort / broker rejection rolls back idempotency token so retry on same candle succeeds', async () => {
  const candleBuilder = new CandleBuilder();
  const poService = new PocketOptionService(candleBuilder);
  const strategyEngine = new StrategyEngine(candleBuilder);
  const autoTrader = new AutoTraderEngine(strategyEngine, poService, undefined, undefined, undefined, candleBuilder, false);

  const mock = configureConnectedBrokerMock(poService, { balance: 1000, rejectNextOrder: true });
  const baseSec = Math.floor(Date.now() / 1000) - 30 * 60;
  const candles = buildBaselineCandles(25, baseSec, 60);
  const c1Time = baseSec + 25 * 60;
  candleBuilder.loadHistoricalCandles('EURUSD_otc', 60, [...candles, makeCandle(1.085, 1.086, 1.0848, 1.0858, c1Time)]);

  autoTrader.resetPnL();
  autoTrader.start({
    strategyId: 'ema_trend',
    asset: 'EURUSD_otc',
    baseAmount: 10,
    timeframe: 60,
    maxConcurrentTrades: 1,
    cooldownBetweenTradesSec: 0,
    minSignalStrength: 50,
  });

  (strategyEngine as any).evaluateStrategiesOnCandles = () => [
    {
      strategyId: 'ema_trend',
      strategyName: 'EMA Trend',
      signal: 'UP',
      score: 90,
      normalizedScore: 90,
      qualified: true,
      dataValid: true,
      reasons: ['EMA'],
    },
  ];

  const sig: any = {
    id: `sig_${c1Time}`,
    asset: 'EURUSD_otc',
    timeframe: 60,
    type: 'UP',
    direction: 'UP',
    confidence: 90,
    timestamp: c1Time * 1000,
    candleTimestamp: c1Time,
    dataStatus: 'LIVE',
    strategies: [{ strategyId: 'ema_trend', strategyName: 'EMA Trend', signal: 'UP', score: 90, normalizedScore: 90, qualified: true, dataValid: true, reasons: [] }],
  };

  // 1st attempt is rejected by broker
  await autoTrader.onSignalUpdate(sig);
  assert.equal(mock.getOrderCount(), 1);
  assert.equal(autoTrader.getStatus().rejectedTradesCount, 1);

  // Immediately clearing backoff & switching broker mock to accept: same candle retry MUST NOT be blocked by stale idempotency token!
  (autoTrader as any).lastFailedOrderTime = 0;
  configureConnectedBrokerMock(poService, { balance: 1000, rejectNextOrder: false });

  await autoTrader.onSignalUpdate(sig);
  assert.equal(autoTrader.getStatus().acceptedTradesCount, 1, 'Retry on same candle succeeds after rejection rollback');

  autoTrader.stop();
  poService.disconnect();
  console.log('  ✓ [PASS] Idempotency rollback on rejection verified');
});
