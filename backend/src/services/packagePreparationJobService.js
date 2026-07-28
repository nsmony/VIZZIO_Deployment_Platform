import crypto from 'crypto';
import path from 'path';
import { validatePackage } from './deploymentService.js';

const jobs = new Map();
const activeJobs = new Map();
const JOB_RETENTION_MS = 60 * 60 * 1000;

function createJobKey(data) {
  const parts = [
    data.deploymentId,
    data.versionNumber,
    data.sourceType,
    path.resolve(String(data.packagePath || '')),
  ];
  const key = parts.join('|');
  return process.platform === 'win32' ? key.toLowerCase() : key;
}

function updateProgress(job, progress = {}) {
  const now = Date.now();
  if (progress.phase && progress.phase !== job.phase) {
    job.phase = progress.phase;
    job.phaseStartedAt = now;
  }
  if (progress.percent !== undefined) job.phasePercent = progress.percent;
  if (progress.detail !== undefined) job.detail = progress.detail;
  if (progress.processedBytes !== undefined) job.processedBytes = progress.processedBytes;
  if (progress.totalBytes !== undefined) job.totalBytes = progress.totalBytes;
  job.updatedAt = now;
}

function toPublicJob(job) {
  const now = Date.now();
  const elapsedSeconds = Math.max(0, Math.round((now - job.startedAt) / 1000));
  const phaseElapsedSeconds = Math.max(0, (now - job.phaseStartedAt) / 1000);
  const measurable = Number.isFinite(job.phasePercent) && job.phasePercent > 0 && job.phasePercent < 100;
  const etaSeconds = measurable
    ? Math.max(0, Math.round(phaseElapsedSeconds * (100 - job.phasePercent) / job.phasePercent))
    : null;

  return {
    id: job.id,
    status: job.status,
    phase: job.phase,
    phasePercent: job.phasePercent,
    detail: job.detail,
    processedBytes: job.processedBytes,
    totalBytes: job.totalBytes,
    elapsedSeconds,
    etaSeconds,
    package: job.package || null,
    error: job.error || '',
    createdAt: new Date(job.createdAt).toISOString(),
    updatedAt: new Date(job.updatedAt).toISOString(),
  };
}

export function startPackagePreparationJob(data) {
  const key = createJobKey(data);
  const activeId = activeJobs.get(key);
  const activeJob = activeId ? jobs.get(activeId) : null;
  if (activeJob && (activeJob.status === 'queued' || activeJob.status === 'running')) {
    return toPublicJob(activeJob);
  }

  const now = Date.now();
  const job = {
    id: crypto.randomUUID(),
    key,
    status: 'queued',
    phase: 'queued',
    phasePercent: null,
    detail: 'Waiting to start package preparation.',
    processedBytes: null,
    totalBytes: null,
    package: null,
    error: '',
    createdAt: now,
    startedAt: now,
    phaseStartedAt: now,
    updatedAt: now,
    abortController: new AbortController(),
  };
  jobs.set(job.id, job);
  activeJobs.set(key, job.id);

  queueMicrotask(async () => {
    if (job.abortController.signal.aborted) return;
    job.status = 'running';
    updateProgress(job, {
      phase: 'scanning',
      percent: null,
      detail: 'Scanning package files and checking the launch script.',
    });
    try {
      job.package = await validatePackage(data, {
        onProgress: (progress) => updateProgress(job, progress),
        signal: job.abortController.signal,
      });
      if (job.abortController.signal.aborted) return;
      job.status = 'completed';
      updateProgress(job, {
        phase: 'completed',
        percent: 100,
        detail: 'Package archive and checksum are ready.',
        processedBytes: job.totalBytes,
      });
    } catch (error) {
      if (job.abortController.signal.aborted) return;
      job.status = 'failed';
      job.error = error.message || 'Package preparation failed.';
      updateProgress(job, {
        phase: 'failed',
        percent: null,
        detail: job.error,
      });
    } finally {
      if (activeJobs.get(key) === job.id) activeJobs.delete(key);
      setTimeout(() => jobs.delete(job.id), JOB_RETENTION_MS).unref?.();
    }
  });

  return toPublicJob(job);
}

export function getPackagePreparationJob(jobId) {
  const job = jobs.get(jobId);
  return job ? toPublicJob(job) : null;
}

export function cancelPackagePreparationJob(jobId) {
  const job = jobs.get(jobId);
  if (!job) return null;
  if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
    return toPublicJob(job);
  }

  job.status = 'cancelled';
  job.error = '';
  updateProgress(job, {
    phase: 'cancelled',
    percent: null,
    detail: 'Package preparation was cancelled.',
  });
  job.abortController.abort();
  if (activeJobs.get(job.key) === job.id) activeJobs.delete(job.key);
  setTimeout(() => jobs.delete(job.id), JOB_RETENTION_MS).unref?.();
  return toPublicJob(job);
}
