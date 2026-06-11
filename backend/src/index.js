import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import deploymentRoutes from './routes/deployments.js';
import internalRoutes from './routes/internal.js';
import { rateLimiter } from './middleware/rateLimiter.js';
import { authenticateToken } from './middleware/authMiddleware.js';
import { createDownloadToken } from './controllers/deploymentController.js';
import { downloadUploadedFile } from './controllers/downloadController.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(rateLimiter);

app.use('/api/auth', authRoutes);
app.get('/api/download-token/:fileId', authenticateToken, createDownloadToken);
app.use('/api/users', authenticateToken, userRoutes);
app.use('/api/deployments', authenticateToken, deploymentRoutes);
app.use('/internal', internalRoutes);
app.get('/downloads/:fileId', downloadUploadedFile);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

const port = process.env.PORT || 4000;
const server = app.listen(port, () => {
  console.log(`Backend running on http://localhost:${port}`);
});

server.requestTimeout = 0;
server.timeout = 0;
server.keepAliveTimeout = 65_000;
server.headersTimeout = 70_000;
