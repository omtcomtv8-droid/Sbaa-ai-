/**
 * PocketOptionSessionStore.ts
 *
 * Single Authoritative Source of Truth for Pocket Option Session State.
 * Implements strict separation of:
 * 1. Application Authentication (APP_UNAUTHENTICATED / APP_AUTHENTICATED)
 * 2. Pocket Option Connection (PO_CONNECTION_IDLE, PO_CONNECTION_CONNECTING, PO_CONNECTION_AUTHENTICATING, PO_CONNECTION_AUTHENTICATED, PO_CONNECTION_FAILED, PO_CONNECTION_DISCONNECTED)
 * 3. Account Data State (ACCOUNT_LOADING, ACCOUNT_READY, ACCOUNT_FAILED)
 * 4. Balance Data State (BALANCE_LOADING, BALANCE_READY, BALANCE_UNAVAILABLE)
 *
 * ZERO FAKE BALANCES. ZERO FAKE ACCOUNTS. ZERO LEAKAGE BETWEEN REAL AND DEMO.
 * STALE RESPONSE PROTECTION VIA INCREMENTING GENERATION COUNTER.
 */

import { DiagnosticsInfo } from '../types';

export type AppAuthState = 'APP_UNAUTHENTICATED' | 'APP_AUTHENTICATED';

export type POConnectionState =
  | 'PO_CONNECTION_IDLE'
  | 'PO_CONNECTION_CONNECTING'
  | 'PO_CONNECTION_AUTHENTICATING'
  | 'PO_CONNECTION_AUTHENTICATED'
  | 'PO_CONNECTION_FAILED'
  | 'PO_CONNECTION_DISCONNECTED';

export type AccountDataState =
  | 'ACCOUNT_LOADING'
  | 'ACCOUNT_READY'
  | 'ACCOUNT_FAILED';

export type BalanceDataState =
  | 'BALANCE_LOADING'
  | 'BALANCE_READY'
  | 'BALANCE_UNAVAILABLE';

export type POErrorCategory =
  | 'AUTH_FAILED'
  | 'SESSION_EXPIRED'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'ACCOUNT_DATA_UNAVAILABLE'
  | 'BALANCE_UNAVAILABLE'
  | 'UNKNOWN_ERROR';

export type AccountModeType = 'REAL' | 'DEMO' | 'UNKNOWN';

export interface POAccountData {
  accountId: string | null;
  accountMode: AccountModeType;
  currency: string;
  verified: boolean;
  receivedAt: number | null;
  generation: number;
  connectionId: string | null;
}

export interface PocketOptionSessionSnapshot {
  appAuth: AppAuthState;
  connectionState: POConnectionState;
  accountState: AccountDataState;
  balanceState: BalanceDataState;
  status: string; // 'IDLE' | 'CONNECTING' | 'AUTHENTICATED' | 'READY' | 'FAILED' | 'DISCONNECTED'
  connectionId: string | null;
  generation: number;
  authenticated: boolean;
  account: POAccountData | null;
  accountMode: AccountModeType;
  requestedMode: AccountModeType;
  balance: number | null;
  balanceVerified: boolean;
  lastAccountUpdate: number | null;
  lastBalanceUpdate: number | null;
  error: {
    code: POErrorCategory;
    message: string;
    timestamp: number;
  } | null;
  activeAttemptId: string | null;
  diagnostics: DiagnosticsInfo | null;
  cachedSessionToken: string; // Preserved in-memory for UX so user does not need to re-type
}

export type SessionStoreListener = (snapshot: PocketOptionSessionSnapshot) => void;

class PocketOptionSessionStoreClass {
  private static instance: PocketOptionSessionStoreClass;

  private state: PocketOptionSessionSnapshot = {
    appAuth: 'APP_AUTHENTICATED',
    connectionState: 'PO_CONNECTION_IDLE',
    accountState: 'ACCOUNT_LOADING',
    balanceState: 'BALANCE_LOADING',
    status: 'IDLE',
    connectionId: null,
    generation: 1,
    authenticated: false,
    account: null,
    accountMode: 'UNKNOWN',
    requestedMode: 'DEMO',
    balance: null,
    balanceVerified: false,
    lastAccountUpdate: null,
    lastBalanceUpdate: null,
    error: null,
    activeAttemptId: null,
    diagnostics: null,
    cachedSessionToken: '',
  };

  private listeners = new Set<SessionStoreListener>();

  public static getInstance(): PocketOptionSessionStoreClass {
    if (!PocketOptionSessionStoreClass.instance) {
      PocketOptionSessionStoreClass.instance = new PocketOptionSessionStoreClass();
    }
    return PocketOptionSessionStoreClass.instance;
  }

  public getState(): PocketOptionSessionSnapshot {
    return { ...this.state };
  }

  public subscribe(listener: SessionStoreListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const snap = this.getState();
    this.listeners.forEach((l) => {
      try {
        l(snap);
      } catch (err) {
        console.warn('[SessionStore] Listener error:', err);
      }
    });
  }

