import { useEffect, useState } from 'react';
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

  return (
    <main className="dashboard">
      <header className="dashboard-header">
        <p>Overview of your deployments, activity, and group status.</p>
      </header>

      <div className="stats-grid">
        <StatCard title="Groups" subtitle="Managed workspaces" value={data.stats.groups} change="5.1% last month" trend="up" icon="groups" />
        <StatCard title="Active Deployments" subtitle="Live rollout count" value={data.stats.activeDeployments} change="4.6% this week" trend="up" icon="deployment" />
        <StatCard title="Stable Releases" subtitle="Production ready packages" value={data.stats.stableReleases} change="No change this week" trend="flat" icon="release" />
        <StatCard title="Beta Releases" subtitle="Packages in testing" value={data.stats.betaReleases} change="2.1% this week" trend="down" icon="release" />
      </div>

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

