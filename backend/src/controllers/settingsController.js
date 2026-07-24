import { getAdminSettings, saveAdminSettings, resetAdminSettings } from '../services/settingsService.js';
import { getSystemReadiness } from '../services/systemReadinessService.js';

export async function fetchSettings(req, res) {
  if (!isAdmin(req.user)) {
    return res.status(403).json({ error: 'Admin access required.' });
  }

  res.json({ settings: await getAdminSettings() });
}

export async function updateSettings(req, res) {
  if (!isAdmin(req.user)) {
    return res.status(403).json({ error: 'Admin access required.' });
  }

  try {
    const settings = await saveAdminSettings(req.body);
    res.json({ settings });
  } catch (error) {
    res.status(500).json({ error: 'Unable to save settings.' });
  }
}

export async function resetSettings(req, res) {
  if (!isAdmin(req.user)) {
    return res.status(403).json({ error: 'Admin access required.' });
  }

  const settings = await resetAdminSettings();
  res.json({ settings });
}

export async function systemReadiness(req, res) {
  if (!isAdmin(req.user)) {
    return res.status(403).json({ error: 'Admin access required.' });
  }

  try {
    res.json({ readiness: await getSystemReadiness() });
  } catch {
    res.status(500).json({ error: 'Unable to check system readiness.' });
  }
}

function isAdmin(user) {
  return String(user?.role || '').toLowerCase() === 'admin';
}
