import { verifyToken } from '../auth.js';
import { getAdminSettings } from '../services/settingsService.js';

// Protect API routes by checking the Bearer token.
export async function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing authorization token' });
  }

  try {
    req.user = verifyToken(token);
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Administrative routes must authorize the role after authentication. Keeping
// this separate from authenticateToken lets launcher/user routes accept the
// same JWT format without gaining admin privileges.
export function requireAdmin(req, res, next) {
  if (String(req.user?.role || '').toLowerCase() !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }

  return next();
}

export async function enforceMaintenanceMode(req, res, next) {
  const settings = await getAdminSettings();
  if (!settings.maintenanceMode) {
    return next();
  }

  const isAdmin = String(req.user?.role || '').toLowerCase() === 'admin';
  if (isAdmin) {
    return next();
  }

  return res.status(503).json({
    error: 'Service unavailable due to maintenance.',
    maintenanceMessage: settings.maintenanceMessage || 'The system is currently under maintenance. Please try again later.',
  });
}
