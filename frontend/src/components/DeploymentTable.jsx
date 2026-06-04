import '../styles/DeploymentTable.css';

export default function DeploymentTable({ deployments }) {
  return (
    <div className="deployment-section">
      <div className="section-header">
        <h2>Deployments</h2>
        <div className="section-actions">
          <button className="btn-filter">Filter</button>
          <button className="btn-import">Import</button>
        </div>
      </div>
      <table className="deployment-table">
        <thead>
          <tr>
            <th>Module</th>
            <th>Latest Beta</th>
            <th>Stable Version</th>
            <th>Status</th>
            <th>Last Updated</th>
          </tr>
        </thead>
        <tbody>
          {deployments.map((dep, idx) => (
            <tr key={idx}>
              <td>{dep.module}</td>
              <td>{dep.latestBeta}</td>
              <td>{dep.stableVersion}</td>
              <td>
                <span className={`status ${dep.status.toLowerCase()}`}>{dep.status}</span>
              </td>
              <td>{dep.lastUpdated}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
