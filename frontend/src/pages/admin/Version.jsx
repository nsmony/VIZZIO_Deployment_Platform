import { useEffect, useMemo, useState } from 'react';
import {
  fetchDeployments,
  registerDeploymentVersion,
  updateDeploymentVersion,
} from '../../api';
import '../../styles/Deployment.css';
import '../../styles/Version.css';

const emptyVersion = {
  versionNumber: '',
  releaseType: 'stable',
  packagePath: '',
  fileName: '',
  fileType: '',
  packageSize: '',
  checksum: '',
};

function formatPackageSize(value) {
  if (!value) return 'Not set';
  const bytes = Number(value);
  if (!Number.isFinite(bytes)) return `${value} bytes`;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

export default function Version() {
  const [deployments, setDeployments] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [form, setForm] = useState(emptyVersion);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyVersion, setBusyVersion] = useState('');
  const [error, setError] = useState('');

  const deployment = useMemo(
    () => deployments.find((item) => item.id === selectedId) || null,
    [deployments, selectedId]
  );

  async function loadDeployments(preferredId) {
    const token = localStorage.getItem('vizzio_token');
    if (!token) return;

    setLoading(true);
    try {
      const result = await fetchDeployments(token);
      const items = result.deployments || [];
      setDeployments(items);
      setSelectedId((current) => preferredId || current || items[0]?.id || '');
      setError('');
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDeployments();
  }, []);

  async function handleRegister(event) {
    event.preventDefault();
    const token = localStorage.getItem('vizzio_token');
    if (!token || !deployment) return;

    setSaving(true);
    setError('');
    try {
      await registerDeploymentVersion(token, deployment.id, form);
      setForm(emptyVersion);
      setShowForm(false);
      await loadDeployments(deployment.id);
    } catch (registerError) {
      setError(registerError.message);
    } finally {
      setSaving(false);
    }
  }

  async function updateVersion(version, updates) {
    const token = localStorage.getItem('vizzio_token');
    if (!token || !deployment) return;

    setBusyVersion(version.id);
    setError('');
    try {
      await updateDeploymentVersion(token, deployment.id, version.id, updates);
      await loadDeployments(deployment.id);
    } catch (updateError) {
      setError(updateError.message);
    } finally {
      setBusyVersion('');
    }
  }

  return (
    <main className="version-page">
      <header className="version-heading">
        <div>
          <p className="page-overline">Release catalog</p>
          <h1>Version management</h1>
          <p>Register release folders, choose a channel, and control publication status.</p>
        </div>
        <button className="primary-btn" type="button" disabled={!deployment} onClick={() => setShowForm((open) => !open)}>
          {showForm ? 'Cancel' : '+ Register Version'}
        </button>
      </header>

      <div className="version-toolbar">
        <label className="version-filter">
          Deployment
          <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)} disabled={loading || deployments.length === 0}>
            {deployments.length === 0 && <option value="">No deployments available</option>}
            {deployments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
      </div>

      {showForm && deployment && (
        <form className="version-register-card" onSubmit={handleRegister}>
          <div className="form-heading">
            <h2>Register a version for {deployment.name}</h2>
            <p>The version starts as a draft so it can be reviewed before release.</p>
          </div>
          <label>
            Version number
            <input value={form.versionNumber} onChange={(event) => setForm({ ...form, versionNumber: event.target.value })} placeholder="v1.3.0" required />
          </label>
          <label>
            Release channel
            <select value={form.releaseType} onChange={(event) => setForm({ ...form, releaseType: event.target.value })}>
              <option value="stable">Stable</option>
              <option value="beta">Beta</option>
            </select>
          </label>
          <label className="version-path-field">
            Release folder
            <input value={form.packagePath} onChange={(event) => setForm({ ...form, packagePath: event.target.value })} placeholder="D:\\Releases\\DigitalTwin\\v1.3.0" required />
          </label>
          <label>
            File name <span>(optional)</span>
            <input value={form.fileName} onChange={(event) => setForm({ ...form, fileName: event.target.value })} placeholder="digital-twin-v1.3.0.zip" />
          </label>
          <label>
            File type <span>(optional)</span>
            <input value={form.fileType} onChange={(event) => setForm({ ...form, fileType: event.target.value })} placeholder="application/zip" />
          </label>
          <label>
            Package size in bytes <span>(optional)</span>
            <input type="number" min="0" step="1" value={form.packageSize} onChange={(event) => setForm({ ...form, packageSize: event.target.value })} placeholder="1073741824" />
          </label>
          <label className="version-checksum-field">
            Checksum <span>(optional)</span>
            <input value={form.checksum} onChange={(event) => setForm({ ...form, checksum: event.target.value })} placeholder="SHA-256 checksum" />
          </label>
          <div className="version-form-actions">
            <button className="primary-btn" type="submit" disabled={saving}>{saving ? 'Registering...' : 'Register version'}</button>
          </div>
        </form>
      )}

      {error && <p className="version-message error">{error}</p>}

      <section className="version-list-card">
        <div className="version-list-heading">
          <div>
            <h2>{deployment?.name || 'Versions'}</h2>
            <p>{deployment ? `${deployment.versions.length} registered versions` : 'Create a deployment before registering versions.'}</p>
          </div>
        </div>

        {loading ? (
          <p className="version-empty">Loading versions...</p>
        ) : !deployment || deployment.versions.length === 0 ? (
          <div className="version-empty">
            <h3>No versions registered</h3>
            <p>Register a release folder to create the first draft.</p>
          </div>
        ) : (
          <div className="version-table-wrap">
            <table className="version-table">
              <thead><tr><th>Version</th><th>Package</th><th>Channel</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
              <tbody>
                {deployment.versions.map((version) => {
                  const busy = busyVersion === version.id;
                  return (
                    <tr key={version.id}>
                      <td><strong>{version.versionNumber}</strong></td>
                      <td>
                        <div className="version-package-details">
                          <strong>{version.fileName || 'Folder release'}</strong>
                          <span className="version-path" title={version.packagePath || ''}>{version.packagePath || 'Path not set'}</span>
                          <span>{version.fileType || 'Type not set'} · {formatPackageSize(version.packageSize)}</span>
                          {version.checksum && <span className="version-checksum" title={version.checksum}>Checksum: {version.checksum}</span>}
                        </div>
                      </td>
                      <td>
                        <button className={`channel-toggle channel-${version.releaseType}`} type="button" disabled={busy} onClick={() => updateVersion(version, { releaseType: version.releaseType === 'stable' ? 'beta' : 'stable' })}>
                          {version.releaseType}
                        </button>
                      </td>
                      <td><span className={`version-status status-${version.status}`}>{version.status}</span></td>
                      <td>{new Date(version.createdAt).toLocaleDateString()}</td>
                      <td>
                        <div className="version-actions">
                          {version.status !== 'released' && <button className="release-btn" type="button" disabled={busy} onClick={() => updateVersion(version, { status: 'released' })}>Release</button>}
                          {version.status !== 'archived' && <button className="archive-btn" type="button" disabled={busy} onClick={() => updateVersion(version, { status: 'archived' })}>Archive</button>}
                          {version.status === 'archived' && <button className="draft-btn" type="button" disabled={busy} onClick={() => updateVersion(version, { status: 'draft' })}>Restore draft</button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
