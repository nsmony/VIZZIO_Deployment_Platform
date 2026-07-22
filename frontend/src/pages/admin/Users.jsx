import { useEffect, useMemo, useState } from 'react';
import {
  createGroup,
  createUser,
  deleteUser,
  disableUser,
  fetchDeployments,
  fetchGroups,
  fetchUsers,
  grantGroupDeploymentAccess,
  resetUserPassword,
  revokeGroupDeploymentAccess,
  updateGroup,
  updateUser,
} from '../../api';
import '../../styles/Users.css';

const emptyForm = {
  name: '',
  username: '',
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

const pageSize = 25;

export default function Users() {
  // Main lists used by this page.
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [deployments, setDeployments] = useState([]);

  // Filters and pagination for the users table.
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('All Users');
  const [filterGroup, setFilterGroup] = useState('All Groups');
  const [page, setPage] = useState(1);

  // Form state for user and group modals.
  const [form, setForm] = useState(emptyForm);
  const [groupForm, setGroupForm] = useState(emptyGroupForm);
  const [editingUser, setEditingUser] = useState(null);
  const [editingGroup, setEditingGroup] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isGroupFormOpen, setIsGroupFormOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [credentials, setCredentials] = useState(null);
  const [detailUser, setDetailUser] = useState(null);
  const [passwordResetUser, setPasswordResetUser] = useState(null);
  const [passwordResetValue, setPasswordResetValue] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);
  const [openUserMenuId, setOpenUserMenuId] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const token = localStorage.getItem('vizzio_token');

  // Load users, groups, and deployments when the page opens.
  useEffect(() => {
    loadData();
  }, []);

  const groupNames = useMemo(() => groups.map((group) => group.name), [groups]);

  // Make it easy to show deployment names from group deployment IDs.
  const deploymentById = useMemo(() => {
    return deployments.reduce((lookup, deployment) => {
      lookup[deployment.id] = deployment;
      return lookup;
    }, {});
  }, [deployments]);

  // Apply search, role filter, and group filter before pagination.
  const filteredUsers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return users.filter((user) => {
      const matchesSearch =
        !normalizedSearch ||
        user.name.toLowerCase().includes(normalizedSearch) ||
        String(user.username || '').toLowerCase().includes(normalizedSearch) ||
        user.email.toLowerCase().includes(normalizedSearch);
      const matchesRole = filterRole === 'All Users' || user.role === filterRole;
      const matchesGroup =
        filterGroup === 'All Groups' || (user.groups || []).includes(filterGroup);
      return matchesSearch && matchesRole && matchesGroup;
    });
  }, [users, search, filterRole, filterGroup]);

  const pageCount = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const pagedUsers = filteredUsers.slice((page - 1) * pageSize, page * pageSize);

  // Reset to page one when filters change.
  useEffect(() => {
    setPage(1);
  }, [search, filterRole, filterGroup]);

  // Keep the current page inside the available page count.
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  // Fetch all data this page needs in one load.
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

  // Open a blank user form.
  function openCreateForm() {
    setEditingUser(null);
    setForm(emptyForm);
    setMessage('');
    setError('');
    setIsFormOpen(true);
  }

  // Open the user form with existing values.
  function openEditForm(user) {
    setOpenUserMenuId(null);
    setEditingUser(user);
    setForm({
      name: user.name,
      username: user.username || '',
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

  // Close the user form unless a save is running.
  function closeForm() {
    if (isSaving) return;
    setIsFormOpen(false);
    setEditingUser(null);
    setForm(emptyForm);
  }

  // Open a blank group form.
  function openCreateGroupForm() {
    setEditingGroup(null);
    setGroupForm(emptyGroupForm);
    setMessage('');
    setError('');
    setIsGroupFormOpen(true);
  }

  // Open the group form and preselect current members.
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

  // Close the group form unless a save is running.
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

  // Add or remove a group on the user form.
  function toggleUserGroup(groupName) {
    setForm((current) => ({
      ...current,
      groups: current.groups.includes(groupName)
        ? current.groups.filter((name) => name !== groupName)
        : [...current.groups, groupName],
    }));
  }

  // Add or remove deployment access on the group form.
  function toggleGroupDeployment(deploymentId) {
    setGroupForm((current) => ({
      ...current,
      deploymentIds: current.deploymentIds.includes(deploymentId)
        ? current.deploymentIds.filter((id) => id !== deploymentId)
        : [...current.deploymentIds, deploymentId],
    }));
  }

  // Add or remove a member on the group form.
  function toggleGroupMember(userId) {
    setGroupForm((current) => ({
      ...current,
      memberIds: current.memberIds.includes(userId)
        ? current.memberIds.filter((id) => id !== userId)
        : [...current.memberIds, userId],
    }));
  }

  // Create a user or update the selected user.
  async function saveUser(event) {
    event.preventDefault();
    setIsSaving(true);
    setError('');
    setMessage('');

    const payload = {
      name: form.name.trim(),
      username: form.username.trim(),
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
        // Update the row locally so the table reflects the saved user.
        const data = await updateUser(token, editingUser.id, payload);
        setUsers((current) =>
          current.map((user) => (user.id === editingUser.id ? data.user : user))
        );
        setMessage(`${data.user.name} was updated.`);
      } else {
        const data = await createUser(token, payload);
        setUsers((current) => [...current, data.user]);

        // Temporary passwords are shown once after the account is created.
        if (data.temporaryPassword) {
          const credential = {
            userId: data.user.id,
            username: data.user.username,
            name: data.user.name,
            email: data.user.email,
            password: data.temporaryPassword,
          };
          setCredentials(credential);
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

  // Create a group or update the selected group.
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
        const nameChanged = editingGroup.name !== payload.name;
        const previousDeploymentIds = new Set(editingGroup.deploymentIds || []);
        const nextDeploymentIds = new Set(groupForm.deploymentIds);
        const deploymentsToGrant = [...nextDeploymentIds].filter((deploymentId) => !previousDeploymentIds.has(deploymentId));
        const deploymentsToRevoke = [...previousDeploymentIds].filter((deploymentId) => !nextDeploymentIds.has(deploymentId));

        if (nameChanged) {
          const data = await updateGroup(token, editingGroup.id, { name: payload.name });
          savedGroup = data.group;
        } else {
          savedGroup = editingGroup;
        }

        for (const deploymentId of deploymentsToGrant) {
          const data = await grantGroupDeploymentAccess(token, editingGroup.id, deploymentId);
          savedGroup = data.group;
        }

        for (const deploymentId of deploymentsToRevoke) {
          const data = await revokeGroupDeploymentAccess(token, editingGroup.id, deploymentId);
          savedGroup = data.group;
        }

        setMessage(`${savedGroup.name} access was updated.`);
      } else {
        const data = await createGroup(token, payload);
        savedGroup = data.group;
        setMessage(`${data.group.name} group was created.`);
      }

      // Member checkboxes update user records after the group is saved.
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

  // Disable an account without deleting its history.
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

  function openPasswordResetModal(user) {
    setOpenUserMenuId(null);
    setPasswordResetUser(user);
    setPasswordResetValue('');
    setError('');
    setMessage('');
  }

  // Allow the admin to choose the replacement password instead of generating one.
  async function handleResetPassword(event) {
    event.preventDefault();
    if (!passwordResetUser) {
      return;
    }

    setError('');
    setMessage('');
    setResettingPassword(true);

    try {
      const data = await resetUserPassword(token, passwordResetUser.id, passwordResetValue.trim());
      setUsers((current) => current.map((item) => (item.id === passwordResetUser.id ? data.user : item)));
      const credential = {
        userId: data.user.id,
        username: data.user.username,
        name: data.user.name,
        email: data.user.email,
        password: passwordResetValue.trim(),
      };
      setCredentials(credential);
      setPasswordResetUser(null);
      setPasswordResetValue('');
      setMessage(`Password was reset for ${data.user.name}.`);
    } catch (resetError) {
      setError(resetError.message);
    } finally {
      setResettingPassword(false);
    }
  }

  // Delete the user account from the system.
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
      setMessage(`${user.name} was deleted.`);
    } catch (deleteError) {
      setError(deleteError.message);
    }
  }

  // Copy the temporary credentials from the modal.
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

  function openUserDetails(user) {
    setOpenUserMenuId(null);
    setDetailUser(user);
  }

  // Keep user group membership in sync with the group member checkboxes.
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
                <th>Access</th>
                <th>Last Login</th>
                <th>Controls</th>
              </tr>
            </thead>
            <tbody>
              {pagedUsers.map((user) => (
                <tr key={user.id}>
                  <td>
                    <div className="user-cell">
                      <div className="avatar">{user.name.charAt(0)}</div>
                      <div>
                        <strong>{user.name}</strong>
                        <div className="user-meta">@{user.username || 'unassigned'}</div>
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
                          <button type="button" onClick={() => openUserDetails(user)}>View Access</button>
                          <button type="button" onClick={() => openEditForm(user)}>Edit</button>
                          <button type="button" onClick={() => openPasswordResetModal(user)}>Reset Password</button>
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

      {filteredUsers.length > pageSize && (
        <div className="users-pagination">
          <button className="secondary-btn" type="button" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</button>
          <span>Page {page} of {pageCount}</span>
          <button className="secondary-btn" type="button" disabled={page === pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>Next</button>
        </div>
      )}

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
              Username
              <input
                type="text"
                value={form.username}
                onChange={(event) => updateField('username', event.target.value)}
                minLength="3"
                maxLength="64"
                pattern="[A-Za-z0-9_]+"
                title="Use 3 to 64 letters, numbers, or underscores."
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

      {passwordResetUser && (
        <div className="modal-backdrop" role="presentation">
          <form className="user-modal" onSubmit={handleResetPassword}>
            <div className="modal-header">
              <div>
                <h3>Reset Password</h3>
                <p>Set a new password for {passwordResetUser.name}. Minimum length is 8 characters.</p>
              </div>
              <button
                type="button"
                className="close-btn"
                onClick={() => setPasswordResetUser(null)}
                aria-label="Close password reset"
              >
                x
              </button>
            </div>

            <label>
              New Password
              <input
                type="text"
                value={passwordResetValue}
                onChange={(event) => setPasswordResetValue(event.target.value)}
                minLength="8"
                required
              />
            </label>

            <div className="modal-actions">
              <button type="button" className="secondary-btn" onClick={() => setPasswordResetUser(null)}>
                Cancel
              </button>
              <button type="submit" className="primary-btn" disabled={resettingPassword}>
                {resettingPassword ? 'Resetting...' : 'Reset Password'}
              </button>
            </div>
          </form>
        </div>
      )}

      {credentials && (
        <div className="modal-backdrop" role="presentation">
          <section className="user-modal credential-modal" role="dialog" aria-modal="true">
            <div className="modal-header">
              <div>
                <h3>Temporary Credentials</h3>
                <p>Copy these credentials now. The password is not stored in the admin portal.</p>
              </div>
              <button
                type="button"
                className="close-btn"
                onClick={() => setCredentials(null)}
                aria-label="Close credentials"
              >
                x
              </button>
            </div>
            <div className="credential-lines">
              <span>Username: {credentials.username || credentials.email}</span>
              <span>Email: {credentials.email}</span>
              <span>Password: {credentials.password}</span>
            </div>
            <div className="modal-actions">
              <button type="button" className="secondary-btn" onClick={() => setCredentials(null)}>Done</button>
              <button type="button" className="primary-btn" onClick={copyCredentials}>Copy Credentials</button>
            </div>
          </section>
        </div>
      )}

      {detailUser && (
        <div className="modal-backdrop" role="presentation">
          <section className="user-modal detail-modal" role="dialog" aria-modal="true">
            <div className="modal-header">
              <div>
                <h3>{detailUser.name}</h3>
                <p>Review direct group memberships and inherited deployment access.</p>
              </div>
              <button
                type="button"
                className="close-btn"
                onClick={() => setDetailUser(null)}
                aria-label="Close user details"
              >
                x
              </button>
            </div>

            <div className="detail-grid">
              <DetailBlock title="Username" value={`@${detailUser.username || 'unassigned'}`} />
              <DetailBlock title="Email" value={detailUser.email} />
              <DetailBlock title="Role" value={detailUser.role} />
              <DetailBlock title="Status" value={detailUser.status} />
            </div>

            <section className="detail-section">
              <h4>Group Memberships</h4>
              {(detailUser.groups || []).length > 0 ? (
                <div className="detail-pill-list">
                  {detailUser.groups.map((group) => (
                    <span key={group} className="group-pill">{group}</span>
                  ))}
                </div>
              ) : (
                <p className="muted-text">This user is not currently assigned to any groups.</p>
              )}
            </section>

            <section className="detail-section">
              <h4>Inherited Deployments</h4>
              {getAccessibleDeployments(detailUser.groups, groups, deploymentById).length > 0 ? (
                <div className="detail-pill-list">
                  {getAccessibleDeployments(detailUser.groups, groups, deploymentById).map((deploymentName) => (
                    <span key={deploymentName} className="access-pill">{deploymentName}</span>
                  ))}
                </div>
              ) : (
                <p className="muted-text">This user does not inherit access to any deployments.</p>
              )}
            </section>

            <div className="modal-actions">
              <button type="button" className="primary-btn" onClick={() => setDetailUser(null)}>Done</button>
            </div>
          </section>
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

// Count unique deployments the user's groups can access.
function getAccessibleDeploymentCount(userGroups = [], groups = []) {
  const deploymentIds = groups
    .filter((group) => userGroups.includes(group.name))
    .flatMap((group) => group.deploymentIds || []);
  return new Set(deploymentIds).size;
}

function getAccessibleDeployments(userGroups = [], groups = [], deploymentById = {}) {
  return [...new Set(
    groups
      .filter((group) => userGroups.includes(group.name))
      .flatMap((group) => group.deploymentIds || [])
      .map((deploymentId) => deploymentById[deploymentId]?.name || deploymentId)
      .filter(Boolean)
  )].sort((left, right) => left.localeCompare(right));
}

function DetailBlock({ title, value }) {
  return (
    <div className="detail-block">
      <span>{title}</span>
      <strong>{value}</strong>
    </div>
  );
}

// Count members shown on each group card.
function countUsersInGroup(users, groupName) {
  return users.filter((user) => (user.groups || []).includes(groupName)).length;
}

// Show a friendly value when the user has never logged in.
function formatLastLogin(value) {
  if (!value) return 'Never logged in';
  return new Date(value).toLocaleString();
}

// Copy text with a fallback for older browsers.
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
