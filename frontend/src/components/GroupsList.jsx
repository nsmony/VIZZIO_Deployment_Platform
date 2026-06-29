import '../styles/GroupsList.css';

export default function GroupsList({ groups }) {
  return (
    <div className="groups-section">
      <div className="section-header">
        <h3>Groups</h3>
      </div>
      <div className="groups-list">
        {groups.map((group, idx) => (
          <div key={idx} className="group-item">
            <div className="group-name">{group.name}</div>
            <div className="group-users">{group.users} Users</div>
            <div className={`group-status ${group.status.toLowerCase()}`}>{group.status}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
