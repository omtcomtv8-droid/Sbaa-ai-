import crypto from 'crypto';
import { dbService } from './DatabaseService';
import { adminAuthService } from './AdminAuthService';
import {
  ActivationCodeRecord,
  CodeStatus,
  DeviceRecord,
  UserRecord,
  UserSessionRecord,
  DashboardStats,
} from '../types/authSystemTypes';

export class ActivationManager {
  private static instance: ActivationManager;

  // Rate limiting for activation attempts per IP/user (max 10 attempts per 10 minutes)
  private activationAttempts = new Map<string, { count: number; lastAttempt: number }>();

  private constructor() {}

  public static getInstance(): ActivationManager {
    if (!ActivationManager.instance) {
      ActivationManager.instance = new ActivationManager();
    }
    return ActivationManager.instance;
  }

  public isMasterAdminCode(code: string): boolean {
    if (!code) return false;
    const normalizedDigits = code
      .replace(/[٠۰]/g, '0')
      .replace(/[١۱]/g, '1')
      .replace(/[٢۲]/g, '2')
      .replace(/[٣۳]/g, '3')
      .replace(/[٤۴]/g, '4')
      .replace(/[٥۵]/g, '5')
      .replace(/[٦۶]/g, '6')
      .replace(/[٧۷]/g, '7')
      .replace(/[٨۸]/g, '8')
      .replace(/[٩۹]/g, '9');

    const clean = normalizedDigits.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const rawLower = normalizedDigits.trim().toLowerCase();
    const envPass = (process.env.ADMIN_INITIAL_PASSWORD || 'sbaa0000').trim().toLowerCase();
    const envClean = envPass.toUpperCase().replace(/[^A-Z0-9]/g, '');

    return (
      clean === 'SBAA0000' ||
      clean === 'SABAA0000' ||
      rawLower === 'sbaa0000' ||
      rawLower === 'sabaa0000' ||
      rawLower === envPass ||
      clean === envClean
    );
  }

  /**
   * Cryptographically secure activation code generator
   * Formats: SABAA-XXXX-XXXX-XXXX (16 chars alphanumeric)
   */
  public generateSecureCodeString(): string {
    const raw = crypto.randomBytes(6).toString('hex').toUpperCase(); // 12 chars
    const chunk1 = raw.substring(0, 4);
    const chunk2 = raw.substring(4, 8);
    const chunk3 = raw.substring(8, 12);
    return `SABAA-${chunk1}-${chunk2}-${chunk3}`;
  }

  public getDurationLabel(hours: number): string {
    if (hours === 1) return '1 Hour (ساعة واحدة)';
    if (hours === 24) return '24 Hours (يوم كامل)';
    if (hours === 168) return '7 Days (أسبوع)';
    if (hours === 720) return '30 Days (شهر واحد)';
    if (hours === 2160) return '90 Days (3 أشهر)';
    if (hours === 4320) return '180 Days (6 أشهر)';
    if (hours === 8760) return '1 Year (سنة كاملة - 365 يوماً)';
    if (hours >= 8760) {
      const years = Math.floor(hours / 8760);
      return `${years} Year${years > 1 ? 's' : ''} (سنة)`;
    }
    if (hours >= 24) {
      const days = Math.floor(hours / 24);
      return `${days} Days (أيام)`;
    }
    return `${hours} Hours (ساعة)`;
  }

