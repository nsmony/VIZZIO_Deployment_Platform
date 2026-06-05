import { useMemo, useState } from 'react';
import '../../styles/UserPortal.css';

const packageList = [
  {
    id: 'digital-twin',
    title: 'Digital Twin',
    subtitle: 'A digital twin environment for urban infrastructure simulation, featuring real-time data overlays and 3D visualization of city systems including traffic, utilities, and environmental sensors.',
    label: 'Stable',
    version: 'v1.1.0',
    size: '3.0GB',
    installed: true,
  },
  {
    id: 'sensor-hub',
    title: 'Sensor Hub',
    subtitle: 'Centralized sensor management for asset telemetry, live status tracking, and automated alerts across infrastructure systems.',
    label: 'Beta',
    version: 'v1.2.0-beta',
    size: '750MB',
    installed: false,
  },
  {
    id: 'traffic-insights',
    title: 'Traffic Insights',
    subtitle: 'Analyze traffic flows, congestion patterns, and route performance across city corridors using historical and live data feeds.',
    label: 'Stable',
    version: 'v2.0.3',
    size: '1.1GB',
    installed: true,
  },
  {
    id: 'environmental-sensors',
    title: 'Environmental Sensors',
    subtitle: 'Real-time air quality, noise, and weather data integration for environmental monitoring and urban planning dashboards.',
    label: 'Beta',
    version: 'v0.9.4-beta',
    size: '980MB',
    installed: false,
  },
];

const filters = ['All', 'Stable', 'Beta', 'Installed'];

export default function UserPortal() {
  const [activeFilter, setActiveFilter] = useState('All');
  const [search, setSearch] = useState('');

  const filteredPackages = useMemo(() => {
    return packageList.filter((pkg) => {
      const matchesFilter =
        activeFilter === 'All' ||
        (activeFilter === 'Installed' ? pkg.installed : pkg.label === activeFilter);
      const matchesSearch =
        search.trim().length === 0 ||
        pkg.title.toLowerCase().includes(search.toLowerCase()) ||
        pkg.subtitle.toLowerCase().includes(search.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [activeFilter, search]);

  return (
    <main className="user-page">
      <header className="page-header">
        <p className="page-overline">All Packages</p>
        <h1>Package library</h1>
        <p className="page-copy">Browse installed and available packages for your Digital Twin deployment.</p>
      </header>

      <div className="library-toolbar">
        <div className="search-field">
          <input
            type="search"
            placeholder="Search packages..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="filter-list">
          {filters.map((filter) => (
            <button
              key={filter}
              className={`filter-pill ${activeFilter === filter ? 'active' : ''}`}
              onClick={() => setActiveFilter(filter)}
              type="button"
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      <div className="package-grid">
        {filteredPackages.map((pkg) => (
          <article key={pkg.id} className="package-card">
            <div className="package-card-top">
              <span className={`status-pill ${pkg.label.toLowerCase()}`}>{pkg.label}</span>
              {pkg.installed && <span className="installed-pill">Installed</span>}
            </div>
            <h2>{pkg.title}</h2>
            <p>{pkg.subtitle}</p>
            <div className="package-meta">
              <span>{pkg.version}</span>
              <span>{pkg.size}</span>
            </div>
            <div className="package-actions">
              <button className="secondary-btn">Open folder</button>
              <button className="text-btn">Details</button>
            </div>
          </article>
        ))}

        {filteredPackages.length === 0 && (
          <div className="empty-state-card">
            <h2>No packages found</h2>
            <p>Try adjusting your filter or search term to locate available packages.</p>
          </div>
        )}
      </div>
    </main>
  );
}
