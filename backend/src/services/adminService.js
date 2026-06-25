import prisma from '../prisma.js';

export async function getAdminDashboard() {
  const [groups, users, deployments, versions, recentLogs] = await Promise.all([
    prisma.userGroup.findMany({
      include: { deploymentAccesses: true, members: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.deployment.findMany({
      include: { versions: { orderBy: { createdAt: 'desc' } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.deploymentVersion.findMany({
      where: { deletedAt: null },
      include: { deployment: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.downloadLog.findMany({
      take: 8,
      include: {
        user: true,
        version: { include: { deployment: true } },
      },
      orderBy: { downloadedAt: 'desc' },
    }),
  ]);

  const releasedVersions = versions.filter((version) => version.status === 'released');

  return {
    stats: {
      groups: groups.length,
      activeUsers: users.filter((user) => user.isActive).length,
      activeDeployments: deployments.length,
      stableReleases: releasedVersions.filter((version) => version.releaseType === 'stable').length,
      betaReleases: releasedVersions.filter((version) => version.releaseType === 'beta').length,
    },
    deployments: deployments.map((deployment) => {
      const deploymentVersions = deployment.versions.filter((version) => !version.deletedAt && version.status !== 'deleted');
      const latestBeta = deploymentVersions.find((version) => version.releaseType === 'beta');
      const stableVersion = deploymentVersions.find((version) => version.releaseType === 'stable');
      return {
        module: deployment.name,
        latestBeta: latestBeta?.versionNumber || '-',
        stableVersion: stableVersion?.versionNumber || '-',
        status: deploymentVersions.some((version) => version.status === 'released') ? 'Released' : 'Draft',
        lastUpdated: formatRelativeTime(deploymentVersions[0]?.createdAt || deployment.createdAt),
      };
    }),
    activities: [
      ...versions.slice(0, 5).map((version) => ({
        name: `${version.deployment.name} ${version.versionNumber}`,
        description: `${version.status} ${version.releaseType} package`,
      })),
      ...recentLogs.slice(0, 3).map((log) => ({
        name: log.version.deployment.name,
        description: `downloaded by ${log.user.displayName || log.user.username}`,
      })),
    ].slice(0, 6),
    groups: groups.slice(0, 6).map((group) => ({
      name: group.name,
      users: group.members.length,
      status: group.deploymentAccesses.length > 0 ? 'Active' : 'No access',
    })),
  };
}

export async function getNotifications() {
  const [versions, logs, users] = await Promise.all([
    prisma.deploymentVersion.findMany({
      take: 10,
      where: { deletedAt: null },
      include: { deployment: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.downloadLog.findMany({
      take: 10,
      include: {
        user: true,
        version: { include: { deployment: true } },
      },
      orderBy: { downloadedAt: 'desc' },
    }),
    prisma.user.findMany({ take: 5, orderBy: { createdAt: 'desc' } }),
  ]);

  return [
    ...versions.map((version) => ({
      id: `version-${version.id}`,
      type: 'Version',
      title: `${version.deployment.name} ${version.versionNumber}`,
      message: `${version.status} ${version.releaseType} package registered`,
      createdAt: version.createdAt.toISOString(),
    })),
    ...logs.map((log) => ({
      id: `download-${log.id}`,
      type: 'Download',
      title: log.version.deployment.name,
      message: `${log.user.displayName || log.user.username} downloaded ${log.version.versionNumber}`,
      createdAt: log.downloadedAt.toISOString(),
    })),
    ...users.map((user) => ({
      id: `user-${user.id}`,
      type: 'User',
      title: user.displayName || user.username,
      message: `User account ${user.isActive ? 'active' : 'inactive'}`,
      createdAt: user.createdAt.toISOString(),
    })),
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 25);
}

export async function getDownloadLogs(filters = {}) {
  const where = {};
  if (filters.deploymentId) {
    where.version = { deploymentId: filters.deploymentId };
  }

  const logs = await prisma.downloadLog.findMany({
    where,
    take: 500,
    include: {
      user: true,
      version: { include: { deployment: true } },
    },
    orderBy: { downloadedAt: 'desc' },
  });

  return logs.map((log) => ({
    id: log.id,
    user: log.user.displayName || log.user.username,
    username: log.user.username,
    deploymentId: log.version.deploymentId,
    deployment: log.version.deployment.name,
    version: log.version.versionNumber,
    channel: log.version.releaseType,
    downloadedAt: log.downloadedAt.toISOString(),
    ipAddress: log.ipAddress || '',
    userAgent: log.userAgent || '',
  }));
}

function formatRelativeTime(value) {
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return `${diffDays} days ago`;
}
