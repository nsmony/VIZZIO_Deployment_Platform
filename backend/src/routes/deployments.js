import express from 'express';
import {
  createDeploymentHandler,
  listUploadedPackages,
  listDeployments,
  registerVersionHandler,
  updateVersionHandler,
  uploadPackage,
} from '../controllers/deploymentController.js';

const router = express.Router();

router.get('/', listDeployments);
router.get('/uploads', listUploadedPackages);
router.post('/', createDeploymentHandler);
router.post('/versions', createDeploymentHandler);
router.post('/:deploymentId/versions', registerVersionHandler);
router.patch('/:deploymentId/versions/:versionId', updateVersionHandler);
router.post('/uploads', express.raw({ type: 'application/octet-stream', limit: '5gb' }), uploadPackage);

export default router;
