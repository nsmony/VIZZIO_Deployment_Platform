import StatusBadge from './StatusBadge';
import '../../styles/Deployment.css';

function CardActionIcon({ type }) {
  if (type === 'view') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
        <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
        <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      </svg>
    );
  }

  if (type === 'edit') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5Z" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <path d="M12 6.5h.01" />
      <path d="M12 12h.01" />
      <path d="M12 17.5h.01" />
    </svg>
  );
}

export default function DeploymentCard({ deployment, onView, onEdit, onToggleMenu, menuOpen, onCopyId, onArchive, onRestore, onDelete }) {
  const isArchived = deployment.displayStatus === 'Archived';

  return (
    <article className="deployment-card">
      <div className="deployment-card-top">
        <div className="deployment-card-icon">
          {deployment.logoUrl ? <img src={deployment.logoUrl} alt="" /> : deployment.name.slice(0, 1).toUpperCase()}
        </div>
        <div className="deployment-card-copy">
          <h3>{deployment.name}</h3>
          <p>{deployment.description || 'No description provided.'}</p>
        </div>
        <StatusBadge status={deployment.displayStatus} />
      </div>

      <dl className="deployment-card-stats">
        <div>
          <dt>Versions</dt>
          <dd>{deployment.versionCount}</dd>
        </div>
        <div>
          <dt>Released</dt>
          <dd>{deployment.releasedCount}</dd>
        </div>
        <div>
          <dt>Created</dt>
          <dd>{deployment.createdLabel}</dd>
        </div>
      </dl>

      <div className="deployment-card-actions">
        <button className="secondary-btn" type="button" onClick={() => onView(deployment)}>
          <CardActionIcon type="view" />
          View
        </button>
        <button className="secondary-btn" type="button" onClick={() => onEdit(deployment)}>
          <CardActionIcon type="edit" />
          Edit
        </button>
        <div className="deployment-more">
          <button className="icon-more-btn" type="button" onClick={() => onToggleMenu(deployment.id)} aria-label={`More actions for ${deployment.name}`}>
            <CardActionIcon type="more" />
          </button>
          {menuOpen && (
            <div className="deployment-more-menu">
              <button type="button" onClick={() => onView(deployment)}>View details</button>
              <button type="button" onClick={() => onCopyId(deployment)}>Copy ID</button>
              {isArchived ? (
                <button type="button" onClick={() => onRestore(deployment)}>Restore draft</button>
              ) : (
                <button type="button" onClick={() => onArchive(deployment)}>Archive deployment</button>
              )}
              <button className="danger" type="button" onClick={() => onDelete(deployment)}>Delete deployment</button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
