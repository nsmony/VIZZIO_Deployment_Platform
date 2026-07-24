import { useEffect, useMemo, useState } from 'react';
import {
  deleteNotification,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../../api';
import '../../styles/Notifications.css';

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [filter, setFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadNotifications();
  }, []);

  const unreadCount = notifications.filter((item) => !item.isRead).length;
  const visibleNotifications = useMemo(() => {
    if (filter === 'unread') return notifications.filter((item) => !item.isRead);
    if (filter === 'read') return notifications.filter((item) => item.isRead);
    return notifications;
  }, [filter, notifications]);

  async function loadNotifications() {
    const token = localStorage.getItem('vizzio_token');
    if (!token) return;
    setIsLoading(true);
    setError('');
    try {
      const data = await fetchNotifications(token);
      setNotifications(data.notifications || []);
    } catch (loadError) {
      setError(loadError.message || 'Could not load notifications.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleMarkRead(notification) {
    if (notification.isRead) return;
    const token = localStorage.getItem('vizzio_token');
    if (!token) return;
    setBusyId(notification.id);
    setError('');
    try {
      const data = await markNotificationRead(token, notification.id);
      setNotifications((current) =>
        current.map((item) => (item.id === notification.id ? data.notification : item))
      );
    } catch (markError) {
      setError(markError.message || 'Could not mark notification as read.');
    } finally {
      setBusyId('');
    }
  }

  async function handleMarkAllRead() {
    const token = localStorage.getItem('vizzio_token');
    if (!token || unreadCount === 0) return;
    setError('');
    try {
      const data = await markAllNotificationsRead(token);
      setNotifications(data.notifications || []);
    } catch (markError) {
      setError(markError.message || 'Could not mark notifications as read.');
    }
  }

  async function handleDelete(notification) {
    const token = localStorage.getItem('vizzio_token');
    if (!token) return;
    setBusyId(notification.id);
    setError('');
    try {
      await deleteNotification(token, notification.id);
      setNotifications((current) => current.filter((item) => item.id !== notification.id));
    } catch (deleteError) {
      setError(deleteError.message || 'Could not delete notification.');
    } finally {
      setBusyId('');
    }
  }

  return (
    <main className="notifications-page">
      <section className="notifications-header">
        <div>
          <p>Recent platform notifications for your account.</p>
          <span>{unreadCount} unread</span>
        </div>
        <button type="button" onClick={handleMarkAllRead} disabled={unreadCount === 0}>
          Mark all read
        </button>
      </section>

      <section className="notifications-panel">
        <div className="notifications-toolbar" aria-label="Notification filters">
          <button className={filter === 'all' ? 'active' : ''} type="button" onClick={() => setFilter('all')}>All</button>
          <button className={filter === 'unread' ? 'active' : ''} type="button" onClick={() => setFilter('unread')}>Unread</button>
          <button className={filter === 'read' ? 'active' : ''} type="button" onClick={() => setFilter('read')}>Read</button>
        </div>

        {error && <div className="notifications-alert">{error}</div>}
        {isLoading ? (
          <div className="notifications-empty">Loading notifications...</div>
        ) : visibleNotifications.length === 0 ? (
          <div className="notifications-empty">{filter === 'all' ? 'No notifications yet.' : `No ${filter} notifications.`}</div>
        ) : (
          <div className="notifications-list">
            {visibleNotifications.map((item) => (
              <article className={`notification-item ${item.isRead ? 'read' : 'unread'}`} key={item.id}>
                <span className="notification-read-marker" aria-hidden="true" />
                <span className="notification-type">{formatType(item.type)}</span>
                <div className="notification-copy">
                  <h3>{item.title}</h3>
                  <p>{item.message}</p>
                  <time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time>
                </div>
                <div className="notification-actions">
                  {!item.isRead && (
                    <button type="button" disabled={busyId === item.id} onClick={() => handleMarkRead(item)}>
                      Mark read
                    </button>
                  )}
                  <button type="button" className="danger" disabled={busyId === item.id} onClick={() => handleDelete(item)}>
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function formatType(value) {
  if (!value) return 'Info';
  return String(value).slice(0, 1).toUpperCase() + String(value).slice(1);
}
