import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  deleteDoc,
  Firestore,
} from 'firebase/firestore';
import fs from 'fs';
import path from 'path';
import {
  AdminAccount,
  ActivationCodeRecord,
  UserRecord,
  DeviceRecord,
  UserSessionRecord,
  UserApiCredentialRecord,
  AuditLogRecord,
} from '../types/authSystemTypes';

export class DatabaseService {
  private static instance: DatabaseService;
  private db: Firestore | null = null;
  private isConnected = false;

  // Resilient memory cache backing with atomic transaction locks
  private adminsCache = new Map<string, AdminAccount>();
  private codesCache = new Map<string, ActivationCodeRecord>();
  private usersCache = new Map<string, UserRecord>();
  private devicesCache = new Map<string, DeviceRecord>();
  private sessionsCache = new Map<string, UserSessionRecord>();
  private credentialsCache = new Map<string, UserApiCredentialRecord>();
  private auditLogsCache: AuditLogRecord[] = [];

  private lockMap = new Map<string, Promise<void>>();

  private constructor() {
    this.initFirebase();
    this.loadLocalState();
    this.ensureMasterCode();
  }

  public ensureMasterCode(): ActivationCodeRecord {
    const existing = this.codesCache.get('code_master_sbaa0000') ||
      this.codesCache.get('SBAA0000') ||
      Array.from(this.codesCache.values()).find((c) => c.code.toUpperCase().replace(/[^A-Z0-9]/g, '') === 'SBAA0000');

    if (existing) {
      existing.status = 'ACTIVE';
      this.codesCache.set('SBAA0000', existing);
      this.codesCache.set('SABAA0000', existing);
      return existing;
    }

    const now = new Date();
    const expTime = new Date(now.getTime() + 100 * 365 * 24 * 60 * 60 * 1000); // 100 years lifetime
    const masterCode: ActivationCodeRecord = {
      id: 'code_master_sbaa0000',
      code: 'SBAA0000',
      status: 'ACTIVE',
      durationHours: 876000,
      durationLabel: 'Lifetime (Master Administrator)',
      maxDevices: 100,
      activeDevicesCount: 0,
      boundUserId: null,
      boundUserEmail: null,
      createdAt: now.toISOString(),
      createdBy: 'system_root_admin',
      updatedAt: now.toISOString(),
      expiresAt: expTime.toISOString(),
    };

    this.codesCache.set(masterCode.id, masterCode);
    this.codesCache.set('SBAA0000', masterCode);
    this.codesCache.set('SABAA0000', masterCode);
    this.persistLocalState('activation_codes');
    return masterCode;
  }

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  private initFirebase() {
    try {
      const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
      if (fs.existsSync(configPath)) {
        const configRaw = fs.readFileSync(configPath, 'utf8');
        const config = JSON.parse(configRaw);
        const app = getApps().length === 0 ? initializeApp(config) : getApp();
        const dbId = config.firestoreDatabaseId && config.firestoreDatabaseId !== '(default)'
          ? config.firestoreDatabaseId
          : undefined;
        this.db = dbId ? getFirestore(app, dbId) : getFirestore(app);
        this.isConnected = true;
        console.log('[DatabaseService] Connected to Firestore instance:', dbId || '(default)');
      }
    } catch (err) {
      console.warn('[DatabaseService] Notice initializing Firestore:', err instanceof Error ? err.message : String(err));
    }
  }

