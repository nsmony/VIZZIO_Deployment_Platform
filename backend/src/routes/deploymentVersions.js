import express from 'express';
import {
  deleteVersionHandler,
  validatePackageHandler,
} from '../controllers/deploymentController.js';

const router = express.Router();

router.post('/validate-package', validatePackageHandler);
router.delete('/:versionId', deleteVersionHandler);

export default router;
