import {
  archiveDeployment,
  changeVersion,
  createDeployment,
  deleteDeployment,
  deleteVersion,
  editDeployment,
  getDeploymentDetails,
  getDeploymentsForRequest,
  registerVersion,
  restoreDeployment,
  userCanAccessVersion,
  validatePackage,
} from '../services/deploymentService.js';
import { signDownloadToken } from '../downloadToken.js';
import { findUploadedFile, listUploadedFiles, saveUploadedStream } from '../uploadStore.js';

// HTTP handlers for deployments, versions, uploads, and download tokens.
export async function listDeployments(req, res) {
  res.json({ deployments: await getDeploymentsForRequest(req.user) });
}

export async function getDeploymentDetailsHandler(req, res) {
  const deployment = await getDeploymentDetails(req.params.deploymentId, req.user);
  if (!deployment) return res.status(404).json({ error: 'Deployment not found.' });
  res.json({ deployment });
}

export async function createDeploymentHandler(req, res) {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Admin access is required' });

  try {
    const deployment = await createDeployment(req.body, req.user?.userId);
    res.status(201).json({ deployment });
  } catch (error) {
    res.status(isDuplicateError(error) ? 409 : 400).json({ error: error.message });
  }
}

export async function updateDeploymentHandler(req, res) {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Admin access is required' });

  try {
    const deployment = await editDeployment(req.params.deploymentId, req.body);
    if (!deployment) return res.status(404).json({ error: 'Deployment not found.' });
    res.json({ deployment });
  } catch (error) {
    res.status(isDuplicateError(error) ? 409 : 400).json({ error: error.message });
  }
}

export async function archiveDeploymentHandler(req, res) {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Admin access is required' });

  try {
    const deployment = await archiveDeployment(req.params.deploymentId);
    if (!deployment) return res.status(404).json({ error: 'Deployment not found.' });
    res.json({ deployment });
  } catch (error) {
    res.status(error.status || 400).json({ error: error.message });
  }
}

export async function restoreDeploymentHandler(req, res) {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Admin access is required' });

  try {
    const deployment = await restoreDeployment(req.params.deploymentId);
    if (!deployment) return res.status(404).json({ error: 'Deployment not found.' });
    res.json({ deployment });
  } catch (error) {
    res.status(error.status || 400).json({ error: error.message });
  }
}

export async function deleteDeploymentHandler(req, res) {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Admin access is required' });

  try {
    const deployment = await deleteDeployment(req.params.deploymentId);
    if (!deployment) return res.status(404).json({ error: 'Deployment not found.' });
    res.json({ deployment });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

export async function registerVersionHandler(req, res) {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Admin access is required' });

  try {
    const version = await registerVersion(req.params.deploymentId, req.body, req.user?.userId);
    if (!version) return res.status(404).json({ error: 'Deployment not found.' });
    res.status(201).json({ version });
  } catch (error) {
    res.status(isPackageSourceError(error) ? 422 : 400).json({ error: toPublicVersionError(error) });
  }
}

export async function validatePackageHandler(req, res) {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Admin access is required' });

  try {
    res.json({ package: await validatePackage(req.body) });
  } catch (error) {
    res.status(isPackageSourceError(error) ? 422 : 400).json({ error: error.message });
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

export async function deleteVersionHandler(req, res) {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Admin access is required' });

  const version = await deleteVersion(req.params.versionId, req.user?.userId);
  if (!version) return res.status(404).json({ error: 'Version not found.' });
  res.json({ version });
}

export async function listUploadedPackages(req, res) {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Admin access is required' });
  res.json({ packages: listUploadedFiles() });
}

export async function uploadPackage(req, res) {
  const role = req.user?.role?.toLowerCase();

  if (role !== 'admin') {
    return res.status(403).json({ error: 'Admin access is required' });
  }

  const originalName = decodeURIComponent(req.headers['x-file-name'] || '');
  const title = decodeURIComponent(req.headers['x-package-title'] || '');

  try {
    const file = await saveUploadedStream({
      originalName,
      title,
      stream: req,
      uploadedBy: req.user.userId,
    });

    res.status(201).json({ package: file });
  } catch (error) {
    res.status(error.status || 400).json({ error: error.message });
  }
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

  if (fileId.startsWith('version:')) {
    const versionId = fileId.slice('version:'.length);
    if (!await userCanAccessVersion(req.user, versionId)) {
      return res.status(403).json({ error: 'You are not allowed to download this version' });
    }
  } else if (!findUploadedFile(fileId)) {
    return res.status(404).json({ error: 'File not found' });
  } else if (!isAdmin(req)) {
    return res.status(403).json({ error: 'Standalone uploaded packages are admin-only' });
  }

  const token = signDownloadToken({ fileId, userId });
  res.json({ token });
}

function isAdmin(req) {
  return req.user?.role?.toLowerCase() === 'admin';
}

function isDuplicateError(error) {
  return /already exists/i.test(error.message || '');
}

function isPackageSourceError(error) {
  return /not found|must be inside|must point|must contain|requires 7z|could not be inspected|source path is required/i.test(error.message || '');
}

function toPublicVersionError(error) {
  const message = error.message || '';
  if (isPackageSourceError(error)) return message;
  if (/already registered/i.test(message)) return message;
  if (/prisma|invocation|unknown argument|column|database/i.test(message)) {
    return 'Version could not be registered because the backend database is not ready. Run Prisma migrations, restart the backend, and try again.';
  }
  return message || 'Version could not be registered.';
}
