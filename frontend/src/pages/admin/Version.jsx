import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  deleteDeploymentVersion,
  fetchDeploymentDetails,
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
  status: 'draft',
  sourceType: 'stagingFolder',
  packagePath: '',
  fileName: '',
  fileType: '',
  packageSize: '',
  checksum: '',
  batchScriptName: '',
  description: '',
};

// Convert package bytes into a readable label.
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
  // Store deployments and the currently selected deployment.
  const [deployments, setDeployments] = useState([]);
  const [selectedId, setSelectedId] = useState('');

  // Store the register-version form state.
  const [form, setForm] = useState(emptyVersion);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyVersion, setBusyVersion] = useState('');
  const [error, setError] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [packageValidated, setPackageValidated] = useState(false);
  const [validatingPackage, setValidatingPackage] = useState(false);
  const [detailsVersion, setDetailsVersion] = useState(null);
  const [detailsDescription, setDetailsDescription] = useState('');
  const [savingDetails, setSavingDetails] = useState(false);

  const deployment = useMemo(
    () => deployments.find((item) => item.id === selectedId) || null,
    [deployments, selectedId]
  );

  // Reload deployments after changes so generated metadata stays up to date.
  async function loadDeployments(preferredId) {
    const token = localStorage.getItem('vizzio_token');
    if (!token) return;

    setLoading(true);
    try {
      const result = await fetchDeployments(token);
      const items = result.deployments || [];
      const selectedDeploymentId = preferredId || selectedId || items[0]?.id || '';
      let deploymentsWithDetails = items;

      if (selectedDeploymentId) {
        const detailsResult = await fetchDeploymentDetails(token, selectedDeploymentId);
        if (detailsResult?.deployment) {
          deploymentsWithDetails = items.map((item) =>
            item.id === selectedDeploymentId ? detailsResult.deployment : item
          );
        }
      }

      setDeployments(deploymentsWithDetails);
      setSelectedId(selectedDeploymentId);
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

  // Register a version after upload or package validation is complete.
  async function handleRegister(event) {
    event.preventDefault();
    const token = localStorage.getItem('vizzio_token');
    if (!token || !deployment) return;

    setSaving(true);
    setError('');
    try {
      let nextForm = { ...form };
      if (selectedFile) {
        // Upload first so the backend can return file metadata.
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
      setDetailsVersion(null);
      setShowForm(false);
      await loadDeployments(deployment.id);
    } catch (registerError) {
      setError(registerError.message);
    } finally {
      setSaving(false);
    }
  }

  // Clear package metadata when the path changes.
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
      batchScriptName: '',
    });
  }

  async function handleValidatePackage() {
    const token = localStorage.getItem('vizzio_token');
    if (!token) return;

    setValidatingPackage(true);
    setError('');
    try {
      // Ask the backend to check the path and calculate package details.
      const result = await validateDeploymentPackage(token, form.packagePath, form.sourceType);
      const packageInfo = result.package;
      setForm((current) => ({
        ...current,
        sourceType: packageInfo.packageSource || current.sourceType,
        fileName: packageInfo.fileName || '',
        fileType: packageInfo.fileType || '',
        packageSize: packageInfo.packageSize || '',
        checksum: packageInfo.checksum || '',
        batchScriptName: packageInfo.batchScriptName || '',
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

    // Delete only the catalog record; the package file stays on the server.
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

    // Block repeated clicks while this version is updating.
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

  async function handleSaveDetails() {
    const token = localStorage.getItem('vizzio_token');
    if (!token || !deployment || !detailsVersion) return;

    setSavingDetails(true);
    setError('');
    try {
      await updateDeploymentVersion(token, deployment.id, detailsVersion.id, {
        description: detailsDescription,
      });
      await loadDeployments(deployment.id);
      setDetailsVersion(null);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSavingDetails(false);
    }
  }

  return (
    <main className="version-page">
      <header className="version-heading">
        <div>
          <p>Register release folders, choose a channel, and control publication status.</p>
        </div>
        <button className="primary-btn" type="button" disabled={!deployment} onClick={() => setShowForm((open) => !open)}>
          {showForm ? 'Cancel' : '+ Register Version'}
        </button>
      </header>

      <div className="version-toolbar">
        <label className="version-filter">
          Deployment
          <select value={selectedId} onChange={(event) => loadDeployments(event.target.value)} disabled={loading || deployments.length === 0}>
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
          <label>
            Package source
            <select
              value={form.sourceType}
              onChange={(event) => {
                // Reset package fields when the source type changes.
                setSelectedFile(null);
                setPackageValidated(false);
                setForm({ ...form, sourceType: event.target.value, packagePath: '', fileName: '', fileType: '', packageSize: '', checksum: '', batchScriptName: '', description: form.description });
              }}
            >
              <option value="stagingFolder">Server staging folder</option>
              <option value="serverArchive">Server archive path</option>
              <option value="upload">Upload archive</option>
            </select>
          </label>
          <label className="version-path-field">
            {form.sourceType === 'stagingFolder' ? 'Server staging folder path' : 'Server archive path'}
            <input
              value={form.packagePath}
              onChange={(event) => updatePackagePath(event.target.value)}
              placeholder={form.sourceType === 'stagingFolder' ? '/var/vizzio/packages/digital-twin/v1.3.0' : '/var/vizzio/packages/digital-twin-v1.3.0.zip'}
              required={form.sourceType !== 'upload'}
              disabled={form.sourceType === 'upload'}
            />
          </label>
          {form.sourceType !== 'upload' && (
            <div className="version-form-actions">
              <button className="secondary-btn" type="button" disabled={validatingPackage || !form.packagePath || Boolean(selectedFile)} onClick={handleValidatePackage}>
                {validatingPackage ? 'Validating...' : form.sourceType === 'stagingFolder' ? 'Validate folder' : 'Validate archive'}
              </button>
              {packageValidated && <span className="version-validation-ok">{form.sourceType === 'stagingFolder' ? 'Folder ready for packaging' : 'Archive validated'}</span>}
            </div>
          )}
          {form.sourceType === 'upload' && <label className="version-file-field">
            Upload package archive
            <input
              type="file"
              accept=".zip,.7z,application/zip,application/x-7z-compressed"
              onChange={(event) => {
                const file = event.target.files?.[0] || null;
                // Fill basic file details before upload.
                setSelectedFile(file);
                setPackageValidated(false);
                if (file) {
                  setForm({
                    ...form,
                    sourceType: 'upload',
                    packagePath: file.name,
                    fileName: file.name,
                    fileType: file.type || form.fileType,
                    packageSize: String(file.size),
                  });
                }
              }}
            />
          </label>}
          <label>
            Initial status
            <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
              <option value="draft">Draft</option>
              <option value="released">Released</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          <label>
            Description
            <textarea
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              placeholder="Describe what's included in this version"
              rows="3"
            />
          </label>
          <label>
            File name
            <input value={form.fileName} readOnly placeholder={form.sourceType === 'stagingFolder' ? 'Generated when the version is registered' : 'Validate or upload a package first'} />
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
            <button className="primary-btn" type="submit" disabled={saving || (form.sourceType === 'upload' ? !selectedFile : !packageValidated)}>{saving ? 'Registering...' : 'Register version'}</button>
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
                {groupVersions(deployment.versions).map((group) => (
                  <Fragment key={group.key}>
                    <tr className="version-group-row">
                      <td colSpan="6">{group.label}</td>
                    </tr>
                    {group.versions.map((version) => {
                      const busy = busyVersion === version.id;
                      return (
                        <tr key={version.id}>
                          <td><strong>{version.versionNumber}</strong></td>
                          <td>
                            <div className="version-package-details">
                              <strong>{version.fileName || 'Generated package'}</strong>
                              <span className="version-path" title={version.packagePath || ''}>{version.packagePath || 'Path not set'}</span>
                              <span>{version.packageSource || 'package'} - {version.fileType || 'Type not set'} - {formatPackageSize(version.packageSize)}</span>
                              {version.description && <span className="version-description-preview" title={version.description}>{version.description}</span>}
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
                              <button
                                className="details-btn"
                                type="button"
                                disabled={busy}
                                onClick={() => {
                                  setDetailsVersion(version);
                                  setDetailsDescription(version.description || '');
                                }}
                              >
                                Details
                              </button>
                              {version.status !== 'released' && <button className="release-btn" type="button" disabled={busy} onClick={() => updateVersion(version, { status: 'released' })}>Release</button>}
                              {version.status !== 'archived' && <button className="archive-btn" type="button" disabled={busy} onClick={() => updateVersion(version, { status: 'archived' })}>Archive</button>}
                              {version.status === 'archived' && <button className="draft-btn" type="button" disabled={busy} onClick={() => updateVersion(version, { status: 'draft' })}>Restore draft</button>}
                              <button className="delete-btn" type="button" disabled={busy} onClick={() => handleDeleteVersion(version)}>Delete</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {detailsVersion && (
        <div className="version-modal-backdrop" onClick={() => setDetailsVersion(null)} role="presentation">
          <section
            className="version-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Version details"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="version-modal-header">
              <h3>{detailsVersion.versionNumber}</h3>
              <button type="button" className="details-close-btn" onClick={() => setDetailsVersion(null)}>
                Close
              </button>
            </header>
            <dl className="version-modal-grid">
              <div>
                <dt>Name</dt>
                <dd>{detailsVersion.versionNumber}</dd>
              </div>
              <div>
                <dt>File</dt>
                <dd>{detailsVersion.fileName || 'Generated package'}</dd>
              </div>
              <div>
                <dt>Size</dt>
                <dd>{formatPackageSize(detailsVersion.packageSize)}</dd>
              </div>
              <div>
                <dt>Type</dt>
                <dd>{detailsVersion.fileType || 'Not set'}</dd>
              </div>
              <div>
                <dt>Channel</dt>
                <dd>{titleCase(detailsVersion.releaseType)}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{titleCase(detailsVersion.status)}</dd>
              </div>
              <div className="version-modal-full">
                <dt>Description</dt>
                <dd>
                  <textarea
                    className="version-modal-textarea"
                    value={detailsDescription}
                    onChange={(event) => setDetailsDescription(event.target.value)}
                    rows="4"
                    placeholder="No description provided"
                  />
                </dd>
              </div>
              <div className="version-modal-full">
                <dt>Package path</dt>
                <dd className="version-mono">{detailsVersion.packagePath || 'Path not set'}</dd>
              </div>
              <div className="version-modal-full">
                <dt>Checksum</dt>
                <dd className="version-mono">{detailsVersion.checksum || 'Not available'}</dd>
              </div>
              <div>
                <dt>Created</dt>
                <dd>{new Date(detailsVersion.createdAt).toLocaleString()}</dd>
              </div>
              <div>
                <dt>Released</dt>
                <dd>{detailsVersion.releasedAt ? new Date(detailsVersion.releasedAt).toLocaleString() : 'Not released'}</dd>
              </div>
            </dl>
            <footer className="version-modal-actions">
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setDetailsVersion(null)}
                disabled={savingDetails}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary-btn"
                onClick={handleSaveDetails}
                disabled={savingDetails}
              >
                {savingDetails ? 'Saving...' : 'Save description'}
              </button>
            </footer>
          </section>
        </div>
      )}
    </main>
  );
}

function groupVersions(versions) {
  const channelOrder = ['stable', 'beta'];
  const statusOrder = ['released', 'archived', 'draft', 'paused', 'canceled', 'failed'];

  return channelOrder.flatMap((channel) =>
    statusOrder
      .map((status) => {
        const items = versions.filter((version) => version.releaseType === channel && version.status === status);
        return {
          key: `${channel}-${status}`,
          label: `${titleCase(channel)} / ${titleCase(status)} (${items.length})`,
          versions: items,
        };
      })
      .filter((group) => group.versions.length > 0)
  );
}

function titleCase(value) {
  return String(value || '').slice(0, 1).toUpperCase() + String(value || '').slice(1);
}
