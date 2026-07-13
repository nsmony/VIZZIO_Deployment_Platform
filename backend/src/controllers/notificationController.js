import {
  deleteNotification,
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../services/notificationService.js';

export async function listNotificationsHandler(req, res) {
  try {
    res.json({ notifications: await listNotifications(req.user) });
  } catch (error) {
    sendNotificationError(res, error);
  }
}

export async function unreadNotificationCountHandler(req, res) {
  try {
    res.json({ unreadCount: await getUnreadNotificationCount(req.user) });
  } catch (error) {
    sendNotificationError(res, error);
  }
}

export async function markNotificationReadHandler(req, res) {
  try {
    const notification = await markNotificationRead(req.user, req.params.id);
    if (!notification) return res.status(404).json({ error: 'Notification not found.' });
    res.json({ notification, unreadCount: await getUnreadNotificationCount(req.user) });
  } catch (error) {
    sendNotificationError(res, error);
  }
}

export async function markAllNotificationsReadHandler(req, res) {
  try {
    const notifications = await markAllNotificationsRead(req.user);
    res.json({ notifications, unreadCount: 0 });
  } catch (error) {
    sendNotificationError(res, error);
  }
}

export async function deleteNotificationHandler(req, res) {
  try {
    const notification = await deleteNotification(req.user, req.params.id);
    if (!notification) return res.status(404).json({ error: 'Notification not found.' });
    res.json({ notification, unreadCount: await getUnreadNotificationCount(req.user) });
  } catch (error) {
    sendNotificationError(res, error);
  }
}

function sendNotificationError(res, error) {
  res.status(error.status || 500).json({
    error: error.status ? error.message : 'Notification request failed.',
  });
}
