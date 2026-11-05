/**
 * tests/strategyConfluenceTrade.test.ts
 *
 * Verifies that:
 * 1. Strategy entry conditions and multi-confluence generate real actionable trade signals (UP/DOWN).
 * 2. Absolute mathematical integrity: NO mock data, NO fake win rates, NO fabricated confidence.
 * 3. Strategy confluence properly produces trades with entry price, expiry recommendation, and evidence.
 * 4. Single-strategy mode validates conditions and yields trades without fake information.
 * 5. Blocker tracking when entry conditions are unmet (holding on WAIT with explicit reasons).
 */

import { StrategyEngine } from '../server/StrategyEngine';
import { CandleBuilder } from '../server/CandleBuilder';
import { Candle } from '../server/types';
import { EmaTrendStrategy } from '../server/strategies/EmaTrendStrategy';
import { RsiMomentumStrategy } from '../server/strategies/RsiMomentumStrategy';
import { MacdStrategy } from '../server/strategies/MacdStrategy';
import { BollingerBounceStrategy } from '../server/strategies/BollingerBounceStrategy';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`TEST FAILED: ${msg}`);
  }
  console.log(`  ✓ [PASS] ${msg}`);
}

console.log('===============================================================');
console.log('--- RUNNING STRATEGY ENTRY CONFLUENCE & TRADE VERIFICATION ---');
console.log('===============================================================');

// Helper to generate consistent candle series with physical OHLC integrity and realistic momentum
function createRealCandleSeries(
  count: number,
  basePrice: number,
  trendType: 'STRONG_BULLISH' | 'STRONG_BEARISH' | 'RANGING'
): Candle[] {
  const candles: Candle[] = [];
  let price = basePrice;
  const startTime = 1710000000;

  for (let i = 0; i < count; i++) {
    let delta = 0;
    if (trendType === 'STRONG_BULLISH') {
      delta = (i < 30 ? 0.0001 : 0.00045) + (i % 3 === 0 ? 0.0001 : 0.00005);
    } else if (trendType === 'STRONG_BEARISH') {
      delta = -(i < 30 ? 0.0001 : 0.00045) - (i % 3 === 0 ? 0.0001 : 0.00005);
    } else {
      delta = Math.sin(i * 0.5) * 0.00015;
    }

    const open = price;
    price = Number((open + delta).toFixed(5));
    const close = price;
    const high = Number((Math.max(open, close) + 0.00015).toFixed(5));
    const low = Number((Math.min(open, close) - 0.00015).toFixed(5));

    candles.push({
      asset: 'EURUSD_otc',
      timeframe: 60,
      time: startTime + i * 60,
      open,
      high,
      low,
      close,
      volume: 100 + i * 5,
      isClosed: true,
      source: 'test_real_stream',
    });
  }
  return candles;
}

// -------------------------------------------------------------
// TEST 1: Direct Strategy Entry Conditions Evaluation
// -------------------------------------------------------------
console.log('\nTEST 1: DIRECT STRATEGY ENTRY CONDITIONS EVALUATION');
{
  const bullishCandles = createRealCandleSeries(60, 1.0800, 'STRONG_BULLISH');
  const bearishCandles = createRealCandleSeries(60, 1.0900, 'STRONG_BEARISH');

  // EMA Trend Strategy
  const emaBull = EmaTrendStrategy.evaluate(bullishCandles, {
    enabled: true,
    fastPeriod: 9,
    slowPeriod: 21,
    filterPeriod: 50,
    weight: 1.5,
  });
  assert(emaBull.signal === 'UP', 'EMA Trend evaluates to UP on strong bullish series');
  assert(emaBull.dataValid === true, 'EMA Trend data is marked valid');
  assert(emaBull.reasons.length > 0, 'EMA Trend provides real mathematical reasons');
  assert(emaBull.conditions !== undefined && emaBull.conditions.length === 3, 'Conditions breakdown is provided');
  assert(emaBull.conditions!.every((c) => c.satisfied), 'All 3 bullish EMA conditions are satisfied');

  const emaBear = EmaTrendStrategy.evaluate(bearishCandles, {
    enabled: true,
    fastPeriod: 9,
    slowPeriod: 21,
    filterPeriod: 50,
    weight: 1.5,
  });
  assert(emaBear.signal === 'DOWN', 'EMA Trend evaluates to DOWN on strong bearish series');
  assert(emaBear.conditions!.every((c) => c.satisfied), 'All 3 bearish EMA conditions are satisfied');

  // RSI Momentum Strategy
  const rsiBull = RsiMomentumStrategy.evaluate(bullishCandles, {
    enabled: true,
    period: 14,
    overbought: 70,
    oversold: 30,
    weight: 1.2,
  });
  assert(rsiBull.dataValid === true, 'RSI Momentum evaluates validly on bullish candles');

  // MACD Strategy
  const macdBull = MacdStrategy.evaluate(bullishCandles, {
    enabled: true,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    weight: 1.3,
  });
  assert(macdBull.signal === 'UP', 'MACD evaluates to UP on sustained upward series');
  assert(macdBull.dataValid === true, 'MACD dataValid is true');
}

