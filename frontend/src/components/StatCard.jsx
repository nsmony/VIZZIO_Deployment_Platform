import '../styles/StatCard.css';

function StatIcon({ type }) {
  const icons = {
    groups: (
      <path
        d="M6 16.5C6 14.57 7.57 13 9.5 13h5c1.93 0 3.5 1.57 3.5 3.5V19H6v-2.5ZM8.5 8.5a2.5 2.5 0 1 1 5 0a2.5 2.5 0 0 1-5 0ZM17.5 9.5a2 2 0 1 0 0-4a2 2 0 0 0 0 4ZM16.25 19v-2.1c0-1.26-.48-2.4-1.26-3.26M20 19v-1.9c0-1.11-.38-2.12-1.02-2.92"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    ),
    deployment: (
      <path
        d="M6.5 7.5h11M6.5 12h11M6.5 16.5h7M4.5 6.5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2v-11Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    ),
    release: (
      <path
        d="M12 4.5l2.4 4.86 5.36.78-3.88 3.78.92 5.34L12 16.77l-4.8 2.49.92-5.34-3.88-3.78 5.36-.78L12 4.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        fill="none"
      />
    ),
    packages: (
      <path
        d="M5.5 8.5 12 5l6.5 3.5v7L12 19l-6.5-3.5v-7ZM12 5v14M5.5 8.5 12 12l6.5-3.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    ),
    download: (
      <path
        d="M12 4.5v9M8.5 10.5 12 14l3.5-3.5M6.5 16.5h11"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    ),
    calendar: (
      <path
        d="M7.5 4.5v2M16.5 4.5v2M5 8h14M6.5 6.5h11a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    ),
  };

  return icons[type] || icons.packages;
}

export default function StatCard({ title, value, change, trend, subtitle, icon = 'packages' }) {
  const trendSymbol = trend === 'up' ? '+' : trend === 'down' ? '-' : '';

  return (
    <div className="stat-card">
      <div className="stat-top">
        <div className="stat-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <StatIcon type={icon} />
          </svg>
        </div>
        <div className="stat-header">
          <h3>{title}</h3>
          <p className="stat-subtitle">{subtitle}</p>
        </div>
      </div>
      <div className="stat-value">{value}</div>
      {change && (
        <div className={`stat-trend ${trend || 'flat'}`}>
          {trendSymbol && <span className="trend-arrow">{trendSymbol}</span>}
          <span>{change}</span>
        </div>
      )}
    </div>
  );
}
