import '../../styles/Deployment.css';

export default function FilterToolbar({
  search,
  status,
  sort,
  viewMode,
  onSearchChange,
  onStatusChange,
  onSortChange,
  onViewModeChange,
  onCreate,
}) {
  return (
    <section className="deployment-toolbar">
      <label className="deployment-search-control">
        <span>⌕</span>
        <input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search deployments..."
          type="search"
        />
      </label>
      <select value={status} onChange={(event) => onStatusChange(event.target.value)} aria-label="Filter by status">
        <option value="all">All Status</option>
        <option value="Active">Active</option>
        <option value="Draft">Draft</option>
        <option value="Testing">Testing</option>
        <option value="Inactive">Inactive</option>
        <option value="Failed">Failed</option>
      </select>
      <select value={sort} onChange={(event) => onSortChange(event.target.value)} aria-label="Sort deployments">
        <option value="recent">Recently Created</option>
        <option value="oldest">Oldest Created</option>
        <option value="az">Name A-Z</option>
        <option value="za">Name Z-A</option>
        <option value="versions">Most Versions</option>
      </select>
      <div className="deployment-view-toggle" aria-label="View mode">
        <button type="button" className={viewMode === 'grid' ? 'active' : ''} onClick={() => onViewModeChange('grid')}>▦</button>
        <button type="button" className={viewMode === 'list' ? 'active' : ''} onClick={() => onViewModeChange('list')}>☷</button>
      </div>
      <button className="primary-btn deployment-new-button" type="button" onClick={onCreate}>+ New Deployment</button>
    </section>
  );
}
