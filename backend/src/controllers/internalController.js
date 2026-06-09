import { verifyDownloadToken } from '../downloadToken.js';

export function validateDownloadToken(req, res) {
  const { token } = req.query;

  if (!token) {
    return res.sendStatus(401);
  }

  try {
    verifyDownloadToken(token);
    return res.sendStatus(200);
  } catch (error) {
    return res.sendStatus(401);
  }
}
