import assert from 'assert';
import {
  PocketOptionSessionSnapshot,
  pocketOptionSessionStore,
} from '../src/services/PocketOptionSessionStore';
import { pocketOptionConnectionService } from '../src/services/PocketOptionConnectionService';

console.log('===============================================================');
console.log('--- RUNNING POCKET OPTION SSD LOGIN LOOP & AUTH SUITE ---');
console.log('===============================================================');

// TEST 1: STRICT STATE SEPARATION
console.log('TEST 1: STRICT STATE SEPARATION (App Auth vs PO Connection vs Account vs Balance)');
const initialSnap = pocketOptionSessionStore.getState();
assert.strictEqual(typeof initialSnap.appAuth, 'string', 'appAuth is distinct');
assert.strictEqual(typeof initialSnap.connectionState, 'string', 'connectionState is distinct');
assert.strictEqual(typeof initialSnap.accountState, 'string', 'accountState is distinct');
assert.strictEqual(typeof initialSnap.balanceState, 'string', 'balanceState is distinct');
assert.strictEqual(typeof initialSnap.generation, 'number', 'generation is tracked');
console.log('  ✓ [PASS] Separate states are strictly partitioned in PocketOptionSessionStore');

// TEST 2: SINGLE SUBMISSION & GENERATION ADVANCEMENT
console.log('TEST 2: ATOMIC GENERATION ADVANCEMENT & STALE PROTECTION');
const gen1 = pocketOptionSessionStore.startConnecting({
  attemptId: 'attempt_test_1',
  requestedMode: 'REAL',
  sessionToken: 'valid_ssd_session_token_12345',
});
const snapGen1 = pocketOptionSessionStore.getState();
assert.strictEqual(snapGen1.connectionState, 'PO_CONNECTION_CONNECTING');
assert.strictEqual(snapGen1.generation, gen1);
assert.strictEqual(snapGen1.cachedSessionToken, 'valid_ssd_session_token_12345');

// Advance to authenticating
pocketOptionSessionStore.setAuthenticating(gen1);
assert.strictEqual(pocketOptionSessionStore.getState().connectionState, 'PO_CONNECTION_AUTHENTICATING');
console.log('  ✓ [PASS] Generation correctly advanced to', gen1, 'and state is PO_CONNECTION_AUTHENTICATING');

// TEST 3: STALE RESPONSE FROM OLDER GENERATION MUST BE IGNORED
console.log('TEST 3: STALE OLD GENERATION IGNORED');
const gen2 = pocketOptionSessionStore.startConnecting({
  attemptId: 'attempt_test_2',
  requestedMode: 'REAL',
  sessionToken: 'valid_ssd_session_token_12345',
});
assert.strictEqual(gen2, gen1 + 1);

// Attempt to send an authentication success for gen1 (old)
pocketOptionSessionStore.setAuthenticated({
  generation: gen1, // Stale!
  accountId: 'OLD_UID_111',
  accountMode: 'REAL',
});

// Verify gen1 update was rejected
const snapAfterStale = pocketOptionSessionStore.getState();
assert.strictEqual(snapAfterStale.generation, gen2);
assert.strictEqual(snapAfterStale.authenticated, false, 'Old gen1 response was ignored');
console.log('  ✓ [PASS] Response from older generation #1 was rejected by generation #2');

// TEST 4: AUTHENTICATION SUCCEEDS WITHOUT REQUIRING IMMEDIATE BALANCE
console.log('TEST 4: AUTHENTICATION SUCCESS SEPARATE FROM BALANCE ARRIVAL');
pocketOptionSessionStore.setAuthenticated({
  generation: gen2,
  accountId: 'VERIFIED_UID_8888',
  accountMode: 'REAL',
});

const snapAuthed = pocketOptionSessionStore.getState();
assert.strictEqual(snapAuthed.connectionState, 'PO_CONNECTION_AUTHENTICATED');
assert.strictEqual(snapAuthed.authenticated, true);
assert.strictEqual(snapAuthed.accountState, 'ACCOUNT_READY');
assert.strictEqual(snapAuthed.account?.accountId, 'VERIFIED_UID_8888');
assert.strictEqual(snapAuthed.balance, null, 'Balance is not yet loaded');
assert.strictEqual(snapAuthed.balanceState, 'BALANCE_LOADING', 'Balance state is LOADING without resetting auth');
assert.strictEqual(snapAuthed.authenticated, true, 'User remains authenticated even with null balance');
console.log('  ✓ [PASS] Platform authenticated successfully while balance is still loading');

