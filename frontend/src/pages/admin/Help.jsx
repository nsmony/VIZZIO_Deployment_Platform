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
            <li>Archive, restore, or delete from Deployments when the action should apply to the whole deployment family.</li>
            <li>Archiving a deployment archives every version under that deployment.</li>
            <li>Check the dashboard for active deployment counts and recent activity.</li>
          </ul>
        </article>

        <article className="utility-panel">
          <h3>Versions</h3>
          <ul className="utility-list">
            <li>Register each package version with a version number and release channel.</li>
            <li>Use Upload archive for ZIP or 7z files from your computer.</li>
            <li>Use server archive or staging folder only for paths inside the backend package root.</li>
            <li>Every package source must contain a top-level .bat launch script.</li>
            <li>Archive, restore, or delete from Versions when the action should affect only one package version.</li>
          </ul>
        </article>

        <article className="utility-panel">
          <h3>Package Validation</h3>
          <ul className="utility-list">
            <li>ZIP files are inspected directly by the backend.</li>
            <li>7z files require 7z or 7za on the backend PC.</li>
            <li>Nested launch scripts such as Package/Launch.bat are rejected.</li>
            <li>The Version form shows the detected launch batch script after validation.</li>
          </ul>
        </article>

        <article className="utility-panel">
          <h3>Launcher Downloads</h3>
          <ul className="utility-list">
            <li>Users sign in through the launcher and download released package versions.</li>
            <li>The launcher verifies package checksum before installation.</li>
            <li>Use Download Logs to review who downloaded each version and when.</li>
            <li>Use Launcher Reports to review download/install, launch, prerequisite, and update failures.</li>
          </ul>
        </article>

        <article className="utility-panel">
          <h3>Hosted PC Readiness</h3>
          <ul className="utility-list">
            <li>Open Settings, then Server, then Test Connection before exposing the app.</li>
            <li>Confirm database URL, secure token secrets, storage paths, and backend port.</li>
            <li>Confirm 7z or 7za is available if accepting 7z packages.</li>
            <li>Set frontend and launcher API URLs to the Cloudflare Tunnel hostname.</li>
          </ul>
        </article>

        <article className="utility-panel">
          <h3>Deployment Prerequisites</h3>
          <ul className="utility-list">
            <li>Place prerequisites.json beside the package launch batch script when a deployment needs local checks.</li>
            <li>Use command, file, or environment checks for deployment-specific requirements.</li>
            <li>Declare required ports so the launcher can block conflicts before running the deployment.</li>
          </ul>
        </article>
      </section>
    </main>
  );
}
