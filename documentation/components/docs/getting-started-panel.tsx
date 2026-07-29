import Link from 'next/link';

export function GettingStartedPanel() {
  return (
    <aside className="getting-started-panel" aria-labelledby="getting-started-title">
      <p className="docs-eyebrow">New to VIZZIO?</p>
      <h2 id="getting-started-title">Getting Started</h2>
      <p>
        Begin with the platform overview, confirm the deployment environment, then
        understand how the system components work together.
      </p>
      <ul>
        <li><Link href="/docs/getting-started/overview">Platform Overview →</Link></li>
        <li><Link href="/docs/getting-started/deployment-prerequisites">Prerequisites →</Link></li>
        <li><Link href="/docs/architecture/architecture">Architecture →</Link></li>
      </ul>
    </aside>
  );
}
