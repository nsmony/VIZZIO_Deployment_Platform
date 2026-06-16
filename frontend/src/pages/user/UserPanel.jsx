import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  buildManagedDownloadUrl,
  createDownloadManagerSession,
  fetchDownloadManagerItems,
  updateDownloadManagerSession,
} from '../../api';
import '../../styles/UserPanel.css';

const sidebarSections = [
  {
    title: 'LIBRARY',
    key: 'library',
    links: [
      { label: 'All Packages', to: '/user' },
      { label: 'Installed', to: '/user/installed' },
      { label: 'Download', to: '/user/download' },
    ],
  },
  {
    title: 'INSIGHTS',
    key: 'insights',
    links: [{ label: 'Dashboard', to: '/user/dashboard' }],
  },
  {
    title: 'ACCOUNT',
    key: 'account',
    links: [{ label: 'Settings', to: '/user/settings' }],
  },
];

const pageTitleMap = {
  '/user': 'All Packages',
  '/user/installed': 'Installed',
  '/user/download': 'Download',
  '/user/dashboard': 'Dashboard',
  '/user/settings': 'Setting',
};

function SearchBox() {
  return (
    <div className="vizzio-search-box">
      <span className="vizzio-search-icon">Search</span>
      <input type="text" placeholder="Search packages" aria-label="Search packages" />
    </div>
  );
}

