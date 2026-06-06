import { useEffect, useState } from 'react';
import StatCard from '../../components/StatCard';
import DeploymentTable from '../../components/DeploymentTable';
import RecentActivity from '../../components/RecentActivity';
import GroupsList from '../../components/GroupsList';
import '../../styles/Dashboard.css';

export default function Dashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('vizzio_token');
    if (token) {
      // TODO: Replace with real API call
      setData({
        stats: {
          groups: 1234,
          activeDeployments: 50,
          stableReleases: 40,
          betaReleases: 10,
        },
      });
    }
  }, []);

  const mockDeployments = [
    {
      module: 'Digital Twin',
      latestBeta: 'v1.2.1',
      stableVersion: 'v1.2.0',
      status: 'Released',
      lastUpdated: '3 days ago',
    },
  ];

  const mockActivities = [
    { name: 'DigitalTwin v2.4.0.2', description: 'deployed on staging' },
    { name: 'DataPipeline', description: 'updated on health checks' },
    { name: 'Sensorbot', description: 'refresh updated by John' },
    { name: 'AuthGateway', description: 'updated after deployment' },
    { name: 'LiveConnect v2.1.4', description: 'migrated to stable' },
  ];

  const mockGroups = [
    { name: 'Kagel Smart Infra', users: 11, status: 'Active' },
    { name: 'Stellar Lifestyle Retail', users: 3, status: 'Active' },
    { name: 'AETOS Command Centre', users: 24, status: 'Active' },
    { name: 'Surbana Jurong BIM', users: 5, status: 'Active' },
  ];

  if (!data) return <div className="loading">Loading...</div>;

  return (
    <main className="dashboard">
      <header className="dashboard-header">
        <p>Overview of your deployments, activity, and group status.</p>
      </header>

      <div className="stats-grid">
        <StatCard title="Groups" subtitle="Managed workspaces" value={data.stats.groups} change="5.1% last month" trend="up" icon="groups" accent="#2563eb" />
        <StatCard title="Active Deployments" subtitle="Live rollout count" value={data.stats.activeDeployments} change="4.6% this week" trend="up" icon="deployment" accent="#0f766e" />
        <StatCard title="Stable Releases" subtitle="Production ready packages" value={data.stats.stableReleases} change="No change this week" trend="flat" icon="release" accent="#7c3aed" />
        <StatCard title="Beta Releases" subtitle="Packages in testing" value={data.stats.betaReleases} change="2.1% this week" trend="down" icon="release" accent="#f59e0b" />
      </div>

      <div className="content-grid">
        <div className="main-content">
          <DeploymentTable deployments={mockDeployments} />
        </div>
        <div className="sidebar-content">
          <RecentActivity activities={mockActivities} />
          <GroupsList groups={mockGroups} />
        </div>
      </div>
    </main>
  );
}

