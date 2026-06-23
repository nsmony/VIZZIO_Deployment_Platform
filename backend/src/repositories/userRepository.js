import prisma from '../prisma.js';

const userInclude = {
  groupMemberships: {
    include: {
      group: true,
    },
  },
};

export function findUsers() {
  return prisma.user.findMany({
    include: userInclude,
    orderBy: { createdAt: 'asc' },
  });
}

export function findUserById(id) {
  return prisma.user.findUnique({
    where: { id },
    include: userInclude,
  });
}

export function findUserByEmail(email) {
  return prisma.user.findFirst({
    where: {
      email: {
        equals: email,
        mode: 'insensitive',
      },
    },
    include: userInclude,
  });
}

export function findUserByUsernameOrEmail(identifier) {
  return prisma.user.findFirst({
    where: {
      OR: [
        {
          username: {
            equals: identifier,
            mode: 'insensitive',
          },
        },
        {
          email: {
            equals: identifier,
            mode: 'insensitive',
          },
        },
      ],
    },
    include: userInclude,
  });
}

export async function addUser(user) {
  const { groups = [], ...userData } = user;

  return prisma.user.create({
    data: {
      ...userData,
      groupMemberships: {
        create: groups.map((name) => ({
          group: {
            connectOrCreate: {
              where: { name },
              create: { name },
            },
          },
        })),
      },
    },
    include: userInclude,
  });
}

export async function updateUser(id, updates) {
  const { groups, ...userUpdates } = updates;

  if (groups === undefined) {
    return prisma.user.update({
      where: { id },
      data: userUpdates,
      include: userInclude,
    });
  }

  return prisma.$transaction(async (tx) => {
    await tx.userGroupMember.deleteMany({
      where: { userId: id },
    });

    return tx.user.update({
      where: { id },
      data: {
        ...userUpdates,
        groupMemberships: {
          create: groups.map((name) => ({
            group: {
              connectOrCreate: {
                where: { name },
                create: { name },
              },
            },
          })),
        },
      },
      include: userInclude,
    });
  });
}

export function updateUserLastLogin(id) {
  return prisma.user.update({
    where: { id },
    data: { lastLoginAt: new Date() },
    include: userInclude,
  });
}

export async function deleteUser(id) {
  const user = await findUserById(id);
  if (!user) return null;

  return prisma.user.delete({
    where: { id },
  });
}
