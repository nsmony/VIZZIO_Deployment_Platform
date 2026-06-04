import '../../styles/Users.css';

export default function Users() {
  return (
    <main className="users-page">
      <h1>User Administration</h1>
      <p>Manage user accounts, permissions, and access levels.</p>
      <div className="users-grid">
        <div className="users-card">
          <h2>Admins</h2>
          <p>Admin users can manage deployments and system settings.</p>
        </div>
        <div className="users-card">
          <h2>Users</h2>
          <p>Standard users can view deployments and launcher status.</p>
        </div>
      </div>
    </main>
  );
}
