import { useEffect, useState } from 'react';
import appPackage from '../../../package.json';
import { fetchAdminSettings, resetAdminSettings, saveAdminSettings } from '../../api/index.js';
import { clearStoredSession, getValidToken } from '../../hooks/useAuth.js';
import '../../styles/UtilityPages.css';

const tabs = ['General', 'Server', 'Security', 'Maintenance'];

const defaultSettings = {
  appName: 'VIZZIO Deployment Platform',
  supportEmail: 'support@vizzio.local',
  maintenanceMode: false,
  maintenanceMessage: '',
};

export default function Settings() {
  const [activeTab, setActiveTab] = useState('General');
  const [serverStatus, setServerStatus] = useState('Checking');
  const [message, setMessage] = useState('');
  const [settings, setSettings] = useState(defaultSettings);
  const [loading, setLoading] = useState(true);

  const username = localStorage.getItem('vizzio_username') || 'Admin';
  const role = localStorage.getItem('vizzio_role') || 'Administrator';
  const apiBase = import.meta.env.VITE_API_BASE || 'http://localhost:4000/api';
  const downloadBase = import.meta.env.VITE_DOWNLOAD_BASE || 'http://localhost:4000/downloads';
  const token = localStorage.getItem('vizzio_token');

  useEffect(() => {
    async function loadSettings() {
      const validToken = getValidToken();
      if (!validToken) {
        setLoading(false);
        setMessage('Admin authentication is required to load settings.');
        return;
      }

      try {
        const response = await fetchAdminSettings(validToken);
        setSettings(response.settings || defaultSettings);
        setMessage('');
      } catch (error) {
        setMessage(error.message || 'Unable to load admin settings.');
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, [token]);

  function handleSignOut() {
    clearStoredSession();
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

  async function handleResetSettings() {
    if (!token) {
      setMessage('Admin authentication is required to reset settings.');
      return;
    }

    try {
      const response = await resetAdminSettings(token);
      setSettings(response.settings || defaultSettings);
      setMessage('Admin settings were reset to defaults.');
    } catch (error) {
      setMessage(error.message || 'Unable to reset admin settings.');
    }
  }

  async function handleCheckUpdates() {
    setMessage('Update check is ready for a future release channel.');
  }

  async function handleSaveSettings() {
    if (!token) {
      setMessage('Admin authentication is required to save settings.');
      return;
    }

    try {
      const response = await saveAdminSettings(token, settings);
      setSettings(response.settings || defaultSettings);
      setMessage('Admin settings saved successfully.');
    } catch (error) {
      setMessage(error.message || 'Unable to save admin settings.');
    }
  }

  return (
    <main className="settings-page">
      <p className="settings-page-description">Manage system configuration and administrator preferences.</p>

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
            <SettingsRow title="Product Name" description="Label shown in the web admin shell">
              <input
                className="settings-text-input"
                value={settings.appName}
                disabled={loading}
                onChange={(event) => setSettings({ ...settings, appName: event.target.value })}
              />
            </SettingsRow>
            <SettingsRow title="Support Email" description="Contact email for administrators">
              <input
                className="settings-text-input"
                value={settings.supportEmail}
                disabled={loading}
                onChange={(event) => setSettings({ ...settings, supportEmail: event.target.value })}
              />
            </SettingsRow>
            <SettingsRow title="Save settings">
              <button className="settings-primary-button" type="button" onClick={handleSaveSettings} disabled={loading}>
                Save Settings
              </button>
            </SettingsRow>
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
          <SettingsPanel title="Maintenance" description="Control maintenance mode and system actions.">
            <SettingsRow title="Enable Maintenance Mode" description="Prevent non-admin users from using the system.">
              <label className="settings-switch">
                <input
                  type="checkbox"
                  checked={settings.maintenanceMode}
                  disabled={loading}
                  onChange={(event) => setSettings({ ...settings, maintenanceMode: event.target.checked })}
                />
                <span className="settings-switch-slider" />
              </label>
            </SettingsRow>
            <SettingsRow title="Maintenance Message" description="Shown to blocked users while maintenance is active.">
              <textarea
                className="settings-textarea"
                value={settings.maintenanceMessage}
                disabled={loading}
                onChange={(event) => setSettings({ ...settings, maintenanceMessage: event.target.value })}
              />
            </SettingsRow>
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
            <SettingsRow title="Save maintenance settings">
              <button className="settings-primary-button" type="button" onClick={handleSaveSettings} disabled={loading}>
                Save Maintenance Settings
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
