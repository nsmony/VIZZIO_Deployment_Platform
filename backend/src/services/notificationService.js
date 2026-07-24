import prisma from '../prisma.js';

export async function notifyAdmins({ title, message, type = 'info' }) {
  if (!title || !message) return;

  try {
    const admins = await prisma.user.findMany({
      where: {
        isActive: true,
        role: { equals: 'Admin', mode: 'insensitive' },
      },
      select: { id: true },
    });

    if (admins.length === 0) return;

    await prisma.notification.createMany({
      data: admins.map((admin) => ({
        userId: admin.id,
        title,
        message,
        type,
      })),
    });
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[notification-write]', error);
    }
  }
}

export async function listNotifications(user) {
  const userId = await resolveUserId(user);
  const notifications = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return notifications.map(serializeNotification);
}

export async function getUnreadNotificationCount(user) {
  const userId = await resolveUserId(user);
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
