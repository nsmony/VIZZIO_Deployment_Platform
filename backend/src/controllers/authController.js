import { authenticateUser } from '../services/authService.js';

// Simple in-memory lockout to slow repeated failed logins.
const FAILED_LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILED_LOGINS = 10;
const failedLogins = new Map();

export async function login(req, res) {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const clientKey = req.ip || req.socket?.remoteAddress || 'unknown';
  const rateState = getFailedLoginState(clientKey);
  if (rateState.blockedUntil > Date.now()) {
    const retryAfterSeconds = Math.ceil((rateState.blockedUntil - Date.now()) / 1000);
    res.setHeader('Retry-After', String(retryAfterSeconds));
    return res.status(429).json({ error: 'Too many failed login attempts. Please try again later.' });
  }

  try {
    const result = await authenticateUser(username, password);
    if (!result) {
      recordFailedLogin(clientKey);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    failedLogins.delete(clientKey);
    res.json(result);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.status ? error.message : 'Authentication failed' });
  }
}

function getFailedLoginState(clientKey) {
  const now = Date.now();
  const current = failedLogins.get(clientKey);
  if (!current || current.expiresAt <= now) {
    const next = { count: 0, expiresAt: now + FAILED_LOGIN_WINDOW_MS, blockedUntil: 0 };
    failedLogins.set(clientKey, next);
    return next;
  }
  return current;
}

function recordFailedLogin(clientKey) {
  const state = getFailedLoginState(clientKey);
  state.count += 1;
  if (state.count > MAX_FAILED_LOGINS) {
    state.blockedUntil = Date.now() + FAILED_LOGIN_WINDOW_MS;
  }
  failedLogins.set(clientKey, state);
}
