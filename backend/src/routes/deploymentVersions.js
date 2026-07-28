import express from 'express';
import {
  deleteVersionHandler,
  getPackagePreparationHandler,
  startPackagePreparationHandler,
  validatePackageHandler,
} from '../controllers/deploymentController.js';

// Version-specific routes kept separate for simple frontend calls.
const router = express.Router();

router.post('/validate-package', validatePackageHandler);
router.post('/package-jobs', startPackagePreparationHandler);
router.get('/package-jobs/:jobId', getPackagePreparationHandler);
router.delete('/:versionId', deleteVersionHandler);

export default router;
