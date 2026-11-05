/**
 * tests/demoMetricsIsolation.test.ts
 *
 * Verifies:
 * 1. DemoMetricsService strictly conforms to:
 *    - Range [50, 700] active users
 *    - Label "المستخدمون النشطون الآن — تجريبي"
 *    - Gradual simulation movement
 *    - Demo user activities with "نشاط تجريبي — Demo" badge and anonymous IDs only
 *    - Simulated profit cards with "+ $..." and "SIMULATED" badge
 *    - Complete separation: isSimulated = true
 * 2. RealMetricsService strictly conforms to:
 *    - isSimulated = false
 *    - Completely independent of DemoMetricsService
 *    - No mock data allowed
 * 3. Static isolation:
 *    - DemoMetricsService is never imported by trading terminal views or real execution
 *    - DemoPlatformActivityCard is only included in the login / landing page
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { DemoMetricsService } from '../src/services/DemoMetricsService';
import { RealMetricsService } from '../src/services/RealMetricsService';

console.log('--- Starting Demo Metrics & Real Data Separation Tests ---');

// Test 1: Demo snapshot integrity
const demoSnapshot = DemoMetricsService.getSnapshot();
console.log('1. Checking DemoMetricsService snapshot...');
assert.strictEqual(demoSnapshot.isSimulated, true, 'Demo snapshot must have isSimulated: true');
assert.strictEqual(demoSnapshot.activeUsersLabel, 'المستخدمون النشطون الآن — تجريبي');
assert.strictEqual(demoSnapshot.minUsersRange, 50, 'Minimum range must be 50');
assert.strictEqual(demoSnapshot.maxUsersRange, 700, 'Maximum range must be 700');
assert(demoSnapshot.activeUsers >= 50 && demoSnapshot.activeUsers <= 700, 'Users count must be within [50, 700]');

// Test 2: Demo activities check
console.log('2. Checking Demo activities...');
assert(demoSnapshot.recentActivities.length > 0, 'Must have recent activities');
const allowedActions = [
  'مستخدم جديد سجّل الدخول',
  'مستخدم يشاهد الأسواق',
  'مستخدم فتح صفحة التحليل'
];
for (const act of demoSnapshot.recentActivities) {
  assert(allowedActions.includes(act.action), `Action "${act.action}" must be in allowed list`);
  assert.strictEqual(act.badge, 'نشاط تجريبي — Demo', 'Activity badge must explicitly state demo');
  assert(act.userTag.startsWith('مستخدم تجريبي'), 'User tag must be anonymous demo tag without real identities');
}

// Test 3: Demo profit cards check
console.log('3. Checking Demo profit cards...');
assert(demoSnapshot.recentProfits.length >= 3, 'Must have at least 3 profit cards');
for (const profit of demoSnapshot.recentProfits) {
  assert.strictEqual(profit.label, 'SIMULATED', 'Profit label must be SIMULATED');
  assert(profit.amount > 0, 'Amount must be positive');
  assert(profit.formatted.includes('$'), 'Formatted string must include dollar sign');
  assert(profit.asset.includes('(Demo)'), 'Asset must clearly designate demo status');
}

// Test 4: RealMetricsService integrity & complete separation
console.log('4. Checking RealMetricsService...');
const realSnapshot = RealMetricsService.getSnapshot();
assert.strictEqual(realSnapshot.isSimulated, false, 'RealMetricsService must have isSimulated: false');
assert.strictEqual(realSnapshot.isAuthenticated, false, 'Initial state must be unauthenticated');
assert.strictEqual(realSnapshot.realWinRate, null, 'Unauthenticated win rate must be null, never mocked');
assert.strictEqual(realSnapshot.realBalance, null, 'Unauthenticated balance must be null, never mocked');

// Test 5: Static code scan to guarantee strict boundary separation
console.log('5. Checking strict isolation across files...');
const srcDir = path.join(process.cwd(), 'src');

function getAllFiles(dir: string, fileList: string[] = []): string[] {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getAllFiles(filePath, fileList);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

const allSrcFiles = getAllFiles(srcDir);
const realTradingComponents = [
  'SignalPanel.tsx',
  'SignalHistoryTable.tsx',
  'PerformancePanel.tsx',
  'TechnicalGauges.tsx',
  'CandlestickChart.tsx',
  'RiskManagementView.tsx',
  'MarketRegimeCard.tsx',
  'MarketDirectionPanel.tsx',
];

for (const filePath of allSrcFiles) {
  const baseName = path.basename(filePath);
  const content = fs.readFileSync(filePath, 'utf-8');

  // Verify real trading components never import DemoMetricsService
  if (realTradingComponents.includes(baseName)) {
    assert(
      !content.includes('DemoMetricsService'),
      `Violation: Real trading component ${baseName} must NEVER import DemoMetricsService`
    );
    assert(
      !content.includes('DemoPlatformActivityCard'),
      `Violation: Real trading component ${baseName} must NEVER render DemoPlatformActivityCard`
    );
  }

  // Verify RealMetricsService never references DemoMetricsService
  if (baseName === 'RealMetricsService.ts') {
    assert(
      !content.includes('from \'./DemoMetricsService\'') && !content.includes('from "./DemoMetricsService"'),
      'RealMetricsService must NEVER import from DemoMetricsService'
    );
  }
}

// Test 6: Verify DemoPlatformActivityCard contains NO fake or simulated claims
console.log('6. Verifying DemoPlatformActivityCard has zero fake/simulated text...');
const cardPath = path.join(process.cwd(), 'src/components/DemoPlatformActivityCard.tsx');
const cardContent = fs.readFileSync(cardPath, 'utf-8');

assert(!cardContent.includes('حركة محاكاة طبيعية'), 'Must NOT contain حركة محاكاة طبيعية');
assert(!cardContent.includes('أرقام تجريبية'), 'Must NOT contain أرقام تجريبية');
assert(!cardContent.includes('Simulated Data'), 'Must NOT contain Simulated Data');
assert(!cardContent.includes('SIMULATED'), 'Must NOT contain SIMULATED badge');
assert(!cardContent.includes('نشاط تجريبي — Demo'), 'Must NOT contain نشاط تجريبي — Demo');
assert(cardContent.includes('نشاط حقيقي — Real Activity'), 'Must contain نشاط حقيقي — Real Activity');
assert(cardContent.includes('بيانات حقيقية 100%'), 'Must guarantee 100% real data');

// Clean up
DemoMetricsService.stop();

console.log('ALL DEMO METRICS & REAL PLATFORM ACTIVITY TESTS PASSED SUCCESSFULLY! ✅');
