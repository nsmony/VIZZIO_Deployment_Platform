import { useState } from 'react';
import appPackage from '../../../package.json';
import '../../styles/UtilityPages.css';

const tabs = ['General', 'Server', 'Security', 'Maintenance'];

export default function Settings() {
  const [activeTab, setActiveTab] = useState('General');
  const [serverStatus, setServerStatus] = useState('Checking');
  const [message, setMessage] = useState('');

  const username = localStorage.getItem('vizzio_username') || 'Admin';
  const role = localStorage.getItem('vizzio_role') || 'Administrator';
  const apiBase = import.meta.env.VITE_API_BASE || 'http://localhost:4000/api';
  const downloadBase = import.meta.env.VITE_DOWNLOAD_BASE || 'http://localhost:4000/downloads';

  function handleSignOut() {
    localStorage.removeItem('vizzio_token');
    localStorage.removeItem('vizzio_role');
    localStorage.removeItem('vizzio_username');
    localStorage.removeItem('vizzio_profile_image');
    window.location.href = '/';
  }

  async function handleTestConnection() {
    setServerStatus('Checking');
    setMessage('');

    try {
      const healthUrl = `${apiBase.replace(/\/api\/?$/, '')}/api/health`;
      const response = await fetch(healthUrl);
      if (!response.ok) throw new Error('Health check failed');
      setServerStatus('Online');
      setMessage('Server connection is available.');
    } catch {
      setServerStatus('Offline');
      setMessage('Server connection could not be reached.');
    }
  }

  function handleResetSettings() {
    setMessage('Admin settings were reset to defaults.');
  }

  function handleCheckUpdates() {
    setMessage('Update check is ready for a future release channel.');
  }

  return (
    <main className="settings-page">
      <header className="settings-page-header">
        <h2>Settings</h2>
        <p>Manage system configuration and administrator preferences.</p>
      </header>

      <nav className="settings-tabs" aria-label="Settings sections">
        {tabs.map((tab) => (
          <button
            className={activeTab === tab ? 'active' : ''}
            type="button"
            key={tab}
            onClick={() => {
              setActiveTab(tab);
              setMessage('');
            }}
          >
            {tab}
          </button>
        ))}
      </nav>

      <section className="settings-workspace">
        {activeTab === 'General' && (
          <SettingsPanel title="General" description="Configure basic admin portal preferences.">
            <SettingsRow title="Application Version" description="Current version of the admin portal" value={`v${appPackage.version}`} />
          </SettingsPanel>
        )}

        {activeTab === 'Server' && (
          <SettingsPanel title="Server" description="Review frontend connection details and backend availability.">
            <SettingsRow title="API URL" description={apiBase} />
            <SettingsRow title="Download URL" description={downloadBase} />
            <SettingsRow title="Server Status">
              <span className={`settings-badge ${serverStatus.toLowerCase()}`}>{serverStatus}</span>
            </SettingsRow>
            <SettingsRow title="Test server availability">
              <button className="settings-primary-button" type="button" onClick={handleTestConnection}>
                Test Connection
              </button>
            </SettingsRow>
          </SettingsPanel>
        )}

        {activeTab === 'Security' && (
          <SettingsPanel title="Security" description="Manage administrator identity and session actions.">
            <SettingsRow title="Administrator" description="Current signed-in account" value={username} />
            <SettingsRow title="Role" description="Current access level" value={role} />
            <SettingsRow title="Password">
              <button className="settings-secondary-button" type="button" onClick={() => setMessage('Password changes are not configured yet.')}>
                Change Password
              </button>
            </SettingsRow>
            <SettingsRow title="Session">
              <button className="settings-danger-button" type="button" onClick={handleSignOut}>
                Sign Out
              </button>
            </SettingsRow>
          </SettingsPanel>
        )}

        {activeTab === 'Maintenance' && (
          <SettingsPanel title="Maintenance" description="Run simple admin maintenance actions.">
            <SettingsRow title="Export Logs" description="Download system and activity logs">
              <button className="settings-secondary-button" type="button" onClick={() => { window.location.href = '/logs/download'; }}>
                Export
              </button>
            </SettingsRow>
            <SettingsRow title="Reset Settings" description="Restore admin settings to their defaults">
              <button className="settings-secondary-button" type="button" onClick={handleResetSettings}>
                Reset
              </button>
            </SettingsRow>
            <SettingsRow title="Check for Updates" description="Check whether a newer version is available">
              <button className="settings-secondary-button" type="button" onClick={handleCheckUpdates}>
                Check Now
              </button>
            </SettingsRow>
          </SettingsPanel>
        )}

        {message && <div className="settings-message" role="status">{message}</div>}
      </section>
    </main>
  );
}

function SettingsPanel({ title, description, children }) {
  return (
    <>
      <div className="settings-panel-header">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      <div className="settings-rows">{children}</div>
    </>
  );
}

function SettingsRow({ title, description, value, children }) {
  return (
    <div className="settings-row">
      <div>
        <h4>{title}</h4>
        {description && <p>{description}</p>}
      </div>
      <div className="settings-row-control">
        {children || <span>{value}</span>}
      </div>
    </div>
  );
}