  // Backup persistence state for fast warm reboots
  private getStorageFilePath(collectionName: string): string {
    const dir = path.resolve(process.cwd(), '.data');
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch {
        // ignore
      }
    }
    return path.join(dir, `${collectionName}.json`);
  }

  private loadLocalState() {
    try {
      const collections = ['admins', 'activation_codes', 'users', 'devices', 'sessions', 'api_credentials', 'audit_logs'];
      for (const col of collections) {
        const filePath = this.getStorageFilePath(col);
        if (fs.existsSync(filePath)) {
          const raw = fs.readFileSync(filePath, 'utf8');
          const data = JSON.parse(raw);
          if (col === 'admins') {
            Object.values(data).forEach((item: any) => this.adminsCache.set(item.id || item.username, item));
          } else if (col === 'activation_codes') {
            Object.values(data).forEach((item: any) => this.codesCache.set(item.id || item.code, item));
          } else if (col === 'users') {
            Object.values(data).forEach((item: any) => this.usersCache.set(item.uid, item));
          } else if (col === 'devices') {
            Object.values(data).forEach((item: any) => this.devicesCache.set(item.id || item.deviceId, item));
          } else if (col === 'sessions') {
            Object.values(data).forEach((item: any) => this.sessionsCache.set(item.id || item.sessionToken, item));
          } else if (col === 'api_credentials') {
            Object.values(data).forEach((item: any) => this.credentialsCache.set(item.id || item.userId, item));
          } else if (col === 'audit_logs') {
            this.auditLogsCache = Array.isArray(data) ? data : [];
          }
        }
      }
    } catch (e) {
      console.warn('[DatabaseService] Notice loading local cache:', e);
    }
  }

  private persistLocalState(col: string) {
    try {
      const filePath = this.getStorageFilePath(col);
      let data: any;
      if (col === 'admins') data = Object.fromEntries(this.adminsCache);
      else if (col === 'activation_codes') data = Object.fromEntries(this.codesCache);
      else if (col === 'users') data = Object.fromEntries(this.usersCache);
      else if (col === 'devices') data = Object.fromEntries(this.devicesCache);
      else if (col === 'sessions') data = Object.fromEntries(this.sessionsCache);
      else if (col === 'api_credentials') data = Object.fromEntries(this.credentialsCache);
      else if (col === 'audit_logs') data = this.auditLogsCache;

      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch {
      // ignore
    }
  }

  /**
   * Acquire atomic transaction lock for key to prevent activation and device race conditions
   */
  public async withLock<T>(key: string, task: () => Promise<T>): Promise<T> {
    while (this.lockMap.has(key)) {
      await this.lockMap.get(key);
    }
    let resolveLock!: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      resolveLock = resolve;
    });
    this.lockMap.set(key, lockPromise);

    try {
      return await task();
    } finally {
      this.lockMap.delete(key);
      resolveLock();
    }
  }

  // ================= ADMINS =================
  public async getAdmin(idOrUsername: string): Promise<AdminAccount | null> {
    const cached = this.adminsCache.get(idOrUsername) || Array.from(this.adminsCache.values()).find((a) => a.username === idOrUsername);
    if (cached) return cached;

    if (this.db) {
      try {
        const docRef = doc(this.db, 'admins', idOrUsername);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const val = snap.data() as AdminAccount;
          this.adminsCache.set(val.id, val);
          return val;
        }
      } catch (err) {
        console.warn('[DatabaseService] Firestore getAdmin error:', err);
      }
    }
    return null;
  }

  public async saveAdmin(admin: AdminAccount): Promise<void> {
    this.adminsCache.set(admin.id, admin);
    this.persistLocalState('admins');

    if (this.db) {
      try {
        const docRef = doc(this.db, 'admins', admin.id);
        await setDoc(docRef, admin, { merge: true });
      } catch (err) {
        console.warn('[DatabaseService] Firestore saveAdmin error:', err);
      }
    }
  }

  // ================= ACTIVATION CODES =================
  public async getActivationCode(codeOrId: string): Promise<ActivationCodeRecord | null> {
    if (!codeOrId) return null;
    const normalizedDigits = codeOrId
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

    const normalized = normalizedDigits.trim().toUpperCase();
    const cleanNoHyphen = normalized.replace(/[^A-Z0-9]/g, '');

    // Master administrator code instant resolution
    if (cleanNoHyphen === 'SBAA0000' || cleanNoHyphen === 'SABAA0000') {
      return this.ensureMasterCode();
    }

    const cached = this.codesCache.get(codeOrId) ||
      this.codesCache.get(normalized) ||
      Array.from(this.codesCache.values()).find((c) => c.code.toUpperCase() === normalized || c.code.toUpperCase().replace(/[^A-Z0-9]/g, '') === cleanNoHyphen);
    if (cached) return cached;

    if (this.db) {
      try {
        const docRef = doc(this.db, 'activation_codes', codeOrId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const val = snap.data() as ActivationCodeRecord;
          this.codesCache.set(val.id, val);
          return val;
        }
      } catch (err) {
        console.warn('[DatabaseService] Firestore getActivationCode error:', err);
      }
    }
    return null;
  }

  public async saveActivationCode(code: ActivationCodeRecord): Promise<void> {
    this.codesCache.set(code.id, code);
    this.codesCache.set(code.code.toUpperCase(), code);
    this.persistLocalState('activation_codes');

    if (this.db) {
      try {
        const docRef = doc(this.db, 'activation_codes', code.id);
        await setDoc(docRef, code, { merge: true });
      } catch (err) {
        console.warn('[DatabaseService] Firestore saveActivationCode error:', err);
      }
    }
  }

  public async getAllActivationCodes(): Promise<ActivationCodeRecord[]> {
    return Array.from(new Set(this.codesCache.values()));
  }

  // ================= USERS =================
  public async getUser(uid: string): Promise<UserRecord | null> {
    const cached = this.usersCache.get(uid);
    if (cached) return cached;

    if (this.db) {
      try {
        const docRef = doc(this.db, 'users', uid);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const val = snap.data() as UserRecord;
          this.usersCache.set(val.uid, val);
          return val;
        }
      } catch (err) {
        console.warn('[DatabaseService] Firestore getUser error:', err);
      }
    }
    return null;
  }

  public async saveUser(user: UserRecord): Promise<void> {
    this.usersCache.set(user.uid, user);
    this.persistLocalState('users');

    if (this.db) {
      try {
        const docRef = doc(this.db, 'users', user.uid);
        await setDoc(docRef, user, { merge: true });
      } catch (err) {
        console.warn('[DatabaseService] Firestore saveUser error:', err);
      }
    }
  }

  public async getAllUsers(): Promise<UserRecord[]> {
    return Array.from(this.usersCache.values());
  }

  // ================= DEVICES =================
  public async getDevice(deviceIdOrToken: string): Promise<DeviceRecord | null> {
    const cached = this.devicesCache.get(deviceIdOrToken) || Array.from(this.devicesCache.values()).find((d) => d.deviceToken === deviceIdOrToken || d.deviceId === deviceIdOrToken);
    if (cached) return cached;

    if (this.db) {
      try {
        const docRef = doc(this.db, 'devices', deviceIdOrToken);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const val = snap.data() as DeviceRecord;
          this.devicesCache.set(val.id, val);
          return val;
        }
      } catch (err) {
        console.warn('[DatabaseService] Firestore getDevice error:', err);
      }
    }
    return null;
  }

  public async getDevicesByUserAndCode(userId: string, codeId: string): Promise<DeviceRecord[]> {
    return Array.from(this.devicesCache.values()).filter(
      (d) => d.userId === userId && d.codeId === codeId && d.status === 'ACTIVE'
    );
  }

  public async getDevicesByCode(codeId: string): Promise<DeviceRecord[]> {
    return Array.from(this.devicesCache.values()).filter((d) => d.codeId === codeId);
  }

  public async getAllDevices(): Promise<DeviceRecord[]> {
    return Array.from(this.devicesCache.values());
  }

  public async saveDevice(device: DeviceRecord): Promise<void> {
    this.devicesCache.set(device.id, device);
    this.devicesCache.set(device.deviceToken, device);
    this.persistLocalState('devices');

    if (this.db) {
      try {
        const docRef = doc(this.db, 'devices', device.id);
        await setDoc(docRef, device, { merge: true });
      } catch (err) {
        console.warn('[DatabaseService] Firestore saveDevice error:', err);
      }
    }
  }

  // ================= SESSIONS =================
  public async getSession(sessionToken: string): Promise<UserSessionRecord | null> {
    const cached = this.sessionsCache.get(sessionToken);
    if (cached) return cached;

    if (this.db) {
      try {
        const docRef = doc(this.db, 'sessions', sessionToken);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const val = snap.data() as UserSessionRecord;
          this.sessionsCache.set(val.sessionToken, val);
          return val;
        }
      } catch (err) {
        console.warn('[DatabaseService] Firestore getSession error:', err);
      }
    }
    return null;
  }

  public async saveSession(session: UserSessionRecord): Promise<void> {
    this.sessionsCache.set(session.sessionToken, session);
    this.persistLocalState('sessions');

    if (this.db) {
      try {
        const docRef = doc(this.db, 'sessions', session.sessionToken);
        await setDoc(docRef, session, { merge: true });
      } catch (err) {
        console.warn('[DatabaseService] Firestore saveSession error:', err);
      }
    }
  }

  public async invalidateUserSessions(userId: string): Promise<void> {
    for (const [key, session] of this.sessionsCache.entries()) {
      if (session.userId === userId) {
        session.status = 'REVOKED';
        this.sessionsCache.set(key, session);
        if (this.db) {
          try {
            await setDoc(doc(this.db, 'sessions', session.sessionToken), { status: 'REVOKED' }, { merge: true });
          } catch {}
        }
      }
    }
    this.persistLocalState('sessions');
  }

  // ================= API CREDENTIALS =================
  public async getCredentials(userId: string): Promise<UserApiCredentialRecord | null> {
    const cached = this.credentialsCache.get(userId);
    if (cached) return cached;

    if (this.db) {
      try {
        const docRef = doc(this.db, 'api_credentials', userId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const val = snap.data() as UserApiCredentialRecord;
          this.credentialsCache.set(userId, val);
          return val;
        }
      } catch (err) {
        console.warn('[DatabaseService] Firestore getCredentials error:', err);
      }
    }
    return null;
  }

  public async saveCredentials(cred: UserApiCredentialRecord): Promise<void> {
    this.credentialsCache.set(cred.userId, cred);
    this.persistLocalState('api_credentials');

    if (this.db) {
      try {
        const docRef = doc(this.db, 'api_credentials', cred.userId);
        await setDoc(docRef, cred, { merge: true });
      } catch (err) {
        console.warn('[DatabaseService] Firestore saveCredentials error:', err);
      }
    }
  }

  public async deleteCredentials(userId: string): Promise<void> {
    this.credentialsCache.delete(userId);
    this.persistLocalState('api_credentials');

    if (this.db) {
      try {
        const docRef = doc(this.db, 'api_credentials', userId);
        await deleteDoc(docRef);
      } catch (err) {
        console.warn('[DatabaseService] Firestore deleteCredentials error:', err);
      }
    }
  }

  // ================= AUDIT LOGS =================
  public async addAuditLog(log: Omit<AuditLogRecord, 'id' | 'timestamp'>): Promise<AuditLogRecord> {
    const record: AuditLogRecord = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      timestamp: new Date().toISOString(),
      ...log,
    };
    this.auditLogsCache.unshift(record);
    if (this.auditLogsCache.length > 500) {
      this.auditLogsCache = this.auditLogsCache.slice(0, 500);
    }
    this.persistLocalState('audit_logs');

    if (this.db) {
      try {
        const docRef = doc(this.db, 'audit_logs', record.id);
        await setDoc(docRef, record);
      } catch (err) {
        console.warn('[DatabaseService] Firestore addAuditLog error:', err);
      }
    }
    return record;
  }

  public async getAuditLogs(limitCount = 100): Promise<AuditLogRecord[]> {
    return this.auditLogsCache.slice(0, limitCount);
  }
}

export const dbService = DatabaseService.getInstance();
