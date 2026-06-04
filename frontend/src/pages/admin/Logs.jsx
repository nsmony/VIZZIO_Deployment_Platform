import '../../styles/Logs.css';

export default function Logs() {
  return (
    <main className="logs-page">
      <h1>Download Logs</h1>
      <p>Select a log package to download and inspect deployment history.</p>
      <div className="logs-actions">
        <button className="primary-btn">Download Latest Logs</button>
        <button className="secondary-btn">Show Log Directory</button>
      </div>
    </main>
  );
}