  public setCachedSession(token: string): void {
    this.state.cachedSessionToken = token;
    this.notify();
  }

  /**
   * Start a new connection attempt with a fresh generation counter.
   * Cancels/supersedes any previous generation.
   */
  public startConnecting(params: {
    attemptId: string;
    requestedMode: AccountModeType;
    sessionToken?: string;
  }): number {
    const nextGen = this.state.generation + 1;
    const connId = `conn_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    this.state = {
      ...this.state,
      generation: nextGen,
      connectionId: connId,
      activeAttemptId: params.attemptId,
      requestedMode: params.requestedMode,
      connectionState: 'PO_CONNECTION_CONNECTING',
      accountState: 'ACCOUNT_LOADING',
      balanceState: 'BALANCE_LOADING',
      status: 'CONNECTING',
      authenticated: false,
      balance: null,
      balanceVerified: false,
      error: null,
      cachedSessionToken: params.sessionToken || this.state.cachedSessionToken,
    };

    this.notify();
    return nextGen;
  }

  public setAuthenticating(generation: number): void {
    if (generation < this.state.generation) return; // Stale check

    this.state = {
      ...this.state,
      connectionState: 'PO_CONNECTION_AUTHENTICATING',
      status: 'AUTHENTICATING',
    };
    this.notify();
  }

  /**
   * Platform authentication was accepted by broker.
   * Authentication success is strictly separate from balance data.
   */
  public setAuthenticated(params: {
    generation: number;
    accountId?: string | null;
    accountMode: AccountModeType;
    connectionId?: string | null;
  }): void {
    if (params.generation < this.state.generation) return; // Stale check

    const now = Date.now();
    const accountObj: POAccountData = {
      accountId: params.accountId || this.state.account?.accountId || null,
      accountMode: params.accountMode,
      currency: this.state.account?.currency || 'USD',
      verified: true,
      receivedAt: now,
      generation: params.generation,
      connectionId: params.connectionId || this.state.connectionId,
    };

    this.state = {
      ...this.state,
      connectionState: 'PO_CONNECTION_AUTHENTICATED',
      authenticated: true,
      accountState: 'ACCOUNT_READY',
      account: accountObj,
      accountMode: params.accountMode,
      lastAccountUpdate: now,
      status: 'AUTHENTICATED',
      error: null,
    };

    this.notify();
  }

  /**
   * Verified balance received from broker.
   */
  public setVerifiedBalance(params: {
    generation: number;
    balance: number;
    accountMode: AccountModeType;
    currency?: string;
  }): void {
    if (params.generation < this.state.generation) return; // Stale check

    // Strict Mode Isolation: Never overwrite an active REAL account with DEMO balance, and vice versa
    if (this.state.accountMode === 'REAL' && params.accountMode === 'DEMO') {
      return;
    }
    if (this.state.accountMode === 'DEMO' && params.accountMode === 'REAL') {
      return;
    }

    const now = Date.now();
    const effectiveMode = params.accountMode || this.state.accountMode;
    this.state = {
      ...this.state,
      balance: params.balance,
      balanceVerified: true,
      balanceState: 'BALANCE_READY',
      lastBalanceUpdate: now,
      status: 'READY',
      accountMode: effectiveMode !== 'UNKNOWN' ? effectiveMode : this.state.accountMode,
      account: this.state.account
        ? {
            ...this.state.account,
            accountMode: effectiveMode !== 'UNKNOWN' ? effectiveMode : this.state.account.accountMode,
            currency: params.currency || this.state.account.currency,
          }
        : null,
    };

    this.notify();
  }

  /**
   * If balance is temporarily unavailable from broker, mark it as unavailable
   * WITHOUT logging out or resetting authentication!
   */
  public setBalanceUnavailable(generation: number): void {
    if (generation < this.state.generation) return;

    this.state = {
      ...this.state,
      balanceState: 'BALANCE_UNAVAILABLE',
    };
    this.notify();
  }

  /**
   * Connection or Authentication definitively failed.
   * Does NOT redirect user or crash app.
   */
  public setConnectionFailed(params: {
    generation: number;
    errorCode: POErrorCategory;
    errorMessage: string;
  }): void {
    if (params.generation < this.state.generation) return;

    this.state = {
      ...this.state,
      connectionState: 'PO_CONNECTION_FAILED',
      authenticated: false,
      accountState: 'ACCOUNT_FAILED',
      balanceState: 'BALANCE_UNAVAILABLE',
      status: 'FAILED',
      activeAttemptId: null,
      error: {
        code: params.errorCode,
        message: params.errorMessage,
        timestamp: Date.now(),
      },
    };

    this.notify();
  }

  /**
   * User explicitly requested disconnect.
   * Keeps cachedSessionToken in memory so user never has to re-type it.
   */
  public disconnect(): void {
    const nextGen = this.state.generation + 1;
    this.state = {
      ...this.state,
      generation: nextGen,
      connectionState: 'PO_CONNECTION_DISCONNECTED',
      accountState: 'ACCOUNT_LOADING',
      balanceState: 'BALANCE_LOADING',
      status: 'DISCONNECTED',
      authenticated: false,
      account: null,
      balance: null,
      balanceVerified: false,
      activeAttemptId: null,
      error: null,
      cachedSessionToken: this.state.cachedSessionToken,
    };
    this.notify();
  }

  /**
   * Synchronize generation with server response to prevent stale rejection lockouts.
   */
  public syncServerGeneration(gen: number): void {
    if (typeof gen === 'number' && gen > 0) {
      this.state.generation = Math.max(this.state.generation, gen);
      this.notify();
    }
  }

  public isTransitional(): boolean {
    return (
      this.state.connectionState === 'PO_CONNECTION_CONNECTING' ||
      this.state.connectionState === 'PO_CONNECTION_AUTHENTICATING' ||
      this.state.accountState === 'ACCOUNT_LOADING' ||
      this.state.balanceState === 'BALANCE_LOADING'
    );
  }

  public canEnterDashboard(): boolean {
    return (
      this.state.authenticated ||
      this.state.connectionState === 'PO_CONNECTION_AUTHENTICATED' ||
      this.state.status === 'READY'
    );
  }

  /**
   * Synchronize from backend DiagnosticsInfo (polling or SSE).
   * Strictly respects generations and isolates REAL vs DEMO.
   */
  public updateFromDiagnostics(diag: DiagnosticsInfo | null): void {
    if (!diag) return;

    const diagGen =
      typeof (diag as any).generation === 'number'
        ? (diag as any).generation
        : typeof (diag as any).authDiagnostic?.generation === 'number'
        ? (diag as any).authDiagnostic.generation
        : undefined;

    const isActivelyAttempting =
      this.state.connectionState === 'PO_CONNECTION_CONNECTING' ||
      this.state.connectionState === 'PO_CONNECTION_AUTHENTICATING';

    if (isActivelyAttempting && typeof diagGen === 'number' && diagGen < this.state.generation) {
      // Stale response from older generation while actively attempting new connection -> ignore
      return;
    }

    if (typeof diagGen === 'number' && diagGen > this.state.generation) {
      this.state.generation = diagGen;
    }

    const authVerified = Boolean(diag.authVerified);
    const mode: AccountModeType = (diag.account as any)?.accountMode || (diag.account?.isDemo ? 'DEMO' : 'REAL');

    // Only filter unverified cross-mode balances if authentication is not confirmed
    const isCrossContamination = !authVerified && this.state.accountMode !== 'UNKNOWN' && this.state.accountMode !== mode;
    const rawBal = isCrossContamination ? null : diag.account?.balance;
    const hasValidBalance = rawBal !== null && rawBal !== undefined && !isNaN(rawBal);
    const balanceNum = hasValidBalance ? Number(rawBal) : null;

    let connState: POConnectionState = this.state.connectionState;

    if (authVerified) {
      connState = 'PO_CONNECTION_AUTHENTICATED';
    } else if (diag.subsystems?.overall === 'AUTHENTICATING' || diag.subsystems?.auth === 'pending') {
      connState = 'PO_CONNECTION_AUTHENTICATING';
    } else if (diag.subsystems?.websocket === 'connecting') {
      connState = 'PO_CONNECTION_CONNECTING';
    } else if (
      (diag.subsystems?.overall === 'AUTH_FAILED' || diag.subsystems?.auth === 'failed') &&
      !isActivelyAttempting
    ) {
      connState = 'PO_CONNECTION_FAILED';
    }

    const isAuthed = authVerified || this.state.authenticated;
    const now = Date.now();

    this.state = {
      ...this.state,
      diagnostics: diag,
      authenticated: isAuthed,
      connectionState: connState,
      accountMode: isAuthed ? mode : this.state.accountMode,
      status: hasValidBalance && isAuthed ? 'READY' : isAuthed ? 'AUTHENTICATED' : connState === 'PO_CONNECTION_FAILED' ? 'FAILED' : this.state.status,
      account: isAuthed
        ? {
            accountId: diag.account?.uidMasked || diag.authUid || this.state.account?.accountId || null,
            accountMode: mode,
            currency: diag.account?.currency || 'USD',
            verified: true,
            receivedAt: this.state.account?.receivedAt || now,
            generation: this.state.generation,
            connectionId: diag.connectionId || this.state.connectionId,
          }
        : null,
      accountState: isAuthed ? 'ACCOUNT_READY' : isActivelyAttempting ? 'ACCOUNT_LOADING' : this.state.accountState,
      balance: balanceNum !== null ? balanceNum : this.state.balance,
      balanceVerified: balanceNum !== null ? true : this.state.balanceVerified,
      balanceState: balanceNum !== null ? 'BALANCE_READY' : isAuthed ? 'BALANCE_LOADING' : 'BALANCE_UNAVAILABLE',
      lastBalanceUpdate: balanceNum !== null ? now : this.state.lastBalanceUpdate,
    };

    this.notify();
  }
}

export const pocketOptionSessionStore = PocketOptionSessionStoreClass.getInstance();
