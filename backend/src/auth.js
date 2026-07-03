import jwt from 'jsonwebtoken';

// Shared JWT helpers for normal user/admin API sessions.
const jwtOptions = { expiresIn: '24h' };

function getJwtSecret() {
  return process.env.JWT_SECRET || 'replace-with-secure-secret';
}

export function signToken(payload) {
  return jwt.sign(payload, getJwtSecret(), jwtOptions);
}

export function verifyToken(token) {
  return jwt.verify(token, getJwtSecret());
}
