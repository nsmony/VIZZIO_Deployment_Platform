import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { Transform } from 'stream';
import { pipeline } from 'stream/promises';
import { ensureSupportedArchive, findTopLevelBatchScriptInArchive } from './archiveValidation.js';

// Small file manifest used for packages uploaded through the admin panel.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_MAX_UPLOAD_BYTES = 50 * 1024 * 1024 * 1024;
const DEFAULT_SESSION_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const resumableUploadLocks = new Map();
const resumableUploadHashes = new Map();
let lastSessionCleanupAt = 0;

function getDownloadDir() {
  return path.resolve(process.env.PACKAGE_UPLOAD_ROOT || path.resolve(__dirname, '../storage/downloads'));
}

function getManifestPath() {
  return path.join(getDownloadDir(), 'manifest.json');
}

function getSessionDir() {
  return path.join(getDownloadDir(), '.sessions');
}

function ensureDownloadDir() {
  fs.mkdirSync(getDownloadDir(), { recursive: true });
  fs.mkdirSync(getSessionDir(), { recursive: true });
}

function readManifest() {
  ensureDownloadDir();

  const manifestPath = getManifestPath();
  if (!fs.existsSync(manifestPath)) {
    return [];
  }

  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    return [];
  }
}

function writeManifest(files) {
  ensureDownloadDir();
  fs.writeFileSync(getManifestPath(), JSON.stringify(files, null, 2));
}

function createFileId(filename) {
  const safeName = filename
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `${Date.now()}-${safeName || 'upload.bin'}`;
}

export function saveUploadedFile({ originalName, title, buffer, uploadedBy }) {
  ensureDownloadDir();

  const filename = originalName || 'upload.bin';
  ensureSupportedArchive(filename);
  const fileId = createFileId(filename);
  const filePath = path.join(getDownloadDir(), fileId);
  fs.writeFileSync(filePath, buffer);
  const checksum = crypto.createHash('sha256').update(buffer).digest('hex');

  const file = {
    id: fileId,
    fileId,
    title: title || filename,
    originalName: filename,
    size: buffer.length,
    checksum,
    uploadedBy,
    uploadedAt: new Date().toISOString(),
  };

  const files = readManifest();
  files.unshift(file);
  writeManifest(files);

  return file;
}

function getSessionMetadataPath(sessionId) {
  return path.join(getSessionDir(), `${sessionId}.json`);
}

function getSessionPartPath(sessionId, originalName = '') {
  const extension = path.extname(String(originalName || '')).toLowerCase();
  return path.join(getSessionDir(), `${sessionId}.part${extension}`);
}

function readUploadSession(sessionId) {
  if (!/^[0-9a-f-]{36}$/i.test(String(sessionId || ''))) return null;
  try {
    return JSON.parse(fs.readFileSync(getSessionMetadataPath(sessionId), 'utf8'));
  } catch {
    return null;
  }
}

async function writeUploadSession(session) {
  const metadataPath = getSessionMetadataPath(session.id);
  const temporaryPath = `${metadataPath}.${process.pid}.tmp`;
  await fs.promises.writeFile(temporaryPath, JSON.stringify(session, null, 2));
  await fs.promises.rename(temporaryPath, metadataPath);
}

