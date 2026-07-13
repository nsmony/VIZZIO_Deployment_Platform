import prisma from '../prisma.js';

export async function listNotifications(user) {
  const userId = await resolveUserId(user);
  await seedSampleNotifications(userId);
  const notifications = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return notifications.map(serializeNotification);
}

export async function getUnreadNotificationCount(user) {
  const userId = await resolveUserId(user);
  await seedSampleNotifications(userId);
  return prisma.notification.count({ where: { userId, isRead: false } });
}

export async function markNotificationRead(user, notificationId) {
  const userId = await resolveUserId(user);
  const notification = await prisma.notification.findFirst({
    where: { id: notificationId, userId },
  });
  if (!notification) return null;

  return serializeNotification(await prisma.notification.update({
    where: { id: notification.id },
    data: { isRead: true },
  }));
}

export async function markAllNotificationsRead(user) {
  const userId = await resolveUserId(user);
  await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
  return listNotifications(user);
}

export async function deleteNotification(user, notificationId) {
  const userId = await resolveUserId(user);
  const notification = await prisma.notification.findFirst({
    where: { id: notificationId, userId },
  });
  if (!notification) return null;

  await prisma.notification.delete({ where: { id: notification.id } });
  return serializeNotification(notification);
}

async function resolveUserId(user) {
  if (isUuid(user?.userId)) {
    const existingUser = await prisma.user.findUnique({ where: { id: user.userId } });
    if (existingUser) return existingUser.id;
  }

  const managedUser = await prisma.user.findFirst({
    where: user?.username
      ? { username: { equals: user.username, mode: 'insensitive' } }
      : undefined,
  });
  if (managedUser) return managedUser.id;

  if (user?.username) {
    try {
      const demoUser = await prisma.user.create({
        data: {
          username: user.username,
          email: `${user.username}@demo.local`,
          passwordHash: 'notification-demo-user',
          displayName: user.username,
          role: user.role || 'Admin',
        },
      });
      return demoUser.id;
    } catch (error) {
      if (error.code === 'P2002') {
        const retryUser = await prisma.user.findFirst({
          where: { username: { equals: user.username, mode: 'insensitive' } },
        });
        if (retryUser) return retryUser.id;
      }
      throw error;
    }
  }

  const error = new Error('Notification user was not found.');
  error.status = 404;
  throw error;
}

async function seedSampleNotifications(userId) {
  const existing = await prisma.notification.count({ where: { userId } });
  if (existing > 0) return;

  await prisma.notification.createMany({
    data: [
      {
        userId,
        title: 'Deployment status updated',
        message: 'A deployment version is ready for review.',
        type: 'deployment',
      },
      {
        userId,
        title: 'New download activity',
        message: 'A package was downloaded from the portal.',
        type: 'download',
      },
      {
        userId,
        title: 'User access changed',
        message: 'A group permission update was applied.',
        type: 'user',
        isRead: true,
      },
    ],
  });
}

function serializeNotification(notification) {
  return {
    id: notification.id,
    userId: notification.userId,
    title: notification.title,
    message: notification.message,
    type: notification.type,
    isRead: notification.isRead,
    createdAt: notification.createdAt.toISOString(),
    updatedAt: notification.updatedAt.toISOString(),
  };
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || '')
  );
}
