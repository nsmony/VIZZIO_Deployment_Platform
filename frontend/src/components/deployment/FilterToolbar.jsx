import '../../styles/Deployment.css';

function ToolbarIcon({ name }) {
  const paths = {
    search: 'M10.5 18a7.5 7.5 0 1 1 5.3-12.8A7.5 7.5 0 0 1 10.5 18Zm5.7-1.8 3.3 3.3',
    grid: 'M5 5h5v5H5V5Zm9 0h5v5h-5V5ZM5 14h5v5H5v-5Zm9 0h5v5h-5v-5Z',
    list: 'M8 6h11M8 12h11M8 18h11M5 6h.01M5 12h.01M5 18h.01',
  };

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={paths[name]} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function FilterToolbar({
  search,
  status,
  channel,
  sort,
  viewMode,
  onSearchChange,
  onStatusChange,
  onChannelChange,
  onSortChange,
  onViewModeChange,
  onCreate,
}) {
  return (
    <section className="deployment-toolbar">
      <label className="deployment-search-control">
        <ToolbarIcon name="search" />
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
        <option value="Archived">Archived</option>
        <option value="Draft">Draft</option>
        <option value="Inactive">Inactive</option>
      </select>
      <select value={channel} onChange={(event) => onChannelChange(event.target.value)} aria-label="Filter by release channel">
        <option value="all">All Channels</option>
        <option value="stable">Stable</option>
        <option value="beta">Beta</option>
      </select>
      <select value={sort} onChange={(event) => onSortChange(event.target.value)} aria-label="Sort deployments">
        <option value="recent">Recently Created</option>
        <option value="oldest">Oldest Created</option>
        <option value="az">Name A-Z</option>
        <option value="za">Name Z-A</option>
        <option value="versions">Most Versions</option>
      </select>
      <div className="deployment-view-toggle" aria-label="View mode">
        <button type="button" className={viewMode === 'grid' ? 'active' : ''} onClick={() => onViewModeChange('grid')} aria-label="Grid view">
          <ToolbarIcon name="grid" />
        </button>
        <button type="button" className={viewMode === 'list' ? 'active' : ''} onClick={() => onViewModeChange('list')} aria-label="List view">
          <ToolbarIcon name="list" />
        </button>
      </div>
      <button className="primary-btn deployment-new-button" type="button" onClick={onCreate}>+ New Deployment</button>
    </section>
  );
}
