import { useMemo, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import '../../styles/UserPanel.css';

const packageCards = [
  {
    id: 1,
    badge: 'FREE',
    badgeColor: 'yellow',
    name: 'Digital Twin Core',
    version: 'v1.3.0',
    path: 'C:/Vizzio/packages/digital-twin',
    selected: true,
  },
  {
    id: 2,
    badge: 'BETA',
    badgeColor: 'blue',
    name: 'Factory Analytics',
    version: 'v0.9.4',
    path: 'C:/Vizzio/packages/factory-analytics',
  },
  {
    id: 3,
    badge: 'FREE',
    badgeColor: 'yellow',
    name: 'Energy Monitor',
    version: 'v2.0.1',
    path: 'C:/Vizzio/packages/energy-monitor',
  },
  {
    id: 4,
    badge: 'BETA',
    badgeColor: 'blue',
    name: '3D Facility Viewer',
    version: 'v1.1.2',
    path: 'C:/Vizzio/packages/facility-viewer',
  },
  {
    id: 5,
    badge: 'FREE',
    badgeColor: 'yellow',
    name: 'Asset Health',
    version: 'v2.4.0',
    path: 'C:/Vizzio/packages/asset-health',
  },
  {
    id: 6,
    badge: 'BETA',
    badgeColor: 'blue',
    name: 'Predictive Alerts',
    version: 'v0.8.7',
    path: 'C:/Vizzio/packages/predictive-alerts',
  },
];

const recentActivity = [
  { name: 'Digital Twin Core', value: 88, time: '09:43 AM' },
  { name: 'Energy Monitor', value: 67, time: 'Yesterday' },
  { name: 'Asset Health', value: 54, time: 'Yesterday' },
  { name: 'Factory Analytics', value: 32, time: '2 days ago' },
];

const sidebarSections = [
  {
    title: 'LIBRARY',
    key: 'library',
    links: [
      { label: 'All Packages', to: '/user' },
      { label: 'Installed', to: '/user/installed' },
      { label: 'Download', to: '/user/download' },
    ],
  },
  {
    title: 'INSIGHTS',
    key: 'insights',
    links: [{ label: 'Dashboard', to: '/user/dashboard' }],
  },
  {
    title: 'ACCOUNT',
    key: 'account',
    links: [{ label: 'Settings', to: '/user/settings' }],
  },
];

const pageTitleMap = {
  '/user': 'All Packages',
  '/user/installed': 'Installed',
  '/user/download': 'Download',
  '/user/dashboard': 'Dashboard',
  '/user/settings': 'Setting',
};

function SearchBox() {
  return (
    <div className="vizzio-search-box">
      <span className="vizzio-search-icon">Search</span>
      <input type="text" placeholder="Search packages" aria-label="Search packages" />
    </div>
  );
}

function AllPackagesPage() {
  return (
    <section className="vizzio-page-wrap">
      <div className="vizzio-page-head">
        <h2>All Packages</h2>
        <SearchBox />
      </div>
      <div className="vizzio-card-grid">
        {packageCards.map((card) => (
          <article
            key={card.id}
            className={`vizzio-package-card${card.selected ? ' selected' : ''}`}
          >
            <div className="vizzio-preview-area">
              <span className={`vizzio-badge ${card.badgeColor}`}>{card.badge}</span>
              <div className="vizzio-preview-art" />
            </div>
            <div className="vizzio-card-body">
              <h3>{card.name}</h3>
              <p>
                {card.version} | {card.path}
              </p>
            </div>
            <div className="vizzio-card-actions">
              <button type="button" className="btn-primary">
                Open Folder
              </button>
              <button type="button" className="btn-ghost">
                Details
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function InstalledPage() {
  return (
    <section className="vizzio-page-wrap">
      <div className="vizzio-page-head">
        <h2>Installed</h2>
        <SearchBox />
      </div>
      <div className="vizzio-list-card">
        <div className="vizzio-list-row">
          <div>
            <h3>Digital Twin Core - v1.3.0</h3>
            <p>C:/Vizzio/packages/digital-twin</p>
          </div>
          <div className="vizzio-row-actions">
            <button type="button" className="btn-primary">
              Open Folder
            </button>
            <button type="button" className="btn-link">
              More
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function DownloadPage() {
  return (
    <section className="vizzio-page-wrap">
      <div className="vizzio-page-head">
        <h2>Active downloads</h2>
      </div>

      <div className="vizzio-download-card">
        <div className="vizzio-download-top">
          <div>
            <h3>Digital Twin - beta v1.3.0</h3>
            <p>Download in progress</p>
          </div>
          <span className="vizzio-progress-label">75%</span>
        </div>

        <div className="vizzio-progress-track" role="progressbar" aria-valuenow={75} aria-valuemin={0} aria-valuemax={100}>
          <div className="vizzio-progress-fill" style={{ width: '75%' }} />
        </div>

        <div className="vizzio-stats-grid">
          <div className="vizzio-stat-box">
            <span>Downloaded size</span>
            <strong>10.51 GB</strong>
          </div>
          <div className="vizzio-stat-box">
            <span>Download speed</span>
            <strong>4.2 MB/s</strong>
          </div>
          <div className="vizzio-stat-box">
            <span>Upload speed</span>
            <strong>0.7 MB/s</strong>
          </div>
          <div className="vizzio-stat-box">
            <span>ETA</span>
            <strong>00:18:12</strong>
          </div>
        </div>

        <div className="vizzio-download-actions">
          <button type="button" className="btn-ghost">
            Pause
          </button>
          <button type="button" className="btn-danger-ghost">
            Cancel
          </button>
        </div>
      </div>
    </section>
  );
}

function DashboardPage() {
  return (
    <section className="vizzio-page-wrap">
      <div className="vizzio-page-head">
        <h2>Dashboard</h2>
      </div>

      <div className="vizzio-kpi-grid">
        <article className="vizzio-kpi-card">
          <span>Products installed</span>
          <strong>4</strong>
          <p>Total active products</p>
        </article>
        <article className="vizzio-kpi-card">
          <span>Services</span>
          <strong>4 GB</strong>
          <p>Connected service storage</p>
        </article>
        <article className="vizzio-kpi-card">
          <span>System uptime</span>
          <strong>100</strong>
          <p>Operational score</p>
        </article>
        <article className="vizzio-kpi-card">
          <span>Last update</span>
          <strong>Today</strong>
          <p>Synced 12 mins ago</p>
        </article>
      </div>

      <div className="vizzio-chart-grid">
        <article className="vizzio-panel">
          <h3>Storage Usage</h3>
          <div className="vizzio-storage-layout">
            <svg viewBox="0 0 160 160" className="vizzio-donut" aria-label="Storage usage donut chart">
              <circle cx="80" cy="80" r="56" className="ring-bg" />
              <circle cx="80" cy="80" r="56" className="ring-main" />
              <text x="80" y="82" textAnchor="middle" className="ring-value">
                30.2
              </text>
            </svg>
            <div className="vizzio-legend">
              <div><span className="dot blue" />Digital Twin Core</div>
              <div><span className="dot cyan" />Factory Analytics</div>
              <div><span className="dot green" />Energy Monitor</div>
              <div><span className="dot gray" />Free Space: 284 GB</div>
            </div>
          </div>
        </article>

        <article className="vizzio-panel">
          <h3>Download activity</h3>
          <svg viewBox="0 0 480 220" className="vizzio-line-chart" aria-label="Download activity line chart">
            <polyline points="20,180 90,150 160,160 230,120 300,130 370,100 440,92" className="line-a" />
            <polyline points="20,190 90,170 160,148 230,142 300,126 370,136 440,110" className="line-b" />
            <line x1="20" y1="200" x2="460" y2="200" className="axis" />
          </svg>
        </article>
      </div>

      <article className="vizzio-panel vizzio-recent-panel">
        <h3>Recent Activity</h3>
        <div className="vizzio-recent-list">
          {recentActivity.map((item) => (
            <div className="vizzio-recent-item" key={item.name}>
              <span>{item.name}</span>
              <div className="vizzio-recent-bar-track">
                <div className="vizzio-recent-bar-fill" style={{ width: `${item.value}%` }} />
              </div>
              <time>{item.time}</time>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}

function SettingsPage({ onSignOut }) {
  return (
    <section className="vizzio-page-wrap">
      <div className="vizzio-page-head">
        <h2>Application settings</h2>
      </div>

      <article className="vizzio-settings-card">
        <h3>INSTALL LOCATION</h3>
        <div className="vizzio-input-row">
          <input type="text" value="C:/Vizzio/packages" readOnly />
          <button type="button" className="btn-ghost">Browse</button>
        </div>
      </article>

      <article className="vizzio-settings-card">
        <h3>DOWNLOAD</h3>
        <div className="vizzio-form-grid">
          <label>
            Parallel streams
            <input type="number" value="4" readOnly />
          </label>
          <label>
            Reconnect interval
            <input type="text" value="6 sec" readOnly />
          </label>
          <label>
            Bandwidth cap
            <input type="text" value="120 MB/s" readOnly />
          </label>
          <label>
            Max speed
            <input type="text" value="Unlimited" readOnly />
          </label>
        </div>
      </article>

      <article className="vizzio-settings-card">
        <h3>SERVER</h3>
        <label className="vizzio-full-label">
          Server URL
          <input type="text" value="https://api.vizzio.local" readOnly />
        </label>
      </article>

      <article className="vizzio-settings-card">
        <h3>ACCOUNT</h3>
        <p className="vizzio-account-text">Signed in as: user@vizzio.ai</p>
        <button type="button" className="btn-link btn-link-danger" onClick={onSignOut}>Sign Out</button>
      </article>
    </section>
  );
}

export default function UserPanel() {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [sectionsOpen, setSectionsOpen] = useState({
    library: true,
    insights: true,
    account: true,
  });

  const pathKey = useMemo(() => {
    const path = location.pathname;
    if (path.startsWith('/user/installed')) return '/user/installed';
    if (path.startsWith('/user/download')) return '/user/download';
    if (path.startsWith('/user/dashboard')) return '/user/dashboard';
    if (path.startsWith('/user/settings')) return '/user/settings';
    return '/user';
  }, [location.pathname]);

  const pageTitle = pageTitleMap[pathKey] || 'All Packages';

  function toggleSection(sectionKey) {
    setSectionsOpen((prev) => ({ ...prev, [sectionKey]: !prev[sectionKey] }));
  }

  function handleLogout() {
    localStorage.removeItem('vizzio_token');
    localStorage.removeItem('vizzio_role');
    navigate('/');
  }

  function renderPage() {
    switch (pathKey) {
      case '/user/installed':
        return <InstalledPage />;
      case '/user/download':
        return <DownloadPage />;
      case '/user/dashboard':
        return <DashboardPage />;
      case '/user/settings':
        return <SettingsPage onSignOut={handleLogout} />;
      case '/user':
      default:
        return <AllPackagesPage />;
    }
  }

  return (
    <div className="vizzio-user-shell">
      <aside className={`vizzio-sidebar ${collapsed ? 'collapsed' : ''}`}>
        <div className="vizzio-logo">VIZZIO</div>
        <nav className="vizzio-nav">
          {sidebarSections.map((section) => (
            <div key={section.key} className="vizzio-nav-section">
              <button
                type="button"
                className="vizzio-nav-section-head"
                onClick={() => toggleSection(section.key)}
              >
                <span>{section.title}</span>
                <span className={`chevron ${sectionsOpen[section.key] ? 'open' : ''}`}>^</span>
              </button>
              {sectionsOpen[section.key] && (
                <ul>
                  {section.links.map((link) => (
                    <li key={link.to}>
                      <NavLink
                        to={link.to}
                        end={link.to === '/user'}
                        className={({ isActive }) =>
                          `vizzio-nav-link${isActive ? ' active' : ''}`
                        }
                      >
                        {collapsed ? link.label.split(' ')[0] : link.label}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </nav>
      </aside>

      <main className="vizzio-main">
        <header className="vizzio-header">
          <div className="vizzio-header-left">
            <button
              type="button"
              className="vizzio-menu-btn"
              onClick={() => setCollapsed((value) => !value)}
              aria-label="Toggle sidebar"
            >
              |||
            </button>
            <span className="vizzio-header-logo">VIZZIO</span>
            <h1>{pageTitle}</h1>
          </div>
          <div className="vizzio-header-right">
            <button type="button" className="vizzio-icon-btn" aria-label="Search">
              S
            </button>
            <button type="button" className="vizzio-avatar" onClick={handleLogout} aria-label="User account">
              U
            </button>
          </div>
        </header>

        <section className="vizzio-content">{renderPage()}</section>
      </main>
    </div>
  );
}
