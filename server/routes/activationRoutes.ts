import { Router, Request, Response } from 'express';
import { ActivationManager } from '../services/ActivationManager';
import { dbService } from '../services/DatabaseService';

export function createActivationRouter(): Router {
  const router = Router();
  const activationManager = ActivationManager.getInstance();

  // POST /api/auth/activate
  router.post('/activate', async (req: Request, res: Response) => {
    try {
      const { code, rawCode, userId, userEmail, deviceFingerprint } = req.body;
      const targetCode = code || rawCode;
      const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || '127.0.0.1';
      const userAgent = req.headers['user-agent'] || '';

      const result = await activationManager.activateCode({
        userId: userId || 'user_' + Date.now(),
        userEmail: userEmail || 'user@sabaa.trader',
        rawCode: targetCode,
        deviceFingerprint,
        userAgent,
        ipAddress: ip,
      });

      if (!result.success) {
        return res.status(400).json(result);
      }
      res.json(result);
    } catch (err: any) {
      console.error('[AUTH API] Activation error:', err);
      res.status(500).json({ success: false, error: err.message || 'Internal activation error' });
    }
  });

  // POST /api/auth/verify
  router.post('/verify', async (req: Request, res: Response) => {
    try {
      const { sessionToken, deviceToken } = req.body;
      const token = sessionToken || req.headers['x-session-token'] || req.cookies?.sabaa_session;

      if (!token) {
        return res.status(401).json({ valid: false, error: 'No session token provided' });
      }

      const result = await activationManager.validateUserSession(token as string, deviceToken);
      res.json(result);
    } catch (err: any) {
      console.error('[AUTH API] Verify error:', err);
      res.status(500).json({ valid: false, error: err.message || 'Internal verification error' });
    }
  });

  // POST /api/auth/logout
  router.post('/logout', async (req: Request, res: Response) => {
    try {
      const { sessionToken } = req.body;
      const token = sessionToken || req.headers['x-session-token'];
      if (token) {
        const session = await dbService.getSession(token as string);
        if (session) {
          session.status = 'REVOKED';
          await dbService.saveSession(session);
        }
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Helper to resolve UID from x-session-token or explicit uid parameter
  const resolveUserUid = async (req: Request): Promise<string | null> => {
    const headerToken = (req.headers['x-session-token'] as string) || '';
    if (headerToken) {
      const check = await activationManager.validateUserSession(headerToken);
      if (check.valid && check.user?.uid) {
        return check.user.uid;
      }
      const rawSession = await dbService.getSession(headerToken);
      if (rawSession?.userId) {
        return rawSession.userId;
      }
    }
    const queryUid = typeof req.query.uid === 'string' ? req.query.uid.trim() : '';
    const bodyUid = typeof req.body?.uid === 'string' ? req.body.uid.trim() : '';
    return queryUid || bodyUid || null;
  };

  // GET, POST & DELETE /api/auth/credentials
  router.get('/credentials', async (req: Request, res: Response) => {
    try {
      const uid = await resolveUserUid(req);
      if (!uid) {
        return res.status(401).json({ success: false, error: 'Valid session token or User UID required' });
      }
      const creds = await dbService.getCredentials(uid);
      res.json({ success: true, credentials: creds || null });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/credentials', async (req: Request, res: Response) => {
    try {
      const uid = await resolveUserUid(req);
      if (!uid) {
        return res.status(401).json({ success: false, error: 'Valid session token or User UID required' });
      }

      const { session, sessionToken: bodySessionToken, accountUid, platform } = req.body || {};
      const existing = await dbService.getCredentials(uid);
      const rawToken = typeof bodySessionToken === 'string' && bodySessionToken !== 'preserved'
        ? bodySessionToken.trim()
        : typeof session === 'string' && session !== 'preserved'
        ? session.trim()
        : '';

      if (!rawToken && !existing) {
        return res.status(400).json({ success: false, error: 'Platform session token is required' });
      }

      const masked = rawToken
        ? rawToken.length > 10
          ? `${rawToken.slice(0, 4)}...${rawToken.slice(-4)}`
          : '****'
        : existing?.sessionTokenMasked || '****';

      const now = new Date().toISOString();
      const record = {
        id: existing?.id || `cred_${uid}`,
        userId: uid,
        platform: platform || existing?.platform || 'pocket_option',
        sessionTokenMasked: masked,
        accountUid: typeof accountUid === 'string' ? accountUid.trim() : (existing?.accountUid || uid),
        isDemo: false, // Real Live Account Only
        status: 'CONNECTED' as const,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
      };

      await dbService.saveCredentials(record);
      res.json({ success: true, credentials: record });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.delete('/credentials', async (req: Request, res: Response) => {
    try {
      const uid = await resolveUserUid(req);
      if (!uid) {
        return res.status(401).json({ success: false, error: 'Valid session token or User UID required' });
      }
      await dbService.deleteCredentials(uid);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
}
