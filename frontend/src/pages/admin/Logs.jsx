import { useEffect, useMemo, useState } from 'react';
import { exportDownloadLogs, fetchDeployments, fetchDownloadLogs } from '../../api';
import '../../styles/Logs.css';

export default function Logs() {
  const [deployments, setDeployments] = useState([]);
  const [deploymentId, setDeploymentId] = useState('');
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const token = localStorage.getItem('vizzio_token');

  useEffect(() => {
    loadDeployments();
  }, []);

  useEffect(() => {
    loadLogs();
  }, [deploymentId]);

  const latestLog = logs[0];
  const selectedDeployment = useMemo(() => {
    return deployments.find((deployment) => deployment.id === deploymentId);
  }, [deployments, deploymentId]);

  async function loadDeployments() {
    try {
      const data = await fetchDeployments(token);
      setDeployments(data.deployments || []);
    } catch (loadError) {
      setError(loadError.message);
    }
  }

  async function loadLogs() {
    setIsLoading(true);
    setError('');

    try {
      const data = await fetchDownloadLogs(token, deploymentId);
      setLogs(data.logs || []);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDownload() {
    setIsExporting(true);
    setError('');
    setMessage('');

    try {
      await exportDownloadLogs(token, deploymentId);
      setMessage('Download log export started.');
    } catch (exportError) {
      setError(exportError.message);
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <main className="logs-page">
      <section className="logs-header">
        <div>
          <p className="logs-description">
            Browse download activity by deployment and export the audit trail as a CSV file.
          </p>
        </div>
      </section>

      <section className="logs-panel">
        <div className="logs-settings">
          <label>
            Deployment
            <select value={deploymentId} onChange={(event) => setDeploymentId(event.target.value)}>
              <option value="">All Deployments</option>
              {deployments.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>
          <label>
            Log type
            <select value="downloads" disabled>
              <option value="downloads">Download Logs</option>
            </select>
          </label>
          <button className="primary-btn" onClick={handleDownload} disabled={isExporting}>
            {isExporting ? 'Exporting...' : 'Download Logs'}
          </button>
        </div>

        {(message || error) && (
          <div className={`logs-alert ${error ? 'error' : 'success'}`} role="status">
            {error || message}
          </div>
        )}

        <div className="logs-summary-card">
          <span className="summary-label">Download activity</span>
          <div className="summary-row">
            <div>
              <p className="summary-title">Scope</p>
              <strong>{selectedDeployment?.name || 'All deployments'}</strong>
            </div>
            <div>
              <p className="summary-title">Entries</p>
              <strong>{logs.length}</strong>
            </div>
            <div>
              <p className="summary-title">Latest Download</p>
              <strong>{latestLog ? formatDate(latestLog.downloadedAt) : 'No downloads yet'}</strong>
            </div>
          </div>
        </div>

        <div className="logs-table-wrap">
          {isLoading ? (
            <div className="logs-empty">Loading download logs...</div>
          ) : (
            <table className="logs-table">
              <thead>
                <tr>
                  <th>Downloaded At</th>
                  <th>User</th>
                  <th>Deployment</th>
                  <th>Version</th>
                  <th>Channel</th>
                  <th>IP Address</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>{formatDate(log.downloadedAt)}</td>
                    <td>
                      <strong>{log.user}</strong>
                      <span>{log.username}</span>
                    </td>
                    <td>{log.deployment}</td>
                    <td>{log.version}</td>
                    <td>{log.channel}</td>
                    <td>{log.ipAddress || '-'}</td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan="6">
                      <div className="logs-empty">No download logs match this filter.</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </main>
  );
}

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString();
}
