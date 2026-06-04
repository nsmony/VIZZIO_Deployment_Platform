const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000/api';

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
