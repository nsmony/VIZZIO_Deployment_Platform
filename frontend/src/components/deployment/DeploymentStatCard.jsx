import '../../styles/Deployment.css';

export default function DeploymentStatCard({ title, value, helper, tone = 'blue', icon }) {
  return (
    <article className="deployment-stat-card">
      <div className={`deployment-stat-icon ${tone}`}>{icon}</div>
      <div>
        <p>{title}</p>
        <strong>{value}</strong>
        <span className={tone === 'red' ? 'danger' : tone === 'green' ? 'success' : ''}>{helper}</span>
      </div>
    </article>
  );
}
