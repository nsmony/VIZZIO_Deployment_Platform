import fs from 'fs/promises';
import { constants as fsConstants } from 'fs';
import path from 'path';
import { getSevenZipStatus } from '../archiveValidation.js';
import { getPackageRoot } from './packageArchiveService.js';
import { getUploadStorageRoot } from '../uploadStore.js';

const DEFAULT_SECRETS = new Set([
  'replace-with-secure-secret',
  'replace-with-secure-download-secret',
  'replace-with-secure-download-manager-secret',
]);

export async function getSystemReadiness() {
  const checks = await Promise.all([
    checkEnvironmentValue('DATABASE_URL', 'Database URL', { required: true, redact: true }),
    checkSecret('JWT_SECRET', 'JWT secret'),
    checkSecret('DOWNLOAD_SECRET', 'Download token secret'),
    checkSecret('DOWNLOAD_MANAGER_SECRET', 'Download manager token secret', { fallback: process.env.DOWNLOAD_SECRET }),
    checkDirectory('Package root', getPackageRoot(), { requireWritable: true }),
    checkDirectory('Upload storage', getUploadStorageRoot(), { requireWritable: true }),
    checkOptionalDirectory('Download root', process.env.DOWNLOAD_ROOT),
    checkSevenZip(),
    checkEnvironmentValue('PORT', 'Backend port', { required: false }),
  ]);

  const failedRequired = checks.some((check) => check.required && check.status !== 'ok');
  const warnings = checks.some((check) => !check.required && check.status !== 'ok');
  return {
    status: failedRequired ? 'not-ready' : warnings ? 'ready-with-warnings' : 'ready',
    checkedAt: new Date().toISOString(),
    checks,
  };
}

async function checkEnvironmentValue(key, label, options = {}) {
  const value = process.env[key] || '';
  const required = options.required !== false;
  const ok = options.required ? Boolean(value) : true;
  return {
    key,
    label,
    status: ok ? 'ok' : 'error',
    required,
    value: value ? (options.redact ? 'Configured' : value) : 'Not configured',
    message: ok ? '' : `${label} is required for hosted operation.`,
  };
}

async function checkSecret(key, label, options = {}) {
  const value = process.env[key] || options.fallback || '';
  const configured = Boolean(value);
  const usesDefault = DEFAULT_SECRETS.has(value);
  return {
    key,
    label,
    status: configured && !usesDefault ? 'ok' : 'error',
    required: true,
    value: configured && !usesDefault ? 'Configured' : 'Not safely configured',
    message: configured && !usesDefault
      ? ''
      : `${label} must be set to a secure non-default value before exposing the backend.`,
  };
}

async function checkDirectory(label, directoryPath, options = {}) {
  const requireWritable = options.requireWritable !== false;
  try {
    await fs.access(directoryPath, requireWritable ? fsConstants.R_OK | fsConstants.W_OK : fsConstants.R_OK);
    return {
      key: label.toLowerCase().replace(/\s+/g, '-'),
      label,
      status: 'ok',
      required: true,
      value: path.resolve(directoryPath),
      message: '',
    };
  } catch (error) {
    return {
      key: label.toLowerCase().replace(/\s+/g, '-'),
      label,
      status: 'error',
      required: true,
      value: path.resolve(directoryPath),
      message: `${label} is not accessible${requireWritable ? ' or writable' : ''}: ${error.message}`,
    };
  }
}

async function checkOptionalDirectory(label, directoryPath) {
  if (!directoryPath) {
    return {
      key: label.toLowerCase().replace(/\s+/g, '-'),
      label,
      status: 'warning',
      required: false,
      value: 'Not configured',
      message: `${label} is optional for local delivery but should be configured for hosted large-file delivery.`,
    };
  }

  return checkDirectory(label, directoryPath, { requireWritable: false });
}

async function checkSevenZip() {
  const status = await getSevenZipStatus();
  return {
    key: 'seven-zip',
    label: '7z / 7za',
    status: status.available ? 'ok' : 'warning',
    required: false,
    value: status.available ? status.command : 'Not found',
    message: status.available ? '' : status.message,
  };
}
