import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/admin/Login';
import Dashboard from './pages/admin/Dashboard';
import Version from './pages/admin/Version';
import Deployment from './pages/admin/Deployment';
import Users from './pages/admin/Users';
import Logs from './pages/admin/Logs';
import Notifications from './pages/admin/Notifications';
import AdminLayout from './layouts/AdminLayout';
import './styles/App.css';

function ProtectedRoute({ children }) {
  const token = localStorage.getItem('vizzio_token');
  return token ? children : <Navigate to="/" />;
}

export default function App() {
  const token = localStorage.getItem('vizzio_token');
  const homePath = token ? '/dashboard' : '/';

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={token ? <Navigate to={homePath} /> : <Login />} />

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
          <Route path="/notifications" element={<Notifications />} />
        </Route>

        <Route path="*" element={<Navigate to={homePath} />} />
      </Routes>
    </BrowserRouter>
  );
}
