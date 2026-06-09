const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000/api';
const DOWNLOAD_BASE = import.meta.env.VITE_DOWNLOAD_BASE || 'http://localhost:4000/downloads';

async function request(endpoint, token, options = {}) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      Authorization: token ? `Bearer ${token}` : undefined,
      ...(options.headers || {}),
    },
    ...options,
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

export async function updateUser(token, userId, updates) {
  return request(`/users/${userId}`, token, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
}

export async function deleteUser(token, userId) {
  return request(`/users/${userId}`, token, {
    method: 'DELETE',
  });
}
