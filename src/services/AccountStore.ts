/**
 * AccountStore.ts
 * Single authoritative store for Pocket Option account connection,
 * verified balance, account mode, and real connection state machine.
 *
 * STRICT RULE: ZERO FAKE BALANCES. ZERO FAKE MODES. ZERO HARDCODED VALUES.
 * STRICT RULE: ISOLATED CONNECTION GENERATIONS.
 */

import { DiagnosticsInfo } from '../types';

export type AccountStoreStatus =
  | 'EMPTY'
  | 'LOADING'
  | 'AUTHENTICATED'
  | 'ACCOUNT_LOADING'
  | 'READY'
  | 'BALANCE_UNAVAILABLE'
  | 'ERROR';

export type ConnectionState =
  | 'IDLE'
  | 'CONNECTING'
  | 'SOCKET_CONNECTED'
  | 'AUTHENTICATING'
  | 'AUTHENTICATED'
  | 'LOADING_ACCOUNT'
  | 'LOADING_BALANCE'
  | 'LOADING_ASSETS'
  | 'READY'
  | 'AUTH_FAILED'
  | 'SESSION_EXPIRED'
  | 'TIMEOUT'
  | 'CONNECTION_ERROR'
  | 'DISCONNECTED';

export type ConnectionErrorType =
  | 'AUTH_FAILED'
  | 'SESSION_EXPIRED'
  | 'TIMEOUT'
  | 'NETWORK_ERROR'
  | 'SOCKET_ERROR'
  | 'ACCOUNT_UNAVAILABLE'
  | 'BALANCE_UNAVAILABLE'
  | 'ASSET_LOAD_FAILED'
  | 'CONNECTION_ERROR'
  | 'UNKNOWN_ERROR';

export type AccountModeType = 'REAL' | 'DEMO' | 'UNKNOWN';

export interface EarlyAccountPacket {
  eventName: string;
  payload: any;
  generation: number;
  receivedAt: number;
}

export interface AccountState {
  status: AccountStoreStatus;
  connectionState: ConnectionState; // Backward-compatible alias
  accountId: string | null;
  accountMode: AccountModeType;
  requestedMode: AccountModeType;
  modeMismatch: boolean;
  currency: string;
  balance: number | null;
  verified: boolean;
  balanceVerified: boolean;
  source: string;
  receivedAt: number | null;
  connectionId: string | null;
  generation: number;
  error: string | null;
  errorCode: ConnectionErrorType | null;
  errorMessage: string | null;
  lastErrorCategory: string | null;
  activeAttemptId: string | null;
  diagnostics: DiagnosticsInfo | null;
}

export type AccountListener = (state: AccountState) => void;

class AccountStoreClass {
  private state: AccountState = {
    status: 'EMPTY',
    connectionState: 'IDLE',
    accountId: null,
    accountMode: 'UNKNOWN',
    requestedMode: 'DEMO',
    modeMismatch: false,
    currency: 'USD',
    balance: null,
    verified: false,
    balanceVerified: false,
    source: 'NONE',
    receivedAt: null,
    connectionId: null,
    generation: 0,
    error: null,
    errorCode: null,
    errorMessage: null,
    lastErrorCategory: null,
    activeAttemptId: null,
    diagnostics: null,
  };

  private listeners = new Set<AccountListener>();
  private earlyMessageBuffer: EarlyAccountPacket[] = [];

  public getState(): AccountState {
    return { ...this.state };
  }

  public subscribe(listener: AccountListener): () => void {
    this.listeners.add(listener);
    listener({ ...this.state });
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const snap = { ...this.state };
    for (const listener of this.listeners) {
      try {
        listener(snap);
      } catch (err) {
        console.warn('[AccountStore] Error in listener callback:', err);
      }
    }
  }

