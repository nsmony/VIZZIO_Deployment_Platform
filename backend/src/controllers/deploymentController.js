import { createDeployment, getDeployments } from '../services/deploymentService.js';
import { signDownloadToken } from '../downloadToken.js';
import { getChunkUploadStatus, listUploadedFiles, saveUploadedChunk, saveUploadedFile } from '../uploadStore.js';

function decodeHeaderValue(value, fallback = '') {
  if (!value) {
    return fallback;
  }

  try {
    return decodeURIComponent(value);
  } catch (error) {
    return value;
  }
}

export async function listDeployments(req, res) {
  res.json({ deployments: getDeployments() });
}

export async function createDeploymentHandler(req, res) {
  try {
    const deployment = createDeployment(req.body);
    res.status(201).json({ deployment });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

export async function listUploadedPackages(req, res) {
  res.json({ packages: listUploadedFiles() });
}

export async function uploadPackage(req, res) {
  const role = req.user?.role?.toLowerCase();

  if (role !== 'admin') {
    return res.status(403).json({ error: 'Admin access is required' });
  }

  if (!req.body || req.body.length === 0) {
    return res.status(400).json({ error: 'Upload file is required' });
  }

  const originalName = decodeHeaderValue(req.headers['x-file-name']);
  const title = decodeHeaderValue(req.headers['x-package-title']);

  const file = saveUploadedFile({
    originalName,
    title,
    buffer: req.body,
    uploadedBy: req.user.userId,
  });

  res.status(201).json({ package: file });
}

export async function uploadPackageChunk(req, res) {
  const role = req.user?.role?.toLowerCase();

  if (role !== 'admin') {
    return res.status(403).json({ error: 'Admin access is required' });
  }

  if (!req.body || req.body.length === 0) {
    return res.status(400).json({ error: 'Upload chunk is required' });
  }

  try {
    console.log('Received chunk request:', {
      uploadId: String(req.headers['x-upload-id'] || ''),
      chunkIndex: req.headers['x-chunk-index'],
      totalChunks: req.headers['x-total-chunks'],
      contentLength: req.headers['content-length'],
      bodyLength: req.body?.length || undefined,
    });
  } catch (logErr) {
    // ignore logging errors
  }

  const uploadId = String(req.headers['x-upload-id'] || '').trim();
  const chunkIndex = Number(req.headers['x-chunk-index']);
  const totalChunks = Number(req.headers['x-total-chunks']);
  const totalSize = Number(req.headers['x-file-size'] || 0);
  const originalName = decodeHeaderValue(req.headers['x-file-name']);
  const title = decodeHeaderValue(req.headers['x-package-title']);

  if (!uploadId) {
    return res.status(400).json({ error: 'Upload ID is required' });
  }

  if (!Number.isInteger(chunkIndex) || chunkIndex < 0) {
    return res.status(400).json({ error: 'Chunk index is required' });
  }

  if (!Number.isInteger(totalChunks) || totalChunks < 1) {
    return res.status(400).json({ error: 'Total chunks is required' });
  }

  try {
    const result = saveUploadedChunk({
      uploadId,
      chunkIndex,
      totalChunks,
      totalSize,
      originalName,
      title,
      buffer: req.body,
      uploadedBy: req.user.userId,
    });

    return res.status(result.finalizing ? 202 : result.complete ? 201 : 200).json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Chunk upload failed' });
  }
}

export async function getUploadChunkStatus(req, res) {
  const role = req.user?.role?.toLowerCase();

  if (role !== 'admin') {
    return res.status(403).json({ error: 'Admin access is required' });
  }

  const { uploadId } = req.params;
  const status = getChunkUploadStatus(uploadId);

  if (!status) {
    return res.status(404).json({ error: 'Upload not found' });
  }

  return res.json(status);
}

export async function createDownloadToken(req, res) {
  const { fileId } = req.params;
  const userId = req.user?.userId;

  if (!fileId) {
    return res.status(400).json({ error: 'File ID is required' });
  }

  if (!userId) {
    return res.status(401).json({ error: 'Invalid authorization token' });
  }

  const token = signDownloadToken({ fileId, userId });
  res.json({ token });
}
