import { AccountMode, SessionFormatType } from './types';

export interface RawAuthInput {
  rawSession?: string;
  sessionToken?: string;
  rawUid?: string | number | null;
  uid?: string | number | null;
  isDemo?: boolean | number;
  expectedMode?: AccountMode;
  endpoint?: string;
  platform?: number;
}

export interface ParsedAuthData {
  session: string;
  uid: number;
  isDemo: 0 | 1;
  platform: number;
  accountMode: AccountMode;
  detectedModeFromPayload?: 'DEMO' | 'REAL' | null;
  format: SessionFormatType;
}

export interface AuthValidationResult {
  valid: boolean;
  isValid: boolean;
  error: string | null;
  errors: string[];
  warnings: string[];
  mode: AccountMode;
  packet?: string;
  payload?: any;
}

export class PocketOptionAuthManager {
  public static parse(input: RawAuthInput): ParsedAuthData {
    let raw = (input.sessionToken || input.rawSession || '').trim();
    // Strip surrounding quotes or backticks
    raw = raw.replace(/^["'`]|["'`]$/g, '').trim();

    let session = raw;
    let uid = 0;
    let platform = input.platform !== undefined ? Number(input.platform) : 2;
    let detectedIsDemo: 0 | 1 | null = null;
    let format: SessionFormatType = 'RAW_SESSION';

    if (raw.startsWith('42') || raw.startsWith('{') || raw.startsWith('[')) {
      format = 'COMPLETE_AUTH_PACKET';
      try {
        const jsonStr = raw.startsWith('42') ? raw.slice(2) : raw;
        const parsed = JSON.parse(jsonStr);
        const data = Array.isArray(parsed) && parsed.length > 1 ? parsed[1] : parsed;
        if (data && typeof data === 'object') {
          if (data.session) {
            session = String(data.session).trim().replace(/^["'`]|["'`]$/g, '');
          }
          if (data.uid !== undefined && data.uid !== null) {
            const numUid = Number(data.uid);
            if (!isNaN(numUid) && numUid > 0) uid = numUid;
          }
          if (data.platform !== undefined) {
            const numPlatform = Number(data.platform);
            if (!isNaN(numPlatform)) platform = numPlatform;
          } else {
            // Default to platform 9 (Web) instead of 2 (Android) when not specified
            platform = 9;
          }
          if (data.isDemo !== undefined && data.isDemo !== null) {
            detectedIsDemo = (data.isDemo === 1 || data.isDemo === '1' || data.isDemo === true) ? 1 : 0;
          }
        }
      } catch {}
    } else if (raw.includes('SSID=') || raw.includes('session=') || raw.includes('auth=') || raw.includes(';')) {
      format = 'RAW_SESSION';
      const match = raw.match(/(?:SSID|session|auth|PHPSESSID)=([^;\s]+)/i);
      if (match) {
        session = match[1].replace(/^["'`]|["'`]$/g, '').trim();
      }
    }

    // Secondary check for isDemo flag inside the string (e.g. cookies or messy JSON)
    if (detectedIsDemo === null) {
      if (/(?:^|[;&,\s"{])isDemo"?\s*[:=]\s*"?0"?/i.test(raw) || /(?:^|[;&,\s"{])is_demo"?\s*[:=]\s*"?0"?/i.test(raw)) {
        detectedIsDemo = 0;
      } else if (/(?:^|[;&,\s"{])isDemo"?\s*[:=]\s*"?1"?/i.test(raw) || /(?:^|[;&,\s"{])is_demo"?\s*[:=]\s*"?1"?/i.test(raw)) {
        detectedIsDemo = 1;
      }
    }

    // Clean any residual cookie prefix or semicolons
    session = session.replace(/^(?:SSID|session|auth|PHPSESSID)=/i, '').replace(/[;\s]+$/, '').replace(/^["'`]|["'`]$/g, '').trim();

    // Priority: explicit input.uid overrides parsed uid
    if (input.uid !== undefined && input.uid !== null && String(input.uid).trim() !== '') {
      const explicitUid = Number(input.uid);
      if (!isNaN(explicitUid) && explicitUid > 0) uid = explicitUid;
    } else if (input.rawUid !== undefined && input.rawUid !== null && String(input.rawUid).trim() !== '') {
      const explicitUid = Number(input.rawUid);
      if (!isNaN(explicitUid) && explicitUid > 0) uid = explicitUid;
    }

    // Determine final isDemo:
    // Highest priority: If detectedIsDemo from SSID payload is found (e.g. {"isDemo":1}), respect it unconditionally!
    // Next priority: If expectedMode was explicitly provided, use it.
    // Next priority: If input.isDemo was explicitly passed, use it.
    // Fallback: Safe Demo mode (1).
    let isDemo: 0 | 1 = 1;
    if (detectedIsDemo !== null) {
      isDemo = detectedIsDemo;
    } else if (input.expectedMode) {
      isDemo = input.expectedMode === 'DEMO' ? 1 : 0;
    } else if (input.isDemo !== undefined && input.isDemo !== null) {
      isDemo = input.isDemo === true || input.isDemo === 1 ? 1 : 0;
    } else {
      isDemo = 1;
    }

    const accountMode: AccountMode = isDemo === 1 ? 'DEMO' : 'REAL';

    return {
      session,
      uid,
      isDemo,
      platform,
      accountMode,
      detectedModeFromPayload: detectedIsDemo === 1 ? 'DEMO' : detectedIsDemo === 0 ? 'REAL' : null,
      format,
    };
  }

  public static validate(
    parsed: ParsedAuthData,
    mode: AccountMode,
    options: { allowZeroUid?: boolean } = {}
  ): AuthValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!parsed.session || parsed.session.length < 8) {
      errors.push('رمز الجلسة غير صالح أو مفقود (أقل من 8 أحرف). يرجى نسخ رمز جلسة صحيح.');
    }

    if (mode === 'REAL' && !options.allowZeroUid && parsed.uid <= 0) {
      warnings.push('الحساب الحقيقي (REAL) يُفضل أن يتضمن معرّف المستخدم (UID) المسجل.');
    }

    if (mode === 'DEMO' && parsed.isDemo !== 1) {
      warnings.push('وضع الحساب DEMO لكن حقل isDemo كان 0. تم تعديله إلى 1.');
    }

    const canonical = this.buildCanonicalPayload(parsed.session, mode, parsed.uid, parsed.platform);
    const valid = errors.length === 0;

    return {
      valid,
      isValid: valid,
      error: errors.length > 0 ? errors[0] : null,
      errors,
      warnings,
      mode,
      packet: canonical.packet,
      payload: canonical.payload,
    };
  }

  public static buildCanonicalPayload(
    session: string,
    mode: AccountMode,
    uid: number,
    platform: number = 9,
    extraOptions?: { isFastHistory?: boolean; isOptimized?: boolean }
  ): { packet: string; payload: any; maskedPacket: string } {
    const isDemo = mode === 'DEMO' ? 1 : 0;
    const cleanSession = (session || '').trim().replace(/^["'`]|["'`]$/g, '');
    const cleanUid = typeof uid === 'number' && !isNaN(uid) && uid > 0 ? uid : 0;
    const cleanPlatform = typeof platform === 'number' && !isNaN(platform) && platform > 0 ? platform : 9;

    const authObject: any = {
      session: cleanSession,
      isDemo,
      uid: cleanUid,
      platform: cleanPlatform,
      isFastHistory: extraOptions?.isFastHistory ?? true,
      isOptimized: extraOptions?.isOptimized ?? true,
    };

    const payload = ['auth', authObject];
    const maskedObject = {
      ...authObject,
      session: '••••••••',
    };

    return {
      packet: `42${JSON.stringify(payload)}`,
      payload: authObject,
      maskedPacket: `42${JSON.stringify(['auth', maskedObject])}`,
    };
  }

  public static validateAuthPayload(sessionToken: string, mode: AccountMode, uid: number): { isValid: boolean; errorReason: string } {
    const parsed = this.parse({ sessionToken, expectedMode: mode, uid });
    if (mode === 'REAL' && (!uid || uid <= 0)) {
      return { isValid: false, errorReason: 'REAL account requires valid numeric UID' };
    }
    const val = this.validate(parsed, mode, { allowZeroUid: mode === 'DEMO' });
    return { isValid: val.isValid, errorReason: val.error || '' };
  }

  public static parseSessionPayload(rawInput: string, fallbackMode: AccountMode, explicitUid?: number): { cleanSession: string; detectedUid: number; sessionFormat: string } {
    const parsed = this.parse({ sessionToken: rawInput, expectedMode: fallbackMode, uid: explicitUid });
    const sessionFormat = parsed.format === 'COMPLETE_AUTH_PACKET' ? 'Format B (Socket.IO DevTools Frame)' : 'Format A (Raw token / serialized)';
    return {
      cleanSession: parsed.session,
      detectedUid: parsed.uid,
      sessionFormat,
    };
  }

  public static getSafeDebugLog(parsed: ParsedAuthData, validation: AuthValidationResult, endpoint: string): string[] {
    const masked = this.maskSecret(parsed.session);
    return [
      `[PO-AUTH-AUDIT] Target Endpoint: ${endpoint}`,
      `[PO-AUTH-AUDIT] Account Mode: ${parsed.accountMode} (isDemo: ${parsed.isDemo})`,
      `[PO-AUTH-AUDIT] User UID: ${parsed.uid > 0 ? this.maskUid(parsed.uid) : '0 (DEMO/UNASSIGNED)'}`,
      `[PO-AUTH-AUDIT] Session Token (Masked): ${masked}`,
      `[PO-AUTH-AUDIT] Format Detected: ${parsed.format}`,
      `[PO-AUTH-AUDIT] Serialized Payload: 42["auth",{"session":"${masked}","isDemo":${parsed.isDemo},"uid":${parsed.uid},"platform":${parsed.platform}}]`,
      `[PO-AUTH-AUDIT] Pre-flight Validation: ${validation.isValid ? 'PASSED' : 'FAILED - ' + validation.error}`,
    ];
  }

  public static maskUid(uid: number | string | null | undefined): string {
    if (!uid) return '0 (DEMO)';
    const s = String(uid);
    if (s.length <= 4) return s;
    return `${s.slice(0, 2)}***${s.slice(-2)}`;
  }

  public static maskSecret(token: string | null | undefined): string {
    if (!token) return 'MISSING';
    if (token.length <= 8) return '********';
    return `${token.slice(0, 4)}...${token.slice(-4)}`;
  }

  public static buildDiagnosticReport(input: any): any {
    return {
      timestamp: new Date().toISOString(),
      ...input,
    };
  }
}
