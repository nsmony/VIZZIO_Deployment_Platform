import '../../styles/UserPortal.css';

export default function UserPortal() {
  return (
    <main className="user-portal-page">
      <section className="user-portal-card">
        <h1>User Portal</h1>
        <p>This is the user-facing page for non-admin users. Replace this placeholder with the user-side experience you want to build.</p>
        <div className="user-portal-actions">
          <button className="primary-btn">View Deployments</button>
          <button className="secondary-btn">Account Settings</button>
        </div>
      </section>
    </main>
  );
}
