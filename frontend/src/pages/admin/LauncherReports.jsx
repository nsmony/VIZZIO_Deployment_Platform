import { useEffect, useMemo, useState } from 'react';
import { fetchLauncherErrorReport, fetchLauncherErrorReports } from '../../api';
import '../../styles/Logs.css';

const AREA_OPTIONS = [
  { value: '', label: 'All Areas' },
  { value: 'launch', label: 'Launch' },
  { value: 'download', label: 'Download' },
  { value: 'self-update', label: 'Self-update' },
];

export default function LauncherReports() {
  const [reports, setReports] = useState([]);
  const [deployment, setDeployment] = useState('');
  const [area, setArea] = useState('');
  const [selectedReport, setSelectedReport] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [error, setError] = useState('');

  const token = localStorage.getItem('vizzio_token');

  useEffect(() => {
    loadReports();
  }, [deployment, area]);

  const deployments = useMemo(() => {
    return [...new Set(reports.map((report) => report.context?.deploymentName).filter(Boolean))].sort();
  }, [reports]);

  const latestReport = reports[0];

  async function loadReports() {
    setIsLoading(true);
    setError('');

    try {
      const data = await fetchLauncherErrorReports(token, { deployment, area });
      setReports(data.reports || []);
      setSelectedReport(null);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function openReport(reportId) {
    setIsDetailLoading(true);
    setError('');

    try {
      const data = await fetchLauncherErrorReport(token, reportId);
      setSelectedReport(data.report || null);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setIsDetailLoading(false);
    }
  }

  return (
    <main className="logs-page">
      <section className="logs-header">
        <div>
          <p className="logs-description">
            Review launcher-side download, launch, prerequisite, and update failures reported by signed-in users.
          </p>
        </div>
      </section>

      <section className="logs-panel">
        <div className="logs-settings">
          <label>
            Deployment
            <select value={deployment} onChange={(event) => setDeployment(event.target.value)}>
              <option value="">All Deployments</option>
              {deployments.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </label>
          <label>
            Area
            <select value={area} onChange={(event) => setArea(event.target.value)}>
              {AREA_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <button className="primary-btn" type="button" onClick={loadReports} disabled={isLoading}>
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {error && (
          <div className="logs-alert error" role="status">
            {error}
          </div>
        )}

        <div className="logs-summary-card">
          <span className="summary-label">Launcher reports</span>
          <div className="summary-row">
            <div>
              <p className="summary-title">Scope</p>
              <strong>{deployment || 'All deployments'}</strong>
            </div>
            <div>
              <p className="summary-title">Reports</p>
              <strong>{reports.length}</strong>
            </div>
            <div>
              <p className="summary-title">Latest Report</p>
              <strong>{latestReport ? formatDate(latestReport.receivedAt) : 'No reports yet'}</strong>
            </div>
          </div>
        </div>

        <div className="logs-table-wrap">
          {isLoading ? (
            <div className="logs-empty">Loading launcher reports...</div>
          ) : (
            <table className="logs-table launcher-reports-table">
              <thead>
                <tr>
                  <th>Reported At</th>
                  <th>User</th>
                  <th>Deployment</th>
                  <th>Area</th>
                  <th>Message</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => (
                  <tr key={report.id}>
                    <td>{formatDate(report.receivedAt)}</td>
                    <td>
                      <strong>{report.user?.username || '-'}</strong>
                      <span>{report.client?.machineName || 'Unknown machine'}</span>
                    </td>
                    <td>
                      <strong>{report.context?.deploymentName || '-'}</strong>
                      <span>{report.context?.versionNumber || '-'}</span>
                    </td>
                    <td><span className="status-pill">{formatArea(report.context?.area)}</span></td>
                    <td className="message-cell">{report.context?.message || '-'}</td>
                    <td>
                      <button className="table-action-btn" type="button" onClick={() => openReport(report.id)}>
                        View
                      </button>
                    </td>
                  </tr>
                ))}
                {reports.length === 0 && (
                  <tr>
                    <td colSpan="6">
                      <div className="logs-empty">No launcher reports match this filter.</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {(selectedReport || isDetailLoading) && (
          <section className="launcher-report-detail" aria-live="polite">
            {isDetailLoading ? (
              <div className="logs-empty">Loading report details...</div>
            ) : (
              <>
                <div className="report-detail-header">
                  <div>
                    <span className="summary-label">Report detail</span>
                    <h3>{selectedReport.context?.deploymentName || 'Launcher'} {selectedReport.context?.versionNumber || ''}</h3>
                  </div>
                  <button className="table-action-btn" type="button" onClick={() => setSelectedReport(null)}>
                    Close
                  </button>
                </div>
                <dl className="report-detail-grid">
                  <div>
                    <dt>Reported</dt>
                    <dd>{formatDate(selectedReport.receivedAt)}</dd>
                  </div>
                  <div>
                    <dt>User</dt>
                    <dd>{selectedReport.user?.username || '-'}</dd>
                  </div>
                  <div>
                    <dt>Launcher</dt>
                    <dd>{selectedReport.client?.version || '-'}</dd>
                  </div>
                  <div>
                    <dt>Machine</dt>
                    <dd>{selectedReport.client?.machineName || '-'}</dd>
                  </div>
                  <div>
                    <dt>OS</dt>
                    <dd>{selectedReport.client?.osVersion || '-'}</dd>
                  </div>
                  <div>
                    <dt>IP Address</dt>
                    <dd>{selectedReport.request?.ipAddress || '-'}</dd>
                  </div>
                </dl>
                <div className="report-message">
                  <strong>{selectedReport.context?.message || '-'}</strong>
                  <span>{selectedReport.request?.userAgent || ''}</span>
                </div>
                <pre className="report-log-tail">{selectedReport.logTail || 'No launcher log tail was included.'}</pre>
              </>
            )}
          </section>
        )}
      </section>
    </main>
  );
}

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString();
}

function formatArea(value) {
  if (!value) return 'Launcher';
  return value
    .split('-')
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ');
}
