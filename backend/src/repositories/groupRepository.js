import prisma from '../prisma.js';

// Groups control deployment visibility. The include shape is shared so every
// caller receives the access mappings needed by the admin permission screens.
const groupInclude = {
  deploymentAccesses: true,
};

export function findGroups() {
  return prisma.userGroup.findMany({
    include: groupInclude,
    orderBy: { createdAt: 'asc' },
  });
}

export function findGroupById(id) {
  return prisma.userGroup.findUnique({
    where: { id },
    include: groupInclude,
  });
}

export function addGroup(group) {
  const { deploymentIds = [], ...groupData } = group;

  return prisma.userGroup.create({
    data: {
      ...groupData,
      deploymentAccesses: {
        create: deploymentIds.map((deploymentId) => ({
          deployment: {
            connect: { id: deploymentId },
          },
        })),
      },
    },
    include: groupInclude,
  });
}

export async function updateGroup(id, updates) {
  const group = await findGroupById(id);
  if (!group) return null;

  const { deploymentIds, ...groupUpdates } = updates;
  if (deploymentIds === undefined) {
    // No deploymentIds field means "only update group metadata"; avoid touching
    // access rows so partial edits do not accidentally revoke deployment access.
    return prisma.userGroup.update({
      where: { id },
      data: groupUpdates,
      include: groupInclude,
    });
  }

  // Replace access rows transactionally so the UI can submit the selected set as
  // the source of truth without leaving a half-updated permissions state.
  return prisma.$transaction(async (tx) => {
    await tx.groupDeploymentAccess.deleteMany({
      where: { groupId: id },
    });

    return tx.userGroup.update({
      where: { id },
      data: {
        ...groupUpdates,
        deploymentAccesses: {
          create: deploymentIds.map((deploymentId) => ({
            deployment: {
              connect: { id: deploymentId },
            },
          })),
        },
      },
      include: groupInclude,
    });
  });
}