function formatBytes(value) {
  const bytes = Number(value || 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function formatSpeed(bytesPerSecond) {
  return bytesPerSecond > 0 ? `${formatBytes(bytesPerSecond)}/s` : '-';
}

function formatEta(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '-';
  if (seconds < 60) return `${Math.ceil(seconds)} sec`;
  if (seconds < 3600) return `${Math.ceil(seconds / 60)} min`;
  return `${Math.ceil(seconds / 3600)} hr`;
}

function getPackageKey(item) {
  return `${item.versionId || 'upload'}:${item.fileId}`;
}

function toPackageCard(item) {
  const channel = item.releaseType || 'package';
  return {
    ...item,
    key: getPackageKey(item),
    badge: channel.toUpperCase(),
    badgeColor: channel === 'stable' ? 'green' : channel === 'beta' ? 'yellow' : 'blue',
    name: item.deploymentName || item.fileName || 'Package',
    version: item.versionNumber || 'Uploaded package',
    path: item.fileName || item.fileId,
  };
}

function AllPackagesPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const authToken = localStorage.getItem('vizzio_token');

    if (!authToken) return;

    setLoading(true);
    fetchDownloadManagerItems(authToken)
      .then((result) => {
        setItems((result.items || []).map(toPackageCard));
        setError('');
      })
      .catch((loadError) => {
        setItems([]);
        setError(loadError.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  function handleDownload(card) {
    sessionStorage.setItem('vizzio_download_file_id', card.fileId);
    navigate('/user/download');
  }

  return (
    <section className="vizzio-page-wrap">
      <div className="vizzio-page-head">
        <SearchBox />
      </div>
      <div className="vizzio-card-grid">
        {items.map((card) => (
          <article
            key={card.key}
            className="vizzio-package-card"
          >
            <div className="vizzio-preview-area">
              <span className={`vizzio-badge ${card.badgeColor}`}>{card.badge}</span>
              <div className="vizzio-preview-art" />
            </div>
            <div className="vizzio-card-body">
              <h3>{card.name}</h3>
              <p>
                {card.version} | {card.path}
              </p>
            </div>
            <div className="vizzio-card-actions">
              <button
                type="button"
                className="btn-primary"
                onClick={() => handleDownload(card)}
                disabled={!card.available}
              >
                {card.available ? 'Download' : 'Missing file'}
              </button>
              <button type="button" className="btn-ghost">
                Details
              </button>
            </div>
          </article>
        ))}
      </div>
      {loading && <p className="vizzio-download-message">Loading packages...</p>}
      {error && <p className="vizzio-download-message error">{error}</p>}
      {!loading && !error && items.length === 0 && (
        <div className="vizzio-empty-state">
          <h3>No packages available</h3>
          <p>Released deployment versions will appear here when your account has access.</p>
        </div>
      )}
    </section>
  );
}

function InstalledPage() {
  return (
    <section className="vizzio-page-wrap">
      <div className="vizzio-page-head">
        <SearchBox />
      </div>
      <div className="vizzio-empty-state">
        <h3>No installed packages reported</h3>
        <p>Installed package tracking will appear here after launcher install events are connected.</p>
      </div>
    </section>
  );
}

function DownloadPage() {
  const [downloadItems, setDownloadItems] = useState([]);
  const [activePackage, setActivePackage] = useState(null);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [downloadUrl, setDownloadUrl] = useState('');
  const [progress, setProgress] = useState({
    downloaded: 0,
    total: 0,
    percent: 0,
    speed: 0,
    eta: 0,
  });
  const controllerRef = useRef(null);
  const chunksRef = useRef([]);
  const downloadedRef = useRef(0);
  const startedAtRef = useRef(0);
  const sessionRef = useRef(null);
  const tokenRef = useRef('');
  const pauseRequestedRef = useRef(false);
  const cancelRequestedRef = useRef(false);
  const lastProgressAtRef = useRef(0);
  const lastSessionAtRef = useRef(0);

  useEffect(() => {
    const authToken = localStorage.getItem('vizzio_token');

    if (!authToken) return;

    fetchDownloadManagerItems(authToken)
      .then((result) => {
        const items = result.items || [];
        const selectedFileId = sessionStorage.getItem('vizzio_download_file_id');
        setDownloadItems(items);
        setActivePackage(
          items.find((item) => item.fileId === selectedFileId)
          || items.find((item) => item.available)
          || items[0]
          || null
        );
        sessionStorage.removeItem('vizzio_download_file_id');
      })
      .catch(() => {
        setDownloadItems([]);
        setActivePackage(null);
      });
  }, []);

  useEffect(() => {
    setStatus('idle');
    setError('');
    setDownloadUrl('');
    setProgress({ downloaded: 0, total: Number(activePackage?.size || 0), percent: 0, speed: 0, eta: 0 });
    chunksRef.current = [];
    downloadedRef.current = 0;
    sessionRef.current = null;
    tokenRef.current = '';
    pauseRequestedRef.current = false;
    cancelRequestedRef.current = false;
    controllerRef.current?.abort();
  }, [activePackage]);

  async function handleStartDownload({ resume = false } = {}) {
    const authToken = localStorage.getItem('vizzio_token');

    if (!authToken) {
      setError('Please sign in again before downloading.');
      return;
    }

    if (!activePackage?.available) {
      setError('No downloadable package is available yet.');
      return;
    }

    setStatus(resume ? 'resuming' : 'starting');
    setError('');
    pauseRequestedRef.current = false;
    cancelRequestedRef.current = false;

    try {
      const fileId = activePackage.fileId;
      if (!resume || !sessionRef.current || !tokenRef.current) {
        const result = await createDownloadManagerSession(authToken, fileId, activePackage.versionId);
        sessionRef.current = result.session?.id || null;
        tokenRef.current = result.token;
        chunksRef.current = [];
        downloadedRef.current = 0;
      }

      const url = buildManagedDownloadUrl(fileId, tokenRef.current);
      setDownloadUrl(url);
      await streamDownload({ authToken, url, resume });
    } catch (requestError) {
      if (requestError.name === 'AbortError') {
        if (pauseRequestedRef.current) setStatus('paused');
        if (cancelRequestedRef.current) setStatus('idle');
        return;
      }
      setStatus('error');
      setError(requestError.message);
    }
  }

  async function streamDownload({ authToken, url, resume }) {
    controllerRef.current = new AbortController();
    startedAtRef.current = performance.now();
    lastProgressAtRef.current = 0;
    lastSessionAtRef.current = 0;
    setStatus('downloading');

    const headers = {};
    if (resume && downloadedRef.current > 0) {
      headers.Range = `bytes=${downloadedRef.current}-`;
    }

    const response = await fetch(url, {
      headers,
      signal: controllerRef.current.signal,
    });

    if (!response.ok && response.status !== 206) {
      throw new Error('Download request failed');
    }

    if (resume && downloadedRef.current > 0 && response.status !== 206) {
      chunksRef.current = [];
      downloadedRef.current = 0;
      setProgress({ downloaded: 0, total: Number(activePackage?.size || 0), percent: 0, speed: 0, eta: 0 });
    }

    const totalSize = Number(activePackage.size || response.headers.get('content-length') || 0);
    const reader = response.body.getReader();

    while (true) {
      if (pauseRequestedRef.current || cancelRequestedRef.current) {
        controllerRef.current?.abort();
        return;
      }

      const { done, value } = await reader.read();
      if (done) break;

      chunksRef.current.push(value);
      downloadedRef.current += value.byteLength;
      const elapsedSeconds = Math.max((performance.now() - startedAtRef.current) / 1000, 0.1);
      const speed = downloadedRef.current / elapsedSeconds;
      const remaining = Math.max(totalSize - downloadedRef.current, 0);
      const percent = totalSize > 0 ? Math.min(100, (downloadedRef.current / totalSize) * 100) : 0;
      const now = performance.now();

      if (now - lastProgressAtRef.current > 250 || percent >= 100) {
        setProgress({
          downloaded: downloadedRef.current,
          total: totalSize,
          percent,
          speed,
          eta: speed > 0 ? remaining / speed : 0,
        });
        lastProgressAtRef.current = now;
      }

      if (sessionRef.current && (now - lastSessionAtRef.current > 1000 || percent >= 100)) {
        updateDownloadManagerSession(authToken, sessionRef.current, {
          status: 'downloading',
          downloadedSize: downloadedRef.current,
          totalSize,
        }).catch(() => {});
        lastSessionAtRef.current = now;
      }
    }

    await finalizeDownload(authToken, totalSize);
  }

  async function finalizeDownload(authToken, totalSize) {
    setStatus('verifying');

    const blob = new Blob(chunksRef.current, { type: 'application/octet-stream' });
    if (activePackage.checksum) {
      const hash = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
      const digest = Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
      if (digest.toLowerCase() !== activePackage.checksum.toLowerCase()) {
        throw new Error('SHA-256 verification failed');
      }
    }

    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = activePackage.fileName || activePackage.fileId;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setDownloadUrl(objectUrl);
    setStatus('completed');
    setProgress((current) => ({ ...current, downloaded: totalSize, total: totalSize, percent: 100, eta: 0 }));

    if (sessionRef.current) {
      updateDownloadManagerSession(authToken, sessionRef.current, {
        status: 'completed',
        downloadedSize: totalSize,
        totalSize,
      }).catch(() => {});
    }
  }

  function handlePauseDownload() {
    pauseRequestedRef.current = true;
    controllerRef.current?.abort();
    setProgress((current) => ({
      ...current,
      downloaded: downloadedRef.current,
      percent: current.total > 0 ? Math.min(100, (downloadedRef.current / current.total) * 100) : current.percent,
      speed: 0,
      eta: 0,
    }));
    setStatus('paused');

    const authToken = localStorage.getItem('vizzio_token');
    if (authToken && sessionRef.current) {
      updateDownloadManagerSession(authToken, sessionRef.current, {
        status: 'paused',
        downloadedSize: downloadedRef.current,
        totalSize: progress.total || activePackage?.size || 0,
      }).catch(() => {});
    }
  }

  function handleCancelDownload() {
    cancelRequestedRef.current = true;
    controllerRef.current?.abort();
    const authToken = localStorage.getItem('vizzio_token');
    if (authToken && sessionRef.current) {
      updateDownloadManagerSession(authToken, sessionRef.current, {
        status: 'cancelled',
        downloadedSize: downloadedRef.current,
        totalSize: progress.total || activePackage?.size || 0,
      }).catch(() => {});
    }
    chunksRef.current = [];
    downloadedRef.current = 0;
    sessionRef.current = null;
    tokenRef.current = '';
    setDownloadUrl('');
    setProgress({ downloaded: 0, total: Number(activePackage?.size || 0), percent: 0, speed: 0, eta: 0 });
    setStatus('idle');
    setError('');
  }

  const isBusy = ['starting', 'downloading', 'resuming', 'verifying'].includes(status);
  const canPause = status === 'downloading';
  const canResume = status === 'paused' && progress.downloaded > 0;

  return (
    <section className="vizzio-page-wrap">
      <div className="vizzio-page-head">
      </div>

      <div className="vizzio-download-card">
        <div className="vizzio-download-top">
          <div>
            <h3>{activePackage?.deploymentName || 'No downloadable package'}</h3>
            <p>{activePackage ? `${activePackage.versionNumber} | ${activePackage.fileName}` : 'Upload a package from the admin Deployment page'}</p>
          </div>
          <span className="vizzio-progress-label">{Math.round(progress.percent)}%</span>
        </div>

        {downloadItems.length > 1 && (
          <label className="vizzio-full-label">
            Package
            <select
              value={activePackage?.fileId || ''}
              onChange={(event) => setActivePackage(downloadItems.find((item) => item.fileId === event.target.value) || null)}
            >
              {downloadItems.map((item) => (
                <option key={`${item.versionId}-${item.fileId}`} value={item.fileId}>
                  {item.deploymentName} - {item.versionNumber}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="vizzio-progress-track" role="progressbar" aria-valuenow={progress.percent} aria-valuemin={0} aria-valuemax={100}>
          <div className="vizzio-progress-fill" style={{ width: `${progress.percent}%` }} />
        </div>

        <div className="vizzio-stats-grid">
          <div className="vizzio-stat-box">
            <span>Package size</span>
            <strong>{formatBytes(activePackage?.size)}</strong>
          </div>
          <div className="vizzio-stat-box">
            <span>Downloaded</span>
            <strong>{formatBytes(progress.downloaded)}</strong>
          </div>
          <div className="vizzio-stat-box">
            <span>Speed</span>
            <strong>{formatSpeed(progress.speed)}</strong>
          </div>
          <div className="vizzio-stat-box">
            <span>ETA</span>
            <strong>{formatEta(progress.eta)}</strong>
          </div>
        </div>

        <div className="vizzio-download-actions">
          <button type="button" className="btn-primary" onClick={() => handleStartDownload()} disabled={isBusy || !activePackage?.available}>
            Start
          </button>
          <button type="button" className="btn-ghost" onClick={handlePauseDownload} disabled={!canPause}>
            Pause
          </button>
          <button type="button" className="btn-primary" onClick={() => handleStartDownload({ resume: true })} disabled={!canResume}>
            Resume
          </button>
          <button type="button" className="btn-danger-ghost" onClick={handleCancelDownload} disabled={status === 'idle'}>
            Cancel
          </button>
        </div>

        {(status !== 'idle' || error) && (
          <p className={`vizzio-download-message${error ? ' error' : ''}`}>
            {error || `Status: ${status}`}
          </p>
        )}
      </div>
    </section>
  );
}

function DashboardPage() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    const authToken = localStorage.getItem('vizzio_token');
    if (!authToken) return;

    fetchDownloadManagerItems(authToken)
      .then((result) => setItems(result.items || []))
      .catch(() => setItems([]));
  }, []);

  const availableItems = items.filter((item) => item.available);
  const totalBytes = availableItems.reduce((sum, item) => sum + Number(item.size || 0), 0);
  const stableCount = availableItems.filter((item) => item.releaseType === 'stable').length;
  const betaCount = availableItems.filter((item) => item.releaseType === 'beta').length;

  return (
    <section className="vizzio-page-wrap">
      <div className="vizzio-page-head">
      </div>

      <div className="vizzio-kpi-grid">
        <article className="vizzio-kpi-card">
          <span>Packages available</span>
          <strong>{availableItems.length}</strong>
          <p>Files your account can download</p>
        </article>
        <article className="vizzio-kpi-card">
          <span>Total package size</span>
          <strong>{formatBytes(totalBytes)}</strong>
          <p>Across available files</p>
        </article>
        <article className="vizzio-kpi-card">
          <span>Stable releases</span>
          <strong>{stableCount}</strong>
          <p>Released stable packages</p>
        </article>
        <article className="vizzio-kpi-card">
          <span>Beta releases</span>
          <strong>{betaCount}</strong>
          <p>Released beta packages</p>
        </article>
      </div>

      <article className="vizzio-panel">
        <h3>Available packages</h3>
        {availableItems.length === 0 ? (
          <p className="vizzio-account-text">No released packages are available for this account yet.</p>
        ) : (
          <div className="vizzio-recent-list">
            {availableItems.map((item) => (
              <div className="vizzio-recent-item" key={getPackageKey(item)}>
                <span>{item.deploymentName}</span>
                <div className="vizzio-recent-bar-track">
                  <div className="vizzio-recent-bar-fill" style={{ width: `${item.size && totalBytes ? Math.max(6, (Number(item.size) / totalBytes) * 100) : 6}%` }} />
                </div>
                <time>{formatBytes(item.size)}</time>
              </div>
            ))}
          </div>
        )}
      </article>
    </section>
  );
}

function SettingsPage({ onSignOut }) {
  const username = localStorage.getItem('vizzio_username') || 'Signed-in user';
  const apiBase = import.meta.env.VITE_API_BASE || 'http://localhost:4000/api';

  return (
    <section className="vizzio-page-wrap">
      <div className="vizzio-page-head">
      </div>

      <article className="vizzio-settings-card">
        <h3>INSTALL LOCATION</h3>
        <div className="vizzio-input-row">
          <input type="text" value="Configured in launcher" readOnly />
          <button type="button" className="btn-ghost">Browse</button>
        </div>
      </article>

      <article className="vizzio-settings-card">
        <h3>DOWNLOAD</h3>
        <div className="vizzio-form-grid">
          <label>
            Parallel streams
            <input type="number" value="4" readOnly />
          </label>
          <label>
            Reconnect interval
            <input type="text" value="6 sec" readOnly />
          </label>
          <label>
            Bandwidth cap
            <input type="text" value="120 MB/s" readOnly />
          </label>
          <label>
            Max speed
            <input type="text" value="Unlimited" readOnly />
          </label>
        </div>
      </article>

      <article className="vizzio-settings-card">
        <h3>SERVER</h3>
        <label className="vizzio-full-label">
          Server URL
          <input type="text" value={apiBase} readOnly />
        </label>
      </article>

      <article className="vizzio-settings-card">
        <h3>ACCOUNT</h3>
        <p className="vizzio-account-text">Signed in as: {username}</p>
        <button type="button" className="btn-link btn-link-danger" onClick={onSignOut}>Sign Out</button>
      </article>
    </section>
  );
}

export default function UserPanel() {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [sectionsOpen, setSectionsOpen] = useState({
    library: true,
    insights: true,
    account: true,
  });

  const pathKey = useMemo(() => {
    const path = location.pathname;
    if (path.startsWith('/user/installed')) return '/user/installed';
    if (path.startsWith('/user/download')) return '/user/download';
    if (path.startsWith('/user/dashboard')) return '/user/dashboard';
    if (path.startsWith('/user/settings')) return '/user/settings';
    return '/user';
  }, [location.pathname]);

  const pageTitle = pageTitleMap[pathKey] || 'All Packages';

  function toggleSection(sectionKey) {
    setSectionsOpen((prev) => ({ ...prev, [sectionKey]: !prev[sectionKey] }));
  }

  function handleLogout() {
    localStorage.removeItem('vizzio_token');
    localStorage.removeItem('vizzio_role');
    localStorage.removeItem('vizzio_username');
    navigate('/');
  }

  function renderPage() {
    switch (pathKey) {
      case '/user/installed':
        return <InstalledPage />;
      case '/user/download':
        return <DownloadPage />;
      case '/user/dashboard':
        return <DashboardPage />;
      case '/user/settings':
        return <SettingsPage onSignOut={handleLogout} />;
      case '/user':
      default:
        return <AllPackagesPage />;
    }
  }

  return (
    <div className="vizzio-user-shell">
      <aside className={`vizzio-sidebar ${collapsed ? 'collapsed' : ''}`}>
        <div className="vizzio-logo">VIZZIO</div>
        <nav className="vizzio-nav">
          {sidebarSections.map((section) => (
            <div key={section.key} className="vizzio-nav-section">
              <button
                type="button"
                className="vizzio-nav-section-head"
                onClick={() => toggleSection(section.key)}
              >
                <span>{section.title}</span>
                <span className={`chevron ${sectionsOpen[section.key] ? 'open' : ''}`}>^</span>
              </button>
              {sectionsOpen[section.key] && (
                <ul>
                  {section.links.map((link) => (
                    <li key={link.to}>
                      <NavLink
                        to={link.to}
                        end={link.to === '/user'}
                        className={({ isActive }) =>
                          `vizzio-nav-link${isActive ? ' active' : ''}`
                        }
                      >
                        {collapsed ? link.label.split(' ')[0] : link.label}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </nav>
      </aside>

      <main className="vizzio-main">
        <header className="vizzio-header">
          <div className="vizzio-header-left">
            <button
              type="button"
              className={`vizzio-menu-btn${collapsed ? ' collapsed' : ''}`}
              onClick={() => setCollapsed((value) => !value)}
              aria-label="Toggle sidebar"
            >
              <span className="vizzio-hamburger-lines" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
            </button>
            <h1>{pageTitle}</h1>
          </div>
          <div className="vizzio-header-right">
            <button type="button" className="vizzio-icon-btn" aria-label="Search">
              S
            </button>
            <button type="button" className="vizzio-avatar" onClick={handleLogout} aria-label="User account">
              U
            </button>
          </div>
        </header>

        <section className="vizzio-content">{renderPage()}</section>
      </main>
    </div>
  );
}