function toPublicUploadSession(session) {
  return {
    id: session.id,
    status: session.status,
    originalName: session.originalName,
    title: session.title,
    size: session.size,
    offset: session.offset,
    package: session.package || null,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}

export async function createResumableUploadSession({ originalName, title, size, fingerprint, uploadedBy }) {
  ensureDownloadDir();
  await cleanupResumableUploadSessions();
  const filename = String(originalName || '').trim();
  ensureSupportedArchive(filename);
  const expectedSize = Number(size);
  const maxBytes = getUploadMaxBytes();
  if (!Number.isSafeInteger(expectedSize) || expectedSize <= 0) {
    throw new Error('Upload size must be a positive integer.');
  }
  if (expectedSize > maxBytes) {
    const error = new Error(`Upload exceeds the configured limit of ${maxBytes} bytes.`);
    error.status = 413;
    throw error;
  }

  const existing = await findMatchingUploadSession({
    originalName: filename,
    title: title || filename,
    size: expectedSize,
    fingerprint,
    uploadedBy,
  });
  if (existing) return toPublicUploadSession(existing);

  const now = new Date().toISOString();
  const session = {
    id: crypto.randomUUID(),
    status: 'uploading',
    originalName: filename,
    title: title || filename,
    size: expectedSize,
    offset: 0,
    fingerprint: String(fingerprint || ''),
    uploadedBy,
    createdAt: now,
    updatedAt: now,
  };
  await fs.promises.writeFile(getSessionPartPath(session.id, session.originalName), '');
  await writeUploadSession(session);
  resumableUploadHashes.set(session.id, {
    hash: crypto.createHash('sha256'),
    offset: 0,
  });
  return toPublicUploadSession(session);
}

export async function cleanupResumableUploadSessions({ force = false } = {}) {
  ensureDownloadDir();
  const now = Date.now();
  if (!force && now - lastSessionCleanupAt < 60 * 60 * 1000) return;
  lastSessionCleanupAt = now;
  const configured = Number(process.env.UPLOAD_SESSION_RETENTION_MS);
  const retentionMs = Number.isFinite(configured) && configured > 0
    ? configured
    : DEFAULT_SESSION_RETENTION_MS;
  const entries = await fs.promises.readdir(getSessionDir(), { withFileTypes: true });
  await Promise.all(entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map(async (entry) => {
      const sessionId = entry.name.slice(0, -5);
      const session = readUploadSession(sessionId);
      const updatedAt = Date.parse(session?.updatedAt || '');
      if (!session || !Number.isFinite(updatedAt) || now - updatedAt <= retentionMs) return;
      if (resumableUploadLocks.has(sessionId)) return;
      await fs.promises.rm(getSessionMetadataPath(sessionId), { force: true });
      await fs.promises.rm(getSessionPartPath(sessionId, session.originalName), { force: true });
      resumableUploadHashes.delete(sessionId);
    }));
}

async function findMatchingUploadSession(match) {
  const entries = await fs.promises.readdir(getSessionDir(), { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    const session = readUploadSession(entry.name.slice(0, -5));
    if (
      session
      && session.originalName === match.originalName
      && session.title === match.title
      && session.size === match.size
      && session.fingerprint === String(match.fingerprint || '')
      && session.uploadedBy === match.uploadedBy
      && ['uploading', 'completed'].includes(session.status)
    ) {
      if (session.status === 'uploading') {
        const stat = await fs.promises.stat(getSessionPartPath(session.id, session.originalName)).catch(() => null);
        if (!stat) continue;
        session.offset = Math.min(stat.size, session.size);
        session.updatedAt = new Date().toISOString();
        await writeUploadSession(session);
      }
      return session;
    }
  }
  return null;
}

export function getResumableUploadSession(sessionId, uploadedBy) {
  ensureDownloadDir();
  const session = readUploadSession(sessionId);
  if (!session || session.uploadedBy !== uploadedBy) return null;
  return toPublicUploadSession(session);
}

export async function appendResumableUploadChunk({ sessionId, uploadedBy, offset, stream }) {
  return withUploadSessionLock(sessionId, async () => {
    const session = readUploadSession(sessionId);
    if (!session || session.uploadedBy !== uploadedBy) return null;
    if (session.status !== 'uploading') return toPublicUploadSession(session);

    const partPath = getSessionPartPath(session.id, session.originalName);
    const stat = await fs.promises.stat(partPath).catch(() => null);
    if (!stat) throw new Error('Upload session data is missing.');
    const requestedOffset = Number(offset);
    if (!Number.isSafeInteger(requestedOffset) || requestedOffset !== stat.size) {
      const error = new Error(`Upload offset mismatch. Resume from byte ${stat.size}.`);
      error.status = 409;
      error.offset = stat.size;
      throw error;
    }
    if (stat.size >= session.size) return toPublicUploadSession({ ...session, offset: stat.size });

    let received = 0;
    const remaining = session.size - stat.size;
    let hashState = resumableUploadHashes.get(session.id);
    if (!hashState && stat.size === 0) {
      hashState = { hash: crypto.createHash('sha256'), offset: 0 };
      resumableUploadHashes.set(session.id, hashState);
    }
    if (hashState?.offset !== stat.size) {
      resumableUploadHashes.delete(session.id);
      hashState = null;
    }
    const meter = new Transform({
      transform(chunk, encoding, callback) {
        received += chunk.length;
        if (received > remaining) {
          const error = new Error('Upload chunk exceeds the declared file size.');
          error.status = 413;
          callback(error);
          return;
        }
        hashState?.hash.update(chunk);
        if (hashState) hashState.offset += chunk.length;
        callback(null, chunk);
      },
    });

    try {
      await pipeline(stream, meter, fs.createWriteStream(partPath, { flags: 'a' }));
    } finally {
      const currentStat = await fs.promises.stat(partPath).catch(() => null);
      if (currentStat) {
        if (hashState && hashState.offset !== currentStat.size) {
          resumableUploadHashes.delete(session.id);
        }
        session.offset = currentStat.size;
        session.updatedAt = new Date().toISOString();
        await writeUploadSession(session);
      }
    }
    return toPublicUploadSession(session);
  });
}

export async function completeResumableUploadSession(sessionId, uploadedBy) {
  return withUploadSessionLock(sessionId, async () => {
    const session = readUploadSession(sessionId);
    if (!session || session.uploadedBy !== uploadedBy) return null;
    if (session.status === 'completed' && session.package) return toPublicUploadSession(session);

    const partPath = getSessionPartPath(session.id, session.originalName);
    const stat = await fs.promises.stat(partPath).catch(() => null);
    if (!stat || stat.size !== session.size) {
      const error = new Error(`Upload is incomplete. Resume from byte ${stat?.size || 0}.`);
      error.status = 409;
      error.offset = stat?.size || 0;
      throw error;
    }

    const batchScriptName = await findTopLevelBatchScriptInArchive(partPath);
    if (!batchScriptName) {
      throw new Error('Deployment package archive must contain a launch batch script at the archive root or inside one top-level folder.');
    }
    const hashState = resumableUploadHashes.get(session.id);
    const checksum = hashState?.offset === session.size
      ? hashState.hash.digest('hex')
      : await hashFile(partPath);
    resumableUploadHashes.delete(session.id);
    const fileId = createFileId(session.originalName);
    await fs.promises.rename(partPath, path.join(getDownloadDir(), fileId));
    const file = {
      id: fileId,
      fileId,
      title: session.title,
      originalName: session.originalName,
      size: session.size,
      checksum,
      batchScriptName,
      uploadedBy,
      uploadedAt: new Date().toISOString(),
    };
    const files = readManifest();
    files.unshift(file);
    writeManifest(files);
    session.status = 'completed';
    session.offset = session.size;
    session.package = file;
    session.updatedAt = new Date().toISOString();
    await writeUploadSession(session);
    return toPublicUploadSession(session);
  });
}

export async function cancelResumableUploadSession(sessionId, uploadedBy) {
  return withUploadSessionLock(sessionId, async () => {
    const session = readUploadSession(sessionId);
    if (!session || session.uploadedBy !== uploadedBy) return null;
    if (session.status === 'completed') return toPublicUploadSession(session);
    session.status = 'cancelled';
    session.updatedAt = new Date().toISOString();
    await fs.promises.rm(getSessionPartPath(session.id, session.originalName), { force: true });
    resumableUploadHashes.delete(session.id);
    await writeUploadSession(session);
    return toPublicUploadSession(session);
  });
}

async function hashFile(filePath) {
  const hash = crypto.createHash('sha256');
  await pipeline(fs.createReadStream(filePath), new Transform({
    transform(chunk, encoding, callback) {
      hash.update(chunk);
      callback(null, chunk);
    },
  }), new Transform({
    transform(chunk, encoding, callback) {
      callback();
    },
  }));
  return hash.digest('hex');
}

async function withUploadSessionLock(sessionId, work) {
  const previous = resumableUploadLocks.get(sessionId) || Promise.resolve();
  const current = previous.catch(() => {}).then(work);
  resumableUploadLocks.set(sessionId, current);
  try {
    return await current;
  } finally {
    if (resumableUploadLocks.get(sessionId) === current) {
      resumableUploadLocks.delete(sessionId);
    }
  }
}

export async function saveUploadedStream({ originalName, title, stream, uploadedBy, maxBytes = getUploadMaxBytes() }) {
  ensureDownloadDir();

  const filename = originalName || 'upload.bin';
  ensureSupportedArchive(filename);
  const fileId = createFileId(filename);
  const filePath = path.join(getDownloadDir(), fileId);
  const checksum = crypto.createHash('sha256');
  let size = 0;

  const meter = new Transform({
    transform(chunk, encoding, callback) {
      size += chunk.length;
      if (size > maxBytes) {
        const error = new Error(`Upload exceeds the configured limit of ${maxBytes} bytes.`);
        error.status = 413;
        callback(error);
        return;
      }

      checksum.update(chunk);
      callback(null, chunk);
    },
  });

  try {
    await pipeline(stream, meter, fs.createWriteStream(filePath));
  } catch (error) {
    await fs.promises.rm(filePath, { force: true }).catch(() => {});
    throw error;
  }

  if (size === 0) {
    await fs.promises.rm(filePath, { force: true }).catch(() => {});
    throw new Error('Upload file is required');
  }

  const batchScriptName = await findTopLevelBatchScriptInArchive(filePath).catch(async (error) => {
    await fs.promises.rm(filePath, { force: true }).catch(() => {});
    throw error;
  });
  if (!batchScriptName) {
    await fs.promises.rm(filePath, { force: true }).catch(() => {});
    throw new Error('Deployment package archive must contain a launch batch script at the archive root or inside one top-level folder.');
  }

  const file = {
    id: fileId,
    fileId,
    title: title || filename,
    originalName: filename,
    size,
    checksum: checksum.digest('hex'),
    batchScriptName,
    uploadedBy,
    uploadedAt: new Date().toISOString(),
  };

  const files = readManifest();
  files.unshift(file);
  writeManifest(files);

  return file;
}

export function listUploadedFiles() {
  return readManifest();
}

export function getUploadStorageRoot() {
  ensureDownloadDir();
  return getDownloadDir();
}

export function findUploadedFile(fileId) {
  return readManifest().find((file) => file.fileId === fileId);
}

export function getUploadedFilePath(fileId) {
  const file = findUploadedFile(fileId);

  if (!file) {
    return null;
  }

  const filePath = path.join(getDownloadDir(), file.fileId);
  return fs.existsSync(filePath) ? filePath : null;
}

function getUploadMaxBytes() {
  const value = Number(process.env.PACKAGE_UPLOAD_MAX_BYTES);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_MAX_UPLOAD_BYTES;
}
