import express from 'express';
import {
  createDeploymentHandler,
  getUploadChunkStatus,
  listUploadedPackages,
  listDeployments,
  uploadPackageChunk,
  uploadPackage,
} from '../controllers/deploymentController.js';

const router = express.Router();

router.get('/', listDeployments);
router.get('/uploads', listUploadedPackages);
router.get('/uploads/chunks/:uploadId/status', getUploadChunkStatus);
router.post('/versions', createDeploymentHandler);
router.post('/uploads', express.raw({ type: 'application/octet-stream', limit: '110mb' }), uploadPackage);
router.post('/uploads/chunks', express.raw({ type: 'application/octet-stream', limit: '60mb' }), uploadPackageChunk);

export default router;