// TEST 5: NO LOGOUT OR REDIRECT WHEN BALANCE IS MISSING/UNAVAILABLE
console.log('TEST 5: BALANCE TIMEOUT DOES NOT RESET AUTHENTICATION');
pocketOptionSessionStore.setBalanceUnavailable(gen2);
const snapNoBal = pocketOptionSessionStore.getState();
assert.strictEqual(snapNoBal.connectionState, 'PO_CONNECTION_AUTHENTICATED', 'Connection stays authenticated');
assert.strictEqual(snapNoBal.authenticated, true, 'Authenticated remains true');
assert.strictEqual(snapNoBal.balanceState, 'BALANCE_UNAVAILABLE');
console.log('  ✓ [PASS] Balance marked BALANCE_UNAVAILABLE without disconnecting or redirecting');

// TEST 6: REAL BALANCE ARRIVAL & VALIDATION
console.log('TEST 6: VERIFIED BALANCE APPLICATION');
pocketOptionSessionStore.setVerifiedBalance({
  generation: gen2,
  balance: 1425.50,
  accountMode: 'REAL',
  currency: 'USD',
});
const snapVerifiedBal = pocketOptionSessionStore.getState();
assert.strictEqual(snapVerifiedBal.balance, 1425.50);
assert.strictEqual(snapVerifiedBal.balanceVerified, true);
assert.strictEqual(snapVerifiedBal.balanceState, 'BALANCE_READY');
console.log('  ✓ [PASS] Verified balance of $1425.50 recorded cleanly for REAL account');

// TEST 7: REAL VS DEMO DATA ISOLATION (NO MIXING)
console.log('TEST 7: DEMO BALANCE NEVER OVERWRITES ACTIVE REAL ACCOUNT');
pocketOptionSessionStore.setVerifiedBalance({
  generation: gen2,
  balance: 50000.00,
  accountMode: 'DEMO', // Mismatched mode!
});
const snapIsolation = pocketOptionSessionStore.getState();
assert.strictEqual(snapIsolation.balance, 1425.50, 'Demo balance rejected when account is REAL');
assert.strictEqual(snapIsolation.accountMode, 'REAL');
console.log('  ✓ [PASS] Real account balance remained $1425.50 and rejected incoming DEMO balance');

// TEST 8: TIMEOUT AND ERROR DO NOT WIPE CACHED SESSION
console.log('TEST 8: FAILED CONNECTION PRESERVES CACHED SESSION & AVOIDS CRASH');
const gen3 = pocketOptionSessionStore.startConnecting({
  attemptId: 'attempt_timeout_test',
  requestedMode: 'REAL',
  sessionToken: 'my_saved_ssd_123',
});
pocketOptionSessionStore.setConnectionFailed({
  generation: gen3,
  errorCode: 'TIMEOUT',
  errorMessage: 'Pocket Option server handshake timed out',
});
const snapFailed = pocketOptionSessionStore.getState();
assert.strictEqual(snapFailed.connectionState, 'PO_CONNECTION_FAILED');
assert.strictEqual(snapFailed.error?.code, 'TIMEOUT');
assert.strictEqual(snapFailed.cachedSessionToken, 'my_saved_ssd_123', 'Session token preserved for retry');
assert.strictEqual(snapFailed.authenticated, false);
console.log('  ✓ [PASS] Timeout set PO_CONNECTION_FAILED without crashing and preserved session in memory');

// TEST 9: DISCONNECT DOES NOT DESTROY APPLICATION AUTH
console.log('TEST 9: DISCONNECT ISOLATED TO POCKET OPTION');
pocketOptionSessionStore.disconnect();
const snapDisc = pocketOptionSessionStore.getState();
assert.strictEqual(snapDisc.connectionState, 'PO_CONNECTION_DISCONNECTED');
assert.strictEqual(snapDisc.appAuth, 'APP_AUTHENTICATED', 'Application auth preserved');
assert.strictEqual(snapDisc.balance, null);
console.log('  ✓ [PASS] Disconnect cleanly reset Pocket Option session without logging out of the app');

console.log('===============================================================');
console.log('✓✓✓ ALL POCKET OPTION SSD LOGIN LOOP & AUTH TESTS PASSED! ✓✓✓');
console.log('===============================================================');
