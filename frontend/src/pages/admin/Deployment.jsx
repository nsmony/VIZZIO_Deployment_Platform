import '../../styles/Deployment.css';
import DeploymentTable from '../../components/DeploymentTable';

export default function Deployment() {
  return (
    <main className="deployment-page">
      <h1>Deployment Management</h1>
      <p>Review and trigger deployment workflows from the admin panel.</p>
      <DeploymentTable deployments={[]} />
    </main>
  );
}
