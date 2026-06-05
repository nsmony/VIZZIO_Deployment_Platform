import '../../styles/UserPortal.css';

export default function Setting() {
  return (
    <main className="user-page user-setting-page">
      <header className="page-header">
        <p className="page-overline">Setting</p>
        <h1>Application settings</h1>
      </header>

      <section className="settings-card">
        <h2>Install location</h2>
        <p className="setting-copy">All packages are installed here. Free space: 284 GB on C:\\.</p>
        <div className="setting-row">
          <span>Root install folder</span>
          <div className="setting-field">C:\\Vizzio</div>
          <button className="secondary-btn">Browse...</button>
        </div>
      </section>

      <section className="settings-card">
        <h2>Download</h2>
        <div className="setting-row">
          <span>Parallel streams</span>
          <span>Simultaneous chunk connections per download (1–8)</span>
        </div>
        <div className="setting-row">
          <span>Reconnect interval</span>
          <span>Seconds between retries when connection is lost</span>
        </div>
        <div className="setting-row">
          <span>Bandwidth cap</span>
          <span>Limit download speed to avoid saturating the office network</span>
        </div>
        <div className="setting-row">
          <span>Max speed</span>
          <span>Uncapped</span>
        </div>
      </section>

      <section className="settings-card">
        <h2>Server</h2>
        <p className="setting-copy">Server URL</p>
        <div className="setting-row">
          <span>https://packages.vizzio.local</span>
        </div>
      </section>

      <section className="settings-card settings-account-card">
        <h2>Account</h2>
        <p className="setting-copy">Signed in as</p>
        <div className="setting-row">
          <span>amir.khalid • amir@vizzio.sa</span>
          <button className="danger-btn">Sign Out</button>
        </div>
      </section>
    </main>
  );
}
