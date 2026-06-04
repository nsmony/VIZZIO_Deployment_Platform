import express from 'express';
import {
  createDeploymentHandler,
  createDownloadToken,
  listDeployments,
} from '../controllers/deploymentController.js';

const router = express.Router();

router.get('/', listDeployments);
router.post('/versions', createDeploymentHandler);
router.post('/token', createDownloadToken);

export default router;
