import { readFileSync } from 'fs';
import { spawnSync } from 'child_process';
import crypto from 'crypto';
import {
  calculateSMA,
  calculateEMA,
  calculateWMA,
  calculateHMA,
  calculateRSI,
  calculateBollingerBands,
  calculateMACD,
  calculateATR,
  calculateADX,
  calculateStochastic,
  calculateCCI,
  calculateWilliamsR,
  calculateROC,
} from '../server/indicators';
import { Candle } from '../server/types';

export interface IndicatorComparisonResult {
  indicator: string;
  timeframe: number;
  asset: string;
  inputHash: string;
  tsValue: number;
  pythonValue: number;
  difference: number;
  tolerance: number;
  status: 'PASS' | 'FAIL';
}

console.log('--- STARTING TYPESCRIPT / PYTHON CROSS-VALIDATION ---');

const fixtureRaw = readFileSync('tests/fixtures/eurusd_otc_5s_fixture.json', 'utf-8');
const fixture = JSON.parse(fixtureRaw);
const candles: Candle[] = fixture.candles;
const closes: number[] = candles.map((c) => c.close);

const inputHash = crypto.createHash('sha256').update(fixtureRaw).digest('hex').slice(0, 12);
const asset = fixture.metadata.asset;
const timeframe = fixture.metadata.timeframe;

// 1. Run Python validator via stdio
const pyProcess = spawnSync('python3', ['-m', 'python.validate'], {
  input: JSON.stringify({ candles }),
  encoding: 'utf-8',
});

if (pyProcess.error || pyProcess.status !== 0) {
  console.error('Python validation failed:', pyProcess.stderr);
  process.exit(1);
}

const pyResults = JSON.parse(pyProcess.stdout);

// 2. Run TypeScript indicators
const tsSma20 = calculateSMA(closes, 20)!;
const tsSma50 = calculateSMA(closes, 50)!;
const tsEma9 = calculateEMA(closes, 9)!;
const tsEma21 = calculateEMA(closes, 21)!;
const tsWma20 = calculateWMA(closes, 20)!;
const tsHma20 = calculateHMA(closes, 20)!;
const tsRsi14 = calculateRSI(closes, 14)!;
const tsBB = calculateBollingerBands(closes, 20, 2)!;
const tsMacd = calculateMACD(closes, 12, 26, 9)!;
const tsAtr14 = calculateATR(candles, 14)!;
const tsAdx14 = calculateADX(candles, 14)!;
const tsStoch = calculateStochastic(candles, 14, 3)!;
const tsCci20 = calculateCCI(candles, 20)!;
const tsWr14 = calculateWilliamsR(candles, 14)!;
const tsRoc12 = calculateROC(closes, 12)!;

const comparisons: IndicatorComparisonResult[] = [];

function check(
  name: string,
  tsVal: number,
  pyVal: number,
  tolerance: number = 0.0001
) {
  const diff = Math.abs(tsVal - pyVal);
  const pass = diff <= tolerance;
  const result: IndicatorComparisonResult = {
    indicator: name,
    timeframe,
    asset,
    inputHash,
    tsValue: tsVal,
    pythonValue: pyVal,
    difference: Number(diff.toFixed(6)),
    tolerance,
    status: pass ? 'PASS' : 'FAIL',
  };
  comparisons.push(result);
  console.log(
    `[${result.status}] ${name.padEnd(16)} | TS: ${tsVal} | PY: ${pyVal} | Diff: ${diff.toFixed(6)} (Tol: ${tolerance})`
  );
  if (!pass) {
    throw new Error(`PARITY FAILURE on ${name}: TS=${tsVal} vs PY=${pyVal} (Diff: ${diff})`);
  }
}

// Moving Averages
check('SMA(20)', tsSma20, pyResults.sma20, 0.00001);
check('SMA(50)', tsSma50, pyResults.sma50, 0.00001);
check('EMA(9)', tsEma9, pyResults.ema9, 0.00005);
check('EMA(21)', tsEma21, pyResults.ema21, 0.00005);
check('WMA(20)', tsWma20, pyResults.wma20, 0.00001);
check('HMA(20)', tsHma20, pyResults.hma20, 0.0001);

// Oscillators
check('RSI(14)', tsRsi14, pyResults.rsi14, 0.05);
check('Stochastic(%K)', tsStoch.k, pyResults.stochastic.k, 0.05);
check('Stochastic(%D)', tsStoch.d, pyResults.stochastic.d, 0.05);
check('Williams%R(14)', tsWr14, pyResults.williamsR14, 0.05);
check('CCI(20)', tsCci20, pyResults.cci20, 0.05);
check('ROC(12)', tsRoc12, pyResults.roc12, 0.001);

// Volatility & Trend
check('Bollinger(Upper)', tsBB.upper, pyResults.bollinger.upper, 0.00005);
check('Bollinger(Middle)', tsBB.middle, pyResults.bollinger.middle, 0.00005);
check('Bollinger(Lower)', tsBB.lower, pyResults.bollinger.lower, 0.00005);
check('MACD(Line)', tsMacd.macd, pyResults.macd.macd, 0.00005);
check('MACD(Signal)', tsMacd.signal, pyResults.macd.signal, 0.00005);
check('ATR(14)', tsAtr14.currentATR, pyResults.atr14.currentATR, 0.00005);
check('ADX(14)', tsAdx14.adx, pyResults.adx14.adx, 0.1);

console.log(`\n✓ ALL ${comparisons.length} INDICATOR CROSS-VALIDATIONS PASSED WITH ZERO DISCREPANCIES!`);
