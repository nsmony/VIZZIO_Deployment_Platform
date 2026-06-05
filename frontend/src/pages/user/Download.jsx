import '../../styles/UserPortal.css';

const activeDownload = {
  title: 'Digital Twin - beta v1.3.0',
  status: 'Downloading',
  progress: 51,
  sizeText: '30 GB / 62 GB',
  speed: '4.2 MB/s',
  remaining: '32 GB',
  estimate: '5 mins',
};

export default function Download() {
  return (
    <main className="user-page user-download-page">
      <header className="page-header">
        <p className="page-overline">Download</p>
        <h1>Active downloads</h1>
      </header>

      <section className="download-card">
        <div className="download-card-heading">
          <div>
            <h2>{activeDownload.title}</h2>
            <p>{activeDownload.status}</p>
          </div>
          <span className="download-percent">{activeDownload.progress}%</span>
        </div>

        <div className="download-meter">
          <div className="download-meter-fill" style={{ width: `${activeDownload.progress}%` }} />
        </div>

        <p className="download-size">{activeDownload.sizeText}</p>

        <div className="download-metrics">
          <div>
            <p className="metric-label">Speed</p>
            <strong>{activeDownload.speed}</strong>
          </div>
          <div>
            <p className="metric-label">Remaining</p>
            <strong>{activeDownload.remaining}</strong>
          </div>
          <div>
            <p className="metric-label">Estimate time</p>
            <strong>{activeDownload.estimate}</strong>
          </div>
          <div>
            <p className="metric-label">Speed</p>
            <strong>{activeDownload.speed}</strong>
          </div>
        </div>

        <div className="download-actions">
          <button className="secondary-btn">Pause</button>
          <button className="danger-btn">Cancel</button>
        </div>
      </section>
    </main>
  );
}
