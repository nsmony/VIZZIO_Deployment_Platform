const deployments = [
  {
    id: 'd1',
    name: 'Digital Twin',
    description: 'Primary smart infrastructure deployment',
    versions: ['v1.2.0', 'v1.2.1-beta'],
    users: 120,
    created: '2026-05-20',
  },
];

export function findDeployments() {
  return deployments;
}

export function addDeployment(deployment) {
  deployments.push(deployment);
  return deployment;
}
