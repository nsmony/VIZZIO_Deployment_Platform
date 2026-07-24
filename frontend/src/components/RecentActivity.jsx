import { Link } from 'react-router-dom';
import '../styles/RecentActivity.css';

export default function RecentActivity({ activities = [] }) {
  return (
    <div className="recent-activity">
      <div className="recent-activity-header">
        <h3>Recent Activity</h3>
        <Link to="/logs/download" className="view-all">View logs</Link>
      </div>
      <div className="activity-list">
        {activities.length === 0 ? (
          <p className="activity-empty">No download or version activity yet.</p>
        ) : (
          activities.map((activity, idx) => (
            <div key={`${activity.name}-${idx}`} className="activity-item">
              <div className="activity-name">{activity.name}</div>
              <div className="activity-desc">{activity.description}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
