export type CodeStatus = 'ACTIVE' | 'UNUSED' | 'EXPIRED' | 'REVOKED' | 'DISABLED';
export type DeviceStatus = 'ACTIVE' | 'REVOKED';
export type UserRole = 'trader' | 'admin' | 'guest';

export interface AdminAccount {
  id: string;
  username: string;
  passwordHash: string;
  passwordSalt: string;
  mustChangePassword: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

export interface ActivationCodeRecord {
  id: string;
  code: string;
  status: CodeStatus;
  durationHours: number;
  durationLabel: string;
  maxDevices: number;
  activeDevicesCount: number;
  boundUserId: string | null;
  boundUserEmail: string | null;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  activatedAt?: string | null;
  expiresAt?: string | null;
  exactExpiration?: string | null;
  lastUsageAt?: string | null;
  revokedAt?: string | null;
  revocationReason?: string | null;
}

export interface UserRecord {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: UserRole;
  status: 'ACTIVE' | 'DISABLED';
  activeActivationId: string | null;
  activeExpiresAt: string | null;
  activeCode: string | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string;
}

export interface DeviceRecord {
  id: string;
  deviceId: string;
  userId: string;
  userEmail: string;
  codeId: string;
  code: string;
  deviceToken: string;
  fingerprint: string;
  userAgent: string;
  ipAddress: string;
  os: string;
  browser: string;
  status: DeviceStatus;
  createdAt: string;
  lastActiveAt: string;
  revokedAt?: string | null;
  revokedBy?: string | null;
  revocationReason?: string | null;
}

export interface UserSessionRecord {
  id: string;
  sessionToken: string;
  userId: string;
  userEmail: string;
  deviceToken: string;
  deviceId: string;
  codeId: string;
  expiresAt: string;
  status: 'ACTIVE' | 'EXPIRED' | 'REVOKED';
  createdAt: string;
  lastSeenAt: string;
}

export interface UserApiCredentialRecord {
  id: string;
  userId: string;
  platform: 'pocket_option' | 'gemini' | 'custom';
  sessionTokenMasked: string;
  accountUid?: string;
  isDemo: boolean;
  status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
  lastTestedAt?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLogRecord {
  id: string;
  action: string;
  actor: string;
  details: Record<string, any>;
  ipAddress: string;
  timestamp: string;
}

export interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  activeActivations: number;
  expiredActivations: number;
  revokedActivations: number;
  activeDevices: number;
  totalCodesCreated: number;
  codesExpiringSoon: number; // Expiring in next 48h
  recentSecurityEvents: number;
}
