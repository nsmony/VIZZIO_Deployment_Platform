import '../../styles/UtilityPages.css';

export default function Help() {
  return (
    <main className="utility-page">
      <p className="utility-description">
        Quick reference for the common admin workflows in the VIZZIO Deployment Portal.
      </p>

      <section className="utility-grid">
        <article className="utility-panel">
          <h3>Deployments</h3>
          <ul className="utility-list">
            <li>Create a deployment for each product, module, or client package family.</li>
            <li>Use pause or cancel when a rollout should stop before users download it.</li>
            <li>Check the dashboard for active deployment counts and recent activity.</li>
          </ul>
        </article>

        <article className="utility-panel">
          <h3>Versions</h3>
          <ul className="utility-list">
            <li>Register each package version with a version number and release channel.</li>
            <li>Upload a ZIP archive or use a valid server archive path.</li>
            <li>Confirm package size, file type, and checksum before releasing.</li>
          </ul>
        </article>

        <article className="utility-panel">
          <h3>Package Uploads</h3>
          <ul className="utility-list">
            <li>If upload fails, confirm the file is a supported archive and the backend is running.</li>
            <li>For large archives, prefer a server-side package path when browser upload limits are too small.</li>
            <li>Keep the package source inside the configured backend package storage area.</li>
          </ul>
        </article>

        <article className="utility-panel">
          <h3>Launcher Downloads</h3>
          <ul className="utility-list">
            <li>Users sign in through the launcher and download released package versions.</li>
            <li>The launcher verifies package checksum before installation.</li>
            <li>Use Download Logs to review who downloaded each version and when.</li>
          </ul>
        </article>
      </section>
    </main>
  );
}
