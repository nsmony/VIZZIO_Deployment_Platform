const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000/api';
const DOWNLOAD_BASE = import.meta.env.VITE_DOWNLOAD_BASE || 'http://localhost:4000/downloads';

async function request(endpoint, token, options = {}) {
  const { headers: optionHeaders = {}, ...requestOptions } = options;

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...requestOptions,
    headers: {
      Authorization: token ? `Bearer ${token}` : undefined,
      ...optionHeaders,
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'API request failed');
  }
  return data;
}

export async function login(username, password) {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  return response.json();
}

export async function fetchDeployments(token) {
  return request('/deployments', token);
}

export async function createDeployment(token, deployment) {
  return request('/deployments', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(deployment),
  });
}

export async function registerDeploymentVersion(token, deploymentId, version) {
  return request(`/deployments/${deploymentId}/versions`, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(version),
  });
}

export async function updateDeploymentVersion(token, deploymentId, versionId, updates) {
  return request(`/deployments/${deploymentId}/versions/${versionId}`, token, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
}

export async function fetchDeploymentDetails(token, deploymentId) {
  return request(`/deployments/${encodeURIComponent(deploymentId)}`, token);
}

export async function validateDeploymentPackage(token, packagePath) {
  return request('/deployment-versions/validate-package', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ packagePath }),
  });
}

export async function deleteDeploymentVersion(token, versionId) {
  return request(`/deployment-versions/${encodeURIComponent(versionId)}`, token, {
    method: 'DELETE',
  });
}

export async function fetchUploadedPackages(token) {
  return request('/deployments/uploads', token);
}

export async function uploadPackage(token, file, title) {
  const response = await fetch(`${API_BASE}/deployments/uploads`, {
    method: 'POST',
    headers: {
      Authorization: token ? `Bearer ${token}` : undefined,
      'Content-Type': 'application/octet-stream',
      'X-File-Name': encodeURIComponent(file.name),
      'X-Package-Title': encodeURIComponent(title || file.name),
    },
    body: file,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Upload failed');
  }
  return data;
}

export async function requestDownloadToken(token, fileId) {
  return request(`/download-token/${encodeURIComponent(fileId)}`, token);
}

export function buildDownloadUrl(fileId, downloadToken) {
  const url = new URL(`${DOWNLOAD_BASE.replace(/\/$/, '')}/${encodeURIComponent(fileId)}`);
  url.searchParams.set('token', downloadToken);
  return url.toString();
}

export async function fetchDownloadManagerItems(token) {
  return request('/download-manager/items', token);
}

export async function createDownloadManagerSession(token, fileId, versionId) {
  return request('/download-manager/sessions', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileId, versionId }),
  });
}

export async function updateDownloadManagerSession(token, sessionId, updates) {
  return request(`/download-manager/sessions/${encodeURIComponent(sessionId)}`, token, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
}

export function buildManagedDownloadUrl(fileId, downloadToken) {
  const url = new URL(`${API_BASE.replace(/\/$/, '')}/download-manager/files/${encodeURIComponent(fileId)}`);
  url.searchParams.set('token', downloadToken);
  return url.toString();
}

export async function fetchUsers(token) {
  return request('/users', token);
}

export async function createUser(token, userData) {
  return request('/users', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData),
  });
}

export async function fetchGroups(token) {
  return request('/users/groups', token);
}

export async function createGroup(token, groupData) {
  return request('/users/groups', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(groupData),
  });
}

export async function updateGroup(token, groupId, updates) {
  return request(`/users/groups/${groupId}`, token, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
}

export async function updateUser(token, userId, updates) {
  return request(`/users/${userId}`, token, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
}

export async function disableUser(token, userId) {
  return request(`/users/${userId}/disable`, token, {
    method: 'PATCH',
  });
}

export async function resetUserPassword(token, userId, password) {
  return request(`/users/${userId}/reset-password`, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(password ? { password } : {}),
  });
}

export async function deleteUser(token, userId) {
  return request(`/users/${userId}`, token, {
    method: 'DELETE',
  });
}
