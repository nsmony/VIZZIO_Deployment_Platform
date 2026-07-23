import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/admin/Login';
import Dashboard from './pages/admin/Dashboard';
import Version from './pages/admin/Version';
import Deployment from './pages/admin/Deployment';
import Users from './pages/admin/Users';
import Logs from './pages/admin/Logs';
import LauncherReports from './pages/admin/LauncherReports';
import Notifications from './pages/admin/Notifications';
import Settings from './pages/admin/Settings';
import Help from './pages/admin/Help';
import AdminLayout from './layouts/AdminLayout';
import { getValidToken } from './hooks/useAuth';
import './styles/App.css';

// Route guard for the admin portal. Authentication state is intentionally read
// from localStorage because the API client and launcher share this token name.
function ProtectedRoute({ children }) {
  const token = getValidToken();
  return token ? children : <Navigate to="/" />;
}

export default function App() {
  const token = getValidToken();
  const homePath = token ? '/dashboard' : '/';

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={token ? <Navigate to={homePath} /> : <Login />} />

        {/* Admin pages share the sidebar/topbar shell and must be protected. */}
        <Route
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/version" element={<Version />} />
          <Route path="/deployment" element={<Deployment />} />
          <Route path="/users" element={<Users />} />
          <Route path="/logs/download" element={<Logs />} />
          <Route path="/logs/launcher" element={<LauncherReports />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/help" element={<Help />} />
        </Route>

        <Route path="*" element={<Navigate to={homePath} />} />
      </Routes>
    </BrowserRouter>
  );
}