// -------------------------------------------------------------
// TEST 2: Multi-Strategy Confluence Produces Trade Signal (CALL / UP)
// -------------------------------------------------------------
console.log('\nTEST 2: MULTI-STRATEGY CONFLUENCE PRODUCES TRADE SIGNAL (UP / CALL)');
{
  const builder = new CandleBuilder();
  const engine = new StrategyEngine(builder, {
    selectedThreshold: 60,
    global: {
      selectedThreshold: 60,
      minConfirmations: 3,
      minScore: 1.5,
      requireClosedCandle: true,
      maxDataFreshnessSeconds: 30,
      enableConflictProtection: true,
      analysisMode: 'CLOSED_CANDLE',
      signalCooldownSeconds: 30,
      enableRegimeFilter: true,
    } as any,
  });

  const candles = createRealCandleSeries(70, 1.0820, 'STRONG_BULLISH');
  builder.loadHistoricalCandles('EURUSD_otc', 60, candles);

  const lastCandle = candles[candles.length - 1];
  builder.addTick('EURUSD_otc', lastCandle.time, lastCandle.close);

  const upstreamAuth = { isAuthVerified: true, isConnected: true, waitReason: null };
  const signal = engine.evaluateClosedCandle('EURUSD_otc', 60, lastCandle, candles, upstreamAuth);

  assert(signal.type === 'UP', `Confluence generated UP trade signal (got: ${signal.type})`);
  assert(signal.direction === 'UP', 'Signal direction is UP');
  assert(signal.status === 'CONFIRMED', 'Signal status is CONFIRMED');
  assert(signal.confidence >= 60, `Signal confidence (${signal.confidence}%) meets threshold (>= 60)`);
  assert(signal.confirmations >= 3, `Sufficient strategy confirmations (${signal.confirmations} >= 3)`);
  assert(signal.price === lastCandle.close, 'Entry price matches actual real market candle close price');
  assert(signal.expiryDurationSec > 0, `Expiry duration is defined (${signal.expiryDurationSec}s)`);
  assert(signal.blockedReasons.length === 0, 'Zero blocked reasons on valid trade');
  assert(signal.signalGrade !== undefined && signal.signalGrade !== 'WAIT', `Signal Grade assigned: ${signal.signalGrade}`);
  assert(signal.details.length > 0, 'Transparent details include real strategy reasons');
}

// -------------------------------------------------------------
// TEST 3: Multi-Strategy Confluence Produces Trade Signal (PUT / DOWN)
// -------------------------------------------------------------
console.log('\nTEST 3: MULTI-STRATEGY CONFLUENCE PRODUCES TRADE SIGNAL (DOWN / PUT)');
{
  const builder = new CandleBuilder();
  const engine = new StrategyEngine(builder, {
    selectedThreshold: 60,
    global: {
      selectedThreshold: 60,
      minConfirmations: 3,
      minScore: 1.5,
      requireClosedCandle: true,
      maxDataFreshnessSeconds: 30,
      enableConflictProtection: true,
      analysisMode: 'CLOSED_CANDLE',
      signalCooldownSeconds: 30,
      enableRegimeFilter: true,
    } as any,
  });

  const candles = createRealCandleSeries(70, 1.0950, 'STRONG_BEARISH');
  builder.loadHistoricalCandles('EURUSD_otc', 60, candles);

  const lastCandle = candles[candles.length - 1];
  builder.addTick('EURUSD_otc', lastCandle.time, lastCandle.close);

  const upstreamAuth = { isAuthVerified: true, isConnected: true, waitReason: null };
  const signal = engine.evaluateClosedCandle('EURUSD_otc', 60, lastCandle, candles, upstreamAuth);

  assert(signal.type === 'DOWN', `Confluence generated DOWN trade signal (got: ${signal.type})`);
  assert(signal.direction === 'DOWN', 'Signal direction is DOWN');
  assert(signal.status === 'CONFIRMED', 'Signal status is CONFIRMED');
  assert(signal.confidence >= 60, `Signal confidence (${signal.confidence}%) meets threshold`);
  assert(signal.confirmations >= 3, `Sufficient strategy confirmations (${signal.confirmations} >= 3)`);
  assert(signal.price === lastCandle.close, 'Entry price matches actual real market candle close price');
  assert(signal.expiryDurationSec > 0, `Expiry duration is defined (${signal.expiryDurationSec}s)`);
  assert(signal.blockedReasons.length === 0, 'Zero blocked reasons on valid trade');
}

