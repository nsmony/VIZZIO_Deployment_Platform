import { useMemo, useState } from 'react';
import '../../styles/Users.css';

const initialUsers = [
  {
    id: 'u1',
    name: 'Alex Johnson',
    email: 'alex.johnson@acmetcorp.com',
    role: 'Admin',
    status: 'Active',
    deployments: 12,
    lastLogin: 'May 20, 2024 10:30 AM',
    groups: ['Engineering'],
  },
  {
    id: 'u2',
    name: 'Maya Patel',
    email: 'maya.patel@acmetcorp.com',
    role: 'User',
    status: 'Active',
    deployments: 8,
    lastLogin: 'May 18, 2024 09:14 AM',
    groups: ['Ops'],
  },
  {
    id: 'u3',
    name: 'Noah Carter',
    email: 'noah.carter@acmetcorp.com',
    role: 'User',
    status: 'Inactive',
    deployments: 3,
    lastLogin: 'May 12, 2024 02:27 PM',
    groups: ['Analytics'],
  },
];

const initialGroups = ['Engineering', 'Ops', 'Analytics'];

export default function Users() {
  const [users, setUsers] = useState(initialUsers);
  const [groups, setGroups] = useState(initialGroups);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('All Users');
  const [filterGroup, setFilterGroup] = useState('All Groups');

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const matchesSearch =
        user.name.toLowerCase().includes(search.toLowerCase()) ||
        user.email.toLowerCase().includes(search.toLowerCase());
      const matchesRole = filterRole === 'All Users' || user.role === filterRole;
      const matchesGroup =
        filterGroup === 'All Groups' || user.groups.includes(filterGroup);
      return matchesSearch && matchesRole && matchesGroup;
    });
  }, [users, search, filterRole, filterGroup]);

  const addUser = () => {
    const name = window.prompt('New user name');
    const email = window.prompt('New user email');
    if (!name || !email) return;

    setUsers((current) => [
      ...current,
      {
        id: `u${current.length + 1}`,
        name,
        email,
        role: 'User',
        status: 'Active',
        deployments: 0,
        lastLogin: 'Never',
        groups: [],
      },
    ]);
  };

  const addGroup = () => {
    const groupName = window.prompt('New user group name');
    if (!groupName) return;
    setGroups((current) => [...current, groupName]);
  };

  const editUser = (userId) => {
    const user = users.find((item) => item.id === userId);
    if (!user) return;
    const newRole = window.prompt('Update role (Admin / User)', user.role);
    if (!newRole) return;
    const groupName = window.prompt('Assign group (existing or new)', user.groups[0] || '');
    setUsers((current) =>
      current.map((item) =>
        item.id === userId
          ? {
              ...item,
              role: ['Admin', 'User'].includes(newRole) ? newRole : item.role,
              groups: groupName ? [groupName] : item.groups,
            }
          : item
      )
    );
    if (groupName && !groups.includes(groupName)) {
      setGroups((current) => [...current, groupName]);
    }
  };

  const deleteUser = (userId) => {
    if (window.confirm('Delete this user?')) {
      setUsers((current) => current.filter((item) => item.id !== userId));
    }
  };

  const addUserToGroup = (userId) => {
    const groupName = window.prompt('Add user to group', groups[0] || '');
    if (!groupName) return;
    setUsers((current) =>
      current.map((item) =>
        item.id === userId && !item.groups.includes(groupName)
          ? { ...item, groups: [...item.groups, groupName] }
          : item
      )
    );
    if (!groups.includes(groupName)) {
      setGroups((current) => [...current, groupName]);
    }
  };

  return (
    <main className="users-page">
      <section className="users-toolbar">
        <div className="users-filters">
          <div className="search-input">
            <span aria-hidden="true">🔎</span>
            <input
              type="text"
              placeholder="Search users"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <select value={filterRole} onChange={(event) => setFilterRole(event.target.value)}>
            <option>All Users</option>
            <option>Admin</option>
            <option>User</option>
          </select>

          <select value={filterGroup} onChange={(event) => setFilterGroup(event.target.value)}>
            <option>All Groups</option>
            {groups.map((group) => (
              <option key={group}>{group}</option>
            ))}
          </select>
        </div>

        <div className="users-actions">
          <button className="secondary-btn" onClick={addUser}>New User</button>
          <button className="primary-btn" onClick={addGroup}>New User Group</button>
        </div>
      </section>

      <section className="users-panel">
        <table className="users-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Status</th>
              <th>Deployments</th>
              <th>Last Login</th>
              <th>Controls</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => (
              <tr key={user.id}>
                <td>
                  <div className="user-cell">
                    <div className="avatar">{user.name.charAt(0)}</div>
                    <div>
                      <strong>{user.name}</strong>
                      <div className="user-email">{user.email}</div>
                      {user.groups.length > 0 && (
                        <div className="group-tags">
                          {user.groups.map((group) => (
                            <span key={group} className="group-pill">{group}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td>{user.role}</td>
                <td>
                  <span className={`status-dot ${user.status === 'Active' ? 'active' : 'inactive'}`} />
                  {user.status}
                </td>
                <td>{user.deployments}</td>
                <td>{user.lastLogin}</td>
                <td className="controls-cell">
                  <button className="icon-btn" onClick={() => editUser(user.id)} title="Edit user" aria-label="Edit user">✎</button>
                  <button className="icon-btn" onClick={() => addUserToGroup(user.id)} title="Add user to group" aria-label="Add user to group">➕</button>
                  <button className="icon-btn danger" onClick={() => deleteUser(user.id)} title="Delete user" aria-label="Delete user">🗑️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}

