import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import '../styles/Sidebar.css';
import '../styles/UserPortal.css';

const navSections = [
  {
    title: 'Library',
    links: [
      { label: 'All Packages', to: '/user', end: true },
      { label: 'Installed', to: '/user/installed' },
      { label: 'Download', to: '/user/download' },
    ],
  },
  {
    title: 'Insights',
    links: [{ label: 'Dashboard', to: '/user/dashboard' }],
  },
  {
    title: 'Account',
    links: [{ label: 'Setting', to: '/user/settings' }],
  },
];

function PageTitle() {
  const location = useLocation();
  const pageTitles = {
    '/user': 'All Packages',
    '/user/installed': 'Installed',
    '/user/download': 'Download',
    '/user/dashboard': 'Dashboard',
    '/user/settings': 'Setting',
  };

  return <h2>{pageTitles[location.pathname] || 'All Packages'}</h2>;
}

export default function UserLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="app-layout">
      <aside className={sidebarOpen ? 'sidebar' : 'sidebar collapsed'}>
        <div className="sidebar-header">
          <h1>VIZZIO</h1>
        </div>
        <nav className="sidebar-nav">
          {navSections.map((section) => (
            <div key={section.title} className="nav-section">
              <details open>
                <summary>{section.title}</summary>
                <ul>
                  {section.links.map((link) => (
                    <li key={link.to}>
                      <NavLink
                        to={link.to}
                        end={link.end || false}
                        className={({ isActive }) => `menu-link${isActive ? ' active' : ''}`}
                      >
                        {link.label}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <a href="#help">Help & Docs</a>
        </div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="hamburger"
              onClick={() => setSidebarOpen((open) => !open)}
              aria-label="Toggle sidebar"
            >
              ☰
            </button>
            <PageTitle />
          </div>
          <div className="topbar-right">
            <button className="icon-btn" aria-label="Notifications">
              🔔
            </button>
            <div className="profile-circle">U</div>
          </div>
        </header>
        <div className="app-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
