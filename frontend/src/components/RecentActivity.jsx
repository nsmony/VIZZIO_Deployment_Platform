import '../styles/RecentActivity.css';

export default function RecentActivity({ activities }) {
  return (
    <div className="recent-activity">
      <h3>Recent Activity</h3>
      <a href="#view-all" className="view-all">View All</a>
      <div className="activity-list">
        {activities.map((activity, idx) => (
          <div key={idx} className="activity-item">
            <div className="activity-name">{activity.name}</div>
            <div className="activity-desc">{activity.description}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
