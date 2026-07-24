import express from 'express';
import {
  archiveDeploymentHandler,
  createDeploymentHandler,
  deleteDeploymentHandler,
  getDeploymentDetailsHandler,
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
