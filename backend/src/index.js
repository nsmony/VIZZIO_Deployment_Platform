import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import deploymentRoutes from './routes/deployments.js';
import deploymentVersionRoutes from './routes/deploymentVersions.js';
import downloadManagerRoutes from './routes/downloadManager.js';
import internalRoutes from './routes/internal.js';
import adminRoutes from './routes/admin.js';
import notificationRoutes from './routes/notifications.js';
import settingsRoutes from './routes/settings.js';
import launcherRoutes from './routes/launcher.js';
import { rateLimiter } from './middleware/rateLimiter.js';
import { authenticateToken, enforceMaintenanceMode } from './middleware/authMiddleware.js';
import { createDownloadToken } from './controllers/deploymentController.js';
import { downloadUploadedFile } from './controllers/downloadController.js';

// Backend composition root. Keep middleware and route order obvious here:
// public auth routes first, protected admin APIs next, download endpoints last.
const app = express();
app.use(cors());
app.use(express.json());
app.use(rateLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/launcher', launcherRoutes);
app.get('/api/download-token/:fileId', authenticateToken, enforceMaintenanceMode, createDownloadToken);
app.use('/api/users', authenticateToken, enforceMaintenanceMode, userRoutes);
app.use('/api/deployments', authenticateToken, enforceMaintenanceMode, deploymentRoutes);
app.use('/api/deployment-versions', authenticateToken, enforceMaintenanceMode, deploymentVersionRoutes);
app.use('/api/notifications', authenticateToken, enforceMaintenanceMode, notificationRoutes);
app.use('/api/settings', authenticateToken, settingsRoutes);
app.use('/api/admin', authenticateToken, adminRoutes);
// These routes perform their own token checks because the launcher also streams
// files with short-lived download tokens.
app.use('/api/download-manager', downloadManagerRoutes);
app.use('/internal', internalRoutes);
app.get('/downloads/:fileId', enforceMaintenanceMode, downloadUploadedFile);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Backend running on http://localhost:${port}`);
});
