import { useEffect, useState } from 'react';
import appPackage from '../../../package.json';
import { changeAdminPassword, fetchAdminSettings, fetchSystemReadiness, resetAdminSettings, saveAdminSettings } from '../../api/index.js';
import { clearStoredSession, getValidToken } from '../../hooks/useAuth.js';
import '../../styles/UtilityPages.css';

const tabs = [
  { name: 'General', icon: 'general' },
  { name: 'Server', icon: 'server' },
  { name: 'Security', icon: 'security' },
  { name: 'Maintenance', icon: 'maintenance' },
];

const defaultSettings = {
  appName: 'VIZZIO Deployment Platform',
  supportEmail: 'support@vizzio.local',
  maintenanceMode: false,
  maintenanceMessage: '',
};

export default function Settings() {
  const [activeTab, setActiveTab] = useState('General');
  const [serverStatus, setServerStatus] = useState('Checking');
  const [readiness, setReadiness] = useState(null);
  const [message, setMessage] = useState('');
  const [settings, setSettings] = useState(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordError, setPasswordError] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

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
      const data = await fetchSystemReadiness(token);
      const nextReadiness = data.readiness || null;
      setReadiness(nextReadiness);
      setServerStatus(formatReadinessStatus(nextReadiness?.status));
      setMessage(getReadinessMessage(nextReadiness));
    } catch (error) {
      setServerStatus('Offline');
      setReadiness(null);
      setMessage(error.message || 'Server connection could not be reached.');
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

  function closePasswordDialog() {
    if (changingPassword) return;
    setShowPasswordDialog(false);
    setPasswordError('');
    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
  }

  async function handleChangePassword(event) {
    event.preventDefault();
    const { currentPassword, newPassword, confirmPassword } = passwordForm;

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('Complete all password fields.');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword.length > 128) {
      setPasswordError('New password must be 128 characters or fewer.');
      return;
    }
    if (newPassword === currentPassword) {
      setPasswordError('New password must be different from the current password.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }
    if (!token) {
      setPasswordError('Admin authentication is required.');
      return;
    }

    setChangingPassword(true);
    setPasswordError('');
    try {
      const response = await changeAdminPassword(token, currentPassword, newPassword);
      closePasswordDialog();
      setShowPasswordDialog(false);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setMessage(response.message || 'Password changed successfully.');
    } catch (error) {
      setPasswordError(error.message || 'Unable to change password.');
    } finally {
      setChangingPassword(false);
    }
  }

  async function copySettingValue(value, label) {
    try {
      await navigator.clipboard.writeText(value);
      setMessage(`${label} copied to clipboard.`);
    } catch {
      setMessage(`Unable to copy ${label.toLowerCase()}.`);
    }
  }

  return (
    <main className="settings-page">
      <p className="settings-page-description">Manage system configuration and administrator preferences.</p>

      <nav className="settings-tabs" aria-label="Settings sections">
        {tabs.map((tab) => (
          <button
            className={activeTab === tab.name ? 'active' : ''}
            type="button"
            key={tab.name}
            onClick={() => {
              setActiveTab(tab.name);
              setMessage('');
            }}
          >
            <SettingsIcon name={tab.icon} />
            <span>{tab.name}</span>
          </button>
        ))}
      </nav>

      <section className="settings-workspace">
        {activeTab === 'General' && (
          <SettingsPanel icon="general" tone="blue" title="General" description="Configure basic admin portal preferences.">
            <SettingsRow title="Application Version" description="Current version of the admin portal">
              <span className="settings-value-chip">v{appPackage.version}</span>
            </SettingsRow>
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
            <SettingsRow title="Save changes" description="Apply the general settings above." action>
              <button className="settings-primary-button" type="button" onClick={handleSaveSettings} disabled={loading}>
                Save Changes
              </button>
            </SettingsRow>
          </SettingsPanel>
        )}

        {activeTab === 'Server' && (
          <SettingsPanel icon="server" tone="green" title="Server" description="Review hosted backend prerequisites and frontend connection details.">
            <SettingsRow title="API URL" description="Backend API endpoint">
              <div className="settings-copy-field">
                <span>{apiBase}</span>
                <button type="button" onClick={() => copySettingValue(apiBase, 'API URL')} aria-label="Copy API URL">Copy</button>
              </div>
            </SettingsRow>
            <SettingsRow title="Download URL" description="Download service endpoint">
              <div className="settings-copy-field">
                <span>{downloadBase}</span>
                <button type="button" onClick={() => copySettingValue(downloadBase, 'Download URL')} aria-label="Copy download URL">Copy</button>
              </div>
            </SettingsRow>
            <SettingsRow title="Server Status" description="Current connection and prerequisite status">
              <span className={`settings-badge ${serverStatus.toLowerCase()}`}>{serverStatus}</span>
            </SettingsRow>
            <SettingsRow title="Test connection" description="Run the backend prerequisite checks." action>
              <button className="settings-secondary-button settings-server-button" type="button" onClick={handleTestConnection}>
                Test Connection
              </button>
            </SettingsRow>
            {readiness?.checks?.length > 0 && (
              <div className="settings-health-list">
                {readiness.checks.map((check) => (
                  <div className="settings-health-row" key={check.key}>
                    <div>
                      <h4>{check.label}</h4>
                      <p>{check.message || check.value}</p>
                    </div>
                    <span className={`settings-badge ${check.status}`}>{formatCheckStatus(check.status)}</span>
                  </div>
                ))}
              </div>
            )}
          </SettingsPanel>
        )}

        {activeTab === 'Security' && (
          <SettingsPanel icon="security" tone="purple" title="Security" description="Manage administrator identity and session actions.">
            <SettingsRow title="Administrator" description="Current signed-in account">
              <span className="settings-identity-value">{username}</span>
            </SettingsRow>
            <SettingsRow title="Role" description="Current access level">
              <span className="settings-role-chip">{role}</span>
            </SettingsRow>
            <SettingsRow title="Password" description="Password for this administrator account">
              <div className="settings-inline-actions">
                <span className="settings-password-mask" aria-label="Password hidden">••••••••</span>
                <button
                  className="settings-secondary-button"
                  type="button"
                  onClick={() => {
                    setMessage('');
                    setShowPasswordDialog(true);
                  }}
                >
                  Change Password
                </button>
              </div>
            </SettingsRow>
            <SettingsRow title="Session" description="Manage your active administrator session">
              <button className="settings-danger-button" type="button" onClick={handleSignOut}>
                Sign Out
              </button>
            </SettingsRow>
          </SettingsPanel>
        )}

        {activeTab === 'Maintenance' && (
          <SettingsPanel icon="maintenance" tone="orange" title="Maintenance" description="Control maintenance mode and system actions.">
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
              <button className="settings-danger-button settings-danger-outline" type="button" onClick={handleResetSettings}>
                Reset
              </button>
            </SettingsRow>
            <SettingsRow title="Save maintenance settings" description="Apply maintenance mode and message changes." action>
              <button className="settings-primary-button settings-maintenance-button" type="button" onClick={handleSaveSettings} disabled={loading}>
                Save Maintenance Settings
              </button>
            </SettingsRow>
          </SettingsPanel>
        )}

        {message && <div className="settings-message" role="status">{message}</div>}
      </section>

      {showPasswordDialog && (
        <div className="settings-modal-backdrop" role="presentation" onMouseDown={closePasswordDialog}>
          <form
            className="settings-password-dialog"
            onSubmit={handleChangePassword}
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="change-password-title"
          >
            <div className="settings-dialog-header">
              <div>
                <h3 id="change-password-title">Change Password</h3>
                <p>Enter your current password, then choose a new password of at least 8 characters.</p>
              </div>
              <button type="button" onClick={closePasswordDialog} aria-label="Close change password dialog">×</button>
            </div>

            <label>
              Current password
              <input
                type="password"
                value={passwordForm.currentPassword}
                onChange={(event) => setPasswordForm({ ...passwordForm, currentPassword: event.target.value })}
                autoComplete="current-password"
                maxLength={128}
                autoFocus
              />
            </label>
            <label>
              New password
              <input
                type="password"
                value={passwordForm.newPassword}
                onChange={(event) => setPasswordForm({ ...passwordForm, newPassword: event.target.value })}
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
              />
            </label>
            <label>
              Confirm new password
              <input
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(event) => setPasswordForm({ ...passwordForm, confirmPassword: event.target.value })}
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
              />
            </label>

            {passwordError && <div className="settings-password-error" role="alert">{passwordError}</div>}

            <div className="settings-dialog-actions">
              <button className="settings-secondary-button" type="button" onClick={closePasswordDialog} disabled={changingPassword}>
                Cancel
              </button>
              <button className="settings-primary-button" type="submit" disabled={changingPassword}>
                {changingPassword ? 'Changing…' : 'Change Password'}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}

function SettingsPanel({ title, description, icon, tone, children }) {
  return (
    <>
      <div className={`settings-panel-header ${tone}`}>
        <div className="settings-panel-icon"><SettingsIcon name={icon} /></div>
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
      </div>
      <div className="settings-rows">{children}</div>
    </>
  );
}

function SettingsRow({ title, description, value, children, action = false }) {
  return (
    <div className={`settings-row${action ? ' settings-action-row' : ''}`}>
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

function SettingsIcon({ name }) {
  const paths = {
    general: 'M4 7h10M18 7h2M4 17h2M10 17h10M8 14v6M16 4v6',
    server: 'M7 18h10a4 4 0 0 0 .7-7.94A6 6 0 0 0 6.2 8.4 4.8 4.8 0 0 0 7 18Z',
    security: 'M12 3 5 6v5c0 4.6 2.8 8 7 10 4.2-2 7-5.4 7-10V6l-7-3Zm0 5v8m-3-4h6',
    maintenance: 'm14.5 6.5 3-3 3 3-3 3m-11 5-3 3 3 3 3-3M9 8l7 7M5 4l15 15',
  };

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={paths[name] || paths.general} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function formatReadinessStatus(status) {
  if (status === 'ready') return 'Online';
  if (status === 'ready-with-warnings') return 'Warnings';
  if (status === 'not-ready') return 'Offline';
  return 'Checking';
}

function getReadinessMessage(readiness) {
  if (readiness?.status === 'ready') {
    return 'Server prerequisites are ready.';
  }

  const checks = readiness?.checks || [];
  const errorCount = checks.filter((check) => check.status === 'error').length;
  const warningCount = checks.filter((check) => check.status === 'warning').length;

  if (errorCount && warningCount) {
    return `Review the checks above: ${errorCount} error${errorCount === 1 ? '' : 's'} and ${warningCount} warning${warningCount === 1 ? '' : 's'}.`;
  }
  if (errorCount) {
    return `Review the checks above: ${errorCount} error${errorCount === 1 ? '' : 's'}.`;
  }
  if (warningCount) {
    return `Review the checks above: ${warningCount} warning${warningCount === 1 ? '' : 's'}.`;
  }

  return 'Review the server prerequisite checks above.';
}

function formatCheckStatus(status) {
  if (status === 'ok') return 'OK';
  if (status === 'warning') return 'Warning';
  return 'Error';
}
