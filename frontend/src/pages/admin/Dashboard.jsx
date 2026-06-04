import DeploymentTable from '../../components/DeploymentTable';
import GroupsList from '../../components/GroupsList';
import RecentActivity from '../../components/RecentActivity';
import '../../styles/Dashboard.css';

export default function Dashboard() {
  return (
    <main className="dashboard-page">
      <section className="dashboard-widgets">
        <GroupsList />
        <RecentActivity />
      </section>
      <section className="dashboard-table">
        <h2>Recent Deployments</h2>
        <DeploymentTable deployments={[]} />
      </section>
    </main>
  );
}
