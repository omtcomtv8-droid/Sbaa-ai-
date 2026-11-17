import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { AutoTraderEngine, AutoTraderTelegramNotifier } from '../server/AutoTraderEngine';
import { TelegramBotService } from '../server/services/TelegramBotService';

function generateCandles(count: number, startTsSec = 1794860000) {
  const candles = [];
  let price = 1.265;
  for (let i = 0; i < count; i++) {
    const delta = 0.0002;
    const open = price;
    const close = price + delta;
    candles.push({
      time: startTsSec + i * 60,
      open,
      high: Math.max(open, close) + 0.00008,
      low: Math.min(open, close) - 0.00005,
      close,
      volume: 100,
      isClosed: true,
    });
    price = close;
  }
  return candles;
}

async function runTests() {
  console.log('--- Running Telegram Auto-Trade Notification Verification Tests ---');

  const openedCalls: any[] = [];
  const closedCalls: any[] = [];
  const dealClosedListeners: ((deal: any) => void)[] = [];
  let shouldRejectDeal = false;

  const mockNotifier: AutoTraderTelegramNotifier = {
    async broadcastAutoTradeOpened(trade) {
      openedCalls.push(trade);
      return { success: true };
    },
    async broadcastAutoTradeClosed(trade) {
      closedCalls.push(trade);
      return { success: true };
    },
    setDisplayTimezone() {},
  };

  const candles = generateCandles(30);
  const mockPoService: any = {
    getDiagnostics: () => ({
      subsystems: { websocket: 'connected', auth: 'success' },
      account: { balance: 1500, isDemo: false },
      endpoint: 'wss://api-eu.po.market/socket.io/?EIO=4&transport=websocket',
      latencyMs: 12,
    }),
    getActiveAsset: () => 'GBPUSD_otc',
    getTimeframe: () => 60,
    isConnected: () => true,
    getAccountMode: () => 'REAL',
    getCandleCount: () => candles.length,
    onDealOpened: () => () => {},
    onDealClosed: (fn: (deal: any) => void) => {
      dealClosedListeners.push(fn);
      return () => {};
    },
    async openDeal(params: any) {
      if (shouldRejectDeal) {
        return { success: false, error: 'Rejected by test gate' };
      }
      // Exact entry timestamp corresponding to 12:57:04 UTC on 2026-11-16 (1794833824)
      return {
        success: true,
        requestId: 'req_real_999',
        deal: {
          id: 'PO_TICKET_887766',
          asset: params.asset,
          action: params.action,
          amount: params.amount,
          openPrice: 1.2715,
          openTime: 1794833824,
          closeTime: 1794833884,
        },
      };
    },
  };
  (mockPoService as any).authVerified = true;

  const mockStrategyEngine: any = {
    evaluateStrategiesOnCandles: () => [
      {
        strategyId: 'ema_crossover',
        strategyName: 'EMA 9/21/200 Crossover',
        signal: 'UP',
        dataValid: true,
        qualified: true,
        normalizedScore: 86,
        rawScore: 86,
        score: 86,
        confidence: 86,
      },
    ],
  };

  const mockCandleBuilder: any = {
    getClosedCandles: () => candles,
    getCandles: () => candles,
  };

  const engine = new AutoTraderEngine(
    mockStrategyEngine,
    mockPoService,
    undefined,
    undefined,
    undefined,
    mockCandleBuilder,
    false, // Do NOT pollute disk
    undefined,
    mockNotifier
  );

  engine.start({
    strategyId: 'ema_crossover',
    asset: 'GBPUSD_otc',
    timeframe: 60,
    baseAmount: 25,
    stopLoss: 200,
    takeProfit: 500,
    displayTimezone: 'UTC',
    cooldownBetweenTradesSec: 0,
  });

  // 1. Rejected order must NOT trigger Telegram notification (no fake alerts)
  const rejectEngine = new AutoTraderEngine(
    mockStrategyEngine,
    mockPoService,
    undefined,
    undefined,
    undefined,
    mockCandleBuilder,
    false,
    undefined,
    mockNotifier
  );
  rejectEngine.start({
    strategyId: 'ema_crossover',
    asset: 'GBPUSD_otc',
    timeframe: 60,
    baseAmount: 25,
    stopLoss: 200,
    takeProfit: 500,
    displayTimezone: 'UTC',
    cooldownBetweenTradesSec: 0,
  });

  shouldRejectDeal = true;
  await rejectEngine.onSignalUpdate({
    id: 'sig_reject_test',
    asset: 'GBPUSD_otc',
    timeframe: 60,
    type: 'UP',
    confidence: 86,
    timestamp: 1794833820000,
    strategies: mockStrategyEngine.evaluateStrategiesOnCandles(),
  } as any);
  assert.strictEqual(openedCalls.length, 0, 'Rejected trade must NOT notify Telegram');
  console.log('[PASS] 1. Rejected trade produced zero Telegram notifications (no fake trades)');

  // 2. Real accepted/opened deal must trigger broadcastAutoTradeOpened with exact asset, direction, and entry time
  shouldRejectDeal = false;
  await engine.onSignalUpdate({
    id: 'sig_open_test',
    asset: 'GBPUSD_otc',
    timeframe: 60,
    type: 'UP',
    confidence: 86,
    timestamp: 1794833820000,
    strategies: mockStrategyEngine.evaluateStrategiesOnCandles(),
  } as any);

  assert.strictEqual(openedCalls.length, 1, 'Accepted real trade must notify Telegram exactly once');
  assert.strictEqual(openedCalls[0].asset, 'GBPUSD_otc');
  assert.strictEqual(openedCalls[0].action, 'call');
  assert.strictEqual(openedCalls[0].amount, 25);
  assert.strictEqual(openedCalls[0].entryTimestampMs, 1794833824000);
  assert.strictEqual(openedCalls[0].openPrice, 1.2715);
  assert.strictEqual(openedCalls[0].ticketId, 'PO_TICKET_887766');
  assert.strictEqual(openedCalls[0].displayTimezone, 'UTC');
  console.log('[PASS] 2. Real AutoTrader trade forwarded exact asset, direction, price, ticket, and real entry time');

  // 3. Deal close triggers broadcastAutoTradeClosed with real PnL & close timestamp
  assert(dealClosedListeners.length > 0, 'Deal closed listener registered');
  for (const fn of dealClosedListeners) {
    fn({
      id: 'PO_TICKET_887766',
      asset: 'GBPUSD_otc',
      profit: 22.0,
      closePrice: 1.2722,
      closeTime: 1794833884,
    });
  }

  assert.strictEqual(closedCalls.length, 1, 'Closed trade must send settlement alert to Telegram');
  assert.strictEqual(closedCalls[0].profit, 22.0);
  assert.strictEqual(closedCalls[0].closeTimestampMs, 1794833884000);
  assert.strictEqual(closedCalls[0].closePrice, 1.2722);
  console.log('[PASS] 3. Closed AutoTrader deal forwarded exact settlement profit and close time');

  // 4. Verify TelegramBotService HTML message formatting & auto-enable on config save (isolated temp dir)
  const origCwd = process.cwd();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tg-test-'));
  const origFetch = globalThis.fetch;
  const sentPayloads: any[] = [];

  try {
    process.chdir(tmpDir);
    (globalThis as any).fetch = async (url: string, init?: any) => {
      if (String(url).includes('/getMe')) {
        return {
          json: async () => ({ ok: true, result: { username: 'TestUserBot', first_name: 'TestBot' } }),
        } as any;
      }
      if (String(url).includes('/sendMessage')) {
        sentPayloads.push(JSON.parse(init.body));
        return {
          json: async () => ({ ok: true, result: { message_id: 42 } }),
        } as any;
      }
      return { json: async () => ({ ok: true, result: [] }) } as any;
    };

    // Reset singleton cleanly for isolated temp dir test
    (TelegramBotService as any).instance = undefined;
    const tg = TelegramBotService.getInstance();
    const savedCfg = tg.saveConfig({
      botToken: '999999:FAKE_UNIT_TEST_TOKEN',
      chatId: '6793310668',
    });
    assert.strictEqual(savedCfg.enabled, true, 'Saving botToken + chatId must auto-enable Telegram bot');
    assert.strictEqual(savedCfg.displayTimezone, 'UTC+3', 'Default timezone must strictly be UTC+3');

    // Compute known timestamp: 09:57:04 UTC == 12:57:04 (UTC+3)
    const exactEntryMs = Date.UTC(2026, 10, 16, 9, 57, 4);
    const openRes = await tg.broadcastAutoTradeOpened({
      asset: 'GBPUSD_otc',
      action: 'call',
      amount: 25,
      entryTimestampMs: exactEntryMs,
      durationSeconds: 60,
      openPrice: 1.2715,
      strategy: 'EMA 9/21/200 Crossover',
      ticketId: 'PO_TICKET_887766',
    });

    assert.strictEqual(openRes.success, true);
    assert.strictEqual(sentPayloads.length, 1);
    const msgText = sentPayloads[0].text as string;
    assert(msgText.includes('GBPUSD_otc'), 'Message includes pair name');
    assert(msgText.includes('شراء (CALL ↑)'), 'Message includes CALL direction');
    assert(msgText.includes('12:57:04') && msgText.includes('(UTC+3)'), `Message includes exact UTC+3 entry time 12:57:04 (UTC+3), got: ${msgText}`);
    assert(msgText.includes('12:58:04') && msgText.includes('(UTC+3)'), 'Message includes exact UTC+3 expiry time 12:58:04 (UTC+3)');
    assert(msgText.includes('#PO_TICKET_887766'), 'Message includes real ticket ID');

    const closeRes = await tg.broadcastAutoTradeClosed({
      asset: 'GBPUSD_otc',
      action: 'call',
      amount: 25,
      profit: 22.0,
      entryTimestampMs: exactEntryMs,
      closeTimestampMs: exactEntryMs + 60000,
      openPrice: 1.2715,
      closePrice: 1.2722,
      ticketId: 'PO_TICKET_887766',
      dailyPnL: 22.0,
    });

    assert.strictEqual(closeRes.success, true);
    assert.strictEqual(sentPayloads.length, 2);
    assert(sentPayloads[1].text.includes('صفقة رابحة (+$22.00)'));
    assert(sentPayloads[1].text.includes('12:57:04'));
    assert(sentPayloads[1].text.includes('12:58:04'));
    assert(sentPayloads[1].text.includes('(UTC+3)'));
    console.log('[PASS] 4. TelegramBotService defaults to UTC+3 and formats real 12:57:04 (UTC+3) entry & settlement messages');
  } finally {
    // Stop polling worker before restoring environment
    const tgInst: any = (TelegramBotService as any).instance;
    if (tgInst && typeof tgInst.stopPolling === 'function') {
      tgInst.stopPolling();
    }
    (TelegramBotService as any).instance = undefined;
    globalThis.fetch = origFetch;
    process.chdir(origCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  console.log('ALL_TELEGRAM_AUTO_TRADE_TESTS_PASSED');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
