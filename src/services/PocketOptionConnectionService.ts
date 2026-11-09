/**
 * PocketOptionConnectionService.ts
 *
 * Dedicated client-side connection manager for Pocket Option.
 * - Single active connection request lifecycle.
 * - Generation counter & connection ID for stale response protection.
 * - Strict double/triple-click prevention (atomic submission lock).
 * - Hard timeout handling (finite 15-20s) without automatic redirect or page wipe.
 * - Separates Authentication, Account Data, and Balance Data.
 * - Zero raw credentials logged or exposed in errors (Strict redaction).
 * - Real-time diagnostic logger capturing 'NotAuthorized' rejection reasons.
 * - Validates 'auth' event format and serialization (session token, account mode, UID, platform).
 */

import { accountStore, ConnectionState, ConnectionErrorType, AccountModeType } from './AccountStore';
import {
  pocketOptionSessionStore,
  POConnectionState,
  POErrorCategory,
} from './PocketOptionSessionStore';
import { DiagnosticsInfo } from '../types';

export interface ConnectionResult {
  ok: boolean;
  state: ConnectionState | POConnectionState;
  accountId: string | null;
  balance: number | null;
  accountMode: AccountModeType;
  errorCode?: ConnectionErrorType | POErrorCategory;
  errorMessage?: string;
  connectionId?: string | null;
  generation?: number;
  timestamp: number;
  diagnostic?: AuthDiagnosticEntry;
}

export interface ConnectParams {
  endpoint?: string;
  sessionToken: string;
  isDemo: boolean;
  uid?: number | string | null;
  timeoutMs?: number;
}

export interface AuthDiagnosticEntry {
  id: string;
  timestamp: string;
  isoTimestamp: string;
  epochMs: number;
  attemptId: string | null;
  generation: number;
  endpoint: string;
  accountMode: AccountModeType;
  isDemo: boolean;
  uid: number;
  uidMasked: string;
  sessionMasked: string;
  rawFormatDetected: string;
  serializedPayloadPreview: string; // e.g. 42["auth",{"session":"296a...6b8b","isDemo":1,"uid":98148605,"platform":2}]
  status: 'PRE_FLIGHT' | 'CONNECTING' | 'AUTHENTICATING' | 'AUTHENTICATED' | 'REJECTED' | 'FAILED' | 'TIMEOUT';
  serverRejectionReason?: string | null;
  serverEvent?: string | null;
  httpStatus?: number;
  remedyAction?: string;
}

export interface CredentialAnalysis {
  cleanSession: string;
  targetUid: number;
  targetMode: AccountModeType;
  isDemo: boolean;
  formatDetected: string;
  serializedFrame: string;
  validationErrors: string[];
}

class PocketOptionConnectionServiceClass {
  private activeAttemptId: string | null = null;
  private currentAbortController: AbortController | null = null;
  private isConnecting = false;
  private activeGeneration = 1;

  // Real-time audit & diagnostics log (redacted of secrets)
  private authDiagnosticsLog: AuthDiagnosticEntry[] = [];
  private latestAuthDiagnostic: AuthDiagnosticEntry | null = null;
  private diagnosticListeners: ((entry: AuthDiagnosticEntry) => void)[] = [];

  public static maskSecret(token: string | null | undefined): string {
    if (!token) return 'MISSING';
    const s = String(token).trim();
    if (s.length <= 8) return '********';
    return `${s.slice(0, 4)}...${s.slice(-4)}`;
  }

  public static maskUid(uid: number | string | null | undefined): string {
    if (!uid || uid === 0 || uid === '0') return '0 (UNASSIGNED)';
    const s = String(uid).trim();
    if (s.length <= 4) return s;
    return `${s.slice(0, 2)}***${s.slice(-2)}`;
  }

