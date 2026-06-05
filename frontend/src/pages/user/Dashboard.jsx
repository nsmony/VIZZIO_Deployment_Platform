import '../../styles/UserPortal.css';

const summaryCards = [
  { label: 'Packages available', value: '4', description: '2 stable, 2 beta' },
  { label: 'Installed', value: '4', description: '100 GB' },
  { label: 'Total downloads', value: '100', description: 'GB this month' },
  { label: 'Last download', value: 'Today', description: 'Digital Twin' },
];

const storageItems = [
  { label: 'Digital Twin', value: '18.4 GB', color: '#2563eb' },
  { label: 'Factory Viewer', value: '11.8 GB', color: '#fbbf24' },
  { label: 'Free space', value: '284 GB', color: '#d1d5db' },
];

const recentActivity = [
  { label: 'Digital Twin - stable v1.1.2', progress: 30 },
  { label: 'Digital Twin - stable v1.1.2', progress: 30 },
];

export default function UserDashboard() {
  return (
    <main className="user-page user-dashboard-page">
      <header className="page-header">
        <p className="page-overline">Dashboard</p>
        <h1>Package insights</h1>
      </header>

      <div className="dashboard-summary-grid">
        {summaryCards.map((item) => (
          <div key={item.label} className="dashboard-summary-card">
            <p className="summary-label">{item.label}</p>
            <h2>{item.value}</h2>
            <p className="summary-copy">{item.description}</p>
          </div>
        ))}
      </div>

      <div className="dashboard-grid">
        <section className="chart-card">
          <div className="chart-card-header">
            <h2>Storage usage</h2>
            <p>By installed package</p>
          </div>
          <div className="donut-chart">
            <div className="donut-center">30.2 GB total</div>
          </div>
          <div className="storage-legend">
            {storageItems.map((item) => (
              <div key={item.label} className="legend-row">
                <span className="legend-swatch" style={{ background: item.color }} />
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="chart-card chart-line-card">
          <div className="chart-card-header">
            <h2>Download activity</h2>
            <p>GB transferred over the last 12 weeks</p>
          </div>
          <div className="line-chart-placeholder">
            <span>Chart placeholder</span>
          </div>
        </section>
      </div>

      <section className="activity-card">
        <div className="chart-card-header">
          <h2>Recent activity</h2>
        </div>
        <div className="activity-list">
          {recentActivity.map((item) => (
            <div key={item.label} className="activity-row">
              <div>
                <p>{item.label}</p>
              </div>
              <span>{item.progress} GB Completed</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
