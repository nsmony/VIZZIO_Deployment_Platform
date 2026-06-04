import { useMemo, useState } from 'react';
import '../styles/Dashboard.css';

const deployments = [
  {
    id: 'digital-twin',
    name: 'Digital Twin',
    stableVersion: 'v1.2.0',
    betaVersion: 'v1.2.1-beta',
    lastReleased: '2026-06-01',
    status: 'Released',
  },
  {
    id: 'sensor-hub',
    name: 'Sensor Hub',
    stableVersion: 'v1.1.4',
    betaVersion: 'v1.2.0-beta',
    lastReleased: '2026-05-24',
    status: 'Beta',
  },
  {
    id: 'auth-gateway',
    name: 'Auth Gateway',
    stableVersion: 'v2.0.2',
    betaVersion: 'v2.1.0-beta',
    lastReleased: '2026-05-30',
    status: 'Released',
  },
];

export default function Version() {
  const [selectedDeployment, setSelectedDeployment] = useState(deployments[0].id);

  const deployment = useMemo(
    () => deployments.find((item) => item.id === selectedDeployment) || deployments[0],
    [selectedDeployment]
  );

  return (
    <main className="dashboard">
      <div className="version-toolbar">
        <label className="version-filter">
          Deployment
          <select value={selectedDeployment} onChange={(event) => setSelectedDeployment(event.target.value)}>
            {deployments.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <section className="version-card">
        <div className="version-card-row">
          <div>
            <p className="version-label">Selected deployment</p>
            <h2>{deployment.name}</h2>
          </div>
          <span className={`status-pill status-${deployment.status.toLowerCase()}`}>
            {deployment.status}
          </span>
        </div>

        <div className="version-grid">
          <div className="version-metric">
            <p className="version-label">Stable version</p>
            <strong>{deployment.stableVersion}</strong>
          </div>
          <div className="version-metric">
            <p className="version-label">Beta version</p>
            <strong>{deployment.betaVersion}</strong>
          </div>
          <div className="version-metric">
            <p className="version-label">Last released</p>
            <strong>{deployment.lastReleased}</strong>
          </div>
        </div>
      </section>
    </main>
  );
}
