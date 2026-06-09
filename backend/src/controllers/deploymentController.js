import { createDeployment, getDeployments } from '../services/deploymentService.js';
import { signDownloadToken } from '../downloadToken.js';
import { listUploadedFiles, saveUploadedFile } from '../uploadStore.js';

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

  const originalName = decodeURIComponent(req.headers['x-file-name'] || '');
  const title = decodeURIComponent(req.headers['x-package-title'] || '');

  const file = saveUploadedFile({
    originalName,
    title,
    buffer: req.body,
    uploadedBy: req.user.userId,
  });

  res.status(201).json({ package: file });
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
