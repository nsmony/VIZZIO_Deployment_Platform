import { verifyDownloadToken } from '../downloadToken.js';
import { findUploadedFile, getUploadedFilePath } from '../uploadStore.js';

export function downloadUploadedFile(req, res) {
  const { fileId } = req.params;
  const { token } = req.query;

  if (!token) {
    return res.status(401).json({ error: 'Missing download token' });
  }

  try {
    const payload = verifyDownloadToken(token);

    if (payload.fileId !== fileId) {
      return res.status(401).json({ error: 'Download token does not match this file' });
    }

    const file = findUploadedFile(fileId);
    const filePath = getUploadedFilePath(fileId);

    if (!file || !filePath) {
      return res.status(404).json({ error: 'File not found' });
    }

    return res.download(filePath, file.originalName);
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired download token' });
  }
}
