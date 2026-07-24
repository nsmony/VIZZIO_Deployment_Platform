import { useMemo, useState } from 'react';
import '../styles/DeploymentTable.css';

export default function DeploymentTable({ deployments }) {
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterMode, setFilterMode] = useState('all');

  const visibleDeployments = useMemo(() => {
    const items = [...deployments];

    if (filterMode === 'active') {
      return items.filter((dep) => dep.status?.toLowerCase() === 'active');
    }

    if (filterMode === 'draft') {
      return items.filter((dep) => dep.status?.toLowerCase() === 'draft');
    }

    if (filterMode === 'archived') {
      return items.filter((dep) => dep.status?.toLowerCase() === 'archived');
    }

    if (filterMode === 'az') {
      return items.sort((a, b) => String(a.module || '').localeCompare(String(b.module || '')));
    }

    if (filterMode === 'za') {
      return items.sort((a, b) => String(b.module || '').localeCompare(String(a.module || '')));
    }

    return items;
  }, [deployments, filterMode]);

  function applyFilter(nextMode) {
    setFilterMode(nextMode);
    setFilterOpen(false);
  }

  return (
    <div className="deployment-section">
      <div className="section-header">
        <h2>Deployments</h2>
        <div className="section-actions">
          <div className="filter-control">
            <button
              className="btn-filter"
              type="button"
              onClick={() => setFilterOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={filterOpen}
            >
              Filter
            </button>
            {filterOpen && (
              <div className="filter-menu" role="menu">
                <button type="button" onClick={() => applyFilter('all')}>Show All</button>
                <button type="button" onClick={() => applyFilter('az')}>Sort A-Z by module name</button>
                <button type="button" onClick={() => applyFilter('za')}>Sort Z-A by module name</button>
                <button type="button" onClick={() => applyFilter('active')}>Status: Active</button>
                <button type="button" onClick={() => applyFilter('draft')}>Status: Draft</button>
                <button type="button" onClick={() => applyFilter('archived')}>Status: Archived</button>
              </div>
            )}
          </div>
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
          {visibleDeployments.length === 0 ? (
            <tr>
              <td colSpan="5" className="deployment-table-empty">No deployments match this view.</td>
            </tr>
          ) : (
            visibleDeployments.map((dep, idx) => (
              <tr key={`${dep.module}-${idx}`}>
                <td>{dep.module}</td>
                <td>{dep.latestBeta}</td>
                <td>{dep.stableVersion}</td>
                <td>
                  <span className={`status ${dep.status?.toLowerCase() || ''}`}>{dep.status}</span>
                </td>
                <td>{dep.lastUpdated}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
