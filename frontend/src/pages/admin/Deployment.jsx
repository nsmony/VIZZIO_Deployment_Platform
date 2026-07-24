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
import DeploymentCard from '../../components/deployment/DeploymentCard';
import DeploymentStatCard from '../../components/deployment/DeploymentStatCard';
import FilterToolbar from '../../components/deployment/FilterToolbar';
import StatusBadge from '../../components/deployment/StatusBadge';
import '../../styles/Deployment.css';

const emptyForm = { name: '', description: '', logoUrl: '' };
const pageSizeOptions = [6, 9, 12];

export default function Deployment() {
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
            <h2>{editingDeployment ? 'Edit deployment' : 'New deployment'}</h2>
            <p>{editingDeployment ? 'Update product details shown in the deployment catalog.' : 'Create a deployment shell, then register versions from Version Management.'}</p>
          </div>
          <label>
            Name
            <input name="name" value={form.name} onChange={updateField} placeholder="Digital Twin" required />
          </label>
          <label>
            Logo URL <span>(optional)</span>
            <input name="logoUrl" value={form.logoUrl} onChange={updateField} placeholder="https://..." />
          </label>
          <label className="deployment-description-field">
            Description shown in deployment cards <span>(optional)</span>
            <textarea name="description" value={form.description} onChange={updateField} placeholder="Type a short description, then save the deployment" rows="3" />
          </label>
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
                <header>
                  <div>
                    <h2>{detailDeployment.name}</h2>
                    <p>{detailDeployment.description || 'No description provided.'}</p>
                  </div>
                  <StatusBadge status={detailDeployment.displayStatus} />
                </header>
                <dl className="deployment-detail-grid">
                  <div><dt>Versions</dt><dd>{detailDeployment.versionCount}</dd></div>
                  <div><dt>Released</dt><dd>{detailDeployment.releasedCount}</dd></div>
                  <div><dt>Created</dt><dd>{detailDeployment.createdLabel}</dd></div>
                </dl>
                <div className="deployment-version-list">
                  <h3>Versions</h3>
                  {detailDeployment.displayStatus === 'Archived' && (
                    <p className="deployment-muted">This deployment is archived. Restore it from deployment actions to move archived versions back to draft.</p>
                  )}
                  {detailDeployment.versions.length === 0 ? (
                    <p className="deployment-muted">No versions registered.</p>
                  ) : (
                    detailDeployment.versions.map((version) => (
                      <div key={version.id}>
                        <div>
                          <strong>{version.versionNumber}</strong>
                          {version.description && <p>{version.description}</p>}
                        </div>
                        <span>{version.releaseType}</span>
                        <span>{version.status}</span>
                      </div>
                    ))
                  )}
                </div>
                <footer>
                  <button className="secondary-btn" type="button" onClick={() => setDetailDeployment(null)}>Close</button>
                  <button className="primary-btn" type="button" onClick={() => openEditForm(detailDeployment)}>Edit deployment</button>
                </footer>
              </>
            )}
          </section>
        </div>
      )}
    </main>
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
