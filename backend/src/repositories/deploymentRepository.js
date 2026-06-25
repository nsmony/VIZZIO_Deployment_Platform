import prisma from '../prisma.js';

const deploymentInclude = {
  versions: {
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' },
  },
};

export function findDeployments() {
  return prisma.deployment.findMany({
    include: deploymentInclude,
    orderBy: { createdAt: 'asc' },
  });
}

export function findDeploymentsForUser(userId) {
  return prisma.deployment.findMany({
    where: {
      groupAccesses: {
        some: {
          group: {
            members: {
              some: { userId },
            },
          },
        },
      },
    },
    include: deploymentInclude,
    distinct: ['id'],
    orderBy: { createdAt: 'asc' },
  });
}

export function addDeployment(deployment) {
  const { versions = [], createdBy, ...deploymentData } = deployment;
  const validCreator = isUuid(createdBy) ? createdBy : undefined;

  return prisma.deployment.create({
    data: {
      ...deploymentData,
      createdBy: validCreator,
      versions: {
        create: versions.map((versionNumber) => ({
          versionNumber,
          status: 'released',
          releasedBy: validCreator,
          releasedAt: new Date(),
        })),
      },
    },
    include: deploymentInclude,
  });
}

export function updateDeployment(id, updates) {
  return prisma.deployment.update({
    where: { id },
    data: updates,
    include: deploymentInclude,
  });
}

export function findDeploymentById(id) {
  return prisma.deployment.findUnique({
    where: { id },
    include: deploymentInclude,
  });
}

export function findDeploymentForUser(id, userId) {
  return prisma.deployment.findFirst({
    where: {
      id,
      groupAccesses: {
        some: {
          group: {
            members: {
              some: { userId },
            },
          },
        },
      },
    },
    include: deploymentInclude,
  });
}

export function addDeploymentVersion(deploymentId, version) {
  return prisma.deploymentVersion.create({
    data: {
      deploymentId,
      ...version,
    },
  });
}

export function findDeploymentVersion(deploymentId, versionId) {
  return prisma.deploymentVersion.findFirst({
    where: { id: versionId, deploymentId },
  });
}

export function updateDeploymentVersion(versionId, updates) {
  return prisma.deploymentVersion.update({
    where: { id: versionId },
    data: updates,
  });
}

export function findVersionById(versionId) {
  return prisma.deploymentVersion.findFirst({
    where: { id: versionId, deletedAt: null },
    include: { deployment: true },
  });
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || '')
  );
}