  public setConnectionState(
    newState: ConnectionState,
    meta?: {
      errorCode?: ConnectionErrorType | null;
      errorMessage?: string | null;
      attemptId?: string | null;
    }
  ): void {
    const errText = meta?.errorMessage || this.state.errorMessage;
    let mappedStatus: AccountStoreStatus = this.state.status;
    if (newState === 'READY') mappedStatus = 'READY';
    else if (newState === 'AUTHENTICATED') mappedStatus = 'AUTHENTICATED';
    else if (newState === 'CONNECTING' || newState === 'AUTHENTICATING') mappedStatus = 'LOADING';
    else if (newState === 'LOADING_BALANCE' || newState === 'LOADING_ACCOUNT') mappedStatus = 'ACCOUNT_LOADING';
    else if (newState === 'AUTH_FAILED' || newState === 'CONNECTION_ERROR' || newState === 'TIMEOUT') mappedStatus = 'ERROR';

    this.state = {
      ...this.state,
      status: mappedStatus,
      connectionState: newState,
      error: errText,
      errorCode: meta?.errorCode !== undefined ? meta.errorCode : this.state.errorCode,
      errorMessage: errText,
      activeAttemptId: meta?.attemptId !== undefined ? meta.attemptId : this.state.activeAttemptId,
    };
    this.notify();
  }

  public setAccountLoading(generation: number): void {
    if (generation < this.state.generation) return;
    this.state = {
      ...this.state,
      status: 'ACCOUNT_LOADING',
      connectionState: 'LOADING_BALANCE',
    };
    this.notify();
  }

  public setBalanceUnavailable(generation?: number): void {
    if (generation !== undefined && generation < this.state.generation) return;
    this.state = {
      ...this.state,
      status: 'BALANCE_UNAVAILABLE',
      connectionState: 'AUTHENTICATED',
    };
    this.notify();
  }

  public bufferEarlyAccountMessage(packet: EarlyAccountPacket): void {
    // Only buffer if relevant to current or newer generation
    if (packet.generation >= this.state.generation) {
      this.earlyMessageBuffer.push(packet);
      // Keep bounded buffer to prevent leaks
      if (this.earlyMessageBuffer.length > 20) {
        this.earlyMessageBuffer.shift();
      }
    }
  }

  public flushEarlyAccountMessages(generation: number): EarlyAccountPacket[] {
    const matched = this.earlyMessageBuffer.filter((m) => m.generation === generation);
    this.earlyMessageBuffer = this.earlyMessageBuffer.filter((m) => m.generation !== generation);
    return matched;
  }

  public updateFromDiagnostics(diag: DiagnosticsInfo | null): void {
    if (!diag) return;

    const authVerified = Boolean(diag.authVerified);
    const isWsConnected = diag.subsystems?.websocket === 'connected';
    const subAuth = diag.subsystems?.auth;
    const subOverall = diag.subsystems?.overall;

    let derivedState: ConnectionState = this.state.connectionState;
    let storeStatus: AccountStoreStatus = this.state.status;

    if (subOverall === 'AUTH_FAILED' || subAuth === 'failed') {
      derivedState = 'AUTH_FAILED';
      storeStatus = 'ERROR';
    } else if (subOverall === 'ACCOUNT_READY' || (authVerified && isWsConnected)) {
      if (diag.account?.balance !== null && diag.account?.balance !== undefined) {
        derivedState = 'READY';
        storeStatus = 'READY';
      } else {
        derivedState = 'AUTHENTICATED';
        storeStatus = 'ACCOUNT_LOADING';
      }
    } else if (diag.subsystems?.websocket === 'connecting' || subOverall === 'CONNECTING') {
      derivedState = 'CONNECTING';
      storeStatus = 'LOADING';
    } else if (subOverall === 'SOCKET_CONNECTED') {
      derivedState = 'SOCKET_CONNECTED';
      storeStatus = 'LOADING';
    } else if (subOverall === 'AUTHENTICATING' || subAuth === 'pending') {
      derivedState = 'AUTHENTICATING';
      storeStatus = 'LOADING';
    } else if (diag.subsystems?.websocket === 'disconnected') {
      if (this.state.connectionState !== 'AUTH_FAILED' && this.state.connectionState !== 'TIMEOUT') {
        derivedState = 'DISCONNECTED';
      }
    }

    const mode: AccountModeType = diag.account?.isDemo ? 'DEMO' : 'REAL';
    const finalBalance =
      diag.account?.balance !== null && diag.account?.balance !== undefined && !isNaN(diag.account.balance)
        ? diag.account.balance
        : null;
    const hasBalance = finalBalance !== null;

    this.state = {
      ...this.state,
      status: hasBalance && authVerified ? 'READY' : storeStatus,
      connectionState: derivedState,
      accountId: diag.account?.uidMasked || diag.authUid || this.state.accountId,
      accountMode: mode,
      modeMismatch: this.state.requestedMode !== 'UNKNOWN' && this.state.requestedMode !== mode,
      balance: hasBalance ? finalBalance : this.state.balance,
      verified: authVerified && hasBalance,
      balanceVerified: authVerified && hasBalance,
      source: authVerified
        ? mode === 'DEMO'
          ? 'POCKET_OPTION_PUBLIC_DEMO'
          : 'POCKET_OPTION_AUTHENTICATED'
        : 'NONE',
      receivedAt: hasBalance ? Date.now() : this.state.receivedAt,
      connectionId: diag.connectionId || (diag as any).activeConnectionId || this.state.connectionId,
      diagnostics: diag,
      error: derivedState === 'AUTH_FAILED' ? diag.authError || 'Authentication failed' : this.state.error,
      errorCode: derivedState === 'AUTH_FAILED' ? 'AUTH_FAILED' : this.state.errorCode,
      errorMessage: diag.authError || this.state.errorMessage,
    };
    this.notify();
  }

