import express from 'express';
import {
  archiveDeploymentHandler,
  appendUploadChunk,
  cancelUploadSession,
  completeUploadSession,
  createUploadSession,
  createDeploymentHandler,
  deleteDeploymentHandler,
  getDeploymentDetailsHandler,
  getUploadSession,
  listUploadedPackages,
  listDeployments,
  registerVersionHandler,
  restoreDeploymentHandler,
  updateDeploymentHandler,
  updateVersionHandler,
  uploadPackage,
  validatePackageHandler,
} from '../controllers/deploymentController.js';

// Deployment catalog, version registration, validation, and uploads.
const router = express.Router();

router.get('/', listDeployments);
router.get('/uploads', listUploadedPackages);
router.post('/uploads/sessions', createUploadSession);
router.get('/uploads/sessions/:sessionId', getUploadSession);
router.patch('/uploads/sessions/:sessionId', appendUploadChunk);
router.post('/uploads/sessions/:sessionId/complete', completeUploadSession);
router.delete('/uploads/sessions/:sessionId', cancelUploadSession);
router.post('/', createDeploymentHandler);
router.post('/versions/validate-package', validatePackageHandler);
router.patch('/:deploymentId', updateDeploymentHandler);
router.post('/:deploymentId/archive', archiveDeploymentHandler);
router.post('/:deploymentId/restore', restoreDeploymentHandler);
router.post('/:deploymentId/versions', registerVersionHandler);
router.patch('/:deploymentId/versions/:versionId', updateVersionHandler);
router.delete('/:deploymentId', deleteDeploymentHandler);
router.post('/uploads', uploadPackage);
router.get('/:deploymentId', getDeploymentDetailsHandler);

export default router;
