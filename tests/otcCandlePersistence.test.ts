import { OTCCandleStore } from '../server/OTCCandleStore';
import { MarketDataStore } from '../server/MarketDataStore';
import { Candle } from '../server/types';

function assert(condition: boolean, testName: string) {
  if (!condition) {
    throw new Error(`[FAIL] ${testName}`);
  }
  console.log(`  ✓ [PASS] ${testName}`);
}

async function runOTCCandlePersistenceTests() {
  console.log('===============================================================');
  console.log('--- RUNNING OTC CANDLE PERSISTENCE & ISOLATION TEST MATRIX ---');
  console.log('===============================================================');

  // TEST 1: Initial State & Empty Context
  console.log('\nTEST 1: INITIAL STATE & EMPTY CONTEXT');
  const otcStore = new OTCCandleStore('EURUSD_otc', 60);
  assert(otcStore.getClosedCandles('EURUSD_otc', 60, 'DEMO').length === 0, 'Initial closed candles are empty');
  assert(otcStore.getFormingCandle('EURUSD_otc', 60, 'DEMO') === null, 'Initial forming candle is null');
  assert(otcStore.getAllCandles('EURUSD_otc', 60, 'DEMO').length === 0, 'Initial all candles are empty');

  // TEST 2: First Tick Starts Forming Candle
  console.log('\nTEST 2: FIRST TICK INGESTION');
  const baseTime = 1726830000; // Even 60s boundary
  const tick1 = otcStore.processTick('EURUSD_otc', baseTime + 5, 1.08500, 1, 'conn_1');
  assert(tick1 === true, 'Tick processed successfully');
  const forming1 = otcStore.getFormingCandle('EURUSD_otc', 60, 'DEMO');
  assert(forming1 !== null, 'Forming candle exists');
  assert(forming1?.open === 1.08500, 'Forming candle open matches first tick');
  assert(forming1?.high === 1.08500, 'Forming candle high matches first tick');
  assert(forming1?.low === 1.08500, 'Forming candle low matches first tick');
  assert(forming1?.close === 1.08500, 'Forming candle close matches first tick');
  assert(forming1?.time === baseTime, 'Forming candle bucket time matches 60s boundary');
  assert(forming1?.isClosed === false, 'Forming candle is not closed');
  assert(otcStore.getClosedCandles('EURUSD_otc', 60, 'DEMO').length === 0, 'No closed candles yet');

  // TEST 3: Multiple Ticks in Same Bucket Update Forming Candle In-Place
  console.log('\nTEST 3: INTRA-BUCKET TICKS UPDATE FORMING CANDLE');
  otcStore.processTick('EURUSD_otc', baseTime + 15, 1.08550, 1, 'conn_1'); // High
  otcStore.processTick('EURUSD_otc', baseTime + 30, 1.08480, 1, 'conn_1'); // Low
  otcStore.processTick('EURUSD_otc', baseTime + 45, 1.08520, 1, 'conn_1'); // Close
  const formingUpdated = otcStore.getFormingCandle('EURUSD_otc', 60, 'DEMO');
  assert(formingUpdated?.open === 1.08500, 'Open price preserved');
  assert(formingUpdated?.high === 1.08550, 'High price updated to highest tick');
  assert(formingUpdated?.low === 1.08480, 'Low price updated to lowest tick');
  assert(formingUpdated?.close === 1.08520, 'Close price updated to latest tick');
  assert(formingUpdated?.volume === 4, 'Volume accumulated to 4');
  assert(otcStore.getClosedCandles('EURUSD_otc', 60, 'DEMO').length === 0, 'Closed candles still 0 during formation');

  // TEST 4: Bucket Boundary Crossing Finalizes Candle 1 and Starts Candle 2
  console.log('\nTEST 4: BUCKET BOUNDARY FINALIZATION');
  const eventTracker = { closedEventFired: false };
  let closedCandleData: Candle | null = null;
  otcStore.onCandleClosed((c) => {
    eventTracker.closedEventFired = true;
    closedCandleData = c;
  });

  const nextBucketTime = baseTime + 60;
  otcStore.processTick('EURUSD_otc', nextBucketTime + 2, 1.08530, 1, 'conn_1');

  assert(eventTracker.closedEventFired === true, 'onCandleClosed listener fired');
  assert(closedCandleData !== null, 'Closed candle data received in event');
  assert(closedCandleData?.time === baseTime, 'Closed candle timestamp matches bucket 1');
  assert(closedCandleData?.close === 1.08520, 'Closed candle final close matches last tick of bucket 1');
  assert(closedCandleData?.isClosed === true, 'Closed candle has isClosed = true');

  const closedCandles = otcStore.getClosedCandles('EURUSD_otc', 60, 'DEMO');
  assert(closedCandles.length === 1, 'Exactly 1 closed candle in history');
  assert(closedCandles[0].time === baseTime, 'Stored closed candle timestamp is correct');

  const forming2 = otcStore.getFormingCandle('EURUSD_otc', 60, 'DEMO');
  assert(forming2 !== null, 'Candle 2 forming active');
  assert(forming2?.time === nextBucketTime, 'Candle 2 bucket matches second minute');
  assert(forming2?.open === 1.08530, 'Candle 2 open price matches new tick');

  // TEST 5: Closed Candle is Permanently Retained (Never Overwritten)
  console.log('\nTEST 5: PERMANENT RETENTION ACROSS MULTIPLE CANDLE CLOSURES');
  for (let m = 2; m <= 10; m++) {
    const bucket = baseTime + m * 60;
    otcStore.processTick('EURUSD_otc', bucket + 10, 1.08500 + m * 0.0001, 1, 'conn_1');
    otcStore.processTick('EURUSD_otc', bucket + 50, 1.08510 + m * 0.0001, 1, 'conn_1');
  }
  // Transition past 10th candle
  otcStore.processTick('EURUSD_otc', baseTime + 11 * 60 + 5, 1.08650, 1, 'conn_1');

  const allClosed = otcStore.getClosedCandles('EURUSD_otc', 60, 'DEMO');
  assert(allClosed.length === 11, `Expected 11 closed candles, got ${allClosed.length}`);
  assert(allClosed[0].time === baseTime, 'Candle 1 timestamp remains unchanged');
  assert(allClosed[0].close === 1.08520, 'Candle 1 close remains completely unchanged');
  assert(allClosed.every((c) => c.isClosed === true), 'All closed candles have isClosed = true');

  // TEST 6: Strict Isolation Between REAL and DEMO Accounts
  console.log('\nTEST 6: STRICT REAL VS DEMO ACCOUNT ISOLATION');
  // Currently we were operating in DEMO
  const demoClosed = otcStore.getClosedCandles('EURUSD_otc', 60, 'DEMO');
  const realClosed = otcStore.getClosedCandles('EURUSD_otc', 60, 'REAL');
  assert(demoClosed.length === 11, 'DEMO context has 11 candles');
  assert(realClosed.length === 0, 'REAL context has strictly 0 candles (no leakage from DEMO)');

  // Now switch active context to REAL
  otcStore.setActiveContext('EURUSD_otc', 60, 'REAL', 2, 'conn_real');
  otcStore.processTick('EURUSD_otc', baseTime + 100 * 60, 1.09000, 2, 'conn_real');
  otcStore.processTick('EURUSD_otc', baseTime + 101 * 60, 1.09050, 2, 'conn_real');

  const realClosedAfter = otcStore.getClosedCandles('EURUSD_otc', 60, 'REAL');
  const demoClosedAfter = otcStore.getClosedCandles('EURUSD_otc', 60, 'DEMO');

  assert(realClosedAfter.length === 1, 'REAL context has 1 closed candle');
  assert(realClosedAfter[0].close === 1.09000, 'REAL closed candle close price matches REAL tick');
  assert(demoClosedAfter.length === 11, 'DEMO closed candles remain strictly 11 (no leakage from REAL)');

  // TEST 7: Broker Historical Candles Ingestion
  console.log('\nTEST 7: BROKER HISTORICAL CANDLES INGESTION');
  const historicalBatch: Candle[] = [];
  for (let i = 0; i < 50; i++) {
    historicalBatch.push({
      asset: 'EURUSD_otc',
      timeframe: 60,
      time: baseTime - (60 - i) * 60,
      open: 1.0800 + i * 0.0001,
      high: 1.0805 + i * 0.0001,
      low: 1.0795 + i * 0.0001,
      close: 1.0802 + i * 0.0001,
      volume: 50,
      isClosed: true,
      source: 'POCKET_OPTION_OTC',
    });
  }

  otcStore.loadBrokerCandles('EURUSD_otc', 60, historicalBatch, 'DEMO');
  const demoAfterLoad = otcStore.getClosedCandles('EURUSD_otc', 60, 'DEMO');
  // 50 historical + 11 from earlier = 61 total
  assert(demoAfterLoad.length === 61, `DEMO total candles: expected 61, got ${demoAfterLoad.length}`);
  // REAL should still have only 1 candle
  assert(otcStore.getClosedCandles('EURUSD_otc', 60, 'REAL').length === 1, 'REAL context remains unaffected by DEMO load');

  // TEST 8: MarketDataStore Integration Verification
  console.log('\nTEST 8: MARKETDATASTORE FACADE DELEGATION');
  const mds = new MarketDataStore('EURUSD_otc', 60);
  mds.setAccountMode('DEMO', 1);
  const mdsOtcStore = mds.getOTCCandleStore();
  mdsOtcStore.loadBrokerCandles('EURUSD_otc', 60, historicalBatch, 'DEMO');

  const mdsCandles = mds.getCandles('EURUSD_otc', 60);
  assert(mdsCandles.length === 50, `MarketDataStore.getCandles returned ${mdsCandles.length} candles`);
  assert(mds.getClosedCandles().length === 50, 'MarketDataStore.getClosedCandles returned 50 closed candles');

  // Check mode switch in MarketDataStore
  mds.setAccountMode('REAL', 2);
  assert(mds.getAccountMode() === 'REAL', 'Account mode updated to REAL');
  assert(mds.getClosedCandles().length === 0, 'REAL closed candles empty on fresh REAL mode');

  console.log('\n===============================================================');
  console.log('✓✓✓ ALL OTC CANDLE PERSISTENCE & ISOLATION TESTS PASSED! ✓✓✓');
  console.log('===============================================================');
}

runOTCCandlePersistenceTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
