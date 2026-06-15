import {
  changeVersion,
  createDeployment,
  getDeployments,
  registerVersion,
} from '../services/deploymentService.js';
import { signDownloadToken } from '../downloadToken.js';
import { listUploadedFiles, saveUploadedFile } from '../uploadStore.js';
import { findGroups } from '../repositories/groupRepository.js';
import { findUserById } from '../repositories/userRepository.js';

export async function listDeployments(req, res) {
  const role = req.user?.role?.toLowerCase();
  const deployments = await getDeployments();

  if (role === 'admin') {
    return res.json({ deployments });
  }

  const user = await findUserById(req.user?.userId);
  if (!user) {
    return res.json({ deployments: [] });
  }

  const userGroupNames = (user.groupMemberships || []).map((membership) => membership.group.name);
  const allowedDeploymentIds = new Set(
    (await findGroups())
      .filter((group) => userGroupNames.includes(group.name))
      .flatMap((group) => (group.deploymentAccesses || []).map((access) => access.deploymentId))
  );

  res.json({
    deployments: deployments.filter((deployment) => allowedDeploymentIds.has(deployment.id)),
  });
}

export async function createDeploymentHandler(req, res) {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Admin access is required' });

  try {
    const deployment = await createDeployment(req.body, req.user?.userId);
    res.status(201).json({ deployment });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

export async function registerVersionHandler(req, res) {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Admin access is required' });

  try {
    const version = await registerVersion(req.params.deploymentId, req.body);
    if (!version) return res.status(404).json({ error: 'Deployment not found.' });
    res.status(201).json({ version });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

export async function updateVersionHandler(req, res) {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Admin access is required' });

  try {
    const version = await changeVersion(
      req.params.deploymentId,
      req.params.versionId,
      req.body,
      req.user?.userId
    );
    if (!version) return res.status(404).json({ error: 'Version not found.' });
    res.json({ version });
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

function isAdmin(req) {
  return req.user?.role?.toLowerCase() === 'admin';
}
