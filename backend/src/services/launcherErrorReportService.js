import fs from 'fs/promises';
import path from 'path';

const REPORT_ROOT = path.resolve(process.env.LAUNCHER_ERROR_REPORT_ROOT || path.join(process.cwd(), 'storage', 'launcher-error-reports'));
const MAX_LOG_CHARS = 120_000;
const MAX_REPORTS = 500;

function sanitizeFilePart(value) {
  return String(value || 'unknown')
    .replace(/[^a-z0-9_.-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'unknown';
}

function sanitizeReportId(value) {
  return String(value || '')
    .replace(/[^a-z0-9_.-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 160);
}

export async function saveLauncherErrorReport({ user, body, ipAddress, userAgent }) {
  const now = new Date();
  const report = {
    id: `${now.toISOString().replace(/[:.]/g, '-')}-${sanitizeFilePart(user?.sub || user?.id || user?.username)}`,
    receivedAt: now.toISOString(),
    user: {
      id: user?.sub || user?.id || '',
      username: user?.username || '',
      role: user?.role || '',
    },
    client: {
      version: String(body?.launcherVersion || ''),
      machineName: String(body?.machineName || ''),
      osVersion: String(body?.osVersion || ''),
    },
    context: {
      area: String(body?.area || 'launcher'),
      deploymentName: String(body?.deploymentName || ''),
      versionNumber: String(body?.versionNumber || ''),
      message: String(body?.message || '').slice(0, 4000),
    },
    request: {
      ipAddress,
      userAgent,
    },
    logTail: String(body?.logTail || '').slice(-MAX_LOG_CHARS),
  };

  await fs.mkdir(REPORT_ROOT, { recursive: true });
  const filePath = path.join(REPORT_ROOT, `${report.id}.json`);
  await fs.writeFile(filePath, JSON.stringify(report, null, 2), 'utf8');
  return { id: report.id, savedAt: report.receivedAt };
}

export async function listLauncherErrorReports(filters = {}) {
  const reports = await readReports();
  return reports
    .filter((report) => matchesFilters(report, filters))
    .sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt))
    .slice(0, MAX_REPORTS)
    .map(toReportSummary);
}

export async function getLauncherErrorReport(reportId) {
  const safeId = sanitizeReportId(reportId);
  if (!safeId || safeId !== String(reportId || '')) {
    const error = new Error('Launcher error report was not found.');
    error.status = 404;
    throw error;
  }

  const filePath = path.join(REPORT_ROOT, `${safeId}.json`);
  try {
    const report = JSON.parse(await fs.readFile(filePath, 'utf8'));
    return normalizeReport(report);
  } catch (error) {
    if (error.code === 'ENOENT') {
      const notFound = new Error('Launcher error report was not found.');
      notFound.status = 404;
      throw notFound;
    }
    throw error;
  }
}

async function readReports() {
  try {
    const entries = await fs.readdir(REPORT_ROOT, { withFileTypes: true });
    const jsonFiles = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
      .map((entry) => entry.name)
      .sort()
      .reverse()
      .slice(0, MAX_REPORTS);

    const reports = await Promise.all(jsonFiles.map(async (fileName) => {
      try {
        return normalizeReport(JSON.parse(await fs.readFile(path.join(REPORT_ROOT, fileName), 'utf8')));
      } catch {
        return null;
      }
    }));
    return reports.filter(Boolean);
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

function matchesFilters(report, filters) {
  const deployment = String(filters.deployment || '').trim().toLowerCase();
  const area = String(filters.area || '').trim().toLowerCase();

  if (deployment && report.context.deploymentName.toLowerCase() !== deployment) return false;
  if (area && report.context.area.toLowerCase() !== area) return false;
  return true;
}

function normalizeReport(report) {
  return {
    id: String(report?.id || ''),
    receivedAt: String(report?.receivedAt || ''),
    user: {
      id: String(report?.user?.id || ''),
      username: String(report?.user?.username || ''),
      role: String(report?.user?.role || ''),
    },
    client: {
      version: String(report?.client?.version || ''),
      machineName: String(report?.client?.machineName || ''),
      osVersion: String(report?.client?.osVersion || ''),
    },
    context: {
      area: String(report?.context?.area || 'launcher'),
      deploymentName: String(report?.context?.deploymentName || ''),
      versionNumber: String(report?.context?.versionNumber || ''),
      message: String(report?.context?.message || ''),
    },
    request: {
      ipAddress: String(report?.request?.ipAddress || ''),
      userAgent: String(report?.request?.userAgent || ''),
    },
    logTail: String(report?.logTail || ''),
  };
}

function toReportSummary(report) {
  return {
    id: report.id,
    receivedAt: report.receivedAt,
    user: report.user,
    client: report.client,
    context: report.context,
    request: report.request,
    logTailSize: report.logTail.length,
  };
}
