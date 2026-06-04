import '../../styles/Deployment.css';

export default function Deployment() {
  return (
    <main className="deployment-page">
      <header className="page-header">
        <div>
          <p>Manage your Digital Twin deployments and release packages from a single workspace.</p>
        </div>
        <button className="primary-btn">+ New Deployment</button>
      </header>

      <section className="deployment-panel">
        <div className="deployment-table-header">
          <span>Name</span>
          <span>Description</span>
          <span>Versions</span>
          <span>Users</span>
          <span>Created</span>
        </div>

        <div className="empty-state-card">
          <div className="empty-state-illustration">
            <svg viewBox="0 0 220 220" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="24" y="48" width="86" height="94" rx="18" fill="#E9EFFB" />
              <rect x="110" y="22" width="86" height="122" rx="18" fill="#D7E4FC" />
              <rect x="38" y="66" width="56" height="12" rx="6" fill="#CBD5E1" />
              <rect x="38" y="90" width="40" height="10" rx="5" fill="#CBD5E1" />
              <rect x="38" y="108" width="28" height="10" rx="5" fill="#CBD5E1" />
              <rect x="124" y="44" width="52" height="14" rx="7" fill="#CBD5E1" />
              <rect x="124" y="72" width="36" height="10" rx="5" fill="#CBD5E1" />
              <circle cx="150" cy="168" r="24" fill="#2563EB" />
              <path d="M148 163L152.5 169L158 161" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="76" cy="146" r="16" fill="#A7B8E4" />
              <path d="M72 146L78 152L84 144" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          <div className="empty-state-content">
            <h2>No deployments yet.</h2>
            <p>LetΓÇÖs build your first Digital Twin package and bring your smart infrastructure online.</p>
          </div>
        </div>
      </section>
    </main>
  );
}

