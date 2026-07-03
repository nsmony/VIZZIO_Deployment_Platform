import { useEffect, useState } from 'react';
import { fetchNotifications } from '../../api';
import '../../styles/Notifications.css';

export default function Notifications() {
  // Store notifications loaded from the backend.
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Load recent platform events once when the page opens.
  useEffect(() => {
    const token = localStorage.getItem('vizzio_token');
    fetchNotifications(token)
      .then((data) => setNotifications(data.notifications || []))
      .catch((loadError) => setError(loadError.message))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <main className="notifications-page">
      <section className="notifications-header">
        <p>Recent package, user, and download events across the deployment platform.</p>
      </section>

      <section className="notifications-panel">
        {error && <div className="notifications-alert">{error}</div>}
        {isLoading ? (
          <div className="notifications-empty">Loading notifications...</div>
        ) : (
          <div className="notifications-list">
            {notifications.map((item) => (
              <article className="notification-item" key={item.id}>
                <span className="notification-type">{item.type}</span>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.message}</p>
                </div>
                <time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time>
              </article>
            ))}
            {notifications.length === 0 && (
              <div className="notifications-empty">No notifications yet.</div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}

// Show notification time in the user's local timezone.
function formatDate(value) {
  return new Date(value).toLocaleString();
}
