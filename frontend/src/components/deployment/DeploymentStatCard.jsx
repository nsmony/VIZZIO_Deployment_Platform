import '../../styles/Deployment.css';

function StatIcon({ name }) {
  const paths = {
    deployments: 'M5 5h14v14H5V5Zm4 4h6v6H9V9Z',
    active: 'm5 12 4 4L19 6',
    versions: 'M7 17 17 7M9 7h8v8',
    failed: 'M12 5v8m0 4h.01',
  };

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={paths[name] || paths.deployments} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function DeploymentStatCard({ title, value, helper, tone = 'blue', icon }) {
  return (
    <article className="deployment-stat-card">
      <div className={`deployment-stat-icon ${tone}`}>
        <StatIcon name={icon} />
      </div>
      <div>
        <p>{title}</p>
        <strong>{value}</strong>
        <span className={tone === 'red' ? 'danger' : tone === 'green' ? 'success' : ''}>{helper}</span>
      </div>
    </article>
  );
}
