const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000/api';

export async function login(username, password) {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  return response.json();
}

export async function fetchDeployments(token) {
  const response = await fetch(`${API_BASE}/deployments`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.json();
}
