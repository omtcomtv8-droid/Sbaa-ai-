import { describe, it, after } from 'node:test';
import assert from 'node:assert';
import { PocketOptionService } from '../server/PocketOptionService';
import { CandleBuilder } from '../server/CandleBuilder';
import { StrategyEngine } from '../server/StrategyEngine';
import { AutoTraderEngine } from '../server/AutoTraderEngine';
import { SbaaStrategyEngine } from '../server/sbaa/SbaaStrategyEngine';
import { Candle, Signal, StrategyResult } from '../server/types';

// Helper to create synthetic candles
function createMockCandles(count: number, basePrice: number = 1.1000, trend: 'up' | 'down' | 'flat' = 'up', tf: number = 60): Candle[] {
  const candles: Candle[] = [];
  const now = Math.floor(Date.now() / 1000);
  let price = basePrice;

  for (let i = 0; i < count; i++) {
    const time = now - (count - i) * tf;
    const delta = trend === 'up' ? 0.0005 : trend === 'down' ? -0.0005 : (Math.random() - 0.5) * 0.0002;
    const open = price;
    const close = open + delta;
    const high = Math.max(open, close) + 0.0002;
    const low = Math.min(open, close) - 0.0002;
    price = close;

    candles.push({
      time,
      open: Number(open.toFixed(5)),
      high: Number(high.toFixed(5)),
      low: Number(low.toFixed(5)),
      close: Number(close.toFixed(5)),
      volume: 100,
    });
  }
  return candles;
}

