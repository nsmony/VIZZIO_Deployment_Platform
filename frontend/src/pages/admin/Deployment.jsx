import { useEffect, useMemo, useState } from 'react';
import {
  archiveDeployment,
  createDeployment,
  deleteDeployment,
  fetchDeploymentDetails,
  fetchDeployments,
  restoreDeployment,
  updateDeployment,
} from '../../api';
import { useNavigate } from 'react-router-dom';
import DeploymentCard from '../../components/deployment/DeploymentCard';
import DeploymentStatCard from '../../components/deployment/DeploymentStatCard';
import FilterToolbar from '../../components/deployment/FilterToolbar';
import StatusBadge from '../../components/deployment/StatusBadge';
import '../../styles/Deployment.css';

const emptyForm = { name: '', description: '', logoUrl: '' };
const pageSizeOptions = [6, 9, 12];

export default function Deployment() {
  const navigate = useNavigate();
  // Main page data and form state.
  const [deployments, setDeployments] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  const [editingDeployment, setEditingDeployment] = useState(null);
  const [detailDeployment, setDetailDeployment] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [channelFilter, setChannelFilter] = useState('all');
  const [sortMode, setSortMode] = useState('recent');
  const [viewMode, setViewMode] = useState('grid');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);
  const [openMenuId, setOpenMenuId] = useState(null);

  // Load all deployments shown in the table/cards.
  async function loadDeployments() {
    const token = localStorage.getItem('vizzio_token');
    if (!token) return;

    setLoading(true);
    try {
      const result = await fetchDeployments(token);
      setDeployments((result.deployments || []).map(enrichDeployment));
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

  // Go back to the first page whenever filters change.
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, channelFilter, sortMode, pageSize]);

  useEffect(() => {
    if (openMenuId === null) return undefined;

    function closeMenuOnOutsideClick(event) {
      if (!event.target.closest?.('.deployment-more')) {
        setOpenMenuId(null);
      }
    }

    function closeMenuOnEscape(event) {
      if (event.key === 'Escape') setOpenMenuId(null);
    }

    document.addEventListener('pointerdown', closeMenuOnOutsideClick);
    document.addEventListener('keydown', closeMenuOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeMenuOnOutsideClick);
      document.removeEventListener('keydown', closeMenuOnEscape);
    };
  }, [openMenuId]);

  // Calculate summary numbers from the loaded deployments.
  const kpis = useMemo(() => {
    const totalVersions = deployments.reduce((sum, deployment) => sum + deployment.versionCount, 0);
    const activeDeployments = deployments.filter((deployment) => deployment.displayStatus === 'Active').length;
    const archivedDeployments = deployments.filter((deployment) => deployment.displayStatus === 'Archived').length;
    const activePercent = deployments.length ? Math.round((activeDeployments / deployments.length) * 1000) / 10 : 0;

    return {
      total: deployments.length,
      active: activeDeployments,
      versions: totalVersions,
      archived: archivedDeployments,
      activePercent,
    };
  }, [deployments]);

  // Apply search, status filter, and sorting before pagination.
  const filteredDeployments = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const filtered = deployments.filter((deployment) => {
      const matchesSearch =
        !normalizedSearch ||
        deployment.name.toLowerCase().includes(normalizedSearch) ||
        String(deployment.description || '').toLowerCase().includes(normalizedSearch);
      const matchesStatus = statusFilter === 'all' || deployment.displayStatus === statusFilter;
      const matchesChannel =
        channelFilter === 'all' ||
        deployment.versions.some((version) => version.releaseType === channelFilter);
      return matchesSearch && matchesStatus && matchesChannel;
    });

    return filtered.sort((a, b) => {
      if (sortMode === 'az') return a.name.localeCompare(b.name);
      if (sortMode === 'za') return b.name.localeCompare(a.name);
      if (sortMode === 'versions') return b.versionCount - a.versionCount;
      if (sortMode === 'oldest') return new Date(a.createdRaw) - new Date(b.createdRaw);
      return new Date(b.createdRaw) - new Date(a.createdRaw);
    });
  }, [deployments, search, statusFilter, channelFilter, sortMode]);

  const pageCount = Math.max(1, Math.ceil(filteredDeployments.length / pageSize));
  const pagedDeployments = filteredDeployments.slice((page - 1) * pageSize, page * pageSize);

  // Create a new deployment or save changes to an existing one.
  async function handleSave(event) {
    event.preventDefault();
    const validationError = validateForm(form);
    if (validationError) {
      setToast({ type: 'error', message: validationError });
      return;
    }

    const token = localStorage.getItem('vizzio_token');
    if (!token) return;

    setSaving(true);
    setError('');
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        logoUrl: form.logoUrl.trim(),
      };

      if (editingDeployment) {
        await updateDeployment(token, editingDeployment.id, payload);
        setToast({ type: 'success', message: 'Deployment updated.' });
      } else {
        await createDeployment(token, payload);
        setToast({ type: 'success', message: 'Deployment created.' });
      }

      closeForm();
      await loadDeployments();
    } catch (saveError) {
      setToast({ type: 'error', message: saveError.message });
    } finally {
      setSaving(false);
    }
  }

  // Fetch full details only when the admin opens the detail modal.
  async function handleView(deployment) {
    const token = localStorage.getItem('vizzio_token');
    if (!token) return;

    setDetailLoading(true);
    setOpenMenuId(null);
    try {
      const result = await fetchDeploymentDetails(token, deployment.id);
      setDetailDeployment(enrichDeployment(result.deployment));
    } catch (viewError) {
      setToast({ type: 'error', message: viewError.message });
    } finally {
      setDetailLoading(false);
    }
  }

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  // Reset the form for creating a new deployment.
  function openCreateForm() {
    setEditingDeployment(null);
    setForm(emptyForm);
    setShowForm(true);
    setError('');
  }

  // Fill the form with the selected deployment for editing.
  function openEditForm(deployment) {
    setEditingDeployment(deployment);
    setForm({
      name: deployment.name || '',
      description: deployment.description || '',
      logoUrl: deployment.logoUrl || '',
    });
    setShowForm(true);
    setOpenMenuId(null);
    setError('');
  }

  // Close the form and remove any edit state.
  function closeForm() {
    setEditingDeployment(null);
    setForm(emptyForm);
    setShowForm(false);
  }

  // Copying the ID helps admins share or debug a deployment record.
  async function copyDeploymentId(deployment) {
    setOpenMenuId(null);
    try {
      await navigator.clipboard.writeText(deployment.id);
      setToast({ type: 'success', message: 'Deployment ID copied.' });
    } catch {
      setToast({ type: 'error', message: 'Could not copy deployment ID.' });
    }
  }

  async function handleDeploymentLifecycle(deployment, action) {
    const token = localStorage.getItem('vizzio_token');
    if (!token) return;

    setOpenMenuId(null);
    try {
      if (action === 'delete') {
        if (!window.confirm(`Delete deployment ${deployment.name}? All version records for this deployment will also be removed.`)) return;
        await deleteDeployment(token, deployment.id);
        setDeployments((current) => current.filter((item) => item.id !== deployment.id));
        setDetailDeployment(null);
        setToast({ type: 'success', message: 'Deployment deleted.' });
        return;
      }

      const result = action === 'archive'
        ? await archiveDeployment(token, deployment.id)
        : await restoreDeployment(token, deployment.id);
      const updated = enrichDeployment(result.deployment);
      setDeployments((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setDetailDeployment((current) => (current?.id === updated.id ? updated : current));
      setToast({ type: 'success', message: action === 'archive' ? 'Deployment archived.' : 'Deployment restored to draft.' });
    } catch (actionError) {
      setToast({ type: 'error', message: actionError.message });
    }
  }

  return (
    <main className="deployment-page">

      <FilterToolbar
        search={search}
        status={statusFilter}
        channel={channelFilter}
        sort={sortMode}
        viewMode={viewMode}
        onSearchChange={setSearch}
        onStatusChange={setStatusFilter}
        onChannelChange={setChannelFilter}
        onSortChange={setSortMode}
        onViewModeChange={setViewMode}
        onCreate={openCreateForm}
      />

      <section className="deployment-kpi-grid">
        <DeploymentStatCard title="Total Deployments" value={kpis.total} helper="All time" tone="blue" icon="deployments" active={statusFilter === 'all'} onClick={() => setStatusFilter('all')} />
        <DeploymentStatCard title="Active Deployments" value={kpis.active} helper={`${kpis.activePercent}% of total`} tone="green" icon="active" active={statusFilter === 'Active'} onClick={() => setStatusFilter('Active')} />
        <DeploymentStatCard title="Total Versions" value={kpis.versions} helper="Across all deployments" tone="purple" icon="versions" />
        <DeploymentStatCard title="Archived Deployments" value={kpis.archived} helper={kpis.archived ? 'Click to review' : 'None archived'} tone="red" icon="archive" active={statusFilter === 'Archived'} onClick={() => setStatusFilter('Archived')} />
      </section>

      {toast && (
        <div className={`deployment-toast ${toast.type}`} role="status">
          <span>{toast.message}</span>
          <button type="button" onClick={() => setToast(null)} aria-label="Dismiss message">x</button>
        </div>
      )}

      {error && <p className="deployment-status error">{error}</p>}

      {showForm && (
        <form className="deployment-create-card" onSubmit={handleSave}>
          <div className="form-heading">
            <span className="deployment-form-heading-icon"><DetailIcon name={editingDeployment ? 'edit' : 'package'} /></span>
            <div>
              <h2>{editingDeployment ? 'Edit deployment' : 'New deployment'}</h2>
              <p>{editingDeployment ? 'Update product details shown in the deployment catalog.' : 'Create a deployment shell, then register versions from Version Management.'}</p>
            </div>
          </div>
          <label className="deployment-form-field">
            <span className="deployment-field-title">Name <em>Required</em></span>
            <small>The name administrators and launcher users will see.</small>
            <span className="deployment-input-shell">
              <DetailIcon name="text" />
              <input name="name" value={form.name} onChange={updateField} placeholder="Digital Twin" required />
            </span>
          </label>
          <label className="deployment-form-field">
            <span className="deployment-field-title">Logo URL <em className="optional">Optional</em></span>
            <small>Link to a square logo image in SVG, PNG, or JPG format.</small>
            <span className="deployment-input-shell">
              <DetailIcon name="link" />
              <input name="logoUrl" value={form.logoUrl} onChange={updateField} placeholder="https://..." />
            </span>
          </label>
          <label className="deployment-description-field deployment-form-field">
            <span className="deployment-field-title">Description shown in deployment cards <em className="optional">Optional</em></span>
            <small>This short description appears beneath the deployment name.</small>
            <span className="deployment-input-shell textarea">
              <DetailIcon name="message" />
              <textarea name="description" value={form.description} onChange={updateField} placeholder="Type a concise description" rows="3" />
            </span>
          </label>
          <aside className="deployment-form-note">
            <span><DetailIcon name="info" /></span>
            <div>
              <strong>About this information</strong>
              <p>These details help administrators identify and organize deployments across the platform.</p>
            </div>
          </aside>
          <div className="deployment-form-actions">
            <button className="secondary-btn" type="button" onClick={closeForm}>Cancel</button>
            <button className="primary-btn" type="submit" disabled={saving}>
              {saving ? 'Saving...' : editingDeployment ? 'Save deployment' : 'Create deployment'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <section className="deployment-loading" aria-label="Loading deployments">
          {Array.from({ length: 6 }).map((_, index) => <div className="deployment-card-skeleton" key={index} />)}
        </section>
      ) : filteredDeployments.length === 0 ? (
        <section className="deployment-empty-state">
          <h2>No deployments found</h2>
          <p>{deployments.length ? 'Try another search, status, or sort option.' : 'Create the first deployment to begin registering releases.'}</p>
          <button className="primary-btn" type="button" onClick={openCreateForm}>+ New Deployment</button>
        </section>
      ) : (
        <>
          <section className={viewMode === 'list' ? 'deployment-card-grid list' : 'deployment-card-grid'}>
            {pagedDeployments.map((deployment) => (
              <DeploymentCard
                key={deployment.id}
                deployment={deployment}
                onView={handleView}
                onEdit={openEditForm}
                onToggleMenu={(id) => setOpenMenuId((current) => (current === id ? null : id))}
                menuOpen={openMenuId === deployment.id}
                onCopyId={copyDeploymentId}
                onArchive={(item) => handleDeploymentLifecycle(item, 'archive')}
                onRestore={(item) => handleDeploymentLifecycle(item, 'restore')}
                onDelete={(item) => handleDeploymentLifecycle(item, 'delete')}
              />
            ))}
          </section>

          <footer className="deployment-pagination">
            <p>Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, filteredDeployments.length)} of {filteredDeployments.length} deployments</p>
            <div className="deployment-pages">
              <button type="button" disabled={page === 1} onClick={() => setPage((current) => current - 1)} aria-label="Previous page">&lt;</button>
              {Array.from({ length: pageCount }).slice(0, 5).map((_, index) => {
                const pageNumber = index + 1;
                return (
                  <button
                    type="button"
                    key={pageNumber}
                    className={page === pageNumber ? 'active' : ''}
                    onClick={() => setPage(pageNumber)}
                  >
                    {pageNumber}
                  </button>
                );
              })}
              <button type="button" disabled={page === pageCount} onClick={() => setPage((current) => current + 1)} aria-label="Next page">&gt;</button>
            </div>
            <label>
              Rows per page:
              <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
                {pageSizeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
          </footer>
        </>
      )}

      {(detailDeployment || detailLoading) && (
        <div className="deployment-modal-backdrop" role="presentation" onClick={() => setDetailDeployment(null)}>
          <section className="deployment-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            {detailLoading ? (
              <p className="deployment-muted">Loading deployment details...</p>
            ) : (
              <>
                <header className="deployment-detail-header">
                  <div className="deployment-detail-identity">
                    <div className="deployment-detail-logo">
                      {detailDeployment.logoUrl
                        ? <img src={detailDeployment.logoUrl} alt="" />
                        : detailDeployment.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <div className="deployment-detail-title">
                        <h2>{detailDeployment.name}</h2>
                        <StatusBadge status={detailDeployment.displayStatus} />
                      </div>
                      <p>{detailDeployment.description || 'No description provided.'}</p>
                    </div>
                  </div>
                  <button className="deployment-detail-close" type="button" onClick={() => setDetailDeployment(null)} aria-label="Close deployment details" />
                </header>
                <dl className="deployment-detail-grid">
                  <div>
                    <span className="deployment-detail-metric-icon blue"><DetailIcon name="versions" /></span>
                    <span><dt>Versions</dt><dd>{detailDeployment.versionCount}</dd></span>
                  </div>
                  <div>
                    <span className="deployment-detail-metric-icon green"><DetailIcon name="released" /></span>
                    <span><dt>Released</dt><dd>{detailDeployment.releasedCount}</dd></span>
                  </div>
                  <div>
                    <span className="deployment-detail-metric-icon purple"><DetailIcon name="created" /></span>
                    <span><dt>Created</dt><dd>{detailDeployment.createdLabel}</dd></span>
                  </div>
                </dl>
                <section className="deployment-version-section">
                  <div className="deployment-version-heading">
                    <div>
                      <h3>Versions</h3>
                      <p>Registered package releases for this deployment.</p>
                    </div>
                  </div>
                  {detailDeployment.displayStatus === 'Archived' && (
                    <p className="deployment-muted">This deployment is archived. Restore it from deployment actions to move archived versions back to draft.</p>
                  )}
                  {detailDeployment.versions.length === 0 ? (
                    <div className="deployment-version-empty">
                      <span><DetailIcon name="package" /></span>
                      <strong>No versions yet</strong>
                      <p>This deployment doesn&apos;t have any registered package versions.</p>
                      <button
                        type="button"
                        onClick={() => {
                          const deploymentId = detailDeployment.id;
                          setDetailDeployment(null);
                          navigate(`/version?deploymentId=${encodeURIComponent(deploymentId)}&register=1`);
                        }}
                      >
                        Register a version to get started
                      </button>
                    </div>
                  ) : (
                    <div className="deployment-version-list">
                      {detailDeployment.versions.map((version) => (
                        <div key={version.id}>
                          <div>
                            <strong>{version.versionNumber}</strong>
                            {version.description && <p>{version.description}</p>}
                          </div>
                          <span>{version.releaseType}</span>
                          <span>{version.status}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
                <footer className="deployment-detail-footer">
                  <button className="secondary-btn" type="button" onClick={() => setDetailDeployment(null)}>Close</button>
                  <button className="primary-btn" type="button" onClick={() => { const item = detailDeployment; setDetailDeployment(null); openEditForm(item); }}>Edit deployment</button>
                </footer>
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

function DetailIcon({ name }) {
  const paths = {
    versions: 'M5 5h14v14H5V5Zm4 4h6v6H9V9Z',
    released: 'M7 4v3m10-3v3M5 9h14v10H5V9Zm4 4h6',
    created: 'M7 4v3m10-3v3M5 9h14v10H5V9Zm4 4h2m2 0h2m-6 3h2',
    package: 'M4 7 12 3l8 4-8 4-8-4Zm0 0v10l8 4 8-4V7m-8 4v10',
    edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5Z',
    text: 'M5 6h14M12 6v12m-4 0h8',
    link: 'M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1',
    message: 'M4 5h16v12H8l-4 4V5Zm4 4h8m-8 4h5',
    info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-10v6m0-10h.01',
  };

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={paths[name] || paths.package} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Add display-only fields used by this page.
function enrichDeployment(deployment) {
  const versions = deployment.versions || [];
  const releasedCount = versions.filter((version) => version.status === 'released').length;
  const archivedCount = versions.filter((version) => version.status === 'archived').length;
  const archiveLikeCount = versions.filter((version) => version.status === 'archived').length;
  const displayStatus = versions.length > 0 && archiveLikeCount === versions.length
      ? 'Archived'
      : releasedCount > 0
        ? 'Active'
        : versions.length > 0
          ? 'Draft'
          : 'Inactive';

  return {
    ...deployment,
    versions,
    versionCount: versions.length,
    releasedCount,
    archivedCount,
    displayStatus,
    createdRaw: deployment.created || deployment.createdAt || new Date().toISOString(),
    createdLabel: formatDate(deployment.created || deployment.createdAt),
  };
}

// Format backend dates for the UI.
function formatDate(value) {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

// Keep basic validation close to the form.
function validateForm(form) {
  if (!form.name.trim()) return 'Deployment name is required.';
  if (form.logoUrl.trim()) {
    try {
      new URL(form.logoUrl.trim());
    } catch {
      return 'Logo URL must be a valid URL.';
    }
  }
  return '';
}
