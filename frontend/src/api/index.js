const API_BASE = import.meta.env.VITE_API_BASE || '/api';
const DOWNLOAD_BASE = import.meta.env.VITE_DOWNLOAD_BASE || '/downloads';

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

export async function changeAdminPassword(token, currentPassword, newPassword) {
  return request('/auth/change-password', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
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

export async function startPackagePreparation(token, packageInfo) {
  return request('/deployment-versions/package-jobs', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(packageInfo),
  });
}

export async function fetchPackagePreparation(token, jobId) {
  return request(`/deployment-versions/package-jobs/${encodeURIComponent(jobId)}`, token);
}

export async function cancelPackagePreparation(token, jobId) {
  return request(`/deployment-versions/package-jobs/${encodeURIComponent(jobId)}`, token, {
    method: 'DELETE',
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

const UPLOAD_CHUNK_BYTES = 64 * 1024 * 1024;
const UPLOAD_CHUNK_RETRIES = 5;

export async function uploadPackage(token, file, title, onProgress, signal) {
  const fingerprint = `${file.name}:${file.size}:${file.lastModified}`;
  const created = await request('/deployments/uploads/sessions', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      originalName: file.name,
      title: title || file.name,
      size: file.size,
      fingerprint,
    }),
    signal,
  });
  let session = created.session;
  if (session.status === 'completed' && session.package) {
    onProgress?.({ loaded: file.size, total: file.size });
    return { package: session.package };
  }

  let offset = Number(session.offset || 0);
  while (offset < file.size) {
    if (signal?.aborted) throw new DOMException('Upload was cancelled.', 'AbortError');
    const end = Math.min(offset + UPLOAD_CHUNK_BYTES, file.size);
    const chunk = file.slice(offset, end);
    let lastError;

    for (let attempt = 0; attempt < UPLOAD_CHUNK_RETRIES; attempt += 1) {
      try {
        const result = await uploadChunk(token, session.id, chunk, offset, file.size, onProgress, signal);
        session = result.session;
        offset = Number(session.offset);
        lastError = null;
        break;
      } catch (error) {
        if (signal?.aborted || error.name === 'AbortError') throw error;
        lastError = error;
        const status = await request(`/deployments/uploads/sessions/${encodeURIComponent(session.id)}`, token, { signal });
        session = status.session;
        const confirmedOffset = Number(session.offset || 0);
        if (confirmedOffset > offset) {
          offset = confirmedOffset;
          lastError = null;
          break;
        }
        if (error.status && error.status < 500 && error.status !== 409) throw error;
        await new Promise((resolve) => setTimeout(resolve, Math.min(5000, 500 * 2 ** attempt)));
      }
    }
    if (lastError) throw lastError;
  }

  // Completion performs archive inspection and the final SHA-256 pass. It is
  // idempotent, so a lost response can safely be retried or recovered later.
  try {
    const completed = await request(
      `/deployments/uploads/sessions/${encodeURIComponent(session.id)}/complete`,
      token,
      { method: 'POST', signal }
    );
    return { package: completed.package };
  } catch (error) {
    if (signal?.aborted) throw error;
    const recovered = await request(`/deployments/uploads/sessions/${encodeURIComponent(session.id)}`, token);
    if (recovered.session.status === 'completed' && recovered.session.package) {
      return { package: recovered.session.package };
    }
    throw error;
  }
}

function uploadChunk(token, sessionId, chunk, offset, total, onProgress, signal) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PATCH', `${API_BASE}/deployments/uploads/sessions/${encodeURIComponent(sessionId)}`);
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    xhr.setRequestHeader('Upload-Offset', String(offset));

    xhr.upload.addEventListener('progress', (event) => {
      onProgress?.({
        loaded: Math.min(total, offset + event.loaded),
        total,
      });
    });
    xhr.addEventListener('load', () => {
      let data = {};
      try {
        data = JSON.parse(xhr.responseText || '{}');
      } catch {
        data = {};
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data);
        return;
      }
      if (xhr.status === 401) clearStoredSession();
      const error = new Error(data.error || `Upload chunk failed with status ${xhr.status}`);
      error.status = xhr.status;
      error.offset = Number(data.offset);
      reject(error);
    });
    xhr.addEventListener('error', () => reject(new Error('Upload chunk was interrupted. Retrying from the confirmed offset.')));
    xhr.addEventListener('abort', () => reject(new DOMException('Upload was cancelled.', 'AbortError')));
    if (signal?.aborted) {
      xhr.abort();
      return;
    }
    signal?.addEventListener('abort', () => xhr.abort(), { once: true });
    xhr.send(chunk);
  });
}

export async function requestDownloadToken(token, fileId) {
  return request(`/download-token/${encodeURIComponent(fileId)}`, token);
}

// Browser downloads use a short-lived token in the URL. Do not replace this
// with a bearer header unless the backend download controller changes too.
export function buildDownloadUrl(fileId, downloadToken) {
  const url = new URL(
    `${DOWNLOAD_BASE.replace(/\/$/, '')}/${encodeURIComponent(fileId)}`,
    window.location.origin
  );
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
  const url = new URL(
    `${API_BASE.replace(/\/$/, '')}/download-manager/files/${encodeURIComponent(fileId)}`,
    window.location.origin
  );
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

export async function clearAllNotifications(token) {
  return request('/notifications/all', token, {
    method: 'DELETE',
  });
}

export async function deleteGroup(token, groupId) {
  return request(`/users/groups/${encodeURIComponent(groupId)}`, token, {
    method: 'DELETE',
  });
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
