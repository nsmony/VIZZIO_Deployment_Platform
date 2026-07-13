import express from 'express';
import {
  cancelDeploymentHandler,
  createDeploymentHandler,
  getDeploymentDetailsHandler,
  listUploadedPackages,
  listDeployments,
  pauseDeploymentHandler,
  registerVersionHandler,
  updateDeploymentHandler,
  updateVersionHandler,
  uploadPackage,
  validatePackageHandler,
} from '../controllers/deploymentController.js';

// Deployment catalog, version registration, validation, and uploads.
const router = express.Router();

router.get('/', listDeployments);
router.get('/uploads', listUploadedPackages);
router.post('/', createDeploymentHandler);
router.post('/versions', createDeploymentHandler);
router.post('/versions/validate-package', validatePackageHandler);
router.patch('/:deploymentId', updateDeploymentHandler);
router.post('/:deploymentId/pause', pauseDeploymentHandler);
router.post('/:deploymentId/cancel', cancelDeploymentHandler);
router.post('/:deploymentId/versions', registerVersionHandler);
router.patch('/:deploymentId/versions/:versionId', updateVersionHandler);
router.post('/uploads', express.raw({ type: 'application/octet-stream', limit: '100mb' }), uploadPackage);
router.get('/:deploymentId', getDeploymentDetailsHandler);

export default router;
