import fs from 'fs';
import path from 'path';
import { getAdminSettings } from '../services/settingsService.js';
import {
  createManagedDownloadSession,
  getDownloadablesForUser,
  getTokenizedFileRequest,
  parseRangeHeader,
  updateManagedDownloadSession,
} from '../services/downloadManagerService.js';

// HTTP handlers used by the Windows launcher download manager.
export async function listDownloadManagerItems(req, res) {
  const items = await getDownloadablesForUser(req.user);
  res.json({ items });
}

export async function createDownloadManagerSession(req, res) {
  try {
    const settings = await getAdminSettings();
    if (settings.maintenanceMode && String(req.user?.role || '').toLowerCase() !== 'admin') {
      return res.status(503).json({
        error: 'Download manager unavailable due to maintenance.',
        maintenanceMessage: settings.maintenanceMessage || 'The system is currently under maintenance. Please try again later.',
      });
    }

    const result = await createManagedDownloadSession({
      user: req.user,
      fileId: req.body?.fileId,
      versionId: req.body?.versionId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    res.status(201).json(result);
  } catch (error) {
    res.status(error.status || 400).json({ error: error.message });
  }
}

export async function updateDownloadManagerSession(req, res) {
  try {
    const settings = await getAdminSettings();
    if (settings.maintenanceMode && String(req.user?.role || '').toLowerCase() !== 'admin') {
      return res.status(503).json({
        error: 'Download manager unavailable due to maintenance.',
        maintenanceMessage: settings.maintenanceMessage || 'The system is currently under maintenance. Please try again later.',
      });
    }

    const session = await updateManagedDownloadSession({
      sessionId: req.params.sessionId,
      user: req.user,
      status: req.body?.status,
      downloadedSize: req.body?.downloadedSize,
      totalSize: req.body?.totalSize,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
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
    const settings = await getAdminSettings();
    const { payload, file, filePath, stat } = await getTokenizedFileRequest({ fileId, token });
    if (settings.maintenanceMode && String(payload.role || '').toLowerCase() !== 'admin') {
      return res.status(503).json({
        error: 'Download stream unavailable due to maintenance.',
        maintenanceMessage: settings.maintenanceMessage || 'The system is currently under maintenance. Please try again later.',
      });
    }

    const range = parseRangeHeader(req.headers.range, stat.size);

    // Range support is required by the WPF launcher. Each .part file resumes by
    // asking for the exact byte range it still needs.
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.originalName)}"`);
    res.setHeader('Content-Type', 'application/octet-stream');

    const accelRedirect = buildAccelRedirectPath(filePath);
    if (accelRedirect) {
      // In production Nginx can serve large files directly after Node verifies
      // the token. Node still controls auth; Nginx only handles file transfer.
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
      return pipeDownloadStream(req, res, filePath, { start: range.start, end: range.end });
    }

    res.setHeader('Content-Length', stat.size);
    return pipeDownloadStream(req, res, filePath);
  } catch (error) {
    return res.status(error.status || 401).json({ error: error.message || 'Invalid or expired download token' });
  }
}

function pipeDownloadStream(req, res, filePath, options = {}) {
  const stream = fs.createReadStream(filePath, options);
  let closed = false;

  const closeStream = () => {
    if (closed) return;
    closed = true;
    stream.destroy();
  };

  req.on('aborted', closeStream);
  res.on('close', closeStream);
  stream.on('error', (error) => {
    if (!res.headersSent) {
      res.status(500).json({ error: 'Download stream failed' });
      return;
    }
    res.destroy(error);
  });

  return stream.pipe(res);
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

  // Never allow an accel redirect outside DOWNLOAD_ROOT.
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
