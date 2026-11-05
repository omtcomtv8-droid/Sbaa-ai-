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

  // GET & POST /api/auth/credentials
  router.get('/credentials', async (req: Request, res: Response) => {
    try {
      const sessionToken = req.headers['x-session-token'] as string;
      const uid = req.query.uid as string;
      if (!uid) {
        return res.status(400).json({ success: false, error: 'User UID required' });
      }
      const creds = await dbService.getCredentials(uid);
      res.json({ success: true, credentials: creds || null });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/credentials', async (req: Request, res: Response) => {
    try {
      const { uid, session, isDemo, endpoint } = req.body;
      if (!uid) {
        return res.status(400).json({ success: false, error: 'User UID required' });
      }
      await dbService.saveCredentials({
        id: `cred_${uid}`,
        userId: uid,
        platform: 'pocket_option',
        sessionTokenMasked: session ? `${session.slice(0, 4)}...${session.slice(-4)}` : '',
        accountUid: uid,
        isDemo: Boolean(isDemo),
        status: 'CONNECTED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
}
