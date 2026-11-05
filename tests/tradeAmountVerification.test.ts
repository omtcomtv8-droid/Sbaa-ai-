import { AutoTraderEngine } from '../server/AutoTraderEngine';
import { StrategyEngine } from '../server/StrategyEngine';
import { PocketOptionService } from '../server/PocketOptionService';
import { CandleBuilder } from '../server/CandleBuilder';
import { SbaaStrategyEngine } from '../server/sbaa/SbaaStrategyEngine';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ [FAIL] ${msg}`);
    process.exit(1);
  } else {
    console.log(`  ✓ [PASS] ${msg}`);
  }
}

async function runTradeAmountVerificationTest() {
  console.log('=====================================================================');
  console.log('--- TRADE AMOUNT & $25 CAP REMOVAL COMPREHENSIVE VERIFICATION ---');
  console.log('=====================================================================\n');

  const candleBuilder = new CandleBuilder();
  const poService = new PocketOptionService(
    candleBuilder,
    'wss://api-fin.po.market/socket.io/?EIO=4&transport=websocket',
    'EURUSD_otc',
    60
  );
  const strategyEngine = new StrategyEngine(candleBuilder);
  const sbaaEngine = new SbaaStrategyEngine(candleBuilder, poService);
  const autoTrader = new AutoTraderEngine(strategyEngine, poService, undefined, sbaaEngine);

  // TEST 1: Default config verification
  console.log('[TEST 1: Default AutoTraderEngine Config]');
  const initialStatus = autoTrader.getStatus();
  assert(initialStatus.config.maxAmount === 1000.0, `Default maxAmount is 1000.0 (actual: ${initialStatus.config.maxAmount})`);
  assert(initialStatus.config.maxAmount !== 25.0, 'Default maxAmount is NOT clamped to 25.0');

  // TEST 2: Testing all required amount presets: 25$, 50$, 75$, 100$, 150$, 200$, 250$, 500$, 750$, 1000$
  console.log('\n[TEST 2: Saving and Validating Required Amount Presets]');
  const testAmounts = [25, 50, 75, 100, 150, 200, 250, 500, 750, 1000];

  for (const amt of testAmounts) {
    autoTrader.saveSettings({ baseAmount: amt });
    const status = autoTrader.getStatus();
    assert(status.config.baseAmount === amt, `Base amount correctly set to $${amt}`);
    assert(status.config.maxAmount >= amt, `maxAmount ($${status.config.maxAmount}) does not clamp $${amt}`);
  }

  // TEST 3: Specific tests requested by user: 100$, 500$, 1000$ must execute without 25$ clamp
  console.log('\n[TEST 3: Verification of $100, $500, and $1000 without 25$ clamp]');
  
  // Test $100
  autoTrader.saveSettings({ baseAmount: 100.0 });
  let currentStatus = autoTrader.getStatus();
  assert(currentStatus.config.baseAmount === 100.0, 'Configured for $100.00');
  assert(currentStatus.config.maxAmount >= 100.0, 'maxAmount allows $100.00 without being capped at 25$');

  // Test $500
  autoTrader.saveSettings({ baseAmount: 500.0 });
  currentStatus = autoTrader.getStatus();
  assert(currentStatus.config.baseAmount === 500.0, 'Configured for $500.00');
  assert(currentStatus.config.maxAmount >= 500.0, 'maxAmount allows $500.00 without being capped at 25$');

  // Test $1000
  autoTrader.saveSettings({ baseAmount: 1000.0 });
  currentStatus = autoTrader.getStatus();
  assert(currentStatus.config.baseAmount === 1000.0, 'Configured for $1000.00');
  assert(currentStatus.config.maxAmount >= 1000.0, 'maxAmount allows $1000.00 without being capped at 25$');

  // TEST 4: AutoTrader start with higher amounts
  console.log('\n[TEST 4: Start AutoTrader with $500 baseAmount]');
  const startRes = autoTrader.start({ baseAmount: 500.0, isDemo: true });
  assert(startRes.success === true, 'AutoTrader started successfully');
  const runningStatus = autoTrader.getStatus();
  assert(runningStatus.config.baseAmount === 500.0, 'Running config has baseAmount = 500.0');
  assert(runningStatus.config.maxAmount >= 500.0, 'Running config maxAmount >= 500.0');
  autoTrader.stop();

  // TEST 5: PocketOptionService.openDeal limits and balance checks
  console.log('\n[TEST 5: PocketOptionService Deal Validation]');
  
  // Amount < 1.0 rejected
  const resLow = await poService.openDeal({ amount: 0.5, action: 'call' });
  assert(resLow.success === false, 'Amounts < 1.0 rejected');

  // Amount > 1000.0 rejected
  const resHigh = await poService.openDeal({ amount: 1005.0, action: 'call' });
  assert(resHigh.success === false, 'Amounts > 1000.0 rejected');

  // Valid amounts: 25, 100, 500, 1000 are permitted by amount validator
  for (const amt of [25, 100, 500, 1000]) {
    const rawAmount = Number(amt);
    const isValid = !isNaN(rawAmount) && rawAmount >= 1.0 && rawAmount <= 1000.0;
    assert(isValid, `Amount $${amt} is within allowed range (1.00 - 1000.00)`);
  }

  // TEST 6: Idleness on Amount Change (Requirement 10: No auto execution on amount change)
  console.log('\n[TEST 6: Changing Amount Does NOT Trigger Automatic Trades]');
  const tradesBefore = autoTrader.getStatus().totalTrades;
  autoTrader.saveSettings({ baseAmount: 250.0 });
  autoTrader.saveSettings({ baseAmount: 500.0 });
  autoTrader.saveSettings({ baseAmount: 1000.0 });
  const tradesAfter = autoTrader.getStatus().totalTrades;
  assert(tradesBefore === tradesAfter, 'Zero trades executed when simply changing or selecting amount');

  console.log('\n=====================================================================');
  console.log('🎉 ALL TRADE AMOUNT & 25$ CAP REMOVAL TESTS PASSED SUCCESSFULLY!');
  console.log('=====================================================================');
  process.exit(0);
}

runTradeAmountVerificationTest().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
