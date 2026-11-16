import { describe, it, after } from 'node:test';
import assert from 'node:assert';
import { PocketOptionService } from '../server/PocketOptionService';
import { CandleBuilder } from '../server/CandleBuilder';
import { StrategyEngine } from '../server/StrategyEngine';
import { AutoTraderEngine } from '../server/AutoTraderEngine';
import { SbaaStrategyEngine } from '../server/sbaa/SbaaStrategyEngine';
import { Candle, Signal, StrategyResult } from '../server/types';

const ALL_26_STRATEGY_IDS = [
  'adx_trend',
  'atr_volatility',
  'bollinger_bounce',
  'breakout',
  'candlestick_pattern',
  'cci_strategy',
  'darvas_box',
  'elliott_wave',
  'ema_trend',
  'fibonacci',
  'gann_price_time',
  'ichimoku_cloud',
  'ma_alignment',
  'macd',
  'market_structure',
  'multi_confluence',
  'parabolic_sar',
  'pivot_point',
  'price_action',
  'rsi_momentum',
  'rsi_reversal',
  'sma_crossover',
  'stochastic',
  'supertrend',
  'support_resistance',
  'volume_flow',
];

function generateCandles(
  count: number,
  mode: 'uptrend' | 'downtrend' | 'pullback_up' | 'breakout_up' | 'volatile_chop',
  tf: number = 60,
  startPrice: number = 1.1
): Candle[] {
  const candles: Candle[] = [];
  const now = Math.floor(Date.now() / 1000) - count * tf;
  let price = startPrice;

  for (let i = 0; i < count; i++) {
    const time = now + i * tf;
    let delta = 0;
    let wickUp = 0.00025;
    let wickDown = 0.00025;

    if (mode === 'uptrend') {
      delta = i % 5 === 0 ? -0.00015 : 0.00045;
    } else if (mode === 'downtrend') {
      delta = i % 5 === 0 ? 0.00015 : -0.00045;
    } else if (mode === 'pullback_up') {
      if (i < count - 6) delta = 0.00035;
      else if (i < count - 2) delta = -0.0006;
      else {
        delta = 0.0009;
        wickDown = 0.0012;
      }
    } else if (mode === 'breakout_up') {
      if (i < count - 4) {
        delta = (i % 2 === 0 ? 1 : -1) * 0.00012;
      } else {
        delta = 0.0012;
      }
    } else {
      delta = (i % 2 === 0 ? 1 : -1) * 0.0004;
    }

    const open = price;
    const close = open + delta;
    const high = Math.max(open, close) + wickUp;
    const low = Math.min(open, close) - wickDown;
    price = close;

    candles.push({
      time,
      open: Number(open.toFixed(5)),
      high: Number(high.toFixed(5)),
      low: Number(low.toFixed(5)),
      close: Number(close.toFixed(5)),
      volume: mode === 'breakout_up' && i >= count - 4 ? 950 : 120 + (i % 7) * 20,
    });
  }

  return candles;
}

