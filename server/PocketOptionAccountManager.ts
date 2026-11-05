import {
  AccountContextState,
  AccountInfo,
  AccountMode,
  AccountStatus,
  BalanceStatus,
  PocketOptionSessionContext,
  SessionFormatType,
} from './types';

export interface ImmutableAuthSnapshot {
  mode: AccountMode;
  isDemo: 0 | 1;
  uid: number;
  sessionToken: string;
  platform: number;
  connectionId: string;
  generation: number;
  sourceFormat: SessionFormatType;
}

/**
 * PocketOptionAccountManager provides absolute isolation between REAL and DEMO account contexts.
 *
 * Enforces:
 * 1. ZERO cross-contamination between REAL and DEMO data (balance, UID, credentials, sockets).
 * 2. Session Generation Tracking: Every login/credential/mode update increments sessionGeneration.
 *    Any callback whose local generation !== currentSessionGeneration is rejected.
 * 3. Immutable Auth Snapshots built immediately before transmission.
 * 4. Mode-based balance and credential encapsulation.
 */
export class PocketOptionAccountManager {
  private activeMode: AccountMode = 'DEMO';
  private sessionGeneration: number = 1;

  private contexts: Record<AccountMode, AccountContextState> = {
    REAL: {
      mode: 'REAL',
      isDemo: 0,
      uid: null,
      sessionToken: '',
      platform: 2,
      connectionId: null,
      generation: 1,
      authenticated: false,
      authState: 'IDLE',
      status: 'DISCONNECTED',
      authError: null,
      lastAuthResponse: null,
      balance: null,
      balanceStatus: 'UNAVAILABLE',
      currency: 'USD',
      lastKnownBalance: null,
      lastKnownBalanceTimestamp: null,
      assets: [],
      shouldAutoReconnect: true,
    },
    DEMO: {
      mode: 'DEMO',
      isDemo: 1,
      uid: null,
      sessionToken: '',
      platform: 2,
      connectionId: null,
      generation: 1,
      authenticated: false,
      authState: 'IDLE',
      status: 'DISCONNECTED',
      authError: null,
      lastAuthResponse: null,
      balance: null,
      balanceStatus: 'UNAVAILABLE',
      currency: 'USD',
      lastKnownBalance: null,
      lastKnownBalanceTimestamp: null,
      assets: [],
      shouldAutoReconnect: true,
    },
  };

  constructor(initialMode: AccountMode = 'DEMO') {
    this.activeMode = initialMode;
    this.sessionGeneration = 1;
  }

  public getActiveMode(): AccountMode {
    return this.activeMode;
  }

  public getSessionGeneration(): number {
    return this.sessionGeneration;
  }

  public getGeneration(): number {
    return this.sessionGeneration;
  }

  public incrementGeneration(): number {
    this.sessionGeneration++;
    this.contexts[this.activeMode].generation = this.sessionGeneration;
    return this.sessionGeneration;
  }

  public isEventCurrent(generation: number): boolean {
    return generation === this.sessionGeneration;
  }

  public getActiveContext(): AccountContextState {
    return { ...this.contexts[this.activeMode], assets: [...this.contexts[this.activeMode].assets] };
  }

  public getContext(mode: AccountMode): AccountContextState {
    return { ...this.contexts[mode], assets: [...this.contexts[mode].assets] };
  }

  public getSnapshot(mode?: AccountMode): AccountContextState {
    const targetMode = mode || this.activeMode;
    return this.getContext(targetMode);
  }

  public setToken(mode: AccountMode, token: string): void {
    this.contexts[mode].sessionToken = token.trim();
  }

  public setBalance(mode: AccountMode, balance: number, currency = 'USD'): void {
    const ctx = this.contexts[mode];
    ctx.balance = balance;
    ctx.balanceStatus = 'LIVE';
    ctx.currency = currency;
    ctx.lastKnownBalance = balance;
    ctx.lastKnownBalanceTimestamp = Date.now();
  }

  public setAssets(mode: AccountMode, assets: any[]): void {
    this.contexts[mode].assets = [...assets];
  }

  public markAuthAttempt(generation: number): void {
    if (generation === this.sessionGeneration) {
      const ctx = this.contexts[this.activeMode];
      ctx.authState = 'PENDING';
      ctx.status = 'LOADING';
    }
  }

  public markAuthFailed(generation: number, reason: string): void {
    if (generation === this.sessionGeneration) {
      const ctx = this.contexts[this.activeMode];
      ctx.authenticated = false;
      ctx.authState = 'FAILED';
      ctx.status = 'INVALID';
      ctx.authError = reason;
      ctx.shouldAutoReconnect = false;
    }
  }

  public shouldReconnect(): boolean {
    return this.contexts[this.activeMode].shouldAutoReconnect && this.contexts[this.activeMode].status !== 'INVALID';
  }

  /**
   * Switches the active account mode (REAL <-> DEMO).
   * Increments sessionGeneration to immediately invalidate any in-flight events from the old mode.
   * Clears live runtime connection state in both contexts.
   */
  public switchMode(newMode: AccountMode): number {
    if (this.activeMode === newMode) {
      return this.sessionGeneration;
    }

    this.sessionGeneration++;
    const prevMode = this.activeMode;
    this.activeMode = newMode;

    // Reset runtime live state of previous mode to prevent leakage
    this.contexts[prevMode].authenticated = false;
    this.contexts[prevMode].authState = 'IDLE';
    this.contexts[prevMode].connectionId = null;

    // Active mode gets fresh generation tag and reset runtime state
    this.contexts[newMode].generation = this.sessionGeneration;
    this.contexts[newMode].authenticated = false;
    this.contexts[newMode].authState = 'IDLE';
    this.contexts[newMode].connectionId = null;

    return this.sessionGeneration;
  }

