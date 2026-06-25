import { useEffect, useState } from 'react';
import { createDeployment, fetchDeployments, updateDeployment } from '../../api';
import '../../styles/Deployment.css';

const emptyForm = { name: '', description: '', logoUrl: '' };

export default function Deployment() {
  const [deployments, setDeployments] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editingDeployment, setEditingDeployment] = useState(null);

  async function loadDeployments() {
    const token = localStorage.getItem('vizzio_token');
    if (!token) return;

    setLoading(true);
    try {
      const result = await fetchDeployments(token);
      setDeployments(result.deployments || []);
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

  async function handleCreate(event) {
    event.preventDefault();
    const token = localStorage.getItem('vizzio_token');
    if (!token) return;

    setSaving(true);
    setError('');
    try {
      if (editingDeployment) {
        await updateDeployment(token, editingDeployment.id, form);
      } else {
        await createDeployment(token, form);
      }
      setForm(emptyForm);
      setEditingDeployment(null);
      setShowForm(false);
      await loadDeployments();
    } catch (createError) {
      setError(createError.message);
    } finally {
      setSaving(false);
    }
  }

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  function openCreateForm() {
    setEditingDeployment(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEditForm(deployment) {
    setEditingDeployment(deployment);
    setForm({
      name: deployment.name || '',
      description: deployment.description || '',
      logoUrl: deployment.logoUrl || '',
    });
    setShowForm(true);
    setError('');
  }

  function closeForm() {
    setEditingDeployment(null);
    setForm(emptyForm);
    setShowForm(false);
  }

  return (
    <main className="deployment-page">
      <header className="deployment-heading">
        <div>
          <p className="page-overline">Deployment catalog</p>
          <h1>Manage deployments</h1>
          <p>Create products here, then register and publish their versions from Version Management.</p>
        </div>
        <button className="primary-btn" type="button" onClick={() => showForm ? closeForm() : openCreateForm()}>
          {showForm ? 'Cancel' : '+ New Deployment'}
        </button>
      </header>

      {showForm && (
        <form className="deployment-create-card" onSubmit={handleCreate}>
          <div className="form-heading">
            <h2>{editingDeployment ? 'Edit deployment' : 'New deployment'}</h2>
            <p>{editingDeployment ? 'Update the product details shown to admins and authorized users.' : 'Add the product details. Versions can be registered after creation.'}</p>
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
            Description <span>(optional)</span>
            <textarea name="description" value={form.description} onChange={updateField} placeholder="What this deployment contains" rows="3" />
          </label>
          <div className="deployment-form-actions">
            <button className="primary-btn" type="submit" disabled={saving}>
              {saving ? 'Saving...' : editingDeployment ? 'Save deployment' : 'Create deployment'}
            </button>
          </div>
        </form>
      )}

      {error && <p className="deployment-status error">{error}</p>}

      <section className="deployment-panel">
        <div className="deployment-section-heading">
          <div>
            <h2>All deployments</h2>
            <p>{deployments.length} registered</p>
          </div>
        </div>

        {loading ? (
          <p className="deployment-muted">Loading deployments...</p>
        ) : deployments.length === 0 ? (
          <div className="deployment-empty-state">
            <h2>No deployments yet</h2>
            <p>Create the first deployment to begin registering releases.</p>
            <button className="primary-btn" type="button" onClick={openCreateForm}>
              + New Deployment
            </button>
          </div>
        ) : (
          <div className="deployment-card-grid">
            {deployments.map((deployment) => {
              const released = deployment.versions.filter((version) => version.status === 'released').length;
              return (
                <article className="deployment-card" key={deployment.id}>
                  <div className="deployment-card-icon">
                    {deployment.logoUrl ? <img src={deployment.logoUrl} alt="" /> : deployment.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="deployment-card-copy">
                    <h3>{deployment.name}</h3>
                    <p>{deployment.description || 'No description provided.'}</p>
                  </div>
                  <dl className="deployment-card-stats">
                    <div><dt>Versions</dt><dd>{deployment.versions.length}</dd></div>
                    <div><dt>Released</dt><dd>{released}</dd></div>
                    <div><dt>Created</dt><dd>{deployment.created}</dd></div>
                  </dl>
                  <div className="deployment-card-actions">
                    <button className="secondary-btn" type="button" onClick={() => openEditForm(deployment)}>Edit</button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
