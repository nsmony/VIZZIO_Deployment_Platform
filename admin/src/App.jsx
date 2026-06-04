import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Version from './pages/Version';
import Deployment from './pages/Deployment';
import Users from './pages/Users';
import Logs from './pages/Logs';
import './styles/App.css';

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

function ProtectedRoute({ children }) {
  const token = localStorage.getItem('vizzio_token');
  return token ? children : <Navigate to="/" />;
}

export default function App() {
  const token = localStorage.getItem('vizzio_token');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <BrowserRouter>
      {token ? (
        <div className="app-layout">
          <Sidebar isOpen={sidebarOpen} />
          <div className="app-main">
            <header className="topbar">
              <div className="topbar-left">
                <button className="hamburger" onClick={() => setSidebarOpen((open) => !open)} aria-label="Toggle sidebar">
                  ☰
                </button>
                <PageTitle />
              </div>
              <div className="topbar-right">
                <button className="icon-btn" aria-label="Notifications">🔔</button>
                <div className="profile-circle">A</div>
              </div>
            </header>
            <div className="app-content">
              <Routes>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/version" element={<Version />} />
                <Route path="/deployment" element={<Deployment />} />
                <Route path="/users" element={<Users />} />
                <Route path="/logs/download" element={<Logs />} />
                <Route path="/" element={<Navigate to="/dashboard" />} />
              </Routes>
            </div>
          </div>
        </div>
      ) : (
        <Routes>
          <Route path="/" element={<Login />} />
        </Routes>
      )}
    </BrowserRouter>
  );
}
