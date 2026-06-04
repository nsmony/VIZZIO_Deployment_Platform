import { useState } from 'react';
import '../../styles/Logs.css';

const deployments = ['All Deployments', 'Digital Twin', 'Sensor Hub', 'Auth Gateway'];
const logTypes = ['All Logs', 'Deployment Logs', 'System Logs', 'Authentication Logs'];
const lastExportDate = new Date('2026-06-03T11:42:00');

export default function Logs() {
  const [deployment, setDeployment] = useState(deployments[0]);
  const [logType, setLogType] = useState(logTypes[0]);

  const downloadLabel = `${deployment.replace(/\s+/g, '-').toLowerCase()}-${lastExportDate.toISOString().slice(0, 10)}.zip`;
  const exportDateLabel = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(lastExportDate);

  const handleDownload = () => {
    alert(`Downloading ${logType} for ${deployment}.`);
  };

  return (
    <main className="logs-page">
      <section className="logs-header">
        <div>
          <p className="logs-description">
            Export and download log files for deployment activity, system events, and authentication history.
          </p>
        </div>
      </section>

      <section className="logs-panel">
        <div className="logs-settings">
          <label>
            Deployment
            <select value={deployment} onChange={(event) => setDeployment(event.target.value)}>
              {deployments.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <label>
            Log type
            <select value={logType} onChange={(event) => setLogType(event.target.value)}>
              {logTypes.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <button className="primary-btn" onClick={handleDownload}>Download Logs</button>
        </div>

        <div className="logs-summary-card">
          <span className="summary-label">Latest export</span>
          <div className="summary-row">
            <div>
              <p className="summary-title">Last exported file</p>
              <strong>{downloadLabel}</strong>
            </div>
            <div>
              <p className="summary-title">Export date</p>
              <strong>{exportDateLabel}</strong>
            </div>
            <div>
              <p className="summary-title">Status</p>
              <strong className="status-pill">Ready</strong>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

