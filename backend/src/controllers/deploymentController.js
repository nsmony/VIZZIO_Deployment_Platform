import { createDeployment, getDeployments } from '../services/deploymentService.js';

export async function listDeployments(req, res) {
  res.json({ deployments: getDeployments() });
}

export async function createDeploymentHandler(req, res) {
  try {
    const deployment = createDeployment(req.body);
    res.status(201).json({ deployment });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

export async function createDownloadToken(req, res) {
  // Placeholder for short-lived download token creation.
  res.json({ message: 'Download token placeholder' });
}
