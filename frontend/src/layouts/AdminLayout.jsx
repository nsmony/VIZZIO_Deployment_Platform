import { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';

function PageTitle() {
  const location = useLocation();
  const pageTitles = {
    '/dashboard': 'Dashboard',
    '/version': 'Version',
    '/users': 'Users & Permissions',
    '/deployment': 'Deployment',
    '/logs/download': 'Download Logs',
  };

  return <h2>{pageTitles[location.pathname] || 'Dashboard'}</h2>;
}

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const navigate = useNavigate();

  function handleLogout() {
    localStorage.removeItem('vizzio_token');
    localStorage.removeItem('vizzio_role');
    window.location.href = '/';
  }

  return (
    <div className="app-layout">
      <Sidebar isOpen={sidebarOpen} />
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
            <button className="btn-logout" onClick={handleLogout} aria-label="Sign out">
              Sign Out
            </button>
            <div className="profile-circle">A</div>
          </div>
        </header>
        <div className="app-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
