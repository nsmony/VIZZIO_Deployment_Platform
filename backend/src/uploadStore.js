import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const downloadDir = path.resolve(__dirname, '../storage/downloads');
const chunkDir = path.resolve(__dirname, '../storage/upload-chunks');
const completedDir = path.resolve(__dirname, '../storage/upload-completions');
const manifestPath = path.join(downloadDir, 'manifest.json');

function ensureDownloadDir() {
  fs.mkdirSync(downloadDir, { recursive: true });
}

function ensureChunkDir() {
  fs.mkdirSync(chunkDir, { recursive: true });
}

function ensureCompletedDir() {
  fs.mkdirSync(completedDir, { recursive: true });
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

function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    return null;
  }
}

function writeJsonFile(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function removeDirectoryIfExists(directoryPath) {
  if (fs.existsSync(directoryPath)) {
    fs.rmSync(directoryPath, { recursive: true, force: true });
  }
}

function createFileId(filename) {
  const safeName = filename
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `${Date.now()}-${safeName || 'upload.bin'}`;
}

function persistUploadedFileRecord({ filePath, originalName, title, size, uploadedBy, uploadedAt }) {
  const filename = originalName || 'upload.bin';
  const fileId = path.basename(filePath);
  const file = {
    id: fileId,
    fileId,
    title: title || filename,
    originalName: filename,
    size,
    uploadedBy,
    uploadedAt: uploadedAt || new Date().toISOString(),
  };

  const files = readManifest();
  const existingIndex = files.findIndex((entry) => entry.fileId === fileId);

  if (existingIndex >= 0) {
    files[existingIndex] = file;
  } else {
    files.unshift(file);
  }

  writeManifest(files);

  return file;
}

function assembleChunkedUpload(sessionDir, meta) {
  ensureDownloadDir();

  const filename = meta.originalName || 'upload.bin';
  const filePath = path.join(downloadDir, createFileId(filename));
  const output = fs.createWriteStream(filePath);
  let totalSize = 0;

  for (let index = 0; index < meta.totalChunks; index += 1) {
    const currentChunkPath = path.join(sessionDir, `${String(index).padStart(6, '0')}.part`);

    if (!fs.existsSync(currentChunkPath)) {
      output.close();
      throw new Error(`Missing chunk ${index + 1} of ${meta.totalChunks}`);
    }

    const chunkBuffer = fs.readFileSync(currentChunkPath);
    totalSize += chunkBuffer.length;
    fs.appendFileSync(filePath, chunkBuffer);
  }

  output.end();

  const fileStats = fs.statSync(filePath);
  return persistUploadedFileRecord({
    filePath,
    originalName: filename,
    title: meta.title,
    size: Number.isFinite(meta.totalSize) && meta.totalSize > 0 ? meta.totalSize : Math.max(totalSize, fileStats.size),
    uploadedBy: meta.uploadedBy,
    uploadedAt: meta.uploadedAt,
  });
}

export function saveUploadedFile({ originalName, title, buffer, uploadedBy }) {
  ensureDownloadDir();

  const filename = originalName || 'upload.bin';
  const fileId = createFileId(filename);
  const filePath = path.join(downloadDir, fileId);
  fs.writeFileSync(filePath, buffer);

  return persistUploadedFileRecord({
    filePath,
    originalName: filename,
    title,
    size: buffer.length,
    uploadedBy,
  });
}

export function saveUploadedChunk({
  uploadId,
  chunkIndex,
  totalChunks,
  totalSize,
  originalName,
  title,
  buffer,
  uploadedBy,
}) {
  ensureChunkDir();
  ensureCompletedDir();

  const sessionDir = path.join(chunkDir, uploadId);
  const metaPath = path.join(sessionDir, 'meta.json');
  const completionPath = path.join(completedDir, `${uploadId}.json`);
  const chunkPath = path.join(sessionDir, `${String(chunkIndex).padStart(6, '0')}.part`);

  const completed = readJsonFile(completionPath);
  if (completed?.package) {
    return { complete: true, package: completed.package };
  }

  fs.mkdirSync(sessionDir, { recursive: true });

  const existingMeta = readJsonFile(metaPath);
  const meta = existingMeta || {
    uploadId,
    originalName,
    title,
    totalChunks,
    totalSize,
    uploadedBy,
    uploadedAt: new Date().toISOString(),
    receivedChunks: [],
    status: 'uploading',
  };

  meta.originalName = originalName || meta.originalName;
  meta.title = title || meta.title;
  meta.totalChunks = totalChunks;
  meta.totalSize = Number.isFinite(totalSize) && totalSize > 0 ? totalSize : meta.totalSize;
  meta.uploadedBy = uploadedBy || meta.uploadedBy;

  fs.writeFileSync(chunkPath, buffer);

  if (!meta.receivedChunks.includes(chunkIndex)) {
    meta.receivedChunks.push(chunkIndex);
  }

  meta.receivedChunks.sort((left, right) => left - right);
  writeJsonFile(metaPath, meta);

  if (meta.receivedChunks.length < totalChunks) {
    meta.status = 'uploading';
    return {
      complete: false,
      finalizing: false,
      receivedChunks: meta.receivedChunks.length,
      totalChunks,
    };
  }

  meta.status = 'finalizing';
  writeJsonFile(metaPath, meta);

  setImmediate(() => {
    try {
      const freshMeta = readJsonFile(metaPath) || meta;
      if (freshMeta.status === 'complete' || readJsonFile(completionPath)?.package) {
        return;
      }

      const file = assembleChunkedUpload(sessionDir, freshMeta);
      writeJsonFile(completionPath, { package: file, completedAt: new Date().toISOString() });
      writeJsonFile(metaPath, {
        ...freshMeta,
        status: 'complete',
        completedAt: new Date().toISOString(),
        package: file,
      });
      removeDirectoryIfExists(sessionDir);
    } catch (error) {
      writeJsonFile(metaPath, {
        ...meta,
        status: 'failed',
        error: error.message,
        failedAt: new Date().toISOString(),
      });
    }
  });

  return {
    complete: false,
    finalizing: true,
    receivedChunks: totalChunks,
    totalChunks,
  };
}

export function getChunkUploadStatus(uploadId) {
  ensureChunkDir();
  ensureCompletedDir();

  const sessionDir = path.join(chunkDir, uploadId);
  const metaPath = path.join(sessionDir, 'meta.json');
  const completionPath = path.join(completedDir, `${uploadId}.json`);

  const completion = readJsonFile(completionPath);
  if (completion?.package) {
    return {
      uploadId,
      complete: true,
      finalizing: false,
      package: completion.package,
    };
  }

  const meta = readJsonFile(metaPath);
  if (!meta) {
    return null;
  }

  return {
    uploadId,
    complete: meta.status === 'complete',
    finalizing: meta.status === 'finalizing',
    failed: meta.status === 'failed',
    error: meta.error || null,
    receivedChunks: meta.receivedChunks?.length || 0,
    totalChunks: meta.totalChunks || 0,
    package: meta.package || null,
  };
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
