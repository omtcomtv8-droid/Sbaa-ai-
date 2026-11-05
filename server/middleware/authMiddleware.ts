import { Request, Response, NextFunction } from 'express';
import { adminAuthService } from '../services/AdminAuthService';
import { activationManager } from '../services/ActivationManager';
import { UserRecord, ActivationCodeRecord, DeviceRecord } from '../types/authSystemTypes';

export interface AuthenticatedUserRequest extends Request {
  user?: UserRecord;
  activation?: ActivationCodeRecord;
  device?: DeviceRecord;
}

export interface AuthenticatedAdminRequest extends Request {
  admin?: {
    username: string;
    mustChangePassword: boolean;
  };
}

/**
 * Middleware: Enforces that the request comes from an authenticated Google user
 * with an ACTIVE, NON-EXPIRED activation code and an authorized device.
 */
export async function requireActivatedUser(
  req: AuthenticatedUserRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const sessionToken =
    req.headers['x-session-token'] ||
    req.cookies?.session_token ||
    (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')
      ? req.headers.authorization.substring(7).trim()
      : null);

  const deviceToken = (req.headers['x-device-token'] as string) || req.cookies?.device_token;

  if (!sessionToken || typeof sessionToken !== 'string') {
    res.status(401).json({
      error: 'AUTHENTICATION_REQUIRED',
      message: 'Google Sign-In and valid session are required to access this resource.',
    });
    return;
  }

  const validation = await activationManager.validateUserSession(sessionToken, deviceToken);

  if (!validation.valid) {
    res.status(403).json({
      error: 'ACTIVATION_REQUIRED',
      errorCode: validation.errorCode,
      message: validation.error || 'A valid, active subscription or activation code is required.',
    });
    return;
  }

  req.user = validation.user;
  req.activation = validation.activation;
  req.device = validation.device;

  next();
}

/**
 * Middleware: Enforces that the request comes from an authenticated Administrator.
 */
export function requireAdminAuth(
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): void {
  const token =
    (req.headers['x-admin-token'] as string) ||
    req.cookies?.admin_token ||
    (req.headers.authorization && req.headers.authorization.startsWith('Bearer adm_')
      ? req.headers.authorization.substring(7).trim()
      : null);

  if (!token) {
    res.status(401).json({
      error: 'UNAUTHORIZED_ADMIN',
      message: 'Administrator authentication required.',
    });
    return;
  }

  const session = adminAuthService.verifySession(token);
  if (!session.valid || !session.username) {
    res.status(401).json({
      error: 'ADMIN_SESSION_EXPIRED',
      message: 'Admin session expired or invalid. Please log in again.',
    });
    return;
  }

  req.admin = {
    username: session.username,
    mustChangePassword: Boolean(session.mustChangePassword),
  };

  next();
}
