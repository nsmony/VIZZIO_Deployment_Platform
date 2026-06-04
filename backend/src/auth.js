import jwt from 'jsonwebtoken';

const jwtSecret = process.env.JWT_SECRET || 'replace-with-secure-secret';
const jwtOptions = { expiresIn: '1h' };

export function signToken(payload) {
  return jwt.sign(payload, jwtSecret, jwtOptions);
}

export function verifyToken(token) {
  return jwt.verify(token, jwtSecret);
}
