import fs from 'fs';
import path from 'path';
import {
  createManagedDownloadSession,
  getDownloadablesForUser,
  getTokenizedFileRequest,
  parseRangeHeader,
  updateManagedDownloadSession,
} from '../services/downloadManagerService.js';

export async function listDownloadManagerItems(req, res) {
  const items = await getDownloadablesForUser(req.user);
  res.json({ items });
}

export async function createDownloadManagerSession(req, res) {
  try {
    const result = await createManagedDownloadSession({
      user: req.user,
      fileId: req.body?.fileId,
      versionId: req.body?.versionId,
    });
    res.status(201).json(result);
  } catch (error) {
    res.status(error.status || 400).json({ error: error.message });
  }
}

export async function updateDownloadManagerSession(req, res) {
  try {
    const session = await updateManagedDownloadSession({
      sessionId: req.params.sessionId,
      user: req.user,
      status: req.body?.status,
      downloadedSize: req.body?.downloadedSize,
      totalSize: req.body?.totalSize,
    });
    res.json({ session });
  } catch (error) {
    res.status(error.status || 400).json({ error: error.message });
  }
}

export async function streamManagedDownloadFile(req, res) {
  const { fileId } = req.params;
  const { token } = req.query;

  if (!token) {
    return res.status(401).json({ error: 'Missing download token' });
  }

  try {
    const { file, filePath, stat } = await getTokenizedFileRequest({ fileId, token });
    const range = parseRangeHeader(req.headers.range, stat.size);

    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.originalName)}"`);
    res.setHeader('Content-Type', 'application/octet-stream');

    const accelRedirect = buildAccelRedirectPath(filePath);
    if (accelRedirect) {
      res.setHeader('X-Accel-Redirect', accelRedirect);
      return res.status(200).end();
    }

    if (range?.invalid) {
      res.setHeader('Content-Range', `bytes */${stat.size}`);
      return res.sendStatus(416);
    }

    if (range) {
      res.status(206);
      res.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${stat.size}`);
      res.setHeader('Content-Length', range.end - range.start + 1);
      return fs.createReadStream(filePath, { start: range.start, end: range.end }).pipe(res);
    }

    res.setHeader('Content-Length', stat.size);
    return fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    return res.status(error.status || 401).json({ error: error.message || 'Invalid or expired download token' });
  }
}

function buildAccelRedirectPath(filePath) {
  if (String(process.env.DOWNLOAD_DELIVERY_MODE || '').toLowerCase() !== 'nginx') {
    return null;
  }

  const downloadRoot = process.env.DOWNLOAD_ROOT;
  if (!downloadRoot) {
    return null;
  }

  const root = path.resolve(downloadRoot);
  const absoluteFile = path.resolve(filePath);
  const relativePath = path.relative(root, absoluteFile);

  if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    return null;
  }

  const prefix = process.env.DOWNLOAD_ACCEL_PREFIX || '/_vizzio_downloads';
  const encodedPath = relativePath
    .split(path.sep)
    .map((part) => encodeURIComponent(part))
    .join('/');

  return `${prefix.replace(/\/$/, '')}/${encodedPath}`;
}