  /**
   * Admin generates batch or single activation codes
   */
  public async generateCodes(options: {
    count?: number;
    durationHours?: number;
    customHours?: number;
    exactExpiration?: string;
    maxDevices?: number;
    boundUserEmail?: string;
    boundUserId?: string;
    createdBy?: string;
  }): Promise<ActivationCodeRecord[]> {
    const count = Math.min(Math.max(options.count || 1, 1), 100);
    const durationHours = options.customHours || options.durationHours || 720;
    const maxDevices = Math.min(Math.max(options.maxDevices || 1, 1), 20);
    const createdBy = options.createdBy || 'admin';
    const now = new Date().toISOString();

    const createdCodes: ActivationCodeRecord[] = [];

    for (let i = 0; i < count; i++) {
      const codeStr = this.generateSecureCodeString();
      const codeId = `code_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

      let expiresAt: string | null = null;
      if (options.exactExpiration) {
        expiresAt = new Date(options.exactExpiration).toISOString();
      }

      const record: ActivationCodeRecord = {
        id: codeId,
        code: codeStr,
        status: 'UNUSED',
        durationHours,
        durationLabel: options.exactExpiration ? 'Fixed Expiration Date' : this.getDurationLabel(durationHours),
        maxDevices,
        activeDevicesCount: 0,
        boundUserId: options.boundUserId || null,
        boundUserEmail: options.boundUserEmail ? options.boundUserEmail.trim().toLowerCase() : null,
        createdAt: now,
        createdBy,
        updatedAt: now,
        exactExpiration: options.exactExpiration || null,
        expiresAt,
      };

      await dbService.saveActivationCode(record);
      createdCodes.push(record);
    }

    await dbService.addAuditLog({
      action: 'CODES_GENERATED',
      actor: createdBy,
      details: {
        count: createdCodes.length,
        durationHours,
        maxDevices,
        exactExpiration: options.exactExpiration || null,
        boundUserEmail: options.boundUserEmail || null,
      },
      ipAddress: 'internal',
    });

    return createdCodes;
  }

  private checkActivationRateLimit(key: string): boolean {
    const now = Date.now();
    const record = this.activationAttempts.get(key);
    if (!record) {
      this.activationAttempts.set(key, { count: 1, lastAttempt: now });
      return false;
    }
    if (now - record.lastAttempt > 10 * 60 * 1000) {
      this.activationAttempts.set(key, { count: 1, lastAttempt: now });
      return false;
    }
    if (record.count >= 10) {
      return true; // Limited
    }
    record.count += 1;
    record.lastAttempt = now;
    return false;
  }

  /**
   * User activates a code atomically with device limit validation and account binding
   */
  public async activateCode(params: {
    userId: string;
    userEmail: string;
    rawCode: string;
    deviceFingerprint?: string;
    userAgent?: string;
    ipAddress: string;
  }): Promise<{
    success: boolean;
    sessionToken?: string;
    deviceToken?: string;
    adminToken?: string;
    role?: string;
    expiresAt?: string;
    durationHours?: number;
    maxDevices?: number;
    activeDevicesCount?: number;
    error?: string;
    errorCode?: string;
  }> {
    const { userId, userEmail, rawCode, deviceFingerprint, userAgent, ipAddress } = params;

    if (!rawCode || typeof rawCode !== 'string') {
      return { success: false, error: 'Activation code is required.', errorCode: 'INVALID_INPUT' };
    }

    const rateKey = `${ipAddress}_${userId}`;
    if (this.checkActivationRateLimit(rateKey)) {
      return {
        success: false,
        error: 'Too many activation attempts. Please wait a few minutes before trying again.',
        errorCode: 'RATE_LIMITED',
      };
    }

    const isMasterAdmin = this.isMasterAdminCode(rawCode);
    const cleanCode = isMasterAdmin ? 'SBAA0000' : rawCode.trim().toUpperCase();

    // Use atomic lock on this code to prevent simultaneous race conditions
    return await dbService.withLock(`code_${cleanCode}`, async () => {
      let codeRecord = await dbService.getActivationCode(cleanCode);

      if (!codeRecord && isMasterAdmin) {
        codeRecord = dbService.ensureMasterCode();
      }

      if (!codeRecord) {
        await dbService.addAuditLog({
          action: 'ACTIVATION_FAILED',
          actor: `user:${userEmail || userId}`,
          details: { reason: 'Code not found', code: cleanCode, ip: ipAddress },
          ipAddress,
        });
        return {
          success: false,
          error: 'The activation code you entered is invalid. Please check your code and try again.',
          errorCode: 'CODE_INVALID',
        };
      }

      const now = new Date();

      if (!isMasterAdmin) {
        // Standard user code checks
        if (codeRecord.status === 'REVOKED') {
          return {
            success: false,
            error: 'This activation code has been revoked by the administrator.',
            errorCode: 'CODE_REVOKED',
          };
        }
        if (codeRecord.status === 'DISABLED') {
          return {
            success: false,
            error: 'This activation code is currently disabled.',
            errorCode: 'CODE_DISABLED',
          };
        }

        // Check account binding: If already bound to another user
        if (codeRecord.boundUserId && codeRecord.boundUserId !== userId) {
          await dbService.addAuditLog({
            action: 'ACTIVATION_FAILED',
            actor: `user:${userEmail}`,
            details: { reason: 'Code bound to different user', boundTo: codeRecord.boundUserEmail, ip: ipAddress },
            ipAddress,
          });
          return {
            success: false,
            error: `This activation code is already registered to another account (${codeRecord.boundUserEmail || 'different user'}).`,
            errorCode: 'CODE_BOUND_TO_OTHER',
          };
        }

        if (codeRecord.boundUserEmail && codeRecord.boundUserEmail.toLowerCase() !== userEmail.toLowerCase()) {
          return {
            success: false,
            error: `This activation code was issued exclusively for ${codeRecord.boundUserEmail}.`,
            errorCode: 'CODE_EMAIL_MISMATCH',
          };
        }

        // Check expiration if already activated
        if (codeRecord.expiresAt && new Date(codeRecord.expiresAt).getTime() <= now.getTime()) {
          codeRecord.status = 'EXPIRED';
          await dbService.saveActivationCode(codeRecord);
          return {
            success: false,
            error: 'This activation code has expired.',
            errorCode: 'CODE_EXPIRED',
          };
        }
      } else {
        // Master admin code is guaranteed permanently active
        codeRecord.status = 'ACTIVE';
        if (!codeRecord.expiresAt || new Date(codeRecord.expiresAt).getTime() <= now.getTime()) {
          codeRecord.expiresAt = new Date(now.getTime() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString();
        }
      }

      // Calculate expiration date if first activation
      let finalExpiresAt = codeRecord.expiresAt;
      if (!finalExpiresAt) {
        if (codeRecord.exactExpiration) {
          finalExpiresAt = new Date(codeRecord.exactExpiration).toISOString();
        } else {
          const expTime = new Date(now.getTime() + codeRecord.durationHours * 60 * 60 * 1000);
          finalExpiresAt = expTime.toISOString();
        }
      }

      // Device & Session Verification
      const fingerprint = deviceFingerprint || crypto.createHash('sha256').update(userAgent || 'web').digest('hex').substring(0, 32);
      const existingDevices = await dbService.getDevicesByUserAndCode(userId, codeRecord.id);

      let matchedDevice = existingDevices.find((d) => d.fingerprint === fingerprint && d.status === 'ACTIVE');
      let deviceToken: string;

      if (matchedDevice) {
        // Known active device -> refresh activity
        matchedDevice.lastActiveAt = now.toISOString();
        matchedDevice.ipAddress = ipAddress;
        if (userAgent) matchedDevice.userAgent = userAgent;
        await dbService.saveDevice(matchedDevice);
        deviceToken = matchedDevice.deviceToken;
      } else {
        // New device: Enforce device limit!
        const activeCount = existingDevices.length;
        if (activeCount >= codeRecord.maxDevices) {
          await dbService.addAuditLog({
            action: 'DEVICE_LIMIT_REACHED',
            actor: `user:${userEmail}`,
            details: {
              code: codeRecord.code,
              maxDevices: codeRecord.maxDevices,
              activeCount,
              fingerprint,
              ip: ipAddress,
            },
            ipAddress,
          });
          return {
            success: false,
            error: `Device limit reached. This activation code allows a maximum of ${codeRecord.maxDevices} active device(s).`,
            errorCode: 'DEVICE_LIMIT_REACHED',
            maxDevices: codeRecord.maxDevices,
            activeDevicesCount: activeCount,
          };
        }

        // Register new device
        deviceToken = `dev_${crypto.randomBytes(32).toString('hex')}`;
        const deviceId = `device_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
        const os = (userAgent || '').includes('Android') ? 'Android' : (userAgent || '').includes('iPhone') ? 'iOS' : (userAgent || '').includes('Windows') ? 'Windows' : (userAgent || '').includes('Mac') ? 'macOS' : 'Web Browser';
        const browser = (userAgent || '').includes('Chrome') ? 'Chrome' : (userAgent || '').includes('Safari') ? 'Safari' : (userAgent || '').includes('Firefox') ? 'Firefox' : 'Browser';

        const newDevice: DeviceRecord = {
          id: deviceId,
          deviceId,
          userId,
          userEmail,
          codeId: codeRecord.id,
          code: codeRecord.code,
          deviceToken,
          fingerprint,
          userAgent: userAgent || 'Web Client',
          ipAddress,
          os,
          browser,
          status: 'ACTIVE',
          createdAt: now.toISOString(),
          lastActiveAt: now.toISOString(),
        };

        await dbService.saveDevice(newDevice);
        existingDevices.push(newDevice);
      }

      // Update code record
      codeRecord.status = 'ACTIVE';
      codeRecord.boundUserId = userId;
      codeRecord.boundUserEmail = userEmail;
      codeRecord.activatedAt = codeRecord.activatedAt || now.toISOString();
      codeRecord.expiresAt = finalExpiresAt;
      codeRecord.activeDevicesCount = existingDevices.filter((d) => d.status === 'ACTIVE').length;
      codeRecord.lastUsageAt = now.toISOString();
      codeRecord.updatedAt = now.toISOString();

      await dbService.saveActivationCode(codeRecord);

      // Update User profile
      let userRecord = await dbService.getUser(userId);
      if (!userRecord) {
        userRecord = {
          uid: userId,
          email: userEmail,
          displayName: userEmail.split('@')[0] || (isMasterAdmin ? 'Admin' : 'Trader'),
          role: isMasterAdmin ? 'admin' : 'trader',
          status: 'ACTIVE',
          activeActivationId: codeRecord.id,
          activeExpiresAt: finalExpiresAt,
          activeCode: codeRecord.code,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
          lastLoginAt: now.toISOString(),
        };
      } else {
        if (isMasterAdmin) {
          userRecord.role = 'admin';
        }
        userRecord.status = 'ACTIVE';
        userRecord.activeActivationId = codeRecord.id;
        userRecord.activeExpiresAt = finalExpiresAt;
        userRecord.activeCode = codeRecord.code;
        userRecord.updatedAt = now.toISOString();
        userRecord.lastLoginAt = now.toISOString();
      }
      await dbService.saveUser(userRecord);

      // Create new secure session
      const sessionToken = `sess_${crypto.randomBytes(32).toString('hex')}`;
      const sessionRecord: UserSessionRecord = {
        id: sessionToken,
        sessionToken,
        userId,
        userEmail,
        deviceToken,
        deviceId: matchedDevice ? matchedDevice.id : deviceToken,
        codeId: codeRecord.id,
        expiresAt: finalExpiresAt,
        status: 'ACTIVE',
        createdAt: now.toISOString(),
        lastSeenAt: now.toISOString(),
      };
      await dbService.saveSession(sessionRecord);

      // Issue admin session token if user is an administrator
      let adminToken: string | undefined;
      if (isMasterAdmin || userRecord.role === 'admin') {
        adminToken = adminAuthService.createAdminSession(userEmail || 'admin');
      }

      await dbService.addAuditLog({
        action: 'USER_ACTIVATION_SUCCESS',
        actor: `user:${userEmail}`,
        details: {
          code: codeRecord.code,
          isMasterAdmin,
          role: userRecord.role,
          durationHours: codeRecord.durationHours,
          expiresAt: finalExpiresAt,
          activeDevices: codeRecord.activeDevicesCount,
          maxDevices: codeRecord.maxDevices,
          ip: ipAddress,
        },
        ipAddress,
      });

      return {
        success: true,
        sessionToken,
        deviceToken,
        adminToken,
        role: userRecord.role,
        expiresAt: finalExpiresAt,
        durationHours: codeRecord.durationHours,
        maxDevices: codeRecord.maxDevices,
        activeDevicesCount: codeRecord.activeDevicesCount,
      };
    });
  }

  /**
   * Real-time verification of user session, device status, and license expiration
   */
  public async validateUserSession(
    sessionToken: string,
    deviceToken?: string
  ): Promise<{
    valid: boolean;
    user?: UserRecord;
    activation?: ActivationCodeRecord;
    device?: DeviceRecord;
    error?: string;
    errorCode?: string;
  }> {
    if (!sessionToken) {
      return { valid: false, error: 'Session token required', errorCode: 'NO_SESSION' };
    }

    const session = await dbService.getSession(sessionToken);
    if (!session || session.status !== 'ACTIVE') {
      return { valid: false, error: 'Session expired or invalidated', errorCode: 'SESSION_INVALID' };
    }

    const user = await dbService.getUser(session.userId);
    if (!user || user.status !== 'ACTIVE') {
      return { valid: false, error: 'User account is disabled', errorCode: 'USER_DISABLED' };
    }

    const code = await dbService.getActivationCode(session.codeId);
    if (!code || code.status !== 'ACTIVE') {
      return { valid: false, error: 'Activation code is not active or has been revoked', errorCode: 'CODE_INACTIVE' };
    }

    const now = new Date();
    if (code.expiresAt && new Date(code.expiresAt).getTime() <= now.getTime()) {
      code.status = 'EXPIRED';
      await dbService.saveActivationCode(code);
      session.status = 'EXPIRED';
      await dbService.saveSession(session);
      return { valid: false, error: 'Activation has expired', errorCode: 'ACTIVATION_EXPIRED' };
    }

    // Check device status
    let device: DeviceRecord | null = null;
    const targetDevToken = deviceToken || session.deviceToken;
    if (targetDevToken) {
      device = await dbService.getDevice(targetDevToken);
      if (device && device.status !== 'ACTIVE') {
        return { valid: false, error: 'This device has been revoked by the administrator', errorCode: 'DEVICE_REVOKED' };
      }
    }

    // Touch last active
    session.lastSeenAt = now.toISOString();
    await dbService.saveSession(session);
    if (device) {
      device.lastActiveAt = now.toISOString();
      await dbService.saveDevice(device);
    }

    return {
      valid: true,
      user,
      activation: code,
      device: device || undefined,
    };
  }

  public async generateBatchCodes(options: {
    count?: number;
    durationHours?: number;
    customHours?: number;
    exactExpiration?: string;
    maxDevices?: number;
    boundUserEmail?: string;
    boundUserId?: string;
    createdBy?: string;
    customDurationLabel?: string;
    ipAddress?: string;
  }): Promise<ActivationCodeRecord[]> {
    return this.generateCodes(options);
  }

  // ================= ADMIN MANAGEMENT =================

  public async revokeCode(codeId: string, arg2?: string, arg3?: string, ipAddress?: string): Promise<boolean> {
    const code = await dbService.getActivationCode(codeId);
    if (!code) return false;

    const adminUser = (arg3 && arg3 !== 'admin' ? arg3 : arg2) || 'admin';
    const reason = (arg3 ? arg2 : arg3) || 'Revoked by administrator';

    code.status = 'REVOKED';
    code.revokedAt = new Date().toISOString();
    code.revocationReason = reason;
    code.updatedAt = new Date().toISOString();
    await dbService.saveActivationCode(code);

    // Invalidate user sessions associated with this code
    if (code.boundUserId) {
      await dbService.invalidateUserSessions(code.boundUserId);
    }

    await dbService.addAuditLog({
      action: 'CODE_REVOKED',
      actor: adminUser,
      details: { code: code.code, boundUser: code.boundUserEmail, reason },
      ipAddress: ipAddress || 'admin_panel',
    });

    return true;
  }

  public async toggleCode(codeId: string, adminUser: string, enabled: boolean): Promise<boolean> {
    const code = await dbService.getActivationCode(codeId);
    if (!code) return false;

    code.status = enabled ? 'ACTIVE' : 'DISABLED';
    code.updatedAt = new Date().toISOString();
    await dbService.saveActivationCode(code);

    await dbService.addAuditLog({
      action: enabled ? 'CODE_ENABLED' : 'CODE_DISABLED',
      actor: adminUser,
      details: { code: code.code, boundUser: code.boundUserEmail },
      ipAddress: 'admin_panel',
    });

    return true;
  }

  public async extendCode(
    codeId: string,
    adminUser: string,
    additionalHours?: number,
    newExactExpiration?: string
  ): Promise<{ success: boolean; newExpiresAt?: string }> {
    const code = await dbService.getActivationCode(codeId);
    if (!code) return { success: false };

    let newExpDate: Date;
    if (newExactExpiration) {
      newExpDate = new Date(newExactExpiration);
    } else {
      const baseTime = code.expiresAt && new Date(code.expiresAt).getTime() > Date.now()
        ? new Date(code.expiresAt)
        : new Date();
      newExpDate = new Date(baseTime.getTime() + (additionalHours || 24) * 60 * 60 * 1000);
    }

    code.expiresAt = newExpDate.toISOString();
    if (code.status === 'EXPIRED') {
      code.status = 'ACTIVE';
    }
    code.updatedAt = new Date().toISOString();
    await dbService.saveActivationCode(code);

    if (code.boundUserId) {
      const user = await dbService.getUser(code.boundUserId);
      if (user) {
        user.activeExpiresAt = code.expiresAt;
        await dbService.saveUser(user);
      }
    }

    await dbService.addAuditLog({
      action: 'CODE_EXTENDED',
      actor: adminUser,
      details: { code: code.code, newExpiresAt: code.expiresAt, boundUser: code.boundUserEmail },
      ipAddress: 'admin_panel',
    });

    return { success: true, newExpiresAt: code.expiresAt };
  }

  public async changeDeviceLimit(codeId: string, adminUser: string, newLimit: number): Promise<boolean> {
    const code = await dbService.getActivationCode(codeId);
    if (!code) return false;

    code.maxDevices = Math.max(1, newLimit);
    code.updatedAt = new Date().toISOString();
    await dbService.saveActivationCode(code);

    await dbService.addAuditLog({
      action: 'DEVICE_LIMIT_CHANGED',
      actor: adminUser,
      details: { code: code.code, newLimit: code.maxDevices },
      ipAddress: 'admin_panel',
    });

    return true;
  }

  public async revokeDevice(deviceId: string, arg2?: string, arg3?: string, ipAddress?: string): Promise<boolean> {
    const device = await dbService.getDevice(deviceId);
    if (!device) return false;

    const adminUser = (arg3 && arg3 !== 'admin' ? arg3 : arg2) || 'admin';
    const reason = (arg3 ? arg2 : arg3) || 'Revoked by administrator';

    device.status = 'REVOKED';
    device.revokedAt = new Date().toISOString();
    device.revokedBy = adminUser;
    device.revocationReason = reason;
    await dbService.saveDevice(device);

    // Decrement active devices on code if possible
    const code = await dbService.getActivationCode(device.codeId);
    if (code) {
      const activeDevices = await dbService.getDevicesByCode(code.id);
      code.activeDevicesCount = activeDevices.filter((d) => d.status === 'ACTIVE').length;
      await dbService.saveActivationCode(code);
    }

    await dbService.addAuditLog({
      action: 'DEVICE_REVOKED',
      actor: adminUser,
      details: { deviceId, userEmail: device.userEmail, ip: device.ipAddress, reason },
      ipAddress: ipAddress || 'admin_panel',
    });

    return true;
  }

  public async toggleUser(userId: string, adminUser: string, active: boolean): Promise<boolean> {
    const user = await dbService.getUser(userId);
    if (!user) return false;

    user.status = active ? 'ACTIVE' : 'DISABLED';
    user.updatedAt = new Date().toISOString();
    await dbService.saveUser(user);

    if (!active) {
      await dbService.invalidateUserSessions(userId);
    }

    await dbService.addAuditLog({
      action: active ? 'USER_ENABLED' : 'USER_DISABLED',
      actor: adminUser,
      details: { userId, userEmail: user.email },
      ipAddress: 'admin_panel',
    });

    return true;
  }

  public async getDashboardStats(): Promise<DashboardStats> {
    const users = await dbService.getAllUsers();
    const codes = await dbService.getAllActivationCodes();
    const devices = await dbService.getAllDevices();
    const now = Date.now();
    const in48Hours = now + 48 * 60 * 60 * 1000;

    const activeUsers = users.filter((u) => u.status === 'ACTIVE').length;
    const activeActivations = codes.filter((c) => c.status === 'ACTIVE').length;
    const expiredActivations = codes.filter((c) => c.status === 'EXPIRED' || (c.expiresAt && new Date(c.expiresAt).getTime() <= now)).length;
    const revokedActivations = codes.filter((c) => c.status === 'REVOKED').length;
    const activeDevices = devices.filter((d) => d.status === 'ACTIVE').length;

    const codesExpiringSoon = codes.filter((c) => {
      if (c.status !== 'ACTIVE' || !c.expiresAt) return false;
      const expTime = new Date(c.expiresAt).getTime();
      return expTime > now && expTime <= in48Hours;
    }).length;

    const logs = await dbService.getAuditLogs(100);
    const recentSecurityEvents = logs.filter((l) => l.action.includes('FAILED') || l.action.includes('LIMITED') || l.action.includes('REVOKED')).length;

    return {
      totalUsers: users.length,
      activeUsers,
      activeActivations,
      expiredActivations,
      revokedActivations,
      activeDevices,
      totalCodesCreated: codes.length,
      codesExpiringSoon,
      recentSecurityEvents,
    };
  }
}

export const activationManager = ActivationManager.getInstance();
