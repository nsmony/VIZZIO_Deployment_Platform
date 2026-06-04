import { addDeployment, findDeployments } from '../repositories/deploymentRepository.js';

export function getDeployments() {
  return findDeployments();
}

export function createDeployment(data) {
  const deployment = {
    id: `d${findDeployments().length + 1}`,
    name: data.name || 'New Deployment',
    description: data.description || '',
    versions: data.versions || [],
    users: data.users || 0,
    created: data.created || new Date().toISOString().slice(0, 10),
  };
  return addDeployment(deployment);
}