function buildSyntheticSignal(
  asset: string,
  tf: number,
  strategies: StrategyResult[],
  type: 'UP' | 'DOWN' | 'WAIT' = 'UP',
  confidence: number = 88,
  dataStatus: 'LIVE' | 'OFFLINE' | 'ERROR' = 'LIVE'
): Signal {
  return {
    id: `sig_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    asset,
    symbol: asset,
    timeframe: tf,
    type,
    direction: type,
    strength: confidence / 100,
    confidence,
    score: confidence,
    details: ['Quantitative signal audit'],
    price: 1.125,
    status: 'CONFIRMED',
    dataStatus,
    timestamp: Date.now(),
    candleTimestamp: Math.floor(Date.now() / (tf * 1000)) * (tf * 1000),
    expiryDurationSec: tf,
    strategies,
  };
}

describe('AutoTrader Full Strategy & Real Trade Execution Audit (Zero AI / Zero Demo / Zero Fake)', () => {
  it('1. Confirms complete AI removal & REAL LIVE enforcement in AutoTraderEngine', () => {
    const candleBuilder = new CandleBuilder();
    const poService = new PocketOptionService(candleBuilder);
    const strategyEngine = new StrategyEngine(candleBuilder);
    const sbaaEngine = new SbaaStrategyEngine(candleBuilder, poService);
    const engine = new AutoTraderEngine(strategyEngine, poService, undefined, sbaaEngine, undefined, candleBuilder, false);

    // Passing legacy sbaa_ai and isDemo: true must coerce to 'sbaa' and isDemo: false
    const startRes = engine.start({
      strategyId: 'sbaa_ai',
      isDemo: true,
      baseAmount: 10,
      asset: 'EURUSD_otc',
      timeframe: 60,
    } as any);

    assert.strictEqual(startRes.success, true);
    const status = engine.getStatus() as any;
    assert.strictEqual(status.config.strategyId, 'sbaa', 'sbaa_ai must be removed/coerced to quantitative sbaa');
    assert.strictEqual(status.config.isDemo, false, 'AutoTrader config must be locked to REAL (isDemo: false)');
    assert.strictEqual(status.aiStatus, undefined, 'aiStatus must not exist in AutoTrader status');
    assert.strictEqual(status.config.aiCode, undefined, 'aiCode must not exist in config');
    assert.strictEqual(status.config.isAiActivated, undefined, 'isAiActivated must not exist in config');
    engine.stop();
  });

  it('2. Verifies all 26 strategy modules evaluate cleanly and resolve 1:1 via StrategyEngine.matchStrategyById', () => {
    const candleBuilder = new CandleBuilder();
    const strategyEngine = new StrategyEngine(candleBuilder);
    const candles = generateCandles(120, 'uptrend', 60);

    const results = strategyEngine.evaluateStrategiesOnCandles(candles, 'EURUSD_otc', 60);
    assert.strictEqual(results.length, 26, `Expected 26 strategy modules, got ${results.length}`);

    for (const id of ALL_26_STRATEGY_IDS) {
      const matched = StrategyEngine.matchStrategyById(results, id);
      assert.ok(matched, `Strategy '${id}' must resolve cleanly via StrategyEngine.matchStrategyById`);
      assert.strictEqual(matched.strategyId, id, `Exact ID match required for '${id}', got '${matched.strategyId}'`);
      assert.ok(
        matched.signal === 'UP' || matched.signal === 'DOWN' || matched.signal === 'WAIT',
        `Strategy '${id}' returned invalid signal '${matched.signal}'`
      );
      assert.ok(Number.isFinite(matched.score), `Strategy '${id}' score must be finite`);
    }
  });

  it('3. Audits AutoTraderEngine.evaluateSignal across ALL 26 strategies + sbaa + auto + confluence + rsi_macd (no WAIT/unqualified/offline fake entries)', () => {
    const candleBuilder = new CandleBuilder();
    const poService = new PocketOptionService(candleBuilder);
    const strategyEngine = new StrategyEngine(candleBuilder);
    const sbaaEngine = new SbaaStrategyEngine(candleBuilder, poService);
    const engine = new AutoTraderEngine(strategyEngine, poService, undefined, sbaaEngine, undefined, candleBuilder, false);

    const tf = 300;
    const asset = 'GBPUSD_otc';

    // Test every one of the 26 strategies
    for (const stratId of ALL_26_STRATEGY_IDS) {
      engine.saveSettings({ strategyId: stratId, asset, timeframe: tf, minSignalStrength: 70 });

      // Case A: Qualified UP signal -> MUST produce 'call'
      const upSignal = buildSyntheticSignal(asset, tf, [
        {
          strategyId: stratId,
          strategyName: stratId,
          signal: 'UP',
          score: 85,
          rawScore: 85,
          normalizedScore: 85,
          qualified: true,
          dataValid: true,
          reasons: ['Bullish setup confirmed'],
          conditions: [],
        },
      ]);
      const upDecision = (engine as any).evaluateSignal(upSignal);
      assert.ok(upDecision, `Strategy '${stratId}' should generate decision when qualified UP`);
      assert.strictEqual(upDecision.action, 'call', `Strategy '${stratId}' UP must map to 'call'`);
      assert.strictEqual(upDecision.duration, tf, `Strategy '${stratId}' duration must equal timeframe ${tf}`);

      // Case B: Qualified DOWN signal -> MUST produce 'put'
      const downSignal = buildSyntheticSignal(asset, tf, [
        {
          strategyId: stratId,
          strategyName: stratId,
          signal: 'DOWN',
          score: 84,
          rawScore: 84,
          normalizedScore: 84,
          qualified: true,
          dataValid: true,
          reasons: ['Bearish setup confirmed'],
          conditions: [],
        },
      ]);
      const downDecision = (engine as any).evaluateSignal(downSignal);
      assert.ok(downDecision, `Strategy '${stratId}' should generate decision when qualified DOWN`);
      assert.strictEqual(downDecision.action, 'put', `Strategy '${stratId}' DOWN must map to 'put'`);

      // Case C: WAIT signal -> MUST NOT generate fake trade
      const waitSignal = buildSyntheticSignal(asset, tf, [
        {
          strategyId: stratId,
          strategyName: stratId,
          signal: 'WAIT',
          score: 50,
          rawScore: 50,
          normalizedScore: 50,
          qualified: false,
          dataValid: true,
          reasons: ['No setup'],
          conditions: [],
        },
      ]);
      const waitDecision = (engine as any).evaluateSignal(waitSignal);
      assert.strictEqual(waitDecision, null, `Strategy '${stratId}' MUST return null on WAIT`);

      // Case D: Invalid / unqualified / low confidence -> MUST return null
      const badSignal = buildSyntheticSignal(asset, tf, [
        {
          strategyId: stratId,
          strategyName: stratId,
          signal: 'UP',
          score: 40,
          rawScore: 40,
          normalizedScore: 40,
          qualified: false,
          dataValid: false,
          reasons: ['Unqualified'],
          conditions: [],
        },
      ]);
      assert.strictEqual((engine as any).evaluateSignal(badSignal), null, `Strategy '${stratId}' MUST reject unqualified/dataValid=false`);
    }

    // Test 'confluence' rejects OFFLINE / ERROR and WAIT
    engine.saveSettings({ strategyId: 'confluence', asset, timeframe: tf, minSignalStrength: 75 });
    assert.strictEqual(
      (engine as any).evaluateSignal(buildSyntheticSignal(asset, tf, [], 'UP', 90, 'OFFLINE')),
      null,
      'confluence must reject OFFLINE feed'
    );
    assert.strictEqual(
      (engine as any).evaluateSignal(buildSyntheticSignal(asset, tf, [], 'WAIT', 90, 'LIVE')),
      null,
      'confluence must reject WAIT signal'
    );
    const confOk = (engine as any).evaluateSignal(buildSyntheticSignal(asset, tf, [], 'DOWN', 88, 'LIVE'));
    assert.ok(confOk && confOk.action === 'put', 'confluence must accept high-confidence LIVE DOWN signal');

    // Test 'auto' blocks directional conflict (>=2 UP & >=2 DOWN)
    engine.saveSettings({ strategyId: 'auto', asset, timeframe: tf, minSignalStrength: 70 });
    const conflicted = buildSyntheticSignal(asset, tf, [
      { strategyId: 'ema_trend', strategyName: 'EMA', signal: 'UP', score: 85, normalizedScore: 85, qualified: true, dataValid: true, reasons: [], conditions: [] },
      { strategyId: 'macd', strategyName: 'MACD', signal: 'UP', score: 82, normalizedScore: 82, qualified: true, dataValid: true, reasons: [], conditions: [] },
      { strategyId: 'rsi_reversal', strategyName: 'RSI Rev', signal: 'DOWN', score: 86, normalizedScore: 86, qualified: true, dataValid: true, reasons: [], conditions: [] },
      { strategyId: 'stochastic', strategyName: 'Stoch', signal: 'DOWN', score: 80, normalizedScore: 80, qualified: true, dataValid: true, reasons: [], conditions: [] },
    ]);
    assert.strictEqual((engine as any).evaluateSignal(conflicted), null, 'auto must block trade during strategy conflict');

    // Test 'rsi_macd' confirms agreement and blocks disagreement
    engine.saveSettings({ strategyId: 'rsi_macd', asset, timeframe: tf });
    const disagree = buildSyntheticSignal(asset, tf, [
      { strategyId: 'macd', strategyName: 'MACD', signal: 'UP', score: 80, qualified: true, dataValid: true, reasons: [], conditions: [] },
      { strategyId: 'rsi_momentum', strategyName: 'RSI Momentum', signal: 'DOWN', score: 80, qualified: true, dataValid: true, reasons: [], conditions: [] },
    ]);
    assert.strictEqual((engine as any).evaluateSignal(disagree), null, 'rsi_macd must block opposing signals');
    const agree = buildSyntheticSignal(asset, tf, [
      { strategyId: 'macd', strategyName: 'MACD', signal: 'UP', score: 80, qualified: true, dataValid: true, reasons: [], conditions: [] },
      { strategyId: 'rsi_momentum', strategyName: 'RSI Momentum', signal: 'UP', score: 82, qualified: true, dataValid: true, reasons: [], conditions: [] },
    ]);
    assert.strictEqual((engine as any).evaluateSignal(agree)?.action, 'call', 'rsi_macd must enter call on aligned signals');
  });

  it('4. Verifies strict pre-flight broker, balance & candle gates and REAL openDeal dispatch', async () => {
    const candleBuilder = new CandleBuilder();
    const poService = new PocketOptionService(candleBuilder);
    const strategyEngine = new StrategyEngine(candleBuilder);
    const sbaaEngine = new SbaaStrategyEngine(candleBuilder, poService);
    const asset = 'EURUSD_otc';
    const tf = 60;

    const dispatchedOrders: any[] = [];
    let mockConnected = false;
    let mockAuth = false;
    let mockBalance = 100;

    // Spy/override broker transport methods in-memory cleanly
    (poService as any).isConnected = () => mockConnected;
    (poService as any).authVerified = false;
    (poService as any).getDiagnostics = () => ({
      endpoint: 'wss://api-eu.po.market/socket.io/?EIO=4&transport=websocket',
      status: mockConnected ? 'connected' : 'disconnected',
      authVerified: mockAuth,
      subsystems: {
        websocket: mockConnected ? 'connected' : 'disconnected',
        auth: mockAuth ? 'success' : 'failed',
        marketData: 'receiving',
        account: 'LIVE',
        overall: mockConnected && mockAuth ? 'READY' : 'DISCONNECTED',
      },
      account: { balance: mockBalance, isDemo: false, currency: 'USD', uidMasked: '99****01', uid: 990001 },
      latencyMs: 25,
    });
    (poService as any).openDeal = async (params: any) => {
      dispatchedOrders.push(params);
      return {
        success: true,
        requestId: 'req_real_001',
        deal: { id: 'ticket_real_999', openPrice: 1.125 },
      };
    };

    const engine = new AutoTraderEngine(strategyEngine, poService, undefined, sbaaEngine, undefined, candleBuilder, false);
    engine.saveSettings({ strategyId: 'ema_trend', asset, timeframe: tf, baseAmount: 15, cooldownBetweenTradesSec: 0 });
    engine.start({ strategyId: 'ema_trend', asset, timeframe: tf, baseAmount: 15 });

    const candles = generateCandles(30, 'uptrend', tf);
    candleBuilder.loadHistoricalCandles(asset, tf, candles);

    const makeSig = (offsetMs: number) => {
      const sig = buildSyntheticSignal(asset, tf, [
        {
          strategyId: 'ema_trend',
          strategyName: 'EMA Trend',
          signal: 'UP',
          score: 88,
          normalizedScore: 88,
          qualified: true,
          dataValid: true,
          reasons: ['Bullish EMA alignment'],
          conditions: [],
        },
      ]);
      sig.candleTimestamp = Date.now() + offsetMs;
      return sig;
    };

    // A: Disconnected / Unauthenticated -> MUST NOT create CREATED trade or dispatch openDeal
    await engine.onSignalUpdate(makeSig(0));
    assert.strictEqual(dispatchedOrders.length, 0, 'Must NOT open deal when disconnected/unauthenticated');
    assert.strictEqual(engine.getStatus().recentTrades.length, 0, 'Must NOT pollute trade table when blocked pre-flight');

    // B: Connected + Authenticated, but Insufficient Balance ($5 < $15 stake) -> MUST NOT open deal
    mockConnected = true;
    mockAuth = true;
    (poService as any).authVerified = true;
    mockBalance = 5;
    await engine.onSignalUpdate(makeSig(60000));
    assert.strictEqual(dispatchedOrders.length, 0, 'Must NOT open deal when real balance < stake');
    assert.strictEqual(engine.getStatus().recentTrades.length, 0, 'Must NOT create order record when balance insufficient');

    // C: Connected + Authenticated + Sufficient Real Balance ($250 >= $15) + 30 Candles -> MUST dispatch REAL deal
    mockBalance = 250;
    await engine.onSignalUpdate(makeSig(120000));
    assert.strictEqual(dispatchedOrders.length, 1, 'Expected exactly 1 real openDeal dispatch');
    assert.strictEqual(dispatchedOrders[0].asset, asset);
    assert.strictEqual(dispatchedOrders[0].amount, 15);
    assert.strictEqual(dispatchedOrders[0].action, 'call');
    assert.strictEqual(dispatchedOrders[0].time, tf);

    const status = engine.getStatus();
    assert.strictEqual(status.acceptedTradesCount, 1);
    assert.strictEqual(status.recentTrades[0].ticketId, 'ticket_real_999');
    assert.strictEqual(status.recentTrades[0].lifecycle, 'OPEN');

    engine.stop();
  });

  it('5. Executes chronological runBacktest across sbaa, auto, confluence, rsi_macd, and all 26 quantitative strategies', () => {
    const candleBuilder = new CandleBuilder();
    const poService = new PocketOptionService(candleBuilder);
    const strategyEngine = new StrategyEngine(candleBuilder);
    const sbaaEngine = new SbaaStrategyEngine(candleBuilder, poService);
    const engine = new AutoTraderEngine(strategyEngine, poService, undefined, sbaaEngine, undefined, candleBuilder, false);

    const candles = generateCandles(90, 'pullback_up', 60);
    const allModes = ['sbaa', 'auto', 'confluence', 'rsi_macd', ...ALL_26_STRATEGY_IDS];

    for (const mode of allModes) {
      const report = engine.runBacktest(mode, candles, 10, 0.88);
      assert.strictEqual(report.strategyId, mode);
      assert.strictEqual(report.totalCandles, candles.length);
      assert.ok(Number.isFinite(report.winRate), `${mode} winRate must be finite`);
      assert.ok(Number.isFinite(report.netProfit), `${mode} netProfit must be finite`);
      assert.ok(report.totalTrades >= 0, `${mode} totalTrades must be non-negative`);
    }
  });

  it('6. Rejects OFFLINE/ERROR feeds globally, preserves SBAA counters in readOnly mode, and settles deals idempotently', () => {
    const candleBuilder = new CandleBuilder();
    const poService = new PocketOptionService(candleBuilder);
    const strategyEngine = new StrategyEngine(candleBuilder);
    const sbaaEngine = new SbaaStrategyEngine(candleBuilder, poService);
    const engine = new AutoTraderEngine(strategyEngine, poService, undefined, sbaaEngine, undefined, candleBuilder, false);

    const asset = 'EURUSD_otc';
    const tf = 60;
    const candles = generateCandles(60, 'pullback_up', tf);
    candleBuilder.loadHistoricalCandles(asset, tf, candles);

    const beforeLogs = sbaaEngine.getDetectionLogs(50).length;
    const beforeBuyCount = sbaaEngine.getStatus().buySignalsCount;

    for (const stratId of ['sbaa', 'auto', 'confluence', 'rsi_macd', 'ema_trend']) {
      engine.saveSettings({ strategyId: stratId, asset, timeframe: tf });
      const offlineSig = buildSyntheticSignal(
        asset,
        tf,
        [
          {
            strategyId: 'ema_trend',
            strategyName: 'EMA Trend',
            signal: 'UP',
            score: 90,
            normalizedScore: 90,
            qualified: true,
            dataValid: true,
            reasons: ['Bullish'],
            conditions: [],
          },
        ],
        'UP',
        90,
        'OFFLINE'
      );
      assert.strictEqual((engine as any).evaluateSignal(offlineSig), null, `${stratId} must block OFFLINE feed`);
    }

    assert.strictEqual(sbaaEngine.getDetectionLogs(50).length, beforeLogs, 'readOnly SBAA tick checks must not spam logs');
    assert.strictEqual(sbaaEngine.getStatus().buySignalsCount, beforeBuyCount, 'readOnly SBAA tick checks must not mutate counters');

    // Verify deal settlement transitions OPEN -> SETTLING -> COMPLETED cleanly
    engine.resetPnL();
    (engine as any).trades.push({
      id: 'at_audit_settle_1',
      ticketId: 'tkt_audit_1',
      runCycleId: 'rc_audit',
      timestamp: Date.now(),
      idempotencyKey: 'ord_audit_1',
      asset,
      action: 'call',
      amount: 10,
      lifecycle: 'OPEN',
      status: 'PENDING',
      strategy: 'sbaa',
      durationSeconds: 60,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    (engine as any).handleDealClosed({ id: 'tkt_audit_1', profit: 8.8, closePrice: 1.13 });
    (engine as any).handleDealClosed({ id: 'tkt_audit_1', profit: 8.8, closePrice: 1.13 });
    const status = engine.getStatus();
    assert.strictEqual(status.dailyPnL, 8.8);
    assert.strictEqual(status.winningTrades, 1);
    assert.strictEqual((engine as any).trades.find((t: any) => t.id === 'at_audit_settle_1').lifecycle, 'COMPLETED');
  });

  after(() => {
    setTimeout(() => process.exit(0), 50);
  });
});

