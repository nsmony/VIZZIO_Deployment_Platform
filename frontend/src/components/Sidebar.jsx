import { Link, useLocation } from 'react-router-dom';
import '../styles/Sidebar.css';

function SidebarIcon({ type }) {
  const paths = {
    overview: 'M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1v-8.5Z',
    deployment: 'M12 3.5 20 8v8l-8 4.5L4 16V8l8-4.5Zm0 0V12m8-4-8 4m-8-4 8 4m0 8.5V12',
    version: 'M6 18.5 18.5 6M7 7.5h5v5M17 16.5h-5v-5',
    users: 'M8.5 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6Zm7 0a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5ZM3.5 19a5 5 0 0 1 10 0m2-5a4.5 4.5 0 0 1 5 4.5',
    logs: 'M7 3.5h7l3 3V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Zm7 0V7h3M8.5 11h7m-7 4h7',
    settings: 'M12 8.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Zm7.2 3.5a7.7 7.7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a7.4 7.4 0 0 0-1.7-1l-.3-2.6h-4l-.4 2.6a7.4 7.4 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.5a7.7 7.7 0 0 0 0 2l-2 1.5 2 3.4 2.4-1a7.4 7.4 0 0 0 1.7 1l.4 2.6h4l.3-2.6a7.4 7.4 0 0 0 1.7-1l2.4 1 2-3.4-2-1.5c.1-.3.1-.7.1-1Z',
    help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-2.2-11a2.3 2.3 0 1 1 3.6 1.9c-.8.5-1.4 1-1.4 2.1m0 3h.01',
  };

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={paths[type]} fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Sidebar({ isOpen = true }) {
  const location = useLocation();

  const sections = [
    {
      label: '',
      type: 'primary',
      items: [{ label: 'Overview', href: '/dashboard', icon: 'overview' }],
    },
    {
      label: 'Management',
      type: 'management',
      items: [
        { label: 'Deployments', href: '/deployment', icon: 'deployment' },
        { label: 'Versions', href: '/version', icon: 'version' },
        { label: 'Users & Permissions', href: '/users', icon: 'users' },
      ],
    },
    {
      label: 'Logs',
      type: 'logs',
      items: [{ label: 'Download Logs', href: '/logs/download', icon: 'logs' }],
    },
    {
      label: '',
      type: 'utility',
      items: [
        { label: 'Settings', href: '/settings', icon: 'settings' },
        { label: 'Help & Docs', href: '/help', icon: 'help' },
      ],
    },
  ];

  return (
    <aside className={isOpen ? 'sidebar' : 'sidebar collapsed'}>
      <div className="sidebar-header">
        <div className="sidebar-logo">V</div>
        <h1>VIZZIO</h1>
      </div>
      <nav className="sidebar-nav">
        {sections.map((section) => (
          <div className={`nav-section ${section.type === 'utility' ? 'utility-section' : ''}`} key={section.type}>
            {section.label && <p>{section.label}</p>}
            <ul>
              {section.items.map((item) => (
                <li key={item.href}>
                  <Link to={item.href} className={location.pathname === item.href ? 'active' : ''}>
                    <SidebarIcon type={item.icon} />
                    <span>{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
