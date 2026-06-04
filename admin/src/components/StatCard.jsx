import '../styles/StatCard.css';

export default function StatCard({ title, value, change, trend }) {
  return (
    <div className="stat-card">
      <div className="stat-header">
        <h3>{title}</h3>
        <div className="stat-menu">⋯</div>
      </div>
      <div className="stat-value">{value}</div>
      <div className={`stat-trend ${trend}`}>
        <span className="trend-arrow">{trend === 'up' ? '📈' : '📉'}</span>
        <span>{change}</span>
      </div>
    </div>
  );
}