  /**
   * Analyze raw user credentials input, detect structure, extract session & UID,
   * and verify Socket.IO canonical frame format: 42["auth",{"session":...,"isDemo":...,"uid":...,"platform":2}]
   */
  public static analyzeCredentials(
    rawToken: string,
    isDemo: boolean,
    explicitUid?: number | string | null,
    endpoint = 'wss://api-eu.po.market/socket.io/?EIO=4&transport=websocket'
  ): CredentialAnalysis {
    let raw = (rawToken || '').trim().replace(/^["'`]|["'`]$/g, '');
    let cleanSession = raw;
    let targetUid = 0;
    let formatDetected = 'RAW_SESSION_TOKEN';
    const validationErrors: string[] = [];

    // 1. Detect if user pasted complete Socket.IO frame (e.g. from Chrome DevTools Network -> WS -> Messages)
    if (raw.startsWith('42') || raw.startsWith('{') || raw.startsWith('[')) {
      formatDetected = 'COMPLETE_SOCKET_IO_FRAME';
      try {
        const jsonStr = raw.startsWith('42') ? raw.slice(2) : raw;
        const parsed = JSON.parse(jsonStr);
        const data = Array.isArray(parsed) && parsed.length > 1 ? parsed[1] : parsed;
        if (data && typeof data === 'object') {
          if (data.session) {
            cleanSession = String(data.session).trim().replace(/^["'`]|["'`]$/g, '');
          }
          if (data.uid !== undefined && data.uid !== null) {
            const parsedNum = Number(data.uid);
            if (!isNaN(parsedNum) && parsedNum > 0) targetUid = parsedNum;
          }
          if (data.isDemo !== undefined && (isDemo === undefined || isDemo === null)) {
            isDemo = data.isDemo === 1 || data.isDemo === true;
          }
        }
      } catch {
        // Fallback to regex extraction if JSON parse fails
        const sessionMatch = raw.match(/"session"\s*:\s*"([^"]+)"/);
        if (sessionMatch) cleanSession = sessionMatch[1];
        const uidMatch = raw.match(/"uid"\s*:\s*(\d+)/);
        if (uidMatch) targetUid = Number(uidMatch[1]);
      }
    } else if (raw.includes('SSID=') || raw.includes('session=') || raw.includes('auth=') || raw.includes(';')) {
      // 2. Detect cookie header or semicolon-delimited token
      formatDetected = 'COOKIE_HEADER_STRING';
      const match = raw.match(/(?:SSID|session|auth|PHPSESSID)=([^;\s]+)/i);
      if (match) {
        cleanSession = match[1].replace(/^["'`]|["'`]$/g, '').trim();
      }
    }

    // Strip any residual prefix or trailing characters
    cleanSession = cleanSession
      .replace(/^(?:SSID|session|auth|PHPSESSID)=/i, '')
      .replace(/[;\s]+$/, '')
      .replace(/^["'`]|["'`]$/g, '')
      .trim();

    // Priority: explicit UI UID input overrides parsed UID
    if (explicitUid !== undefined && explicitUid !== null && String(explicitUid).trim() !== '') {
      const num = Number(explicitUid);
      if (!isNaN(num) && num > 0) targetUid = num;
    }

    if (!cleanSession || cleanSession.length < 8) {
      validationErrors.push('رمز الجلسة غير صالح أو مفقود (أقل من 8 أحرف).');
    }

    const mode: AccountModeType = isDemo ? 'DEMO' : 'REAL';
    const isDemoInt = isDemo ? 1 : 0;
    const maskedSession = PocketOptionConnectionServiceClass.maskSecret(cleanSession);

    // Canonical Socket.IO payload serialization check
    const serializedFrame = `42["auth",{"session":"${maskedSession}","isDemo":${isDemoInt},"uid":${targetUid},"platform":2}]`;

    return {
      cleanSession,
      targetUid,
      targetMode: mode,
      isDemo,
      formatDetected,
      serializedFrame,
      validationErrors,
    };
  }

  public getIsConnecting(): boolean {
    return this.isConnecting;
  }

  public getActiveAttemptId(): string | null {
    return this.activeAttemptId;
  }

  public getActiveGeneration(): number {
    return this.activeGeneration;
  }

  public getAuthDiagnosticsLog(): AuthDiagnosticEntry[] {
    return [...this.authDiagnosticsLog];
  }

  public getLatestAuthDiagnostic(): AuthDiagnosticEntry | null {
    return this.latestAuthDiagnostic;
  }

  public onDiagnostic(listener: (entry: AuthDiagnosticEntry) => void): () => void {
    this.diagnosticListeners.push(listener);
    return () => {
      this.diagnosticListeners = this.diagnosticListeners.filter((l) => l !== listener);
    };
  }

  public addDiagnosticEntry(entry: AuthDiagnosticEntry): void {
    this.authDiagnosticsLog.unshift(entry);
    if (this.authDiagnosticsLog.length > 60) this.authDiagnosticsLog.pop();
    this.latestAuthDiagnostic = entry;

    for (const listener of this.diagnosticListeners) {
      try {
        listener(entry);
      } catch (err) {
        console.warn('[PO-CONNECT] Diagnostic listener error:', err);
      }
    }
  }

  /**
   * Cancel any pending connection attempt cleanly
   */
  public cancelPending(reason = 'Canceled by new request'): void {
    if (this.currentAbortController) {
      try {
        this.currentAbortController.abort();
      } catch {
        // ignore
      }
      this.currentAbortController = null;
    }
    this.isConnecting = false;
    this.activeAttemptId = null;
  }

  /**
   * Connect to Pocket Option via backend handshake with strict state machine and hard timeout.
   */
  public async connect(params: ConnectParams): Promise<ConnectionResult> {
    const targetEndpoint = params.endpoint || 'wss://api-eu.po.market/socket.io/?EIO=4&transport=websocket';
    const analysis = PocketOptionConnectionServiceClass.analyzeCredentials(
      params.sessionToken,
      params.isDemo,
      params.uid,
      targetEndpoint
    );

    const requestedMode: AccountModeType = analysis.targetMode;

    if (analysis.validationErrors.length > 0) {
      const errMsg = analysis.validationErrors[0];
      const diagEntry: AuthDiagnosticEntry = {
        id: `diag_${Date.now()}_val_err`,
        timestamp: new Date().toLocaleTimeString('ar-EG'),
        isoTimestamp: new Date().toISOString(),
        epochMs: Date.now(),
        attemptId: null,
        generation: this.activeGeneration,
        endpoint: targetEndpoint,
        accountMode: requestedMode,
        isDemo: analysis.isDemo,
        uid: analysis.targetUid,
        uidMasked: PocketOptionConnectionServiceClass.maskUid(analysis.targetUid),
        sessionMasked: PocketOptionConnectionServiceClass.maskSecret(analysis.cleanSession),
        rawFormatDetected: analysis.formatDetected,
        serializedPayloadPreview: analysis.serializedFrame,
        status: 'FAILED',
        serverRejectionReason: errMsg,
        remedyAction: 'يرجى إدخال رمز جلسة (SSID) صالح يتكون من 32 حرفًا على الأقل من منصة Pocket Option.',
      };
      this.addDiagnosticEntry(diagEntry);

      pocketOptionSessionStore.setConnectionFailed({
        generation: this.activeGeneration,
        errorCode: 'AUTH_FAILED',
        errorMessage: errMsg,
      });
      accountStore.setConnectionState('AUTH_FAILED', {
        errorCode: 'AUTH_FAILED',
        errorMessage: errMsg,
      });

      return {
        ok: false,
        state: 'PO_CONNECTION_FAILED',
        accountId: null,
        balance: null,
        accountMode: requestedMode,
        errorCode: 'AUTH_FAILED',
        errorMessage: errMsg,
        timestamp: Date.now(),
        diagnostic: diagEntry,
      };
    }

    // Atomic double-submission lock:
    if (this.isConnecting && this.activeAttemptId) {
      console.warn('[PO-CONNECT] Connection attempt already active. Ignoring duplicate submission.');
      return {
        ok: false,
        state: 'PO_CONNECTION_CONNECTING',
        accountId: null,
        balance: null,
        accountMode: requestedMode,
        errorCode: 'NETWORK_ERROR',
        errorMessage: 'جاري الاتصال بالفعل... يرجى الانتظار.',
        timestamp: Date.now(),
      };
    }

    const attemptId = `conn_attempt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    this.activeAttemptId = attemptId;
    this.isConnecting = true;

    // Start in PocketOptionSessionStore with incremented generation
    const gen = pocketOptionSessionStore.startConnecting({
      attemptId,
      requestedMode,
      sessionToken: analysis.cleanSession,
    });
    this.activeGeneration = gen;

    accountStore.setRequestedMode(requestedMode);
    accountStore.setConnectionState('CONNECTING', { attemptId });

    // Precise Pre-flight Diagnostic Log (Redacted of secrets)
    const preFlightDiag: AuthDiagnosticEntry = {
      id: `diag_${Date.now()}_pre`,
      timestamp: new Date().toLocaleTimeString('ar-EG'),
      isoTimestamp: new Date().toISOString(),
      epochMs: Date.now(),
      attemptId,
      generation: gen,
      endpoint: targetEndpoint,
      accountMode: requestedMode,
      isDemo: analysis.isDemo,
      uid: analysis.targetUid,
      uidMasked: PocketOptionConnectionServiceClass.maskUid(analysis.targetUid),
      sessionMasked: PocketOptionConnectionServiceClass.maskSecret(analysis.cleanSession),
      rawFormatDetected: analysis.formatDetected,
      serializedPayloadPreview: analysis.serializedFrame,
      status: 'AUTHENTICATING',
      remedyAction: 'جاري إرسال إطار المصادقة ومطابقة الجلسة مع الخادم...',
    };
    this.addDiagnosticEntry(preFlightDiag);

    console.info(
      `[PO-AUTH-AUDIT] Connection Handshake Initiated:\n` +
      `  Attempt: ${attemptId} | Gen: #${gen} | Mode: ${requestedMode}\n` +
      `  Endpoint: ${targetEndpoint}\n` +
      `  Format: ${analysis.formatDetected}\n` +
      `  UID: ${analysis.targetUid > 0 ? PocketOptionConnectionServiceClass.maskUid(analysis.targetUid) : '0 (UNASSIGNED)'}\n` +
      `  Serialized 'auth' Frame: ${analysis.serializedFrame}`
    );

    const abortController = new AbortController();
    this.currentAbortController = abortController;

    const timeoutDuration = params.timeoutMs || 20000;
    const timeoutPromise = new Promise<ConnectionResult>((resolve) => {
      const timer = setTimeout(() => {
        if (this.activeAttemptId === attemptId && this.activeGeneration === gen) {
          this.cancelPending('Timeout');
          const timeoutMsg = 'انتهت مهلة انتظار خادم Pocket Option (15 ثانية). يرجى التحقق من اتصال الإنترنت وصحة رمز الجلسة.';

          const timeoutDiag: AuthDiagnosticEntry = {
            id: `diag_${Date.now()}_timeout`,
            timestamp: new Date().toLocaleTimeString('ar-EG'),
            isoTimestamp: new Date().toISOString(),
            epochMs: Date.now(),
            attemptId,
            generation: gen,
            endpoint: targetEndpoint,
            accountMode: requestedMode,
            isDemo: analysis.isDemo,
            uid: analysis.targetUid,
            uidMasked: PocketOptionConnectionServiceClass.maskUid(analysis.targetUid),
            sessionMasked: PocketOptionConnectionServiceClass.maskSecret(analysis.cleanSession),
            rawFormatDetected: analysis.formatDetected,
            serializedPayloadPreview: analysis.serializedFrame,
            status: 'TIMEOUT',
            serverRejectionReason: 'Gateway / Network Timeout: No response to Socket.IO authentication handshake within deadline.',
            remedyAction: 'تأكد من استقرار اتصال الإنترنت وأن رمز الجلسة نشط في المتصفح حالياً.',
          };
          this.addDiagnosticEntry(timeoutDiag);

          pocketOptionSessionStore.setConnectionFailed({
            generation: gen,
            errorCode: 'TIMEOUT',
            errorMessage: timeoutMsg,
          });
          accountStore.resetConnection('TIMEOUT', timeoutMsg);
          resolve({
            ok: false,
            state: 'PO_CONNECTION_FAILED',
            accountId: null,
            balance: null,
            accountMode: requestedMode,
            errorCode: 'TIMEOUT',
            errorMessage: timeoutMsg,
            generation: gen,
            timestamp: Date.now(),
            diagnostic: timeoutDiag,
          });
        }
      }, timeoutDuration);

      abortController.signal.addEventListener('abort', () => {
        clearTimeout(timer);
      });
    });

    const executionPromise = (async (): Promise<ConnectionResult> => {
      try {
        pocketOptionSessionStore.setAuthenticating(gen);
        accountStore.setConnectionState('AUTHENTICATING', { attemptId });

        const res = await fetch('/api/account/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: targetEndpoint,
            sessionToken: analysis.cleanSession,
            isDemo: analysis.isDemo,
            mode: requestedMode,
            uid: analysis.targetUid > 0 ? analysis.targetUid : undefined,
            attemptId,
            timeoutMs: timeoutDuration - 2500,
          }),
          signal: abortController.signal,
        });

        // Stale check: If attempt was superseded while fetch was in-flight, discard response
        if (this.activeAttemptId !== attemptId || this.activeGeneration !== gen) {
          return {
            ok: false,
            state: 'PO_CONNECTION_DISCONNECTED',
            accountId: null,
            balance: null,
            accountMode: requestedMode,
            errorMessage: 'Superseded by newer connection attempt',
            generation: gen,
            timestamp: Date.now(),
          };
        }

        let data: any = {};
        try {
          const text = await res.text();
          data = JSON.parse(text);
        } catch {
          data = {
            success: false,
            ok: false,
            error: 'تعذر الاتصال بخادم Pocket Option. يرجى التأكد من اتصال الإنترنت وصحة رمز الجلسة.',
          };
        }

        if (!res.ok || !data.success) {
          const errCode: POErrorCategory =
            data.errorCode === 'AUTH_FAILED' ||
            data.error?.includes('NotAuthorized') ||
            data.error?.includes('expired') ||
            data.error?.includes('rejected')
              ? 'AUTH_FAILED'
              : data.errorCode === 'TIMEOUT'
              ? 'TIMEOUT'
              : 'NETWORK_ERROR';

          const serverEvent = data.diagnostics?.authResponse || data.errorCode || 'NotAuthorized';
          const errMsg = data.error || 'فشل التحقق من جلسة Pocket Option (انتهت صلاحية الجلسة أو الرمز غير صالح)';

          // Actionable troubleshooting instructions
          const remedyAction =
            'تم رفض رمز الجلسة من قبل خادم Pocket Option (NotAuthorized).\n' +
            'السبب الشائع: انتهت صلاحية الجلسة أو تم نسخ رمز غير مكتمل.\n' +
            'الحل: افتح منصة Pocket Option في المتصفح، وافتح أدوات المطور (F12) -> Network -> WS، ' +
            'وابحث عن إطار 42["auth", ...] وانسخ رمز الجلسة session وUID المحدّثين.';

          const rejectedDiag: AuthDiagnosticEntry = {
            id: `diag_${Date.now()}_reject`,
            timestamp: new Date().toLocaleTimeString('ar-EG'),
            isoTimestamp: new Date().toISOString(),
            epochMs: Date.now(),
            attemptId,
            generation: gen,
            endpoint: targetEndpoint,
            accountMode: requestedMode,
            isDemo: analysis.isDemo,
            uid: analysis.targetUid,
            uidMasked: PocketOptionConnectionServiceClass.maskUid(analysis.targetUid),
            sessionMasked: PocketOptionConnectionServiceClass.maskSecret(analysis.cleanSession),
            rawFormatDetected: analysis.formatDetected,
            serializedPayloadPreview: analysis.serializedFrame,
            status: 'REJECTED',
            serverEvent,
            serverRejectionReason: errMsg,
            httpStatus: res.status,
            remedyAction,
          };
          this.addDiagnosticEntry(rejectedDiag);

          // Real-time console diagnostic warning (redacted)
          console.warn(
            `[PO-AUTH-DIAGNOSTIC] Server Rejection Captured in Real-Time:\n` +
            `  Server Event: ${serverEvent}\n` +
            `  Rejection Reason: ${errMsg}\n` +
            `  Account Mode: ${requestedMode}\n` +
            `  Endpoint: ${targetEndpoint}\n` +
            `  Redacted Frame: ${analysis.serializedFrame}\n` +
            `  Generation: #${gen}`
          );

          pocketOptionSessionStore.setConnectionFailed({
            generation: gen,
            errorCode: errCode,
            errorMessage: errMsg,
          });
          accountStore.resetConnection(errCode === 'AUTH_FAILED' ? 'AUTH_FAILED' : 'CONNECTION_ERROR', errMsg);

          return {
            ok: false,
            state: 'PO_CONNECTION_FAILED',
            accountId: null,
            balance: null,
            accountMode: requestedMode,
            errorCode: errCode,
            errorMessage: errMsg,
            generation: gen,
            timestamp: Date.now(),
            diagnostic: rejectedDiag,
          };
        }

        // Synchronize server generation if returned
        if (typeof data.generation === 'number') {
          pocketOptionSessionStore.syncServerGeneration(data.generation);
        }

        // Parse diagnostics returned by backend
        const diag: DiagnosticsInfo | undefined = data.diagnostics;
        if (diag) {
          pocketOptionSessionStore.updateFromDiagnostics(diag);
          accountStore.updateFromDiagnostics(diag);
        }

        const isAuthSuccess = Boolean(data.success || data.authVerified || diag?.authVerified);
        const resolvedUid = data.account?.uid || (data.uid ? String(data.uid) : diag?.account.uidMasked || null);

        // Sequence: Socket Connected -> Auth Accepted -> PO_CONNECTION_AUTHENTICATED
        if (isAuthSuccess) {
          const effectiveGen = typeof data.generation === 'number' ? data.generation : gen;
          pocketOptionSessionStore.setAuthenticated({
            generation: effectiveGen,
            accountId: resolvedUid,
            accountMode: requestedMode,
            connectionId: data.connectionId || diag?.connectionId || null,
          });

          // Preserve cached session token in store for seamless UX
          pocketOptionSessionStore.setCachedSession(analysis.cleanSession);

          // Check if balance arrived with auth payload
          const rawBal = data.balance !== null && data.balance !== undefined ? Number(data.balance) : diag?.account.balance;
          const hasBalance = rawBal !== null && rawBal !== undefined && !isNaN(rawBal);

          if (hasBalance) {
            pocketOptionSessionStore.setVerifiedBalance({
              generation: effectiveGen,
              balance: Number(rawBal),
              accountMode: requestedMode,
              currency: data.account?.currency || diag?.account.currency || 'USD',
            });
            accountStore.setVerifiedAccountData({
              accountId: resolvedUid,
              accountMode: requestedMode,
              balance: Number(rawBal),
              currency: data.account?.currency || diag?.account.currency || 'USD',
              connectionId: data.connectionId || diag?.connectionId || null,
              generation: effectiveGen,
            });
          } else {
            console.log('[PO-CONNECT] Platform authenticated! Awaiting broker balance packet...');
            accountStore.setAccountLoading(effectiveGen);
          }

          const successDiag: AuthDiagnosticEntry = {
            id: `diag_${Date.now()}_success`,
            timestamp: new Date().toLocaleTimeString('ar-EG'),
            isoTimestamp: new Date().toISOString(),
            epochMs: Date.now(),
            attemptId,
            generation: effectiveGen,
            endpoint: targetEndpoint,
            accountMode: requestedMode,
            isDemo: analysis.isDemo,
            uid: resolvedUid ? Number(resolvedUid) || analysis.targetUid : analysis.targetUid,
            uidMasked: PocketOptionConnectionServiceClass.maskUid(resolvedUid || analysis.targetUid),
            sessionMasked: PocketOptionConnectionServiceClass.maskSecret(analysis.cleanSession),
            rawFormatDetected: analysis.formatDetected,
            serializedPayloadPreview: analysis.serializedFrame,
            status: 'AUTHENTICATED',
            serverEvent: 'successauth',
            httpStatus: 200,
            remedyAction: 'تم توثيق الاتصال بنجاح. البيانات الحية جارية من منصة Pocket Option.',
          };
          this.addDiagnosticEntry(successDiag);

          console.info(
            `[PO-AUTH-DIAGNOSTIC] Authentication Verified by Broker:\n` +
            `  Account ID: ${resolvedUid} | Mode: ${requestedMode}\n` +
            `  Connection ID: ${data.connectionId || diag?.connectionId}\n` +
            `  Balance: ${hasBalance ? '$' + Number(rawBal).toFixed(2) : 'Awaiting balance push'}`
          );

          return {
            ok: true,
            state: 'PO_CONNECTION_AUTHENTICATED',
            accountId: resolvedUid,
            balance: hasBalance ? Number(rawBal) : null,
            accountMode: requestedMode,
            connectionId: data.connectionId || diag?.connectionId || null,
            generation: effectiveGen,
            timestamp: Date.now(),
            diagnostic: successDiag,
          };
        }

        return {
          ok: true,
          state: 'PO_CONNECTION_AUTHENTICATING',
          accountId: null,
          balance: null,
          accountMode: requestedMode,
          generation: gen,
          timestamp: Date.now(),
        };
      } catch (err: any) {
        if (err.name === 'AbortError') {
          return {
            ok: false,
            state: 'PO_CONNECTION_DISCONNECTED',
            accountId: null,
            balance: null,
            accountMode: requestedMode,
            errorMessage: 'Connection attempt canceled',
            generation: gen,
            timestamp: Date.now(),
          };
        }

        const errMsg = err?.message || 'حدث خطأ في شبكة الاتصال أثناء التوثيق';
        const netErrDiag: AuthDiagnosticEntry = {
          id: `diag_${Date.now()}_net_err`,
          timestamp: new Date().toLocaleTimeString('ar-EG'),
          isoTimestamp: new Date().toISOString(),
          epochMs: Date.now(),
          attemptId,
          generation: gen,
          endpoint: targetEndpoint,
          accountMode: requestedMode,
          isDemo: analysis.isDemo,
          uid: analysis.targetUid,
          uidMasked: PocketOptionConnectionServiceClass.maskUid(analysis.targetUid),
          sessionMasked: PocketOptionConnectionServiceClass.maskSecret(analysis.cleanSession),
          rawFormatDetected: analysis.formatDetected,
          serializedPayloadPreview: analysis.serializedFrame,
          status: 'FAILED',
          serverRejectionReason: errMsg,
          remedyAction: 'تحقق من تشغيل الخادم المحلي واستقرار الاتصال بالإنترنت.',
        };
        this.addDiagnosticEntry(netErrDiag);

        pocketOptionSessionStore.setConnectionFailed({
          generation: gen,
          errorCode: 'NETWORK_ERROR',
          errorMessage: errMsg,
        });
        accountStore.resetConnection('ERROR', errMsg);

        return {
          ok: false,
          state: 'PO_CONNECTION_FAILED',
          accountId: null,
          balance: null,
          accountMode: requestedMode,
          errorCode: 'NETWORK_ERROR',
          errorMessage: errMsg,
          generation: gen,
          timestamp: Date.now(),
          diagnostic: netErrDiag,
        };
      } finally {
        if (this.activeAttemptId === attemptId) {
          this.isConnecting = false;
        }
      }
    })();

    return Promise.race([executionPromise, timeoutPromise]);
  }

  /**
   * Disconnect Pocket Option session cleanly
   */
  public async disconnect(): Promise<void> {
    this.cancelPending('Manual disconnect');
    pocketOptionSessionStore.disconnect();
    accountStore.resetConnection('DISCONNECTED', 'تم قطع الاتصال بالمنصة يدويًا');

    try {
      await fetch('/api/account/disconnect', { method: 'POST' });
    } catch (err) {
      console.warn('[PocketOptionConnectionService] Notice on disconnect:', err);
    }
  }

  /**
   * Request immediate balance refresh from broker without reconnecting
   */
  public async requestBalanceRefresh(): Promise<boolean> {
    try {
      const res = await fetch('/api/account/balance/refresh', { method: 'POST' });
      return res.ok;
    } catch (err) {
      console.warn('[PocketOptionConnectionService] Error refreshing balance:', err);
      return false;
    }
  }

  public getStatus() {
    return pocketOptionSessionStore.getState();
  }
}

export const pocketOptionConnectionService = new PocketOptionConnectionServiceClass();
