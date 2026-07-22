const AUTH_STORAGE_KEYS = [
  'vizzio_token',
  'vizzio_role',
  'vizzio_username',
  'vizzio_profile_image',
];

export function getToken() {
  return localStorage.getItem('vizzio_token');
}

export function clearStoredSession() {
  AUTH_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
}

export function getJwtPayload(token) {
  try {
    const parts = String(token || '').split('.');
    if (parts.length < 2) return null;
    const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    return JSON.parse(window.atob(padded));
  } catch {
    return null;
  }
}

export function isTokenExpired(token) {
  const payload = getJwtPayload(token);
  if (!payload || typeof payload.exp !== 'number') {
    return false;
  }

  return payload.exp * 1000 <= Date.now();
}

export function getValidToken() {
  const token = getToken();
  if (!token) {
    return null;
  }

  if (isTokenExpired(token)) {
    clearStoredSession();
    return null;
  }

  return token;
}

export function isAuthenticated() {
  return Boolean(getValidToken());
}
