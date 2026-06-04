import '../../styles/Version.css';

export default function Version() {
  return (
    <main className="version-page">
      <section className="version-card">
        <h1>Deployment Version</h1>
        <p>Track the current application and release version details.</p>
        <div className="version-details">
          <div>
            <strong>App Version</strong>
            <span>1.0.0</span>
          </div>
          <div>
            <strong>Release Channel</strong>
            <span>Stable</span>
          </div>
          <div>
            <strong>Build Timestamp</strong>
            <span>{new Date().toLocaleString()}</span>
          </div>
        </div>
      </section>
    </main>
  );
}
