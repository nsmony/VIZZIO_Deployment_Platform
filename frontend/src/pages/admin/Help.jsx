import { useMemo, useState } from 'react';
import '../../styles/UtilityPages.css';

const helpTopics = [
  {
    id: 'deployments',
    title: 'Deployments',
    summary: 'Create, archive, restore, and manage product or package families.',
    tone: 'blue',
    icon: 'deployments',
    steps: [
      'Create one deployment for each product, module, or client package family.',
      'Archive, restore, or delete a deployment when the action should apply to its entire version family.',
      'Use Overview to monitor active deployments and recent activity.',
    ],
  },
  {
    id: 'versions',
    title: 'Versions',
    summary: 'Register package versions, release channels, and archive sources.',
    tone: 'green',
    icon: 'versions',
    steps: [
      'Register each package with a version number and stable or beta release channel.',
      'Upload ZIP or 7z archives, or select a source inside the backend package root.',
      'Archive, restore, or delete here when the action should affect only one version.',
    ],
  },
  {
    id: 'validation',
    title: 'Package Validation',
    summary: 'Understand how ZIP and 7z packages are inspected by the backend.',
    tone: 'purple',
    icon: 'validation',
    steps: [
      'Every package must contain a top-level .bat launch script.',
      'ZIP files are inspected directly; 7z files require 7z or 7za on the backend PC.',
      'The detected launch script appears in the Version form after validation.',
    ],
  },
  {
    id: 'downloads',
    title: 'Launcher Downloads',
    summary: 'Download, verify, install, and launch released package versions.',
    tone: 'orange',
    icon: 'downloads',
    steps: [
      'Users sign in through the launcher and can download released versions they can access.',
      'The launcher verifies the package checksum before installation.',
      'Use Download Logs and Launcher Reports to investigate download, install, launch, or update failures.',
    ],
  },
  {
    id: 'readiness',
    title: 'Hosted PC Readiness',
    summary: 'Prepare the hosted PC before exposing the portal and backend.',
    tone: 'teal',
    icon: 'readiness',
    steps: [
      'Open Settings, select Server, and run Test Connection.',
      'Confirm the database URL, secure token secrets, storage paths, backend port, and 7z availability.',
      'Set frontend and launcher API URLs to the hosted or Cloudflare Tunnel hostname.',
    ],
  },
  {
    id: 'prerequisites',
    title: 'Deployment Prerequisites',
    summary: 'Define required files, checks, environment values, and ports.',
    tone: 'red',
    icon: 'prerequisites',
    steps: [
      'Place prerequisites.json beside the package launch batch script.',
      'Use command, file, or environment checks for deployment-specific requirements.',
      'Declare required ports so the launcher can block conflicts before starting a deployment.',
    ],
  },
];

export default function Help() {
  const [search, setSearch] = useState('');
  const [openTopic, setOpenTopic] = useState(null);

  const filteredTopics = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return helpTopics;
    return helpTopics.filter((topic) =>
      [topic.title, topic.summary, ...topic.steps].some((value) => value.toLowerCase().includes(query))
    );
  }, [search]);

  return (
    <main className="help-page">
      <header className="help-heading">
        <div>
          <h2>Help &amp; Docs</h2>
          <p>Quick reference for common admin workflows in the VIZZIO Deployment Portal.</p>
        </div>
        <label className="help-search">
          <HelpIcon name="search" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search documentation..."
            aria-label="Search help documentation"
          />
          {search && <button type="button" onClick={() => setSearch('')} aria-label="Clear search">×</button>}
        </label>
      </header>

      <section className="help-topics" aria-live="polite">
        {filteredTopics.map((topic) => {
          const isOpen = openTopic === topic.id;
          return (
            <article className={`help-topic${isOpen ? ' open' : ''}`} key={topic.id}>
              <button
                className="help-topic-summary"
                type="button"
                onClick={() => setOpenTopic(isOpen ? null : topic.id)}
                aria-expanded={isOpen}
              >
                <span className={`help-topic-icon ${topic.tone}`}><HelpIcon name={topic.icon} /></span>
                <span className="help-topic-copy">
                  <strong>{topic.title}</strong>
                  <span>{topic.summary}</span>
                </span>
                <span className="help-topic-chevron" aria-hidden="true" />
              </button>
              {isOpen && (
                <div className="help-topic-details">
                  <ol>
                    {topic.steps.map((step) => <li key={step}>{step}</li>)}
                  </ol>
                </div>
              )}
            </article>
          );
        })}

        {filteredTopics.length === 0 && (
          <div className="help-empty">
            <h3>No help topics found</h3>
            <p>Try a broader term or contact support for assistance.</p>
          </div>
        )}
      </section>

      <footer className="help-support">
        <div>
          <HelpIcon name="help" />
          <span>Can&apos;t find what you&apos;re looking for?</span>
        </div>
        <a href="mailto:support@vizzio.local">Contact Support</a>
      </footer>
    </main>
  );
}

function HelpIcon({ name }) {
  const paths = {
    search: 'm21 21-4.3-4.3M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',
    deployments: 'M5 5h14v14H5V5Zm4 4h6v6H9V9Z',
    versions: 'M20 12 12 20 4 12l8-8h6l2 2v6Z',
    validation: 'M12 3 5 6v5c0 4.6 2.8 8 7 10 4.2-2 7-5.4 7-10V6l-7-3Zm-3 9 2 2 4-4',
    downloads: 'M12 3v12m-4-4 4 4 4-4M5 20h14',
    readiness: 'M4 5h16v11H4V5Zm5 15h6m-3-4v4',
    prerequisites: 'M8 4h8m-8 4h8m-8 4h8m-8 4h5M6 3h12v18H6V3Z',
    help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-2.2-11a2.3 2.3 0 1 1 3.6 1.9c-.8.5-1.4 1-1.4 2.1m0 3h.01',
  };

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={paths[name] || paths.help} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