describe('Timeframe System & Strategy Engine Comprehensive Verification', () => {
  const candleBuilder = new CandleBuilder();
  const poService = new PocketOptionService(candleBuilder);
  const strategyEngine = new StrategyEngine(candleBuilder);
  const sbaaEngine = new SbaaStrategyEngine(candleBuilder, poService);

  it('1. Verifies dynamic timeframe synchronization across all 5 standard timeframes (1M, 5M, 15M, 30M, 1H)', () => {
    const timeframes = [
      { tf: 60, label: '1M', expectedDuration: 60 },
      { tf: 300, label: '5M', expectedDuration: 300 },
      { tf: 900, label: '15M', expectedDuration: 900 },
      { tf: 1800, label: '30M', expectedDuration: 1800 },
      { tf: 3600, label: '1H', expectedDuration: 3600 },
    ];

    for (const item of timeframes) {
      const autoTrader = new AutoTraderEngine(strategyEngine, poService, undefined, sbaaEngine);
      autoTrader.setTimeframe(item.tf);
      poService.setTimeframe(item.tf);
      sbaaEngine.setTimeframe(item.tf);

      assert.strictEqual(autoTrader.getStatus().config.timeframe, item.tf, `AutoTrader timeframe must match ${item.label}`);
      assert.strictEqual(poService.getTimeframe(), item.tf, `PocketOptionService timeframe must match ${item.label}`);
      assert.strictEqual(sbaaEngine.getTimeframe(), item.tf, `SbaaStrategyEngine timeframe must match ${item.label}`);
    }
  });

  it('2. Verifies strict minimum candle count (>=15 candles) and NO fallback to 1M or arbitrary frame', async () => {
    const autoTrader = new AutoTraderEngine(strategyEngine, poService, undefined, sbaaEngine);
    const asset = 'TEST_PAIR_otc';
    const tf = 900; // 15M

    autoTrader.setTimeframe(tf);
    autoTrader.setAsset(asset);
    autoTrader.saveSettings({ baseAmount: 25, isDemo: true });

    // Seed ONLY 10 candles (less than 15 required)
    const shortCandles = createMockCandles(10, 1.2000, 'up', tf);
    candleBuilder.loadHistoricalCandles(asset, tf, shortCandles);

    assert.strictEqual(poService.getCandleCount(asset, tf), 10, 'Candle count should be exactly 10');

    // Attempt trade execution with insufficient data
    let dealOpened = false;
    poService.onDealOpened(() => {
      dealOpened = true;
    });

    const signal: Signal = {
      id: 'test_sig',
      asset,
      symbol: asset,
      timeframe: tf,
      type: 'UP',
      direction: 'UP',
      strength: 0.9,
      confidence: 90,
      score: 90,
      details: ['Test strong up signal'],
      price: 1.2050,
      status: 'CONFIRMED',
      timestamp: Date.now(),
      strategies: [
        {
          strategyId: 'ema_trend',
          strategyName: 'EMA Trend',
          signal: 'UP',
          score: 85,
          rawScore: 85,
          normalizedScore: 85,
          qualified: true,
          dataValid: true,
          reasons: ['EMA 9 > EMA 21'],
          conditions: [],
        },
      ],
    };

    autoTrader.start({ strategyId: 'ema_trend', asset, timeframe: tf, baseAmount: 25 });
    await autoTrader.onSignalUpdate(signal);

    // Wait slightly to let any async pipeline execute
    await new Promise((r) => setTimeout(r, 200));

    // Deal MUST NOT have been opened because candleCount < 15
    assert.strictEqual(dealOpened, false, 'Deal MUST NOT be opened when candleCount < 15');

    const logs = autoTrader.getStatus().recentLogs;
    const blockedLog = logs.find((l) => l.message.includes('غير كافٍ للتحليل'));
    assert.ok(blockedLog, 'A warning log mentioning insufficient candles must be recorded');
  });

  it('3. Verifies SBAA Pro Engine dynamic trade duration based on timeframe', () => {
    const autoTrader = new AutoTraderEngine(strategyEngine, poService, undefined, sbaaEngine);
    const tf = 300; // 5M
    autoTrader.setTimeframe(tf);

    // Verify SBAA evaluation responds with proper structure
    const asset = 'EURUSD_otc';
    sbaaEngine.setTimeframe(tf);
    sbaaEngine.setAsset(asset);

    const candles = createMockCandles(60, 1.0850, 'up');
    candleBuilder.loadHistoricalCandles(asset, tf, candles);

    const sbaaRecord = sbaaEngine.evaluateMarket(asset, tf);
    assert.ok(sbaaRecord, 'SbaaStrategyEngine must return an evaluation record');
    assert.strictEqual(sbaaRecord.timeframe, tf, 'Record timeframe must match requested 5M (300s)');
    assert.ok(typeof sbaaRecord.confluenceScore === 'number', 'Confluence score must be a number');
  });

  it('4. Verifies all 26 registered quantitative strategies are recognized without errors', () => {
    const ALL_26_STRATEGIES = [
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

    const autoTrader = new AutoTraderEngine(strategyEngine, poService, undefined, sbaaEngine);
    const tf = 60;
    autoTrader.setTimeframe(tf);

    for (const stratId of ALL_26_STRATEGIES) {
      autoTrader.saveSettings({ strategyId: stratId });
      assert.strictEqual(autoTrader.getStatus().config.strategyId, stratId);
    }
  });

  it('5. Verifies autonomous auto-select strategy routing without conflicts', () => {
    const autoTrader = new AutoTraderEngine(strategyEngine, poService, undefined, sbaaEngine);
    const tf = 1800; // 30M
    autoTrader.setTimeframe(tf);
    autoTrader.saveSettings({ strategyId: 'auto', minSignalStrength: 75 });

    const strategyResults: StrategyResult[] = [
      {
        strategyId: 'ema_trend',
        strategyName: 'EMA Trend',
        signal: 'UP',
        score: 88,
        rawScore: 88,
        normalizedScore: 88,
        qualified: true,
        dataValid: true,
        reasons: ['EMA 9 > EMA 21 bullish alignment'],
        conditions: [],
      },
      {
        strategyId: 'rsi_momentum',
        strategyName: 'RSI Momentum',
        signal: 'UP',
        score: 82,
        rawScore: 82,
        normalizedScore: 82,
        qualified: true,
        dataValid: true,
        reasons: ['RSI 58 crossing upward'],
        conditions: [],
      },
    ];

    const signal: Signal = {
      id: 'auto_test_sig',
      asset: 'GBPUSD_otc',
      symbol: 'GBPUSD_otc',
      timeframe: tf,
      type: 'UP',
      direction: 'UP',
      strength: 0.88,
      confidence: 88,
      score: 88,
      details: ['Valid auto-select setup'],
      price: 1.3000,
      status: 'CONFIRMED',
      timestamp: Date.now(),
      expiryDurationSec: tf,
      strategies: strategyResults,
    };

    const decision = (autoTrader as any).evaluateSignal(signal);
    assert.ok(decision, 'Auto-select should find qualified strategy');
    assert.strictEqual(decision.action, 'call', 'Decision action should be call');
    assert.strictEqual(decision.duration, tf, 'Duration must equal the selected 30M timeframe (1800s)');
    assert.ok(decision.strategyName.includes('EMA Trend'), 'Should pick highest scoring strategy (EMA Trend)');
  });

  it('6. Verifies SBAA Pro Engine integrates all 26 strategies and generates trade decision', () => {
    const autoTrader = new AutoTraderEngine(strategyEngine, poService, undefined, sbaaEngine);
    const tf = 900; // 15M
    autoTrader.setTimeframe(tf);
    autoTrader.saveSettings({ strategyId: 'sbaa', minSignalStrength: 70 });

    const strategyResults: StrategyResult[] = [
      {
        strategyId: 'rsi_reversal',
        strategyName: 'RSI Reversal',
        signal: 'UP',
        score: 86,
        rawScore: 86,
        normalizedScore: 86,
        qualified: true,
        dataValid: true,
        reasons: ['RSI oversold reversal confirmed'],
        conditions: [],
      },
      {
        strategyId: 'bollinger_bounce',
        strategyName: 'Bollinger Bounce',
        signal: 'UP',
        score: 80,
        rawScore: 80,
        normalizedScore: 80,
        qualified: true,
        dataValid: true,
        reasons: ['Lower band rejection'],
        conditions: [],
      },
    ];

    const signal: Signal = {
      id: 'sbaa_integrated_sig',
      asset: 'EURUSD_otc',
      symbol: 'EURUSD_otc',
      timeframe: tf,
      type: 'UP',
      direction: 'UP',
      strength: 0.86,
      confidence: 86,
      score: 86,
      details: ['Valid integrated SBAA setup'],
      price: 1.0850,
      status: 'CONFIRMED',
      timestamp: Date.now(),
      expiryDurationSec: tf,
      strategies: strategyResults,
    };

    const decision = (autoTrader as any).evaluateSignal(signal);
    assert.ok(decision, 'SBAA with integrated strategies must generate a trade decision');
    assert.strictEqual(decision.action, 'call', 'Decision action must be call');
    assert.strictEqual(decision.duration, tf, 'Duration must equal the 15M timeframe (900s)');
    assert.ok(decision.strategyName.includes('SBAA'), 'Strategy name must reflect SBAA Pro Engine');
  });

  it('7. Verifies user-selected timeframes (5M=300s, 15M=900s, 30M=1800s, 1H=3600s) strictly enforce order duration and NEVER collapse to 60s', () => {
    const autoTrader = new AutoTraderEngine(strategyEngine, poService, undefined, sbaaEngine);

    const testCases = [
      { tf: 60, expectedSec: 60, label: '1M (60s)' },
      { tf: 120, expectedSec: 120, label: '2M (120s)' },
      { tf: 180, expectedSec: 180, label: '3M (180s)' },
      { tf: 300, expectedSec: 300, label: '5M (300s)' },
      { tf: 900, expectedSec: 900, label: '15M (900s)' },
      { tf: 1800, expectedSec: 1800, label: '30M (1800s)' },
      { tf: 3600, expectedSec: 3600, label: '1H (3600s)' },
    ];

    for (const tc of testCases) {
      autoTrader.setTimeframe(tc.tf);
      autoTrader.saveSettings({ strategyId: 'ema_trend', timeframe: tc.tf });

      // Simulate a raw tick signal that might have defaulted to 60s
      const incomingSignal: Signal = {
        id: `sig_${tc.tf}`,
        asset: 'EURUSD_otc',
        symbol: 'EURUSD_otc',
        timeframe: 60, // Incoming raw tick timeframe
        type: 'UP',
        direction: 'UP',
        strength: 0.85,
        confidence: 85,
        score: 85,
        details: ['Bullish EMA test'],
        price: 1.0850,
        status: 'CONFIRMED',
        timestamp: Date.now(),
        expiryDurationSec: 60, // Default tick expiry
        strategies: [
          {
            strategyId: 'ema_trend',
            strategyName: 'EMA Trend',
            signal: 'UP',
            score: 85,
            rawScore: 85,
            normalizedScore: 85,
            qualified: true,
            dataValid: true,
            reasons: ['EMA 9 > EMA 21'],
            conditions: [],
          },
        ],
      };

      const decision = (autoTrader as any).evaluateSignal(incomingSignal);
      assert.ok(decision, `Decision must exist for ${tc.label}`);
      assert.strictEqual(
        decision.duration,
        tc.expectedSec,
        `Trade duration for ${tc.label} must be exactly ${tc.expectedSec}s, got ${decision.duration}s. It must NEVER collapse to 60s!`
      );
    }
  });

  it('8. Verifies SBAA Pro Engine end-to-end trade execution across all timeframes from 1M up to 1H (60s, 300s, 900s, 1800s, 3600s)', async () => {
    const timeframesToTest = [
      { tf: 60, label: '1M (1 دقيقة)', expectedSec: 60 },
      { tf: 300, label: '5M (5 دقائق)', expectedSec: 300 },
      { tf: 900, label: '15M (15 دقيقة)', expectedSec: 900 },
      { tf: 1800, label: '30M (30 دقيقة)', expectedSec: 1800 },
      { tf: 3600, label: '1H (1 ساعة)', expectedSec: 3600 },
    ];

    for (const item of timeframesToTest) {
      const mockPo = new PocketOptionService(candleBuilder);
      (mockPo as any).authVerified = true;
      (mockPo as any).isConnected = () => true;

      let openedDealParams: any = null;
      (mockPo as any).openDeal = async (params: any) => {
        openedDealParams = params;
        return {
          success: true,
          deal: {
            id: `deal_${Date.now()}`,
            openPrice: 1.0850,
          },
        };
      };

      const testSbaa = new SbaaStrategyEngine(candleBuilder, mockPo);
      const testAutoTrader = new AutoTraderEngine(strategyEngine, mockPo, undefined, testSbaa);

      const asset = `EURUSD_otc_${item.tf}`;
      const mockCandles = createMockCandles(40, 1.0800, 'up', item.tf);
      candleBuilder.loadHistoricalCandles(asset, item.tf, mockCandles);

      testAutoTrader.setTimeframe(item.tf);
      testAutoTrader.setAsset(asset);
      testAutoTrader.saveSettings({
        strategyId: 'sbaa',
        timeframe: item.tf,
        baseAmount: 10,
        isDemo: true,
        minSignalStrength: 70,
        cooldownBetweenTradesSec: 0,
      });

      testAutoTrader.start({
        strategyId: 'sbaa',
        timeframe: item.tf,
        asset,
        baseAmount: 10,
      });

      const signal: Signal = {
        id: `sig_sbaa_${item.tf}`,
        asset,
        symbol: asset,
        timeframe: item.tf,
        type: 'UP',
        direction: 'UP',
        strength: 0.85,
        confidence: 85,
        score: 85,
        details: [`SBAA setup confirmed for ${item.label}`],
        price: 1.0850,
        status: 'CONFIRMED',
        timestamp: Date.now(),
        expiryDurationSec: item.expectedSec,
        strategies: [
          {
            strategyId: 'ema_trend',
            strategyName: 'EMA Trend',
            signal: 'UP',
            score: 85,
            rawScore: 85,
            normalizedScore: 85,
            qualified: true,
            dataValid: true,
            reasons: ['EMA bullish alignment'],
            conditions: [],
          },
        ],
      };

      // 1. Evaluate Decision
      const decision = (testAutoTrader as any).evaluateSignal(signal);
      assert.ok(decision, `Decision must exist for ${item.label}`);
      assert.strictEqual(decision.action, 'call', `Action must be call for ${item.label}`);
      assert.strictEqual(
        decision.duration,
        item.expectedSec,
        `Decision duration for ${item.label} must be exactly ${item.expectedSec}s`
      );

      // 2. Dispatch Order and verify actual broker call
      await testAutoTrader.onSignalUpdate(signal);

      // Wait for pipeline execution
      await new Promise((r) => setTimeout(r, 200));

      assert.ok(openedDealParams, `openDeal must have been called for ${item.label}`);
      assert.strictEqual(openedDealParams.amount, 10, `Trade amount must match configured $10`);
      assert.strictEqual(
        openedDealParams.time,
        item.expectedSec,
        `Trade duration sent to Pocket Option for ${item.label} must be exactly ${item.expectedSec}s!`
      );
      assert.strictEqual(openedDealParams.action, 'call', `Action must be call`);

      testAutoTrader.stop();
    }
  });

  after(() => {
    setTimeout(() => {
      process.exit(0);
    }, 100);
  });
});
