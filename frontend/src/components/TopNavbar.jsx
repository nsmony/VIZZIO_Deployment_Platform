import { useEffect, useRef, useState } from 'react';
import {
  deleteNotification,
  fetchNotifications,
  fetchUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from '../api';
import '../styles/TopNavbar.css';

function HeaderIcon({ type }) {
  const paths = {
    search: 'M10.5 18a7.5 7.5 0 1 1 5.3-12.8A7.5 7.5 0 0 1 10.5 18Zm5.7-1.8 3.3 3.3',
    bell: 'M6.5 9.5a5.5 5.5 0 0 1 11 0v3.7l1.4 2.3H5.1l1.4-2.3V9.5Zm3.5 8.8a2.3 2.3 0 0 0 4 0',
    settings: 'M12 8.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Zm7.2 3.5a7.7 7.7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a7.4 7.4 0 0 0-1.7-1l-.3-2.6h-4l-.4 2.6a7.4 7.4 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.5a7.7 7.7 0 0 0 0 2l-2 1.5 2 3.4 2.4-1a7.4 7.4 0 0 0 1.7 1l.4 2.6h4l.3-2.6a7.4 7.4 0 0 0 1.7-1l2.4 1 2-3.4-2-1.5c.1-.3.1-.7.1-1Z',
    cube: 'M12 3.5 20 8v8l-8 4.5L4 16V8l8-4.5Zm0 0V12m8-4-8 4m-8-4 8 4m0 8.5V12',
  };

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={paths[type]} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function formatNotificationTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

export default function TopNavbar({ title, onMenuToggle, username = 'Admin', profileImage = '', initials = 'A', onProfileClick, profileOpen, children }) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [notificationError, setNotificationError] = useState('');
  const notificationRef = useRef(null);

  useEffect(() => {
    loadUnreadCount();
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (!notificationRef.current?.contains(event.target)) {
        setNotificationsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function loadUnreadCount() {
    const token = localStorage.getItem('vizzio_token');
    if (!token) return;
    try {
      const data = await fetchUnreadNotificationCount(token);
      setUnreadCount(data.unreadCount || 0);
    } catch {
      setUnreadCount(0);
    }
  }

  async function loadNotifications() {
    const token = localStorage.getItem('vizzio_token');
    if (!token) return;
    setLoadingNotifications(true);
    setNotificationError('');
    try {
      const data = await fetchNotifications(token);
      setNotifications(data.notifications || []);
      const unread = await fetchUnreadNotificationCount(token);
      setUnreadCount(unread.unreadCount || 0);
    } catch (error) {
      setNotificationError(error.message || 'Could not load notifications.');
    } finally {
      setLoadingNotifications(false);
    }
  }

  async function toggleNotifications() {
    const nextOpen = !notificationsOpen;
    setNotificationsOpen(nextOpen);
    if (nextOpen) {
      await loadNotifications();
    }
  }

  async function handleNotificationClick(notification) {
    if (notification.isRead) return;
    const token = localStorage.getItem('vizzio_token');
    if (!token) return;
    try {
      const data = await markNotificationRead(token, notification.id);
      setNotifications((current) =>
        current.map((item) => (item.id === notification.id ? data.notification : item))
      );
      setUnreadCount(data.unreadCount || 0);
    } catch (error) {
      setNotificationError(error.message || 'Could not update notification.');
    }
  }

  async function handleReadAll() {
    const token = localStorage.getItem('vizzio_token');
    if (!token) return;
    try {
      const data = await markAllNotificationsRead(token);
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (error) {
      setNotificationError(error.message || 'Could not mark notifications as read.');
    }
  }

  async function handleDelete(event, notificationId) {
    event.stopPropagation();
    const token = localStorage.getItem('vizzio_token');
    if (!token) return;
    try {
      const data = await deleteNotification(token, notificationId);
      setNotifications((current) => current.filter((item) => item.id !== notificationId));
      setUnreadCount(data.unreadCount || 0);
    } catch (error) {
      setNotificationError(error.message || 'Could not delete notification.');
    }
  }

  return (
    <header className="top-navbar">
      <div className="top-navbar-left">
        <button className="top-menu-button" onClick={onMenuToggle} aria-label="Toggle sidebar">
          <span />
          <span />
          <span />
        </button>
        <div className="top-page-mark">
          <HeaderIcon type="cube" />
        </div>
        <div className="top-page-title">{title}</div>
      </div>

      <div className="top-navbar-right">
        <label className="top-search">
          <HeaderIcon type="search" />
          <input type="search" placeholder="Search deployments..." />
          <kbd>Ctrl K</kbd>
        </label>
        <div className="notification-menu" ref={notificationRef}>
          <button
            className={`top-icon-button ${unreadCount > 0 ? 'notification-dot' : ''}`}
            aria-label="Notifications"
            aria-expanded={notificationsOpen}
            onClick={toggleNotifications}
          >
            <HeaderIcon type="bell" />
            {unreadCount > 0 && <span>{unreadCount}</span>}
          </button>
          {notificationsOpen && (
            <div className="notification-dropdown">
              <header>
                <div>
                  <strong>Notifications</strong>
                  <p>{unreadCount} unread</p>
                </div>
                <button type="button" onClick={handleReadAll} disabled={unreadCount === 0}>
                  Mark all read
                </button>
              </header>
              {loadingNotifications ? (
                <div className="notification-state">Loading notifications...</div>
              ) : notificationError ? (
                <div className="notification-state error">{notificationError}</div>
              ) : notifications.length === 0 ? (
                <div className="notification-state">No notifications yet.</div>
              ) : (
                <div className="notification-list">
                  {notifications.map((notification) => (
                    <button
                      className={`notification-row ${notification.isRead ? 'read' : 'unread'}`}
                      type="button"
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <span className="notification-read-dot" />
                      <span>
                        <strong>{notification.title}</strong>
                        <p>{notification.message}</p>
                        <time dateTime={notification.createdAt}>{formatNotificationTime(notification.createdAt)}</time>
                      </span>
                      <span
                        className="notification-delete"
                        role="button"
                        tabIndex={0}
                        onClick={(event) => handleDelete(event, notification.id)}
                      >
                        ×
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <button className="top-icon-button" aria-label="Settings">
          <HeaderIcon type="settings" />
        </button>
        <div className="top-profile">
          <button className="top-profile-button" onClick={onProfileClick} aria-label="Open profile menu" aria-expanded={profileOpen}>
            {profileImage ? <img src={profileImage} alt="" /> : initials}
          </button>
          <div className="top-profile-name">
            <strong>{username}</strong>
            <small>Administrator</small>
          </div>
          {children}
        </div>
      </div>
    </header>
  );
}
