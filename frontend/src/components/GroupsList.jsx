import '../styles/GroupsList.css';

export default function GroupsList({ groups }) {
  return (
    <div className="groups-section">
      <div className="section-header">
        <h3>Groups</h3>
      </div>
      <div className="groups-list">
        {groups.length === 0 ? (
          <p className="groups-empty">No groups created yet.</p>
        ) : (
          groups.map((group, idx) => (
            <div key={`${group.name}-${idx}`} className="group-item">
              <div className="group-name">{group.name}</div>
              <div className="group-users">{group.users} Users</div>
              <div className={`group-status ${String(group.status).toLowerCase().replace(/\s+/g, '-')}`}>{group.status}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
