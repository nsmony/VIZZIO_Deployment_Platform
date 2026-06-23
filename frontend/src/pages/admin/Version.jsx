import { useEffect, useMemo, useState } from 'react';
import {
  deleteDeploymentVersion,
  fetchDeployments,
  registerDeploymentVersion,
  updateDeploymentVersion,
  uploadPackage,
  validateDeploymentPackage,
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
  const [selectedFile, setSelectedFile] = useState(null);
  const [packageValidated, setPackageValidated] = useState(false);
  const [validatingPackage, setValidatingPackage] = useState(false);

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
      let nextForm = { ...form };
      if (selectedFile) {
        const uploaded = await uploadPackage(token, selectedFile, `${deployment.name} ${form.versionNumber}`.trim());
        const uploadedPackage = uploaded.package;
        nextForm = {
          ...nextForm,
          packagePath: uploadedPackage.fileId,
          fileName: uploadedPackage.originalName,
          fileType: selectedFile.type || nextForm.fileType,
          packageSize: String(uploadedPackage.size),
          checksum: uploadedPackage.checksum || nextForm.checksum,
        };
      }

      await registerDeploymentVersion(token, deployment.id, nextForm);
      setForm(emptyVersion);
      setSelectedFile(null);
      setPackageValidated(false);
      setShowForm(false);
      await loadDeployments(deployment.id);
    } catch (registerError) {
      setError(registerError.message);
    } finally {
      setSaving(false);
    }
  }

  function updatePackagePath(value) {
    setSelectedFile(null);
    setPackageValidated(false);
    setForm({
      ...form,
      packagePath: value,
      fileName: '',
      fileType: '',
      packageSize: '',
      checksum: '',
    });
  }

  async function handleValidatePackage() {
    const token = localStorage.getItem('vizzio_token');
    if (!token) return;

    setValidatingPackage(true);
    setError('');
    try {
      const result = await validateDeploymentPackage(token, form.packagePath);
      const packageInfo = result.package;
      setForm((current) => ({
        ...current,
        fileName: packageInfo.fileName || '',
        fileType: packageInfo.fileType || '',
        packageSize: packageInfo.packageSize || '',
        checksum: packageInfo.checksum || '',
      }));
      setPackageValidated(true);
    } catch (validationError) {
      setPackageValidated(false);
      setError(validationError.message);
    } finally {
      setValidatingPackage(false);
    }
  }

  async function handleDeleteVersion(version) {
    const token = localStorage.getItem('vizzio_token');
    if (!token || !window.confirm(`Delete version ${version.versionNumber}? The package file will remain on the server.`)) return;

    setBusyVersion(version.id);
    setError('');
    try {
      await deleteDeploymentVersion(token, version.id);
      await loadDeployments(deployment.id);
    } catch (deleteError) {
      setError(deleteError.message);
    } finally {
      setBusyVersion('');
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
            Server package path
            <input value={form.packagePath} onChange={(event) => updatePackagePath(event.target.value)} placeholder="/var/vizzio/packages/digital-twin-v1.3.0.zip" required />
          </label>
          <div className="version-form-actions">
            <button className="secondary-btn" type="button" disabled={validatingPackage || !form.packagePath || Boolean(selectedFile)} onClick={handleValidatePackage}>
              {validatingPackage ? 'Validating...' : 'Validate package'}
            </button>
            {packageValidated && <span className="version-validation-ok">Package validated</span>}
          </div>
          <label className="version-file-field">
            Upload small package <span>(optional)</span>
            <input
              type="file"
              onChange={(event) => {
                const file = event.target.files?.[0] || null;
                setSelectedFile(file);
                setPackageValidated(false);
                if (file) {
                  setForm({
                    ...form,
                    packagePath: file.name,
                    fileName: file.name,
                    fileType: file.type || form.fileType,
                    packageSize: String(file.size),
                  });
                }
              }}
            />
          </label>
          <label>
            File name
            <input value={form.fileName} readOnly placeholder="Validate a server package first" />
          </label>
          <label>
            File type
            <input value={form.fileType} readOnly placeholder="application/zip" />
          </label>
          <label>
            Package size in bytes
            <input type="number" min="0" step="1" value={form.packageSize} readOnly placeholder="1073741824" />
          </label>
          <label className="version-checksum-field">
            Checksum
            <input value={form.checksum} readOnly placeholder="SHA-256 checksum" />
          </label>
          <div className="version-form-actions">
            <button className="primary-btn" type="submit" disabled={saving || (!selectedFile && !packageValidated)}>{saving ? 'Registering...' : 'Register version'}</button>
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
                          <button className="delete-btn" type="button" disabled={busy} onClick={() => handleDeleteVersion(version)}>Delete</button>
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
