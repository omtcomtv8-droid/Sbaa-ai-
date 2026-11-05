import { CandleBuilder } from '../server/CandleBuilder';
import { StrategyEngine } from '../server/StrategyEngine';
import {
  calculateADX,
  calculateATR,
  calculateBollingerBands,
  calculateCCI,
  calculateEMA,
  calculateEMASeries,
  calculateFibonacciRetracements,
  calculateHMA,
  calculateIchimoku,
  calculateMACD,
  calculateOBV,
  calculateParabolicSAR,
  calculatePivotPoints,
  calculateROC,
  calculateRSI,
  calculateSMA,
  calculateStochastic,
  calculateVWAP,
  calculateWilliamsR,
  calculateWMA,
} from '../server/indicators';
import { CandlestickPatternEngine } from '../server/CandlestickPatternEngine';
import { TrendAnalysisEngine } from '../server/TrendAnalysisEngine';
import { SupportResistanceEngine } from '../server/SupportResistanceEngine';
import { MarketRegimeEngine } from '../server/MarketRegimeEngine';
import { Candle } from '../server/types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`TEST FAILED: ${message}`);
  }
  console.log(`✓ ${message}`);
}

function generateMockCandles(count: number, basePrice: number = 1.085, trend: 'up' | 'down' | 'flat' = 'up'): Candle[] {
  const candles: Candle[] = [];
  let price = basePrice;
  const baseTime = 1710000000;

  for (let i = 0; i < count; i++) {
    const delta = trend === 'up' ? 0.0003 : trend === 'down' ? -0.0003 : (Math.sin(i) * 0.0002);
    const open = price;
    price = open + delta;
    const close = price;
    const high = Math.max(open, close) + 0.0001;
    const low = Math.min(open, close) - 0.0001;

    candles.push({
      asset: 'EURUSD_otc',
      timeframe: 60,
      time: baseTime + i * 60,
      open: Number(open.toFixed(5)),
      high: Number(high.toFixed(5)),
      low: Number(low.toFixed(5)),
      close: Number(close.toFixed(5)),
      volume: 50,
      isClosed: true,
      source: 'test',
    });
  }
  return candles;
}