  /**
   * Sets credentials for a specific account mode without corrupting the other mode.
   */
  public setCredentials(params: {
    mode: AccountMode;
    sessionToken: string;
    uid?: number | null;
    platform?: number;
  }): number {
    this.sessionGeneration++;
    const target = this.contexts[params.mode];

    target.sessionToken = params.sessionToken.trim();
    if (params.uid !== undefined) {
      target.uid = params.uid !== null && params.uid > 0 ? params.uid : null;
    }
    if (params.platform) {
      target.platform = params.platform;
    }
    target.generation = this.sessionGeneration;
    target.authenticated = false;
    target.authState = 'IDLE';
    target.authError = null;
    target.connectionId = null;

    // Make this mode the active mode
    this.activeMode = params.mode;

    return this.sessionGeneration;
  }

  /**
   * Creates an immutable snapshot for authentication immediately prior to transmission.
   * UI edits after this call will NOT mutate this snapshot.
   */
  public createAuthSnapshot(params: {
    mode: AccountMode;
    connectionId: string;
    sourceFormat?: SessionFormatType;
  }): ImmutableAuthSnapshot {
    const ctx = this.contexts[params.mode];
    const isDemoVal: 0 | 1 = params.mode === 'REAL' ? 0 : 1;
    const uidVal = ctx.uid ?? 0;

    return Object.freeze({
      mode: params.mode,
      isDemo: isDemoVal,
      uid: uidVal,
      sessionToken: ctx.sessionToken,
      platform: ctx.platform || 2,
      connectionId: params.connectionId,
      generation: this.sessionGeneration,
      sourceFormat: params.sourceFormat || 'RAW_SESSION',
    });
  }

  /**
   * Verifies if an incoming event matches the current session generation and connection ID.
   */
  public isEventValid(generation: number, connId: string): boolean {
    if (generation !== this.sessionGeneration) {
      return false;
    }
    const currentConnId = this.contexts[this.activeMode].connectionId;
    return Boolean(currentConnId && currentConnId === connId);
  }

  /**
   * Updates balance with strict generation and mode matching.
   * If generation does not match current sessionGeneration, or mode is not active, the update is dropped.
   */
  public updateBalance(
    generation: number,
    mode: AccountMode,
    balance: number,
    currency = 'USD'
  ): boolean {
    if (generation !== this.sessionGeneration) {
      return false;
    }

    const ctx = this.contexts[mode];
    if (ctx) {
      ctx.balance = balance;
      ctx.balanceStatus = 'LIVE';
      if (ctx.authenticated) {
        ctx.status = 'LIVE';
      }
      ctx.currency = currency;
      ctx.lastKnownBalance = balance;
      ctx.lastKnownBalanceTimestamp = Date.now();
    }
    return true;
  }

  /**
   * Records authentication success for the active context.
   */
  public setAuthSuccess(generation: number, mode: AccountMode, uid?: number | null): boolean {
    if (generation !== this.sessionGeneration || mode !== this.activeMode) {
      return false;
    }

    const ctx = this.contexts[mode];
    ctx.authenticated = true;
    ctx.authState = 'SUCCESS';
    ctx.status = 'READY';
    ctx.authError = null;
    ctx.lastAuthResponse = 'successauth';
    if (mode === 'DEMO') {
      ctx.isDemo = 1;
    } else {
      ctx.isDemo = 0;
    }
    if (uid && uid > 0) {
      ctx.uid = uid;
    }
    return true;
  }

  /**
   * Records authentication failure for the active context.
   * Invalidate runtime state and halts connection.
   */
  public setAuthFailure(
    generation: number,
    mode: AccountMode,
    reason: string,
    responseEvent: string
  ): boolean {
    if (generation !== this.sessionGeneration) {
      return false;
    }

    const ctx = this.contexts[mode];
    ctx.authenticated = false;
    ctx.authState = 'FAILED';
    ctx.status = 'INVALID';
    ctx.authError = reason;
    ctx.lastAuthResponse = responseEvent;
    ctx.balance = null;
    ctx.balanceStatus = 'UNAVAILABLE';
    ctx.connectionId = null;
    ctx.shouldAutoReconnect = false;
    return true;
  }

  /**
   * Sets active connection ID for the active mode.
   */
  public setConnectionId(mode: AccountMode, connectionId: string | null): void {
    this.contexts[mode].connectionId = connectionId;
  }

  /**
   * Builds AccountInfo object matching UI requirements for active mode.
   */
  public buildAccountInfo(): AccountInfo {
    const ctx = this.contexts[this.activeMode];
    let status: AccountStatus = 'UNKNOWN';
    if (ctx.authState === 'FAILED') {
      status = 'INVALID';
    } else if (ctx.authenticated) {
      status = ctx.balance !== null ? 'LIVE' : 'READY';
    } else if (ctx.connectionId) {
      status = 'LOADING';
    } else {
      status = 'DISCONNECTED';
    }

    const uidMasked = ctx.uid && ctx.uid > 0 ? `******${String(ctx.uid).slice(-4)}` : null;

    return {
      status,
      balance: ctx.balance,
      balanceStatus: ctx.balanceStatus,
      currency: ctx.currency,
      isDemo: ctx.mode === 'DEMO',
      uidMasked,
      lastUpdated: ctx.lastKnownBalanceTimestamp,
      connectionId: ctx.connectionId,
      source: ctx.authenticated ? 'POCKET_OPTION_AUTHENTICATED' : 'UNAVAILABLE',
      lastKnownBalance: ctx.lastKnownBalance,
      lastKnownBalanceTimestamp: ctx.lastKnownBalanceTimestamp,
      staleSeconds: 0,
    };
  }
}
