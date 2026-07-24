const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000/api';
const DOWNLOAD_BASE = import.meta.env.VITE_DOWNLOAD_BASE || 'http://localhost:4000/downloads';

import { clearStoredSession } from '../hooks/useAuth.js';

// Shared JSON API helper. It centralizes bearer auth and error extraction so
// pages can show user-friendly failures without duplicating fetch boilerplate.
async function request(endpoint, token, options = {}) {
  const { headers: optionHeaders = {}, ...requestOptions } = options;

  let response;
  try {
    response = await fetch(`${API_BASE}${endpoint}`, {
      ...requestOptions,
      headers: {
        Authorization: token ? `Bearer ${token}` : undefined,
        ...optionHeaders,
      },
    });
  } catch {
    throw new Error(`Could not reach the backend at ${API_BASE}. Check the server URL, Cloudflare Tunnel, and backend service.`);
  }

  const body = await response.text().catch(() => '');
  const data = parseJsonBody(body);
  if (!response.ok) {
    if (response.status === 401) {
      clearStoredSession();
      if (typeof window !== 'undefined' && window.location.pathname !== '/') {
        window.location.assign('/');
      }
    }

    const message = extractApiErrorMessage(data, body, response);
    throw new Error(message);
  }
  return data;
}

function parseJsonBody(body) {
  if (!body) return {};
  try {
    return JSON.parse(body);
  } catch {
    return {};
  }
}

function extractApiErrorMessage(data, body, response) {
  if (data.maintenanceMessage) return data.maintenanceMessage;
  if (typeof data.error === 'string' && data.error.trim()) return data.error;
  if (data.error?.message) return data.error.message;
  if (body && !body.trim().startsWith('<')) return body.trim();
  if (response.status === 404) return 'The requested backend endpoint was not found.';
  if (response.status === 500) return 'The backend hit an internal error. Check the backend terminal logs.';
  if (response.status >= 500) return 'The backend is temporarily unavailable. Try again after checking the server.';
  return `Request failed with HTTP ${response.status}.`;
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

export async function updateDeployment(token, deploymentId, deployment) {
  return request(`/deployments/${encodeURIComponent(deploymentId)}`, token, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(deployment),
  });
}

export async function archiveDeployment(token, deploymentId) {
  return request(`/deployments/${encodeURIComponent(deploymentId)}/archive`, token, {
    method: 'POST',
  });
}

export async function restoreDeployment(token, deploymentId) {
  return request(`/deployments/${encodeURIComponent(deploymentId)}/restore`, token, {
    method: 'POST',
  });
}

export async function deleteDeployment(token, deploymentId) {
  return request(`/deployments/${encodeURIComponent(deploymentId)}`, token, {
    method: 'DELETE',
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

export async function validateDeploymentPackage(token, packageInfo) {
  return request('/deployment-versions/validate-package', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(packageInfo),
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

export async function fetchAdminSettings(token) {
  return request('/settings', token);
}

export async function fetchSystemReadiness(token) {
  return request('/settings/readiness', token);
}

export async function saveAdminSettings(token, settings) {
  return request('/settings', token, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
}

export async function resetAdminSettings(token) {
  return request('/settings/reset', token, {
    method: 'POST',
  });
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

// Browser downloads use a short-lived token in the URL. Do not replace this
// with a bearer header unless the backend download controller changes too.
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
  // Launcher managed downloads use the API range endpoint so pause/resume can
  // rely on HTTP byte-range requests.
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

export async function grantGroupDeploymentAccess(token, groupId, deploymentId) {
  return request(`/users/groups/${encodeURIComponent(groupId)}/deployments/${encodeURIComponent(deploymentId)}`, token, {
    method: 'POST',
  });
}

export async function revokeGroupDeploymentAccess(token, groupId, deploymentId) {
  return request(`/users/groups/${encodeURIComponent(groupId)}/deployments/${encodeURIComponent(deploymentId)}`, token, {
    method: 'DELETE',
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

export async function fetchAdminDashboard(token) {
  return request('/admin/dashboard', token);
}

export async function fetchNotifications(token) {
  return request('/notifications', token);
}

export async function fetchUnreadNotificationCount(token) {
  return request('/notifications/unread-count', token);
}

export async function markNotificationRead(token, notificationId) {
  return request(`/notifications/${encodeURIComponent(notificationId)}/read`, token, {
    method: 'PATCH',
  });
}

export async function markAllNotificationsRead(token) {
  return request('/notifications/read-all', token, {
    method: 'PATCH',
  });
}

export async function deleteNotification(token, notificationId) {
  return request(`/notifications/${encodeURIComponent(notificationId)}`, token, {
    method: 'DELETE',
  });
}

export async function fetchDownloadLogs(token, deploymentId) {
  const params = new URLSearchParams();
  if (deploymentId) params.set('deploymentId', deploymentId);
  const query = params.toString();
  return request(`/admin/download-logs${query ? `?${query}` : ''}`, token);
}

export async function fetchLauncherErrorReports(token, filters = {}) {
  const params = new URLSearchParams();
  if (filters.deployment) params.set('deployment', filters.deployment);
  if (filters.area) params.set('area', filters.area);
  const query = params.toString();
  return request(`/admin/launcher-error-reports${query ? `?${query}` : ''}`, token);
}

export async function fetchLauncherErrorReport(token, reportId) {
  return request(`/admin/launcher-error-reports/${encodeURIComponent(reportId)}`, token);
}

export async function exportDownloadLogs(token, deploymentId) {
  const params = new URLSearchParams();
  if (deploymentId) params.set('deploymentId', deploymentId);
  const query = params.toString();
  const response = await fetch(`${API_BASE}/admin/download-logs/export${query ? `?${query}` : ''}`, {
    headers: {
      Authorization: token ? `Bearer ${token}` : undefined,
    },
  });

  const text = await response.text();
  if (!response.ok) {
    let message = 'Download log export failed';
    try {
      message = JSON.parse(text).error || message;
    } catch (error) {
      message = text || message;
    }
    throw new Error(message);
  }

  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  // Temporary anchor because browsers expose "save as file" through downloads.
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `download-logs-${date}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
