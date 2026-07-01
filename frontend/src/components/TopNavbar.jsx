import '../styles/TopNavbar.css';

function HeaderIcon({ type }) {
  const paths = {
    search: 'M10.5 18a7.5 7.5 0 1 1 5.3-12.8A7.5 7.5 0 0 1 10.5 18Zm5.7-1.8 3.3 3.3',
    bell: 'M6.5 9.5a5.5 5.5 0 0 1 11 0v3.7l1.4 2.3H5.1l1.4-2.3V9.5Zm3.5 8.8a2.3 2.3 0 0 0 4 0',
    settings: 'M12 8.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Zm7.2 3.5a7.7 7.7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a7.4 7.4 0 0 0-1.7-1l-.3-2.6h-4l-.4 2.6a7.4 7.4 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.5a7.7 7.7 0 0 0 0 2l-2 1.5 2 3.4 2.4-1a7.4 7.4 0 0 0 1.7 1l.4 2.6h4l.3-2.6a7.4 7.4 0 0 0 1.7-1l2.4 1 2-3.4-2-1.5c.1-.3.1-.7.1-1Z',
    cube: 'M12 3.5 20 8v8l-8 4.5L4 16V8l8-4.5Zm0 0V12m8-4-8 4m-8-4 8 4m0 8.5V12',
  };

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={paths[type]} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function TopNavbar({ title, onMenuToggle, username = 'Admin', profileImage = '', initials = 'A', onProfileClick, profileOpen, children }) {
  return (
    <header className="top-navbar">
      <div className="top-navbar-left">
        <button className="top-menu-button" onClick={onMenuToggle} aria-label="Toggle sidebar">
          <span />
          <span />
          <span />
        </button>
        <div className="top-page-mark">
          <HeaderIcon type="cube" />
        </div>
        <div className="top-page-title">{title}</div>
      </div>

      <div className="top-navbar-right">
        <label className="top-search">
          <HeaderIcon type="search" />
          <input type="search" placeholder="Search deployments..." />
          <kbd>Ctrl K</kbd>
        </label>
        <button className="top-icon-button notification-dot" aria-label="Notifications">
          <HeaderIcon type="bell" />
          <span>3</span>
        </button>
        <button className="top-icon-button" aria-label="Settings">
          <HeaderIcon type="settings" />
        </button>
        <div className="top-profile">
          <button className="top-profile-button" onClick={onProfileClick} aria-label="Open profile menu" aria-expanded={profileOpen}>
            {profileImage ? <img src={profileImage} alt="" /> : initials}
          </button>
          <div className="top-profile-name">
            <strong>{username}</strong>
            <small>Administrator</small>
          </div>
          {children}
        </div>
      </div>
    </header>
  );
}
