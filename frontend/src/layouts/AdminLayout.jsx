import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import TopNavbar from '../components/TopNavbar';
import { fetchAdminSettings } from '../api/index.js';
import { clearStoredSession, getValidToken } from '../hooks/useAuth.js';

// The layout owns chrome state that must survive route changes: sidebar
// visibility, profile dropdown state, and the locally stored profile image.
function PageTitle() {
  const location = useLocation();
  const pageTitles = {
    '/dashboard': 'Dashboard',
    '/version': 'Version',
    '/users': 'Users & Permissions',
    '/deployment': 'Deployments',
    '/logs/download': 'Download Logs',
    '/notifications': 'Notifications',
    '/settings': 'Settings',
    '/help': 'Help & Docs',
  };

  return <h2>{pageTitles[location.pathname] || 'Dashboard'}</h2>;
}

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileImage, setProfileImage] = useState(localStorage.getItem('vizzio_profile_image') || '');
  const [maintenance, setMaintenance] = useState({ enabled: false, message: '' });
  const navigate = useNavigate();
  const username = localStorage.getItem('vizzio_username') || 'Admin';
  const role = localStorage.getItem('vizzio_role') || 'Admin';
  const initials = username.slice(0, 1).toUpperCase();

  function handleLogout() {
    // Clear every local auth field so a later admin cannot inherit this session.
    clearStoredSession();
    navigate('/');
  }

  useEffect(() => {
    async function loadSettings() {
      const token = localStorage.getItem('vizzio_token');
      const validToken = getValidToken();
      if (!validToken) {
        navigate('/');
        return;
      }

      try {
        const response = await fetchAdminSettings(validToken);
        setMaintenance({
          enabled: response.settings?.maintenanceMode || false,
          message: response.settings?.maintenanceMessage || '',
        });
      } catch {
        setMaintenance({ enabled: false, message: '' });
      }
    }

    loadSettings();
  }, [navigate]);

  function handleProfileImageChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      // The profile image is local UI preference data, not backend account data.
      localStorage.setItem('vizzio_profile_image', result);
      setProfileImage(result);
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="app-layout">
      <Sidebar isOpen={sidebarOpen} />
      <div className="app-main">
        <TopNavbar
          title={<PageTitle />}
          onMenuToggle={() => setSidebarOpen((open) => !open)}
          sidebarOpen={sidebarOpen}
          username={username}
          profileImage={profileImage}
          initials={initials}
          onProfileClick={() => setProfileOpen((open) => !open)}
          profileOpen={profileOpen}
        >
          {maintenance.enabled && (
            <div className="maintenance-banner">
              <strong>Maintenance mode is enabled.</strong>
              {maintenance.message && <span>{maintenance.message}</span>}
            </div>
          )}
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
        </TopNavbar>
        <div className="app-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
