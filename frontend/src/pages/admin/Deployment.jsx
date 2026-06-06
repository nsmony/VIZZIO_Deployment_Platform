import '../../styles/Deployment.css';

export default function Deployment() {
  return (
    <main className="deployment-page">
      <header className="page-header">
        <button className="primary-btn">+ New Deployment</button>
      </header>

      <section className="deployment-panel">
        <div className="empty-state-card deployment-empty-state">
          <div className="empty-state-illustration" aria-hidden="true">
            <svg viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="20" y="22" width="56" height="48" rx="14" stroke="#2563EB" strokeWidth="3" />
              <path d="M32 38h32M32 48h20M32 58h12" stroke="#2563EB" strokeWidth="3" strokeLinecap="round" />
              <path d="M67 57l10-10M67 47l10 10" stroke="#0F766E" strokeWidth="3" strokeLinecap="round" />
              <circle cx="48" cy="74" r="7" fill="#2563EB" opacity="0.12" />
            </svg>
          </div>

          <div className="empty-state-content">
            <h2>No deployments yet</h2>
            <p>Create your first deployment to publish a release package and start managing rollout versions from one workspace.</p>
            <button className="primary-btn">Create deployment</button>
          </div>
        </div>
      </section>
    </main>
  );
}

