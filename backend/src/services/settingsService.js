import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const settingsPath = path.join(__dirname, '..', 'admin-settings.json');

const DEFAULT_SETTINGS = {
  appName: 'VIZZIO Deployment Platform',
  supportEmail: 'support@vizzio.local',
  maintenanceMode: false,
  maintenanceMessage: '',
};

function normalizeSettings(settings = {}) {
  const appName = String(settings.appName ?? DEFAULT_SETTINGS.appName).trim() || DEFAULT_SETTINGS.appName;
  const supportEmail = String(settings.supportEmail ?? DEFAULT_SETTINGS.supportEmail).trim() || DEFAULT_SETTINGS.supportEmail;
  const maintenanceMode = settings.maintenanceMode === true || settings.maintenanceMode === 'true';
  const maintenanceMessage = String(settings.maintenanceMessage ?? DEFAULT_SETTINGS.maintenanceMessage).trim();

  return {
    appName,
    supportEmail,
    maintenanceMode,
    maintenanceMessage,
  };
}

export async function getAdminSettings() {
  try {
    const content = await fs.readFile(settingsPath, 'utf8');
    const parsed = JSON.parse(content);
    return normalizeSettings(parsed);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveAdminSettings(settings) {
  const normalized = normalizeSettings(settings);
  await fs.mkdir(path.dirname(settingsPath), { recursive: true });
  await fs.writeFile(settingsPath, JSON.stringify(normalized, null, 2), 'utf8');
  return normalized;
}

export async function resetAdminSettings() {
  return saveAdminSettings(DEFAULT_SETTINGS);
}

export function getDefaultAdminSettings() {
  return { ...DEFAULT_SETTINGS };
}
