import '../../styles/Deployment.css';

export default function StatusBadge({ status }) {
  const value = status || 'Inactive';
  return <span className={`deployment-status-badge ${value.toLowerCase()}`}>{value}</span>;
}
