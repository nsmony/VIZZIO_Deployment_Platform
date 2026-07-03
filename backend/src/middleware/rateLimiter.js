import rateLimit from 'express-rate-limit';

// Basic API rate limit to reduce accidental or repeated abuse.
export const rateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  skip: (req) => req.method === 'GET' && req.path.startsWith('/api/download-manager/files/'),
  standardHeaders: true,
  legacyHeaders: false,
});
