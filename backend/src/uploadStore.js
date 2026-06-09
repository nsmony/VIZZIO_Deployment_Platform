import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const downloadDir = path.resolve(__dirname, '../storage/downloads');
const manifestPath = path.join(downloadDir, 'manifest.json');

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
  const fileId = createFileId(filename);
  const filePath = path.join(downloadDir, fileId);
  fs.writeFileSync(filePath, buffer);

  const file = {
    id: fileId,
    fileId,
    title: title || filename,
    originalName: filename,
    size: buffer.length,
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
