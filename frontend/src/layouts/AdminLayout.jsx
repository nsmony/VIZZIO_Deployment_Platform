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
    '/notifications': 'Notifications',
  };

  return <h2>{pageTitles[location.pathname] || 'Dashboard'}</h2>;
}

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileImage, setProfileImage] = useState(localStorage.getItem('vizzio_profile_image') || '');
  const navigate = useNavigate();
  const username = localStorage.getItem('vizzio_username') || 'Admin';
  const role = localStorage.getItem('vizzio_role') || 'Admin';
  const initials = username.slice(0, 1).toUpperCase();

  function handleLogout() {
    localStorage.removeItem('vizzio_token');
    localStorage.removeItem('vizzio_role');
    localStorage.removeItem('vizzio_username');
    window.location.href = '/';
  }

  function handleProfileImageChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      localStorage.setItem('vizzio_profile_image', result);
      setProfileImage(result);
    };
    reader.readAsDataURL(file);
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
              Menu
            </button>
            <PageTitle />
          </div>
          <div className="topbar-right">
            <button
              className="icon-btn notification-btn"
              onClick={() => navigate('/notifications')}
              aria-label="Notifications"
            >
              Alerts
            </button>
            <div className="profile-menu">
              <button
                className="profile-circle"
                onClick={() => setProfileOpen((open) => !open)}
                aria-label="Open profile menu"
                aria-expanded={profileOpen}
              >
                {profileImage ? <img src={profileImage} alt="" /> : initials}
              </button>
              {profileOpen && (
                <div className="profile-dropdown">
                  <div className="profile-summary">
                    <div className="profile-preview">
                      {profileImage ? <img src={profileImage} alt="" /> : initials}
                    </div>
                    <div>
                      <strong>{username}</strong>
                      <span>{role}</span>
                    </div>
                  </div>
                  <label className="profile-upload">
                    Update Profile Image
                    <input type="file" accept="image/*" onChange={handleProfileImageChange} />
                  </label>
                  <button type="button" onClick={handleLogout}>Sign Out</button>
                </div>
              )}
            </div>
          </div>
        </header>
        <div className="app-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
