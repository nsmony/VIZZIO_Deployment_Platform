import {
  getAdminDashboard,
  getDownloadLogs,
  getNotifications,
} from '../services/adminService.js';

// HTTP handlers for admin dashboard and audit-log screens.
export async function dashboard(req, res) {
  if (!isAdmin(req.user)) {
    return res.status(403).json({ error: 'Admin access required.' });
  }

  res.json(await getAdminDashboard());
}

export async function notifications(req, res) {
  if (!isAdmin(req.user)) {
    return res.status(403).json({ error: 'Admin access required.' });
  }

  res.json({ notifications: await getNotifications() });
}

export async function downloadLogs(req, res) {
  if (!isAdmin(req.user)) {
    return res.status(403).json({ error: 'Admin access required.' });
  }

  res.json({ logs: await getDownloadLogs(req.query) });
}

export async function exportDownloadLogs(req, res) {
  if (!isAdmin(req.user)) {
    return res.status(403).json({ error: 'Admin access required.' });
  }

  const logs = await getDownloadLogs(req.query);
  const rows = [
    ['Downloaded At', 'User', 'Username', 'Deployment', 'Version', 'Channel', 'IP Address', 'User Agent'],
    ...logs.map((log) => [
      log.downloadedAt,
      log.user,
      log.username,
      log.deployment,
      log.version,
      log.channel,
      log.ipAddress,
      log.userAgent,
    ]),
  ];

  const csv = rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
  const date = new Date().toISOString().slice(0, 10);

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="download-logs-${date}.csv"`);
  res.send(csv);
}

function isAdmin(user) {
  return String(user?.role || '').toLowerCase() === 'admin';
}

function escapeCsv(value) {
  const text = String(value ?? '');
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}