  public setVerifiedAccountData(params: {
    accountId: string | null;
    accountMode: AccountModeType;
    balance: number | null;
    currency?: string;
    connectionId?: string | null;
    generation?: number;
  }): void {
    const isVerified = params.balance !== null && params.balance !== undefined && !isNaN(params.balance);
    this.state = {
      ...this.state,
      status: isVerified ? 'READY' : 'AUTHENTICATED',
      connectionState: isVerified ? 'READY' : 'AUTHENTICATED',
      accountId: params.accountId,
      accountMode: params.accountMode,
      balance: params.balance,
      currency: params.currency || 'USD',
      verified: isVerified,
      balanceVerified: isVerified,
      source: params.accountMode === 'DEMO' ? 'POCKET_OPTION_PUBLIC_DEMO' : 'POCKET_OPTION_AUTHENTICATED',
      receivedAt: isVerified ? Date.now() : this.state.receivedAt,
      connectionId: params.connectionId || this.state.connectionId,
      generation: params.generation !== undefined ? params.generation : this.state.generation,
      error: null,
      errorCode: null,
      errorMessage: null,
    };
    this.notify();
  }

  public resetConnection(reason: 'DISCONNECTED' | 'AUTH_FAILED' | 'TIMEOUT' | 'CONNECTION_ERROR' | 'ERROR', errorMessage?: string): void {
    const finalReason: ConnectionState = reason === 'ERROR' ? 'CONNECTION_ERROR' : reason;
    this.state = {
      ...this.state,
      status: reason === 'AUTH_FAILED' || reason === 'CONNECTION_ERROR' ? 'ERROR' : 'EMPTY',
      connectionState: finalReason,
      balance: null,
      verified: false,
      balanceVerified: false,
      source: 'NONE',
      receivedAt: null,
      error: errorMessage || null,
      errorCode:
        finalReason === 'AUTH_FAILED'
          ? 'AUTH_FAILED'
          : finalReason === 'TIMEOUT'
          ? 'TIMEOUT'
          : finalReason === 'CONNECTION_ERROR'
          ? 'CONNECTION_ERROR'
          : null,
      errorMessage: errorMessage || null,
      activeAttemptId: null,
    };
    this.notify();
  }

  public setRequestedMode(mode: AccountModeType): void {
    this.state = {
      ...this.state,
      requestedMode: mode,
      modeMismatch: this.state.accountMode !== 'UNKNOWN' && this.state.accountMode !== mode,
    };
    this.notify();
  }
}

export const accountStore = new AccountStoreClass();
