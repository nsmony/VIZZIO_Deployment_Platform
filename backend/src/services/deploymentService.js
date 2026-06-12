import { addDeployment, findDeployments } from '../repositories/deploymentRepository.js';

export function getDeployments() {
  return findDeployments().then((deployments) => deployments.map(toPublicDeployment));
}

export async function createDeployment(data, createdBy) {
  const deployment = {
    name: data.name || 'New Deployment',
    description: data.description || '',
    logoUrl: data.logoUrl || null,
    versions: data.versions || [],
    createdBy,
  };
  return toPublicDeployment(await addDeployment(deployment));
}

function toPublicDeployment(deployment) {
  return {
    ...deployment,
    versions: (deployment.versions || []).map((version) => version.versionNumber),
    users: deployment.users || 0,
    created: deployment.createdAt.toISOString().slice(0, 10),
  };
}
