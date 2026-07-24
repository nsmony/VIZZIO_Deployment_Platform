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
const downloadDir = path.resolve(__dirname, '../storage/downloads');
const manifestPath = path.join(downloadDir, 'manifest.json');
const DEFAULT_MAX_UPLOAD_BYTES = 50 * 1024 * 1024 * 1024;

function ensureDownloadDir() {
  fs.mkdirSync(downloadDir, { recursive: true });
}

function readManifest() {
  ensureDownloadDir();

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
  fs.writeFileSync(manifestPath, JSON.stringify(files, null, 2));
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
  const filePath = path.join(downloadDir, fileId);
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

export async function saveUploadedStream({ originalName, title, stream, uploadedBy, maxBytes = getUploadMaxBytes() }) {
  ensureDownloadDir();

  const filename = originalName || 'upload.bin';
  ensureSupportedArchive(filename);
  const fileId = createFileId(filename);
  const filePath = path.join(downloadDir, fileId);
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
  return downloadDir;
}

export function findUploadedFile(fileId) {
  return readManifest().find((file) => file.fileId === fileId);
}

export function getUploadedFilePath(fileId) {
  const file = findUploadedFile(fileId);

  if (!file) {
    return null;
  }

  const filePath = path.join(downloadDir, file.fileId);
  return fs.existsSync(filePath) ? filePath : null;
}

function getUploadMaxBytes() {
  const value = Number(process.env.PACKAGE_UPLOAD_MAX_BYTES);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_MAX_UPLOAD_BYTES;
}
