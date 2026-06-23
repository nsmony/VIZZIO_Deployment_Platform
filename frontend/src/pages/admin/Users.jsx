import { useEffect, useMemo, useState } from 'react';
import {
  createGroup,
  createUser,
  deleteUser,
  disableUser,
  fetchDeployments,
  fetchGroups,
  fetchUsers,
  resetUserPassword,
  updateGroup,
  updateUser,
} from '../../api';
import '../../styles/Users.css';

const emptyForm = {
  name: '',
  email: '',
  role: 'User',
  status: 'Active',
  groups: [],
  password: '',
};

const emptyGroupForm = {
  name: '',
  deploymentIds: [],
  memberIds: [],
};

const credentialStorageKey = 'vizzio_user_credentials';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [deployments, setDeployments] = useState([]);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('All Users');
  const [filterGroup, setFilterGroup] = useState('All Groups');
  const [form, setForm] = useState(emptyForm);
  const [groupForm, setGroupForm] = useState(emptyGroupForm);
  const [editingUser, setEditingUser] = useState(null);
  const [editingGroup, setEditingGroup] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isGroupFormOpen, setIsGroupFormOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [credentials, setCredentials] = useState(null);
  const [userCredentials, setUserCredentials] = useState(loadStoredCredentials);
  const [openUserMenuId, setOpenUserMenuId] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const token = localStorage.getItem('vizzio_token');

  useEffect(() => {
    loadData();
  }, []);

  const groupNames = useMemo(() => groups.map((group) => group.name), [groups]);

  const deploymentById = useMemo(() => {
    return deployments.reduce((lookup, deployment) => {
      lookup[deployment.id] = deployment;
      return lookup;
    }, {});
  }, [deployments]);

  const filteredUsers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return users.filter((user) => {
      const matchesSearch =
        !normalizedSearch ||
        user.name.toLowerCase().includes(normalizedSearch) ||
        user.email.toLowerCase().includes(normalizedSearch);
      const matchesRole = filterRole === 'All Users' || user.role === filterRole;
      const matchesGroup =
        filterGroup === 'All Groups' || (user.groups || []).includes(filterGroup);
      return matchesSearch && matchesRole && matchesGroup;
    });
  }, [users, search, filterRole, filterGroup]);

  async function loadData() {
    setIsLoading(true);
    setError('');

    try {
      const [usersData, groupsData, deploymentsData] = await Promise.all([
        fetchUsers(token),
        fetchGroups(token),
        fetchDeployments(token),
      ]);
      setUsers(usersData.users || []);
      setGroups(groupsData.groups || []);
      setDeployments(deploymentsData.deployments || []);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setIsLoading(false);
    }
  }

  function openCreateForm() {
    setEditingUser(null);
    setForm(emptyForm);
    setMessage('');
    setError('');
    setIsFormOpen(true);
  }

  function openEditForm(user) {
    setOpenUserMenuId(null);
    setEditingUser(user);
    setForm({
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      groups: user.groups || [],
      password: '',
    });
    setMessage('');
    setError('');
    setIsFormOpen(true);
  }

  function closeForm() {
    if (isSaving) return;
    setIsFormOpen(false);
    setEditingUser(null);
    setForm(emptyForm);
  }

  function openCreateGroupForm() {
    setEditingGroup(null);
    setGroupForm(emptyGroupForm);
    setMessage('');
    setError('');
    setIsGroupFormOpen(true);
  }

  function openEditGroupForm(group) {
    setEditingGroup(group);
    setGroupForm({
      name: group.name,
      deploymentIds: group.deploymentIds || [],
      memberIds: users
        .filter((user) => (user.groups || []).includes(group.name))
        .map((user) => user.id),
    });
    setMessage('');
    setError('');
    setIsGroupFormOpen(true);
  }

  function closeGroupForm() {
    if (isSaving) return;
    setIsGroupFormOpen(false);
    setEditingGroup(null);
    setGroupForm(emptyGroupForm);
  }

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateGroupField(field, value) {
    setGroupForm((current) => ({ ...current, [field]: value }));
  }

  function toggleUserGroup(groupName) {
    setForm((current) => ({
      ...current,
      groups: current.groups.includes(groupName)
        ? current.groups.filter((name) => name !== groupName)
        : [...current.groups, groupName],
    }));
  }

  function toggleGroupDeployment(deploymentId) {
    setGroupForm((current) => ({
      ...current,
      deploymentIds: current.deploymentIds.includes(deploymentId)
        ? current.deploymentIds.filter((id) => id !== deploymentId)
        : [...current.deploymentIds, deploymentId],
    }));
  }

  function toggleGroupMember(userId) {
    setGroupForm((current) => ({
      ...current,
      memberIds: current.memberIds.includes(userId)
        ? current.memberIds.filter((id) => id !== userId)
        : [...current.memberIds, userId],
    }));
  }

  async function saveUser(event) {
    event.preventDefault();
    setIsSaving(true);
    setError('');
    setMessage('');

    const payload = {
      name: form.name.trim(),
      email: form.email.trim(),
      role: form.role,
      status: form.status,
      groups: form.groups,
    };

    if (!editingUser && form.password.trim()) {
      payload.password = form.password.trim();
    }

    try {
      if (editingUser) {
        const data = await updateUser(token, editingUser.id, payload);
        setUsers((current) =>
          current.map((user) => (user.id === editingUser.id ? data.user : user))
        );
        setMessage(`${data.user.name} was updated.`);
      } else {
        const data = await createUser(token, payload);
        setUsers((current) => [...current, data.user]);
        if (data.temporaryPassword) {
          const credential = {
            userId: data.user.id,
            username: data.user.username,
            name: data.user.name,
            email: data.user.email,
            password: data.temporaryPassword,
          };
          setCredentials(credential);
          setUserCredentials((current) => storeCredentials({ ...current, [data.user.id]: credential }));
        }
        setMessage(`${data.user.name} was created.`);
      }

      setIsFormOpen(false);
      setEditingUser(null);
      setForm(emptyForm);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function saveGroup(event) {
    event.preventDefault();
    setIsSaving(true);
    setError('');
    setMessage('');

    const previousGroup = editingGroup;
    const previousGroupName = previousGroup?.name;
    const nextGroupName = groupForm.name.trim();
    const payload = {
      name: nextGroupName,
      deploymentIds: groupForm.deploymentIds,
    };

    try {
      let savedGroup;
      if (editingGroup) {
        const data = await updateGroup(token, editingGroup.id, payload);
        savedGroup = data.group;
        setMessage(`${data.group.name} access was updated.`);
      } else {
        const data = await createGroup(token, payload);
        savedGroup = data.group;
        setMessage(`${data.group.name} group was created.`);
      }

      await syncGroupMembers(savedGroup, previousGroupName);
      await loadData();
      setIsGroupFormOpen(false);
      setEditingGroup(null);
      setGroupForm(emptyGroupForm);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDisable(user) {
    setOpenUserMenuId(null);
    if (user.status === 'Inactive') {
      setMessage(`${user.name} is already disabled.`);
      return;
    }

    if (!window.confirm(`Disable ${user.name}?`)) {
      return;
    }

    setError('');
    setMessage('');

    try {
      const data = await disableUser(token, user.id);
      setUsers((current) => current.map((item) => (item.id === user.id ? data.user : item)));
      setMessage(`${data.user.name} was disabled.`);
    } catch (disableError) {
      setError(disableError.message);
    }
  }

  async function handleResetPassword(user) {
    setOpenUserMenuId(null);
    if (!window.confirm(`Reset password for ${user.name}?`)) {
      return;
    }

    setError('');
    setMessage('');

    try {
      const data = await resetUserPassword(token, user.id);
      setUsers((current) => current.map((item) => (item.id === user.id ? data.user : item)));
      const credential = {
        userId: data.user.id,
        username: data.user.username,
        name: data.user.name,
        email: data.user.email,
        password: data.temporaryPassword,
      };
      setCredentials(credential);
      setUserCredentials((current) => storeCredentials({ ...current, [data.user.id]: credential }));
      setMessage(`Password was reset for ${data.user.name}.`);
    } catch (resetError) {
      setError(resetError.message);
    }
  }

  async function handleDeleteUser(user) {
    setOpenUserMenuId(null);
    if (!window.confirm(`Delete ${user.name}? This cannot be undone.`)) {
      return;
    }

    setError('');
    setMessage('');

    try {
      await deleteUser(token, user.id);
      setUsers((current) => current.filter((item) => item.id !== user.id));
      setUserCredentials((current) => {
        const next = { ...current };
        delete next[user.id];
        return storeCredentials(next);
      });
      setMessage(`${user.name} was deleted.`);
    } catch (deleteError) {
      setError(deleteError.message);
    }
  }

  async function copyCredentials() {
    if (!credentials) return;

    const text = [
      `VIZZIO Deployment Platform credentials`,
      `Name: ${credentials.name}`,
      `Username: ${credentials.username || credentials.email}`,
      `Email: ${credentials.email}`,
      `Password: ${credentials.password}`,
    ].join('\n');

    try {
      await copyText(text);
      setMessage('Credentials copied to clipboard.');
    } catch (copyError) {
      setError('Clipboard copy failed. Select the credentials and copy them manually.');
    }
  }

  async function copyUserCredentials(user) {
    setOpenUserMenuId(null);
    const credential = userCredentials[user.id];
    if (!credential) {
      setError(`No temporary password is available for ${user.name}. Reset the password to generate one.`);
      setMessage('');
      return;
    }

    const text = [
      `VIZZIO Deployment Platform credentials`,
      `Name: ${credential.name}`,
      `Username: ${credential.username || credential.email}`,
      `Email: ${credential.email}`,
      `Password: ${credential.password}`,
    ].join('\n');

    try {
      await copyText(text);
      setMessage(`Credentials copied for ${credential.name}.`);
      setError('');
    } catch (copyError) {
      setError('Clipboard copy failed. Select the credentials and copy them manually.');
    }
  }

  async function syncGroupMembers(group, previousGroupName) {
    const selectedIds = new Set(groupForm.memberIds);
    const groupNameChanged = previousGroupName && previousGroupName !== group.name;

    const updates = users
      .map((user) => {
        const currentGroups = user.groups || [];
        const baseGroups = groupNameChanged
          ? currentGroups.filter((name) => name !== previousGroupName)
          : currentGroups;
        const hasGroup = baseGroups.includes(group.name);
        const shouldHaveGroup = selectedIds.has(user.id);
        let nextGroups = baseGroups;

        if (shouldHaveGroup && !hasGroup) {
          nextGroups = [...baseGroups, group.name];
        }
        if (!shouldHaveGroup && hasGroup) {
          nextGroups = baseGroups.filter((name) => name !== group.name);
        }

        if (nextGroups.length === currentGroups.length && nextGroups.every((name, index) => name === currentGroups[index])) {
          return null;
        }

        return updateUser(token, user.id, { groups: nextGroups });
      })
      .filter(Boolean);

    await Promise.all(updates);
  }

  return (
    <main className="users-page">
      <section className="users-toolbar">
        <div className="users-filters">
          <div className="search-input">
            <span aria-hidden="true">Search</span>
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
            {groupNames.map((group) => (
              <option key={group}>{group}</option>
            ))}
          </select>
        </div>

        <div className="users-actions">
          <button className="secondary-btn" onClick={openCreateGroupForm}>New Group</button>
          <button className="primary-btn" onClick={openCreateForm}>New User</button>
        </div>
      </section>

      {(message || error) && (
        <div className={`users-alert ${error ? 'error' : 'success'}`} role="status">
          {error || message}
        </div>
      )}

      {credentials && (
        <section className="credentials-panel">
          <div>
            <h3>Latest Credentials</h3>
            <p>{credentials.name} can sign in with this email and temporary password.</p>
            <div className="credential-lines">
              <span>Username: {credentials.username || credentials.email}</span>
              <span>Email: {credentials.email}</span>
              <span>Password: {credentials.password}</span>
            </div>
          </div>
          <button className="secondary-btn" onClick={copyCredentials}>Copy Credentials</button>
        </section>
      )}

      <section className="users-panel">
        {isLoading ? (
          <div className="users-empty">Loading users...</div>
        ) : (
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
                        {(user.groups || []).length > 0 && (
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
                  <td>{getAccessibleDeploymentCount(user.groups, groups)}</td>
                  <td>{formatLastLogin(user.lastLoginAt)}</td>
                  <td className="controls-cell">
                    <div className="row-menu">
                      <button
                        className="menu-trigger"
                        onClick={() => setOpenUserMenuId((current) => (current === user.id ? null : user.id))}
                        title="User actions"
                        aria-label={`Open actions for ${user.name}`}
                        aria-expanded={openUserMenuId === user.id}
                      >
                        ...
                      </button>
                      {openUserMenuId === user.id && (
                        <div className="row-menu-panel">
                          <button type="button" onClick={() => openEditForm(user)}>Edit</button>
                          <button type="button" onClick={() => handleResetPassword(user)}>Reset Password</button>
                          <button type="button" onClick={() => copyUserCredentials(user)}>Copy Credentials</button>
                          <button
                            type="button"
                            disabled={user.status === 'Inactive'}
                            onClick={() => handleDisable(user)}
                          >
                            Disable
                          </button>
                          <button type="button" className="danger" onClick={() => handleDeleteUser(user)}>
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan="6">
                    <div className="users-empty">No users match the current filters.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </section>

      <section className="groups-panel">
        <div className="section-heading">
          <div>
            <h3>Group Access</h3>
            <p>Users inherit deployment access from their assigned groups.</p>
          </div>
          <button className="secondary-btn" onClick={openCreateGroupForm}>Create Group</button>
        </div>

        <div className="group-grid">
          {groups.map((group) => (
            <article className="group-card" key={group.id}>
              <div className="group-card-header">
                <div>
                  <h4>{group.name}</h4>
                  <p>{countUsersInGroup(users, group.name)} users</p>
                </div>
                <button className="icon-btn" onClick={() => openEditGroupForm(group)}>Manage</button>
              </div>
              <div className="member-list">
                {users
                  .filter((user) => (user.groups || []).includes(group.name))
                  .slice(0, 4)
                  .map((user) => (
                    <span key={user.id} className="member-pill">{user.name}</span>
                  ))}
                {countUsersInGroup(users, group.name) > 4 && (
                  <span className="member-pill muted">+{countUsersInGroup(users, group.name) - 4}</span>
                )}
              </div>
              <div className="access-list">
                {(group.deploymentIds || []).length > 0 ? (
                  group.deploymentIds.map((deploymentId) => (
                    <span key={deploymentId} className="access-pill">
                      {deploymentById[deploymentId]?.name || deploymentId}
                    </span>
                  ))
                ) : (
                  <span className="muted-text">No deployment access</span>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      {isFormOpen && (
        <div className="modal-backdrop" role="presentation">
          <form className="user-modal" onSubmit={saveUser}>
            <div className="modal-header">
              <div>
                <h3>{editingUser ? 'Edit User' : 'Create User'}</h3>
                <p>{editingUser ? 'Update account details and groups.' : 'Create an account and assign groups.'}</p>
              </div>
              <button type="button" className="close-btn" onClick={closeForm} aria-label="Close user form">x</button>
            </div>

            <label>
              Name
              <input
                type="text"
                value={form.name}
                onChange={(event) => updateField('name', event.target.value)}
                required
              />
            </label>

            <label>
              Email
              <input
                type="email"
                value={form.email}
                onChange={(event) => updateField('email', event.target.value)}
                required
              />
            </label>

            <div className="form-grid">
              <label>
                Role
                <select value={form.role} onChange={(event) => updateField('role', event.target.value)}>
                  <option>Admin</option>
                  <option>User</option>
                </select>
              </label>

              <label>
                Status
                <select value={form.status} onChange={(event) => updateField('status', event.target.value)}>
                  <option>Active</option>
                  <option>Inactive</option>
                </select>
              </label>
            </div>

            <fieldset className="checkbox-fieldset">
              <legend>Groups</legend>
              {groups.length > 0 ? (
                groups.map((group) => (
                  <label className="checkbox-row" key={group.id}>
                    <input
                      type="checkbox"
                      checked={form.groups.includes(group.name)}
                      onChange={() => toggleUserGroup(group.name)}
                    />
                    <span>{group.name}</span>
                  </label>
                ))
              ) : (
                <p className="muted-text">Create a group before assigning access.</p>
              )}
            </fieldset>

            {!editingUser && (
              <label>
                Temporary Password
                <input
                  type="text"
                  placeholder="Leave blank to generate"
                  value={form.password}
                  onChange={(event) => updateField('password', event.target.value)}
                />
              </label>
            )}

            <div className="modal-actions">
              <button type="button" className="secondary-btn" onClick={closeForm}>Cancel</button>
              <button type="submit" className="primary-btn" disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save User'}
              </button>
            </div>
          </form>
        </div>
      )}

      {isGroupFormOpen && (
        <div className="modal-backdrop" role="presentation">
          <form className="user-modal" onSubmit={saveGroup}>
            <div className="modal-header">
              <div>
                <h3>{editingGroup ? 'Manage Group' : 'Create Group'}</h3>
                <p>Manage members and the deployments available to this group.</p>
              </div>
              <button type="button" className="close-btn" onClick={closeGroupForm} aria-label="Close group form">x</button>
            </div>

            <label>
              Group Name
              <input
                type="text"
                value={groupForm.name}
                onChange={(event) => updateGroupField('name', event.target.value)}
                required
              />
            </label>

            <fieldset className="checkbox-fieldset">
              <legend>Members</legend>
              {users.length > 0 ? (
                users.map((user) => (
                  <label className="checkbox-row" key={user.id}>
                    <input
                      type="checkbox"
                      checked={groupForm.memberIds.includes(user.id)}
                      onChange={() => toggleGroupMember(user.id)}
                    />
                    <span>{user.name}</span>
                    <small>{user.email}</small>
                  </label>
                ))
              ) : (
                <p className="muted-text">Create users before adding members.</p>
              )}
            </fieldset>

            <fieldset className="checkbox-fieldset">
              <legend>Deployment Access</legend>
              {deployments.length > 0 ? (
                deployments.map((deployment) => (
                  <label className="checkbox-row" key={deployment.id}>
                    <input
                      type="checkbox"
                      checked={groupForm.deploymentIds.includes(deployment.id)}
                      onChange={() => toggleGroupDeployment(deployment.id)}
                    />
                    <span>{deployment.name}</span>
                  </label>
                ))
              ) : (
                <p className="muted-text">No deployments available.</p>
              )}
            </fieldset>

            <div className="modal-actions">
              <button type="button" className="secondary-btn" onClick={closeGroupForm}>Cancel</button>
              <button type="submit" className="primary-btn" disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Group'}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}

function getAccessibleDeploymentCount(userGroups = [], groups = []) {
  const deploymentIds = groups
    .filter((group) => userGroups.includes(group.name))
    .flatMap((group) => group.deploymentIds || []);
  return new Set(deploymentIds).size;
}

function countUsersInGroup(users, groupName) {
  return users.filter((user) => (user.groups || []).includes(groupName)).length;
}

function formatLastLogin(value) {
  if (!value) return 'Never logged in';
  return new Date(value).toLocaleString();
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.setAttribute('readonly', '');
  textArea.style.position = 'fixed';
  textArea.style.opacity = '0';
  document.body.appendChild(textArea);
  textArea.select();
  document.execCommand('copy');
  document.body.removeChild(textArea);
}

function loadStoredCredentials() {
  try {
    return JSON.parse(sessionStorage.getItem(credentialStorageKey) || '{}');
  } catch (error) {
    return {};
  }
}

function storeCredentials(credentialsByUserId) {
  sessionStorage.setItem(credentialStorageKey, JSON.stringify(credentialsByUserId));
  return credentialsByUserId;
}
