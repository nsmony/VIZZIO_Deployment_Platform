import { Link, useLocation } from 'react-router-dom';
import '../styles/Sidebar.css';

export default function Sidebar({ isOpen = true }) {
  const location = useLocation();

  const menuItems = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Deployment', href: '/deployment' },
    { label: 'Version', href: '/version' },
    { label: 'Users & Permissions', href: '/users' },
  ];

  const logItems = [
    { label: 'Download Logs', href: '/logs/download' },
  ];

  return (
    <aside className={isOpen ? 'sidebar' : 'sidebar collapsed'}>
      <div className="sidebar-header">
        <h1>VIZZIO</h1>
      </div>
      <nav className="sidebar-nav">
        <div className="nav-section">
          <details open>
            <summary>Overview</summary>
            <ul>
              {menuItems.slice(0, 1).map((item) => (
                <li key={item.href}>
                  <Link to={item.href} className={location.pathname === item.href ? 'active' : ''}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </details>
        </div>
        <div className="nav-section">
          <details open>
            <summary>Management</summary>
            <ul>
              {menuItems.slice(1).map((item) => (
                <li key={item.href}>
                  <Link to={item.href}>{item.label}</Link>
                </li>
              ))}
            </ul>
          </details>
        </div>
        <div className="nav-section">
          <details open>
            <summary>Logs</summary>
            <ul>
              {logItems.map((item) => (
                <li key={item.href}>
                  <Link to={item.href}>{item.label}</Link>
                </li>
              ))}
            </ul>
          </details>
        </div>
      </nav>
      <div className="sidebar-footer">
        <a href="#help">Help & Docs</a>
      </div>
    </aside>
  );
}
