import { Router, Request, Response } from 'express';
import { adminAuthService } from '../services/AdminAuthService';
import { ActivationManager } from '../services/ActivationManager';
import { dbService } from '../services/DatabaseService';

function getAdminToken(req: Request): string | null {
  const headerToken = req.headers['x-admin-token'] as string;
  if (headerToken) return headerToken;
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return req.cookies?.sabaa_admin_token || null;
}

function requireAdminAuth(req: Request, res: Response, next: () => void) {
  const token = getAdminToken(req);
  if (!token) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Admin authentication token required' });
  }
  const session = adminAuthService.verifySession(token);
  if (!session.valid) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Admin token expired or invalid' });
  }
  (req as any).adminUser = session.username || 'admin';
  next();
}

export function createAdminRouter(): Router {
  const router = Router();
  const activationManager = ActivationManager.getInstance();

  // POST /api/admin/login
  router.post('/login', async (req: Request, res: Response) => {
    try {
      const { username = 'admin', password } = req.body;
      const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || '127.0.0.1';

      if (!password) {
        return res.status(400).json({ success: false, error: 'Password is required' });
      }

      const result = await adminAuthService.login(username, password, ip);
      if (!result.success) {
        return res.status(401).json(result);
      }
      res.json(result);
    } catch (err: any) {
      console.error('[ADMIN ROUTE] Login error:', err);
      res.status(500).json({ success: false, error: err.message || 'Login failed' });
    }
  });

  // POST /api/admin/change-password
  router.post('/change-password', async (req: Request, res: Response) => {
    try {
      const token = getAdminToken(req);
      if (!token) {
        return res.status(401).json({ success: false, error: 'Unauthorized: Missing token' });
      }
      const { currentPassword, newPassword } = req.body;
      const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || '127.0.0.1';

      const result = await adminAuthService.changePassword(token, currentPassword, newPassword, ip);
      if (!result.success) {
        return res.status(400).json(result);
      }
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Protected Routes
  router.use(requireAdminAuth);

  // GET /api/admin/dashboard-stats
  router.get('/dashboard-stats', async (req: Request, res: Response) => {
    try {
      const stats = await activationManager.getDashboardStats();
      res.json({ success: true, stats });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // GET /api/admin/codes
  router.get('/codes', async (req: Request, res: Response) => {
    try {
      const search = (req.query.search as string) || '';
      const status = (req.query.status as string) || 'ALL';
      let codes = await dbService.getAllActivationCodes();

      if (status && status !== 'ALL') {
        codes = codes.filter((c) => c.status === status);
      }
      if (search.trim()) {
        const query = search.trim().toLowerCase();
        codes = codes.filter(
          (c) =>
            c.code.toLowerCase().includes(query) ||
            (c.boundUserEmail && c.boundUserEmail.toLowerCase().includes(query)) ||
            (c.durationLabel && c.durationLabel.toLowerCase().includes(query))
        );
      }

      res.json({ success: true, codes });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/admin/codes/generate
  router.post('/codes/generate', async (req: Request, res: Response) => {
    try {
      const adminUser = (req as any).adminUser || 'admin';
      const { count = 1, durationHours = 720, customHours, exactExpiration, maxDevices = 1, boundUserEmail } = req.body;

      const codes = await activationManager.generateCodes({
        count: Number(count),
        durationHours: Number(durationHours),
        customHours: customHours ? Number(customHours) : undefined,
        exactExpiration,
        maxDevices: Number(maxDevices),
        boundUserEmail,
        createdBy: adminUser,
      });

      res.json({ success: true, codes });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/admin/codes/:id/revoke
  router.post('/codes/:id/revoke', async (req: Request, res: Response) => {
    try {
      const adminUser = (req as any).adminUser || 'admin';
      const { id } = req.params;
      const { reason = 'Revoked from dashboard' } = req.body;

      const ok = await activationManager.revokeCode(id, adminUser, reason);
      res.json({ success: ok });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/admin/codes/:id/toggle
  router.post('/codes/:id/toggle', async (req: Request, res: Response) => {
    try {
      const adminUser = (req as any).adminUser || 'admin';
      const { id } = req.params;
      const { enabled } = req.body;

      const ok = await activationManager.toggleCode(id, adminUser, Boolean(enabled));
      res.json({ success: ok });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/admin/codes/:id/extend
  router.post('/codes/:id/extend', async (req: Request, res: Response) => {
    try {
      const adminUser = (req as any).adminUser || 'admin';
      const { id } = req.params;
      const { additionalHours = 24, newExactExpiration } = req.body;

      const result = await activationManager.extendCode(id, adminUser, Number(additionalHours), newExactExpiration);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/admin/codes/:id/device-limit
  router.post('/codes/:id/device-limit', async (req: Request, res: Response) => {
    try {
      const adminUser = (req as any).adminUser || 'admin';
      const { id } = req.params;
      const { maxDevices } = req.body;

      const ok = await activationManager.changeDeviceLimit(id, adminUser, Number(maxDevices));
      res.json({ success: ok });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // GET /api/admin/users
  router.get('/users', async (req: Request, res: Response) => {
    try {
      const search = (req.query.search as string) || '';
      let users = await dbService.getAllUsers();
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        users = users.filter(
          (u) =>
            u.email.toLowerCase().includes(q) ||
            u.displayName.toLowerCase().includes(q) ||
            u.uid.toLowerCase().includes(q)
        );
      }
      res.json({ success: true, users });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/admin/users/:id/toggle
  router.post('/users/:id/toggle', async (req: Request, res: Response) => {
    try {
      const adminUser = (req as any).adminUser || 'admin';
      const { id } = req.params;
      const { active } = req.body;

      const ok = await activationManager.toggleUser(id, adminUser, Boolean(active));
      res.json({ success: ok });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // GET /api/admin/devices
  router.get('/devices', async (req: Request, res: Response) => {
    try {
      const devices = await dbService.getAllDevices();
      res.json({ success: true, devices });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/admin/devices/:id/revoke
  router.post('/devices/:id/revoke', async (req: Request, res: Response) => {
    try {
      const adminUser = (req as any).adminUser || 'admin';
      const { id } = req.params;
      const { reason = 'Revoked by admin' } = req.body;

      const ok = await activationManager.revokeDevice(id, adminUser, reason);
      res.json({ success: ok });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // GET /api/admin/logs
  router.get('/logs', async (req: Request, res: Response) => {
    try {
      const limit = Number(req.query.limit) || 100;
      const logs = await dbService.getAuditLogs(limit);
      res.json({ success: true, logs });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // GET /api/admin/system-status
  router.get('/system-status', async (req: Request, res: Response) => {
    try {
      res.json({
        success: true,
        status: {
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage(),
          nodeVersion: process.version,
          timestamp: new Date().toISOString(),
          activeConnections: 1,
        },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
}
