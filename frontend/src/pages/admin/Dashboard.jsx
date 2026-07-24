import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import StatCard from '../../components/StatCard';
import DeploymentTable from '../../components/DeploymentTable';
import RecentActivity from '../../components/RecentActivity';
import GroupsList from '../../components/GroupsList';
import { fetchAdminDashboard } from '../../api';
import '../../styles/Dashboard.css';

export default function Dashboard() {
  // Store the latest dashboard response from the backend.
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('vizzio_token');
    if (!token) return undefined;

    let isMounted = true;

    // Refresh dashboard numbers while the admin keeps this page open.
    const loadDashboard = () => {
      fetchAdminDashboard(token)
        .then((nextData) => {
          if (isMounted) setData(nextData);
        })
        .catch((loadError) => {
          if (isMounted) setError(loadError.message);
        });
    };

    loadDashboard();
    const refreshTimer = window.setInterval(loadDashboard, 30000);

    // Stop updates after the page is closed to avoid setting state after unmount.
    return () => {
      isMounted = false;
      window.clearInterval(refreshTimer);
    };
  }, []);

  if (error) return <div className="loading error-text">{error}</div>;
  if (!data) return <div className="loading">Loading...</div>;

  const stats = data.stats || {};
  const attention = data.attention || [];
  const totalDeployments = stats.totalDeployments ?? data.deployments?.length ?? 0;
  const totalVersions = stats.totalVersions ?? (stats.stableReleases || 0) + (stats.betaReleases || 0);

  return (
    <main className="dashboard">
      <header className="dashboard-header">
        <p>Overview of your deployments, activity, and group status.</p>
      </header>

      <div className="stats-grid">
        <StatCard title="Deployments" subtitle="Registered package families" value={totalDeployments} change={`${stats.activeDeployments || 0} active`} icon="deployment" />
        <StatCard title="Versions" subtitle="All registered releases" value={totalVersions} change={`${stats.archivedDeployments || 0} archived deployments`} icon="packages" />
        <StatCard title="Stable Releases" subtitle="Production ready packages" value={stats.stableReleases || 0} change="Released stable versions" icon="release" />
        <StatCard title="Groups" subtitle="Managed access groups" value={stats.groups || 0} change={`${stats.activeUsers || 0} active users`} icon="groups" />
      </div>

      <section className="overview-actions" aria-label="Quick actions">
        <OverviewAction to="/deployment" title="Create deployment" description="Start a new deployment family." />
        <OverviewAction to="/version" title="Register version" description="Add a ZIP, 7z, or staged package." />
        <OverviewAction to="/users" title="Manage access" description="Assign users, groups, and deployments." />
        <OverviewAction to="/logs/launcher" title="Launcher reports" description="Review launcher-side failures." />
      </section>

      <section className="attention-panel">
        <div className="attention-header">
          <div>
            <h2>Needs Attention</h2>
            <p>Setup gaps that can block users from seeing or launching deployments.</p>
          </div>
          <span>{attention.length} item{attention.length === 1 ? '' : 's'}</span>
        </div>

        {attention.length === 0 ? (
          <p className="attention-empty">No setup issues found.</p>
        ) : (
          <div className="attention-list">
            {attention.map((item, index) => (
              <div className="attention-item" key={`${item.title}-${index}`}>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </div>
                <Link to={item.href || '/dashboard'}>{item.action || 'Review'}</Link>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="content-grid">
        <div className="main-content">
          <DeploymentTable deployments={data.deployments || []} />
        </div>
        <div className="sidebar-content">
          <RecentActivity activities={data.activities || []} />
          <GroupsList groups={data.groups || []} />
        </div>
      </div>
    </main>
  );
}

function OverviewAction({ to, title, description }) {
  return (
    <Link to={to} className="overview-action">
      <strong>{title}</strong>
      <span>{description}</span>
    </Link>
  );
}
