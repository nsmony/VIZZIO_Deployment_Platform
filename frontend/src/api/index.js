const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000/api';
const DOWNLOAD_BASE = import.meta.env.VITE_DOWNLOAD_BASE || 'http://localhost:4000/downloads';
const DIRECT_UPLOAD_LIMIT = 100 * 1024 * 1024;
const CHUNK_SIZE = 50 * 1024 * 1024;

function getUploadId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function readResponse(response, fallbackMessage) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || fallbackMessage);
  }

  return data;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

export async function uploadPackage(token, file, title, onProgress = () => {}) {
  const resolvedTitle = title || file.name;

  if (file.size <= DIRECT_UPLOAD_LIMIT) {
    console.log('Starting direct upload', { name: file.name, size: file.size });
    const response = await fetch(`${API_BASE}/deployments/uploads`, {
      method: 'POST',
      headers: {
        Authorization: token ? `Bearer ${token}` : undefined,
        'Content-Type': 'application/octet-stream',
        'X-File-Name': encodeURIComponent(file.name),
        'X-Package-Title': encodeURIComponent(resolvedTitle),
      },
      body: file,
    });

    const data = await readResponse(response, 'Upload failed');
    onProgress({
      percentage: 100,
      uploadedBytes: file.size,
      totalBytes: file.size,
      chunkIndex: 1,
      totalChunks: 1,
    });
    return data;
  }

  const uploadId = getUploadId();
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
    const start = chunkIndex * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);
    let lastError = null;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        console.log('Uploading chunk', { uploadId, chunkIndex, attempt, chunkSize: chunk.size });
        const response = await fetch(`${API_BASE}/deployments/uploads/chunks`, {
          method: 'POST',
          headers: {
            Authorization: token ? `Bearer ${token}` : undefined,
            'Content-Type': 'application/octet-stream',
            'X-Upload-Id': uploadId,
            'X-Chunk-Index': String(chunkIndex),
            'X-Total-Chunks': String(totalChunks),
            'X-File-Name': encodeURIComponent(file.name),
            'X-Package-Title': encodeURIComponent(resolvedTitle),
            'X-File-Size': String(file.size),
          },
          body: chunk,
        });

        const data = await readResponse(response, 'Chunk upload failed');

        onProgress({
          percentage: Math.min(99, Math.round(((chunkIndex + 1) / totalChunks) * 100)),
          uploadedBytes: Math.min(file.size, Math.round(((chunkIndex + 1) / totalChunks) * file.size)),
          totalBytes: file.size,
          chunkIndex: chunkIndex + 1,
          totalChunks,
        });

        if (chunkIndex === totalChunks - 1 && data?.package) {
          onProgress({
            percentage: 100,
            uploadedBytes: file.size,
            totalBytes: file.size,
            chunkIndex: totalChunks,
            totalChunks,
          });
          return data;
        }

        if (chunkIndex === totalChunks - 1 && data?.finalizing) {
          for (let pollAttempt = 0; pollAttempt < 600; pollAttempt += 1) {
            await delay(1000);

            const statusResponse = await fetch(
              `${API_BASE}/deployments/uploads/chunks/${encodeURIComponent(uploadId)}/status`,
              {
                headers: {
                  Authorization: token ? `Bearer ${token}` : undefined,
                },
              },
            );

            const statusData = await readResponse(statusResponse, 'Upload status check failed');

            onProgress({
              percentage: 100,
              uploadedBytes: file.size,
              totalBytes: file.size,
              chunkIndex: totalChunks,
              totalChunks,
            });

            if (statusData?.complete && statusData?.package) {
              return statusData;
            }

            if (statusData?.failed) {
              throw new Error(statusData.error || 'Large upload finalization failed');
            }
          }

          throw new Error('Upload is still finalizing. Please refresh the page in a moment.');
        }

        break;
      } catch (error) {
        console.error('Chunk upload error', { uploadId, chunkIndex, attempt, error: error.message });
        lastError = error;

        if (attempt === 3) {
          throw new Error(`Chunk ${chunkIndex + 1} of ${totalChunks} failed after 3 attempts: ${error.message}`);
        }
      }
    }

    if (lastError && chunkIndex === totalChunks - 1) {
      throw lastError;
    }
  }

  return {
    package: {
      title: resolvedTitle,
      originalName: file.name,
      size: file.size,
    },
  };
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

export async function inviteUser(token, email) {
  return request('/users/invite', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
}

export async function verifyInviteToken(token) {
  const response = await fetch(`${API_BASE}/users/invite/verify?token=${encodeURIComponent(token)}`);
  return response.json();
}

export async function completeInvite(token, name, password) {
  return request('/users/invite/complete', null, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, name, password }),
  });
}
