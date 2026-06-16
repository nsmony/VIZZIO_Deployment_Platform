import jwt from 'jsonwebtoken';

const downloadManagerTokenOptions = { expiresIn: '10m' };

function getDownloadManagerSecret() {
  return process.env.DOWNLOAD_MANAGER_SECRET || process.env.DOWNLOAD_SECRET || 'replace-with-secure-download-secret';
}

export function signDownloadManagerToken(payload, options = downloadManagerTokenOptions) {
  return jwt.sign(payload, getDownloadManagerSecret(), options);
}

export function verifyDownloadManagerToken(token) {
  return jwt.verify(token, getDownloadManagerSecret());
}
