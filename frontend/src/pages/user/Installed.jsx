import '../../styles/UserPortal.css';

const installedPackages = [
  {
    id: 'digital-twin',
    title: 'Digital Twin',
    subtitle: 'Stable v1.1.0',
    folder: 'C:\\Vizzio\\DigitalTwin\\stable-1.1.0',
  },
  {
    id: 'traffic-insights',
    title: 'Traffic Insights',
    subtitle: 'Stable v2.0.3',
    folder: 'C:\\Vizzio\\TrafficInsights\\stable-2.0.3',
  },
];

export default function Installed() {
  return (
    <main className="user-page user-installed-page">
      <header className="page-header">
        <p className="page-overline">Installed</p>
        <h1>Installed packages</h1>
      </header>

      <section className="installed-list">
        {installedPackages.map((pkg) => (
          <article key={pkg.id} className="installed-item">
            <div className="installed-item-left">
              <div className="package-thumbnail" />
              <div>
                <h2>{pkg.title}</h2>
                <p>{pkg.subtitle}</p>
                <p className="package-path">{pkg.folder}</p>
              </div>
            </div>
            <div className="installed-item-actions">
              <button className="secondary-btn">Open Folder</button>
              <button className="text-btn">Details</button>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
