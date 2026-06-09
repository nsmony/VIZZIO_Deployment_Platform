import express from 'express';
import {
  createDeploymentHandler,
  listUploadedPackages,
  listDeployments,
  uploadPackage,
} from '../controllers/deploymentController.js';

const router = express.Router();

router.get('/', listDeployments);
router.get('/uploads', listUploadedPackages);
router.post('/versions', createDeploymentHandler);
router.post('/uploads', express.raw({ type: 'application/octet-stream', limit: '5gb' }), uploadPackage);

export default router;
