import jwt from 'jsonwebtoken';

// Short-lived JWT helpers for direct package download links.
const downloadTokenOptions = { expiresIn: '5m' };

function getDownloadSecret() {
  return process.env.DOWNLOAD_SECRET || 'replace-with-secure-download-secret';
}

export function signDownloadToken(payload) {
  return jwt.sign(payload, getDownloadSecret(), downloadTokenOptions);
}

export function verifyDownloadToken(token) {
  return jwt.verify(token, getDownloadSecret());
}