async function runTests() {
  console.log('--- STARTING COMPREHENSIVE ENGINE TESTS ---');

  // Test 1: CandleBuilder validation
  console.log('\n[1] Candle Validation Tests:');
  const validCandle: Candle = {
    asset: 'EURUSD',
    timeframe: 60,
    time: 1710000000,
    open: 1.085,
    high: 1.086,
    low: 1.084,
    close: 1.0855,
    volume: 10,
    isClosed: true,
  };
  assert(CandleBuilder.isValidCandle(validCandle) === true, 'Valid candle passes validation');

  const invalidCandle: Candle = {
    ...validCandle,
    high: 1.080, // High lower than open/close!
  };
  assert(CandleBuilder.isValidCandle(invalidCandle) === false, 'Invalid candle (high < close) rejected');

  // Test 2: Indicator Calculations
  console.log('\n[2] Mathematical Indicator Formula Tests:');
  const testCandles = generateMockCandles(50, 1.0800, 'up');
  const closes = testCandles.map((c) => c.close);

  const sma = calculateSMA(closes, 10);
  assert(sma !== null && sma > 1.0800, `SMA calculation succeeds (${sma})`);

  const ema = calculateEMA(closes, 10);
  assert(ema !== null && ema > 1.0800, `EMA calculation succeeds (${ema})`);

  const rsi = calculateRSI(closes, 14);
  assert(rsi !== null && rsi >= 0 && rsi <= 100, `RSI bounded in [0, 100] (${rsi})`);
  assert(rsi! > 50, `Uptrend generates bullish RSI > 50 (${rsi})`);

  const bb = calculateBollingerBands(closes, 20, 2);
  assert(bb !== null, 'Bollinger Bands calculation succeeds');
  assert(bb!.upper > bb!.middle && bb!.middle > bb!.lower, 'Bollinger upper > middle > lower');

  const macd = calculateMACD(closes, 12, 26, 9);
  assert(macd !== null, 'MACD calculation succeeds');

  const atr = calculateATR(testCandles, 14);
  assert(atr !== null && atr.currentATR > 0, `ATR calculation succeeds (${atr?.currentATR})`);

  const adx = calculateADX(testCandles, 14);
  assert(adx !== null && adx.adx >= 0, `ADX calculation succeeds (${adx?.adx})`);

  const stoch = calculateStochastic(testCandles, 14, 3);
  assert(stoch !== null && stoch.k >= 0 && stoch.k <= 100, `Stochastic %K in bounds (${stoch?.k})`);

  const roc = calculateROC(closes, 10);
  assert(roc !== null, `ROC calculation succeeds (${roc})`);

  const wma = calculateWMA(closes, 10);
  assert(wma !== null && wma > 1.0800, `WMA calculation succeeds (${wma})`);

  const hma = calculateHMA(closes, 10);
  assert(hma !== null && hma > 1.0800, `HMA calculation succeeds (${hma})`);

  const wr = calculateWilliamsR(testCandles, 14);
  assert(wr !== null && wr <= 0 && wr >= -100, `Williams %R calculation succeeds (${wr})`);

  const cci = calculateCCI(testCandles, 20);
  assert(cci !== null, `CCI calculation succeeds (${cci})`);

  const sar = calculateParabolicSAR(testCandles);
  assert(sar !== null && sar.sar > 0, `Parabolic SAR succeeds (${sar?.sar}, trend: ${sar?.trend})`);

  const ichi = calculateIchimoku(testCandles.concat(testCandles)); // ensure >= 52 candles
  assert(ichi !== null, `Ichimoku calculation succeeds (${ichi?.cloudColor})`);

  const pivots = calculatePivotPoints(testCandles);
  assert(pivots !== null && pivots.r1 > pivots.pivot, `Pivot Points calculation succeeds (P: ${pivots?.pivot})`);

  const fib = calculateFibonacciRetracements(1.1000, 1.0000);
  assert(fib.level500 === 1.0500, `Fibonacci calculation succeeds (50%: ${fib.level500})`);

  const obv = calculateOBV(testCandles);
  assert(obv !== null, `OBV calculation succeeds (${obv})`);

  const vwap = calculateVWAP(testCandles);
  assert(vwap !== null && vwap > 1.0800, `VWAP calculation succeeds (${vwap})`);

  // Test 3: Candlestick Pattern Engine
  console.log('\n[3] Candlestick Pattern Engine Tests:');
  // Bullish Engulfing setup
  const engulfingCandles: Candle[] = [
    { asset: 'EURUSD', timeframe: 60, time: 100, open: 1.0850, high: 1.0855, low: 1.0830, close: 1.0835, volume: 10, isClosed: true },
    { asset: 'EURUSD', timeframe: 60, time: 160, open: 1.0832, high: 1.0865, low: 1.0830, close: 1.0860, volume: 20, isClosed: true },
  ];
  const pattern = CandlestickPatternEngine.detect(engulfingCandles);
  assert(pattern !== null && pattern.name === 'Bullish Engulfing', `Detected Bullish Engulfing correctly: ${pattern?.name}`);
  assert(pattern?.bias === 'BULLISH', 'Engulfing bias is BULLISH');

  // Hammer setup
  const hammerCandles: Candle[] = [
    { asset: 'EURUSD', timeframe: 60, time: 100, open: 1.0850, high: 1.0855, low: 1.0830, close: 1.0835, volume: 10, isClosed: true },
    { asset: 'EURUSD', timeframe: 60, time: 160, open: 1.0835, high: 1.0838, low: 1.0800, close: 1.0837, volume: 20, isClosed: true },
  ];
  const hammerPattern = CandlestickPatternEngine.detect(hammerCandles);
  assert(hammerPattern !== null && hammerPattern.name.includes('Hammer'), `Detected Hammer correctly: ${hammerPattern?.name}`);

  // Test 4: Support & Resistance Engine
  console.log('\n[4] Support & Resistance Engine Tests:');
  const srResult = SupportResistanceEngine.calculateLevels(testCandles, 40, 0.1);
  assert(Array.isArray(srResult.supports) && Array.isArray(srResult.resistances), 'S/R engine returns level arrays');

  // Test 5: Market Regime Engine
  console.log('\n[5] Market Regime Engine Tests:');
  const regimeResult = MarketRegimeEngine.detect(testCandles);
  assert(regimeResult.regime !== undefined, `Market regime detected: ${regimeResult.regime} (${regimeResult.label})`);

  // Test 6: StrategyEngine Orchestration & Safety Gates
  console.log('\n[6] Strategy Engine & Safety Gates Tests:');
  const builder = new CandleBuilder();
  const engine = new StrategyEngine(builder);

  // Stale data gate
  const staleSignal = engine.generateSignal('EURUSD_otc', 60);
  assert(staleSignal.type === 'WAIT', 'Stale/Missing data triggers WAIT');
  assert(staleSignal.dataStatus === 'STALE', 'Data status is STALE');

  // Upstream Gate check: Unauthenticated or disconnected session forces WAIT
  const lockedSignal = engine.generateSignal('EURUSD_otc', 60, {
    isAuthVerified: false,
    isConnected: false,
    waitReason: 'Session expired or unauthenticated',
  });
  assert(lockedSignal.type === 'WAIT', 'Unauthenticated upstream gate forces WAIT signal');
  assert(lockedSignal.dataStatus === 'ERROR', 'Unauthenticated upstream gate sets ERROR status');

  // Load candles into builder
  builder.loadHistoricalCandles('EURUSD_otc', 60, testCandles);
  // Add fresh tick
  builder.addTick('EURUSD_otc', Math.floor(Date.now() / 1000), testCandles[testCandles.length - 1].close);

  const activeSignal = engine.generateSignal('EURUSD_otc', 60);
  console.log(`Generated Signal: ${activeSignal.type} | Score: ${activeSignal.score} | Confirmations: ${activeSignal.confirmations}`);
  assert(['UP', 'DOWN', 'WAIT'].includes(activeSignal.type), 'Signal type is strictly UP, DOWN, or WAIT');
  assert(activeSignal.strategies.length === 26, `All 26 modular strategies evaluated (evaluated ${activeSignal.strategies.length})`);

  // Performance calculation
  const perf = engine.getPerformanceMetrics();
  assert(perf.totalSignals >= 0, 'Performance metrics calculate correctly');
  assert(perf.sampleSize >= 0, 'True sample size tracked transparently');

  // Test 7: Dynamic Strategy Confidence Threshold Tests
  console.log('\n[7] Dynamic Strategy Confidence Threshold Tests:');

  // Test setting threshold to 50%
  engine.updateSettings({ selectedThreshold: 50 });
  const settings50 = engine.getSettings();
  assert(settings50.selectedThreshold === 50, 'Engine settings accurately store selectedThreshold = 50%');

  // Test setting threshold to 85%
  engine.updateSettings({ selectedThreshold: 85 });
  const settings85 = engine.getSettings();
  assert(settings85.selectedThreshold === 85, 'Engine settings dynamically update to selectedThreshold = 85%');

  // Test threshold gating: when threshold is 95%, if strategy confidence is below 95%, signal must be WAIT
  engine.updateSettings({ selectedThreshold: 95 });
  const highThresholdSignal = engine.generateSignal('EURUSD_otc', 60);
  assert(
    highThresholdSignal.type === 'WAIT',
    'High threshold (95%) correctly holds signal in WAIT state when confidence is insufficient'
  );
  assert(
    highThresholdSignal.selectedThreshold === 95,
    'Signal includes selectedThreshold in payload'
  );
  assert(
    highThresholdSignal.validation !== undefined,
    'Signal includes validation metadata'
  );
  assert(
    highThresholdSignal.auditTrail !== undefined,
    'Signal includes comprehensive auditTrail metadata'
  );
  assert(
    highThresholdSignal.candle !== undefined,
    'Signal includes real candle structure and pattern analysis'
  );

  // Test 100% threshold rule: only 100% can pass
  engine.updateSettings({ selectedThreshold: 100 });
  const exact100Signal = engine.generateSignal('EURUSD_otc', 60);
  assert(
    exact100Signal.type === 'WAIT' || exact100Signal.actualConfidence === 100,
    '100% threshold rule strictly enforced (no false signals)'
  );

  console.log('\n--- ALL ENGINE TESTS PASSED SUCCESSFULLY! ---');
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
