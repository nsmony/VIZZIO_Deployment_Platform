import { useEffect, useState } from 'react';
import { fetchUploadedPackages, uploadPackage } from '../../api';
import '../../styles/Deployment.css';

export default function Deployment() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [title, setTitle] = useState('');
  const [packages, setPackages] = useState([]);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);

  async function loadPackages() {
    const token = localStorage.getItem('vizzio_token');

    if (!token) return;

    try {
      const result = await fetchUploadedPackages(token);
      setPackages(result.packages || []);
    } catch (loadError) {
      setError(loadError.message);
    }
  }

  useEffect(() => {
    loadPackages();
  }, []);

  async function handleUpload(event) {
    event.preventDefault();

    if (!selectedFile) {
      setError('Choose a file to upload.');
      return;
    }

    const token = localStorage.getItem('vizzio_token');

    if (!token) {
      setError('Please sign in again before uploading.');
      return;
    }

    setUploading(true);
    setStatus('Uploading package...');
    setError('');

    try {
      await uploadPackage(token, selectedFile, title);
      setStatus('Package uploaded. Users can download it from their library.');
      setSelectedFile(null);
      setTitle('');
      event.target.reset();
      await loadPackages();
    } catch (uploadError) {
      setStatus('');
      setError(uploadError.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <main className="deployment-page">
      <header className="page-header">
        <button className="primary-btn" type="button">+ New Deployment</button>
      </header>

      <section className="deployment-panel">
        <form className="deployment-upload-form" onSubmit={handleUpload}>
          <div>
            <h2>Upload release package</h2>
            <p>Publish a build file to the user package library.</p>
          </div>

          <label>
            Package title
            <input
              type="text"
              placeholder="Digital Twin Core v1.3.0"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>

          <label>
            Build file
            <input
              type="file"
              onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
            />
          </label>

          <button className="primary-btn" type="submit" disabled={uploading}>
            {uploading ? 'Uploading...' : 'Upload package'}
          </button>

          {(status || error) && (
            <p className={`deployment-status${error ? ' error' : ''}`}>
              {error || status}
            </p>
          )}
        </form>

        <div className="deployment-upload-list">
          <h2>Uploaded packages</h2>
          {packages.length === 0 ? (
            <p className="deployment-muted">No packages uploaded yet.</p>
          ) : (
            packages.map((item) => (
              <div className="deployment-upload-row" key={item.fileId}>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.originalName}</p>
                </div>
                <span>{Math.max(1, Math.round(item.size / 1024 / 1024))} MB</span>
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