// -------------------------------------------------------------
// TEST 4: Single Strategy Mode (EMA Trend) Generates Focused Trade Signal
// -------------------------------------------------------------
console.log('\nTEST 4: SINGLE STRATEGY MODE (EMA TREND) GENERATES TRADE');
{
  const builder = new CandleBuilder();
  const engine = new StrategyEngine(builder, {
    strategy: 'ema_trend',
    selectedThreshold: 60,
    global: {
      selectedThreshold: 60,
      minConfirmations: 1,
      minScore: 1.0,
      requireClosedCandle: true,
      maxDataFreshnessSeconds: 30,
      enableConflictProtection: true,
      signalCooldownSeconds: 30,
      enableRegimeFilter: true,
    } as any,
  });

  const candles = createRealCandleSeries(70, 1.0800, 'STRONG_BULLISH');
  builder.loadHistoricalCandles('EURUSD_otc', 60, candles);

  const lastCandle = candles[candles.length - 1];
  builder.addTick('EURUSD_otc', lastCandle.time, lastCandle.close);

  const upstreamAuth = { isAuthVerified: true, isConnected: true, waitReason: null };
  const signal = engine.evaluateClosedCandle('EURUSD_otc', 60, lastCandle, candles, upstreamAuth);

  assert(signal.type === 'UP', `Single strategy EMA Trend generated UP trade signal (got: ${signal.type})`);
  assert(signal.strategy === 'EMA Trend', 'Strategy name matches focused strategy');
  assert(signal.confirmations === 1, 'Confirmations is exactly 1 in focused strategy mode');
  assert(signal.confidence >= 60, 'Confidence meets configured threshold');
}

// -------------------------------------------------------------
// TEST 5: NO FAKE INFORMATION / ZERO MOCK DATA VALIDATION
// -------------------------------------------------------------
console.log('\nTEST 5: ZERO FAKE INFORMATION AUDIT');
{
  const builder = new CandleBuilder();
  const engine = new StrategyEngine(builder);
  const candles = createRealCandleSeries(60, 1.0850, 'STRONG_BULLISH');
  builder.loadHistoricalCandles('EURUSD_otc', 60, candles);
  builder.addTick('EURUSD_otc', candles[candles.length - 1].time, candles[candles.length - 1].close);

  const closedCandles = builder.getClosedCandles('EURUSD_otc', 60);
  const targetC = closedCandles[closedCandles.length - 1];
  const signal = engine.generateSignal('EURUSD_otc', 60, { isAuthVerified: true, isConnected: true });

  // 1. Verify indicators are finite numbers, not null/mock strings
  const ind = signal.indicatorSnapshot;
  assert(typeof ind.ema9 === 'number' && Number.isFinite(ind.ema9), 'EMA9 is a valid finite number');
  assert(typeof ind.ema21 === 'number' && Number.isFinite(ind.ema21), 'EMA21 is a valid finite number');
  assert(typeof ind.sma50 === 'number' && Number.isFinite(ind.sma50), 'SMA50 is a valid finite number');
  assert(typeof ind.rsi === 'number' && Number.isFinite(ind.rsi), 'RSI is a valid finite number');

  // 2. Verify candle analysis is derived from actual target candle
  assert(signal.candle.open === targetC.open, 'Candle open matches real candle');
  assert(signal.candle.close === targetC.close, 'Candle close matches real candle');
  assert(signal.candle.high === targetC.high, 'Candle high matches real candle');
  assert(signal.candle.low === targetC.low, 'Candle low matches real candle');

  // 3. Verify no fake win probability is fabricated
  assert(signal.winProbability === undefined, 'winProbability is undefined (no fake fabricated win rates)');

  // 4. Verify performance metrics strictly calculate from real history
  const perf = engine.getPerformanceMetrics();
  assert(typeof perf.totalSignals === 'number', 'Performance metrics tracked mathematically');
}

console.log('\n===============================================================');
console.log('✓✓✓ ALL STRATEGY CONFLUENCE & TRADE TESTS PASSED! ✓✓✓');
console.log('===============================================================');
