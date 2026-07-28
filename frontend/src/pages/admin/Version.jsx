import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import {
  deleteDeploymentVersion,
  fetchDeploymentDetails,
  fetchDeployments,
  fetchPackagePreparation,
  registerDeploymentVersion,
  startPackagePreparation,
  updateDeploymentVersion,
  uploadPackage,
} from '../../api';
import { useSearchParams } from 'react-router-dom';
import '../../styles/Deployment.css';
import '../../styles/Version.css';

const emptyVersion = {
  versionNumber: '',
  releaseType: 'stable',
  status: 'draft',
  sourceType: 'stagingFolder',
  packagePath: '',
  fileName: '',
  fileType: '',
  packageSize: '',
  checksum: '',
  batchScriptName: '',
  preparedPackagePath: '',
  description: '',
};

const REGISTRATION_DRAFT_KEY = 'vizzio_version_registration_draft';
const REGISTRATION_EVENT = 'vizzio-version-registration-update';
let pendingUploadFile = null;

function readRegistrationDraft() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(REGISTRATION_DRAFT_KEY) || 'null');
    return saved?.deploymentId && saved?.form ? saved : null;
  } catch {
    return null;
  }
}

function storeRegistrationDraft(draft, notify = false) {
  sessionStorage.setItem(REGISTRATION_DRAFT_KEY, JSON.stringify({
    ...draft,
    updatedAt: new Date().toISOString(),
  }));
  if (notify) {
    window.dispatchEvent(new CustomEvent(REGISTRATION_EVENT, { detail: draft }));
  }
}

function discardRegistrationDraft(detail = {}, notify = false) {
  sessionStorage.removeItem(REGISTRATION_DRAFT_KEY);
  pendingUploadFile = null;
  if (notify) {
    window.dispatchEvent(new CustomEvent(REGISTRATION_EVENT, {
      detail: { cleared: true, ...detail },
    }));
  }
}

// Convert package bytes into a readable label.
function formatPackageSize(value) {
  if (!value) return 'Not set';
  const bytes = Number(value);
  if (!Number.isFinite(bytes)) return `${value} bytes`;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function formatDuration(totalSeconds) {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return 'Calculating…';
  const seconds = Math.round(totalSeconds);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  if (hours) return `${hours}h ${minutes}m`;
  if (minutes) return `${minutes}m ${remainingSeconds}s`;
  return `${remainingSeconds}s`;
}

function getPreparationPhaseLabel(phase) {
  const labels = {
    queued: 'Waiting to start',
    uploading: 'Uploading local archive',
    scanning: 'Scanning package files',
    validatingArchive: 'Validating archive',
    creatingArchive: 'Creating package archive',
    checksum: 'Calculating checksum',
    completed: 'Package ready',
    failed: 'Preparation failed',
  };
  return labels[phase] || 'Preparing package';
}

function getPackageSourceHint(sourceType) {
  if (sourceType === 'upload') {
    return 'Choose a prepared ZIP or 7z from this computer.';
  }
  if (sourceType === 'serverArchive') {
    return 'Register a ZIP or 7z that is already stored on the backend server.';
  }
  return 'Let the backend package one complete deployment folder into a validated archive.';
}

const packageSources = [
  {
    value: 'stagingFolder',
    title: 'Package server folder',
    badge: 'Best for large builds',
    icon: 'folder',
  },
  {
    value: 'serverArchive',
    title: 'Register server archive',
    badge: 'Already on server',
    icon: 'server',
  },
  {
    value: 'upload',
    title: 'Upload local archive',
    badge: 'From this computer',
    icon: 'upload',
  },
];

function PackageSourceIcon({ type }) {
  const paths = {
    folder: 'M3.5 7.5h6l2 2h9v10h-17z',
    server: 'M4 5h16v6H4zM4 13h16v6H4zM7 8h.1M7 16h.1',
    upload: 'M12 16V5m0 0L8 9m4-4 4 4M5 17v3h14v-3',
  };
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={paths[type]} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PackageProgress({ progress }) {
  if (!progress) return null;
  const measurable = Number.isFinite(progress.phasePercent);
  return (
    <section className="package-preparation-progress" aria-live="polite">
      <div className="package-progress-heading">
        <div>
          <strong>{getPreparationPhaseLabel(progress.phase)}</strong>
          <span>{progress.detail || 'Preparing package…'}</span>
        </div>
        <b>{measurable ? `${Math.round(progress.phasePercent)}%` : 'Working…'}</b>
      </div>
      <div
        className={`package-progress-track${measurable ? '' : ' indeterminate'}`}
        role="progressbar"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow={measurable ? Math.round(progress.phasePercent) : undefined}
      >
        <span style={measurable ? { width: `${Math.max(2, progress.phasePercent)}%` } : undefined} />
      </div>
      <div className="package-progress-meta">
        <span>Elapsed: {formatDuration(progress.elapsedSeconds)}</span>
        <span>Remaining: {progress.etaSeconds === null ? 'Calculating…' : formatDuration(progress.etaSeconds)}</span>
        {progress.processedBytes !== null && progress.totalBytes !== null && (
          <span>{formatPackageSize(progress.processedBytes)} of {formatPackageSize(progress.totalBytes)}</span>
        )}
      </div>
    </section>
  );
}

export default function Version() {
  const [searchParams] = useSearchParams();
  const requestedDeploymentId = searchParams.get('deploymentId') || '';
  const shouldOpenRegistration = searchParams.get('register') === '1';
  const [initialDraft] = useState(readRegistrationDraft);
  const validatingPackageRef = useRef(initialDraft?.phase === 'preparing');
  const savingRef = useRef(initialDraft?.phase === 'registering');
  const registrationSessionRef = useRef(0);
  const mountedRef = useRef(true);

  // Store deployments and the currently selected deployment.
  const [deployments, setDeployments] = useState([]);
  const [selectedId, setSelectedId] = useState(requestedDeploymentId || initialDraft?.deploymentId || '');

  // Store the register-version form state.
  const [form, setForm] = useState(initialDraft?.form || emptyVersion);
  const [showForm, setShowForm] = useState(shouldOpenRegistration || Boolean(initialDraft));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(initialDraft?.phase === 'registering');
  const [busyVersion, setBusyVersion] = useState('');
  const [error, setError] = useState(initialDraft?.error || '');
  const [selectedFile, setSelectedFile] = useState(() => pendingUploadFile);
  const [packageValidated, setPackageValidated] = useState(initialDraft?.phase === 'ready');
  const [validatingPackage, setValidatingPackage] = useState(initialDraft?.phase === 'preparing');
  const [preparationJobId, setPreparationJobId] = useState(initialDraft?.jobId || '');
  const [preparationProgress, setPreparationProgress] = useState(initialDraft?.progress || null);
  const [detailsVersion, setDetailsVersion] = useState(null);
  const [detailsDescription, setDetailsDescription] = useState('');
  const [savingDetails, setSavingDetails] = useState(false);

  const deployment = useMemo(
    () => deployments.find((item) => item.id === selectedId) || null,
    [deployments, selectedId]
  );

  function resetRegistrationForm({ close = true } = {}) {
    registrationSessionRef.current += 1;
    validatingPackageRef.current = false;
    savingRef.current = false;
    setForm({ ...emptyVersion });
    setSelectedFile(null);
    setPackageValidated(false);
    setValidatingPackage(false);
    setPreparationJobId('');
    setPreparationProgress(null);
    setSaving(false);
    setError('');
    discardRegistrationDraft();
    if (close) setShowForm(false);
  }

  function toggleRegistrationForm() {
    if (showForm) {
      resetRegistrationForm();
      return;
    }

    resetRegistrationForm({ close: false });
    setShowForm(true);
  }

  function changeDeployment(deploymentId) {
    resetRegistrationForm({ close: !showForm });
    loadDeployments(deploymentId);
  }

  // Reload deployments after changes so generated metadata stays up to date.
  async function loadDeployments(preferredId) {
    const token = localStorage.getItem('vizzio_token');
    if (!token) return;

    setLoading(true);
    try {
      const result = await fetchDeployments(token);
      const items = result.deployments || [];
      const requestedId = preferredId || selectedId;
      const selectedDeploymentId = items.some((item) => item.id === requestedId)
        ? requestedId
        : items[0]?.id || '';
      let deploymentsWithDetails = items;

      if (selectedDeploymentId) {
        const detailsResult = await fetchDeploymentDetails(token, selectedDeploymentId);
        if (detailsResult?.deployment) {
          deploymentsWithDetails = items.map((item) =>
            item.id === selectedDeploymentId ? detailsResult.deployment : item
          );
        }
      }

      setDeployments(deploymentsWithDetails);
      setSelectedId(selectedDeploymentId);
      setError('');
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDeployments(requestedDeploymentId || initialDraft?.deploymentId);
  }, []);

  useEffect(() => {
    if (!showForm || !selectedId) return;
    const phase = saving
      ? 'registering'
      : validatingPackage
        ? 'preparing'
        : packageValidated
          ? 'ready'
          : 'draft';
    storeRegistrationDraft({
      deploymentId: selectedId,
      form,
      phase,
      error,
      jobId: preparationJobId,
      progress: preparationProgress,
    });
  }, [showForm, selectedId, form, saving, validatingPackage, packageValidated, error, preparationJobId, preparationProgress]);

  useEffect(() => {
    function synchronizeRegistration(event) {
      const update = event.detail || {};
      if (update.cleared) {
        registrationSessionRef.current += 1;
        validatingPackageRef.current = false;
        savingRef.current = false;
        setForm({ ...emptyVersion });
        setSelectedFile(null);
        setPackageValidated(false);
        setValidatingPackage(false);
        setPreparationJobId('');
        setPreparationProgress(null);
        setSaving(false);
        setError('');
        setShowForm(false);
        if (update.completedDeploymentId) {
          loadDeployments(update.completedDeploymentId);
        }
        return;
      }
      if (!update.deploymentId || !update.form) return;
      setSelectedId(update.deploymentId);
      setForm(update.form);
      setShowForm(true);
      setError(update.error || '');
      setPackageValidated(update.phase === 'ready');
      setValidatingPackage(update.phase === 'preparing');
      setSaving(update.phase === 'registering');
      setPreparationJobId(update.jobId || '');
      setPreparationProgress(update.progress || null);
      validatingPackageRef.current = update.phase === 'preparing';
      savingRef.current = update.phase === 'registering';
    }

    window.addEventListener(REGISTRATION_EVENT, synchronizeRegistration);
    return () => window.removeEventListener(REGISTRATION_EVENT, synchronizeRegistration);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    if (initialDraft?.phase === 'preparing' && initialDraft.jobId) {
      pollPackagePreparation(initialDraft.jobId, initialDraft.form, registrationSessionRef.current)
        .catch((resumeError) => {
          if (!mountedRef.current) return;
          validatingPackageRef.current = false;
          setValidatingPackage(false);
          setPackageValidated(false);
          setError(resumeError.message);
          storeRegistrationDraft({
            ...initialDraft,
            phase: 'draft',
            error: resumeError.message,
          }, true);
        });
    } else if (initialDraft?.phase === 'preparing' && initialDraft.form?.sourceType === 'upload' && !pendingUploadFile) {
      const message = 'The local upload was interrupted by a browser refresh. Select the archive and upload it again.';
      validatingPackageRef.current = false;
      setValidatingPackage(false);
      setError(message);
      storeRegistrationDraft({
        ...initialDraft,
        phase: 'draft',
        error: message,
        progress: null,
      });
    }
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const isLocalUploadPhase = validatingPackage
      && !preparationJobId
      && ['uploading', 'validatingArchive'].includes(preparationProgress?.phase);
    if (!isLocalUploadPhase) return undefined;

    const timer = window.setInterval(() => {
      setPreparationProgress((current) => current ? {
        ...current,
        elapsedSeconds: (current.elapsedSeconds || 0) + 1,
      } : current);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [validatingPackage, preparationJobId, preparationProgress?.phase]);

  // Register a version after upload or package validation is complete.
  async function handleRegister(event) {
    event.preventDefault();
    const token = localStorage.getItem('vizzio_token');
    if (!token || !deployment || savingRef.current) return;

    savingRef.current = true;
    setSaving(true);
    setError('');
    storeRegistrationDraft({
      deploymentId: deployment.id,
      form,
      phase: 'registering',
      error: '',
    }, true);
    try {
      let nextForm = { ...form };
      if (form.sourceType === 'upload' && (!packageValidated || selectedFile)) {
        throw new Error('Upload and validate the local archive before registering the version.');
      }

      if (nextForm.preparedPackagePath) {
        nextForm = {
          ...nextForm,
          packagePath: nextForm.preparedPackagePath,
          sourceType: 'serverArchive',
        };
      }

      await registerDeploymentVersion(token, deployment.id, nextForm);
      discardRegistrationDraft({ completedDeploymentId: deployment.id }, true);
      resetRegistrationForm();
      setDetailsVersion(null);
      await loadDeployments(deployment.id);
    } catch (registerError) {
      setError(registerError.message);
      storeRegistrationDraft({
        deploymentId: deployment.id,
        form,
        phase: packageValidated ? 'ready' : 'draft',
        error: registerError.message,
      }, true);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  // Clear package metadata when the path changes.
  function updatePackagePath(value) {
    pendingUploadFile = null;
    setSelectedFile(null);
    setPackageValidated(false);
    setForm({
      ...form,
      packagePath: value,
      fileName: '',
      fileType: '',
      packageSize: '',
      checksum: '',
      batchScriptName: '',
      preparedPackagePath: '',
    });
  }

  function updateVersionNumber(value) {
    setPackageValidated(false);
    setForm((current) => ({
      ...current,
      versionNumber: value,
      fileName: '',
      fileType: '',
      packageSize: '',
      checksum: '',
      batchScriptName: '',
      preparedPackagePath: '',
    }));
  }

  function selectPackageSource(sourceType) {
    pendingUploadFile = null;
    setSelectedFile(null);
    setPackageValidated(false);
    setForm((current) => ({
      ...current,
      sourceType,
      packagePath: '',
      fileName: '',
      fileType: '',
      packageSize: '',
      checksum: '',
      batchScriptName: '',
      preparedPackagePath: '',
    }));
  }

  function applyPreparedPackage(packageInfo, baseForm, registrationSession, jobId) {
    if (registrationSession !== registrationSessionRef.current) return null;
    if (
      !packageInfo?.packagePath
      || !packageInfo.fileName
      || !packageInfo.packageSize
      || !packageInfo.checksum
      || !packageInfo.batchScriptName
      || (baseForm.sourceType === 'stagingFolder' && packageInfo.packageSource !== 'generatedArchive')
    ) {
      throw new Error('Package preparation returned incomplete metadata. Please prepare the package again.');
    }

    const preparedForm = {
      ...baseForm,
      preparedPackagePath: packageInfo.packageSource === 'generatedArchive'
        ? packageInfo.packagePath
        : '',
      fileName: packageInfo.fileName,
      fileType: packageInfo.fileType || '',
      packageSize: packageInfo.packageSize,
      checksum: packageInfo.checksum,
      batchScriptName: packageInfo.batchScriptName,
    };
    setForm(preparedForm);
    setPackageValidated(true);
    setValidatingPackage(false);
    validatingPackageRef.current = false;
    setPreparationProgress((current) => current ? {
      ...current,
      status: 'completed',
      phase: 'completed',
      phasePercent: 100,
      detail: 'Package archive and checksum are ready.',
      etaSeconds: 0,
    } : current);
    storeRegistrationDraft({
      deploymentId: selectedId,
      form: preparedForm,
      phase: 'ready',
      error: '',
      jobId,
      progress: {
        status: 'completed',
        phase: 'completed',
        phasePercent: 100,
        detail: 'Package archive and checksum are ready.',
        etaSeconds: 0,
      },
    }, true);
    return preparedForm;
  }

  async function handleUploadAndValidate() {
    const token = localStorage.getItem('vizzio_token');
    if (!token || !deployment || !selectedFile || validatingPackageRef.current) return;

    const uploadFile = selectedFile;
    const registrationSession = registrationSessionRef.current;
    const startedAt = Date.now();
    validatingPackageRef.current = true;
    setValidatingPackage(true);
    setPackageValidated(false);
    setError('');

    const initialProgress = {
      status: 'running',
      phase: 'uploading',
      phasePercent: 0,
      detail: 'Transferring the archive to the backend.',
      processedBytes: 0,
      totalBytes: uploadFile.size,
      elapsedSeconds: 0,
      etaSeconds: null,
    };
    setPreparationProgress(initialProgress);
    storeRegistrationDraft({
      deploymentId: deployment.id,
      form,
      phase: 'preparing',
      error: '',
      jobId: '',
      progress: initialProgress,
    }, true);

    try {
      const uploaded = await uploadPackage(
        token,
        uploadFile,
        `${deployment.name} ${form.versionNumber}`.trim(),
        ({ loaded, total }) => {
          if (registrationSession !== registrationSessionRef.current) return;
          const elapsedSeconds = Math.max(0.1, (Date.now() - startedAt) / 1000);
          const percent = total ? Math.min(100, loaded / total * 100) : null;
          const bytesPerSecond = loaded / elapsedSeconds;
          const etaSeconds = bytesPerSecond > 0 && total > loaded
            ? Math.round((total - loaded) / bytesPerSecond)
            : loaded >= total ? null : null;
          const progress = loaded >= total
            ? {
                status: 'running',
                phase: 'validatingArchive',
                phasePercent: null,
                detail: 'Upload complete. Checking archive structure and launch script.',
                processedBytes: loaded,
                totalBytes: total,
                elapsedSeconds: Math.round(elapsedSeconds),
                etaSeconds: null,
              }
            : {
                status: 'running',
                phase: 'uploading',
                phasePercent: percent,
                detail: 'Transferring the archive to the backend.',
                processedBytes: loaded,
                totalBytes: total,
                elapsedSeconds: Math.round(elapsedSeconds),
                etaSeconds,
              };
          setPreparationProgress(progress);
          storeRegistrationDraft({
            deploymentId: deployment.id,
            form,
            phase: 'preparing',
            error: '',
            jobId: '',
            progress,
          }, true);
        }
      );
      if (registrationSession !== registrationSessionRef.current) return;

      const uploadedPackage = uploaded.package;
      if (
        !uploadedPackage?.fileId
        || !uploadedPackage.originalName
        || !uploadedPackage.size
        || !uploadedPackage.checksum
        || !uploadedPackage.batchScriptName
      ) {
        throw new Error('Local archive validation returned incomplete metadata. Please upload it again.');
      }

      const preparedForm = {
        ...form,
        packagePath: uploadedPackage.fileId,
        fileName: uploadedPackage.originalName,
        fileType: uploadFile.type || form.fileType || 'application/octet-stream',
        packageSize: String(uploadedPackage.size),
        checksum: uploadedPackage.checksum,
        batchScriptName: uploadedPackage.batchScriptName,
        preparedPackagePath: '',
      };
      pendingUploadFile = null;
      setSelectedFile(null);
      setForm(preparedForm);
      setPackageValidated(true);
      const completedProgress = {
        status: 'completed',
        phase: 'completed',
        phasePercent: 100,
        detail: 'Local archive uploaded and validated.',
        processedBytes: uploadedPackage.size,
        totalBytes: uploadedPackage.size,
        elapsedSeconds: Math.round((Date.now() - startedAt) / 1000),
        etaSeconds: 0,
      };
      setPreparationProgress(completedProgress);
      storeRegistrationDraft({
        deploymentId: deployment.id,
        form: preparedForm,
        phase: 'ready',
        error: '',
        jobId: '',
        progress: completedProgress,
      }, true);
    } catch (uploadError) {
      if (registrationSession !== registrationSessionRef.current) return;
      setPackageValidated(false);
      setError(uploadError.message);
      storeRegistrationDraft({
        deploymentId: deployment.id,
        form,
        phase: 'draft',
        error: uploadError.message,
        jobId: '',
        progress: null,
      }, true);
    } finally {
      if (registrationSession === registrationSessionRef.current) {
        validatingPackageRef.current = false;
        setValidatingPackage(false);
      }
    }
  }

  async function pollPackagePreparation(jobId, baseForm, registrationSession) {
    const token = localStorage.getItem('vizzio_token');
    if (!token) return;

    while (mountedRef.current && registrationSession === registrationSessionRef.current) {
      const result = await fetchPackagePreparation(token, jobId);
      const job = result.job;
      setPreparationProgress(job);
      storeRegistrationDraft({
        deploymentId: selectedId || initialDraft?.deploymentId,
        form: baseForm,
        phase: job.status === 'completed' ? 'ready' : job.status === 'failed' ? 'draft' : 'preparing',
        error: job.error || '',
        jobId,
        progress: job,
      }, true);

      if (job.status === 'completed') {
        applyPreparedPackage(job.package, baseForm, registrationSession, jobId);
        return;
      }
      if (job.status === 'failed') {
        throw new Error(job.error || 'Package preparation failed.');
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  async function handleValidatePackage() {
    const token = localStorage.getItem('vizzio_token');
    if (!token || validatingPackageRef.current) return;

    validatingPackageRef.current = true;
    const registrationSession = registrationSessionRef.current;
    setValidatingPackage(true);
    setError('');
    storeRegistrationDraft({
      deploymentId: deployment?.id,
      form,
      phase: 'preparing',
      error: '',
      jobId: '',
      progress: null,
    }, true);
    try {
      const result = await startPackagePreparation(token, {
        packagePath: form.packagePath,
        sourceType: form.sourceType,
        versionNumber: form.versionNumber,
        deploymentName: deployment?.name,
        deploymentId: deployment?.id,
      });
      const jobId = result.job.id;
      setPreparationJobId(jobId);
      setPreparationProgress(result.job);
      storeRegistrationDraft({
        deploymentId: deployment?.id,
        form,
        phase: 'preparing',
        error: '',
        jobId,
        progress: result.job,
      }, true);
      await pollPackagePreparation(jobId, form, registrationSession);
    } catch (validationError) {
      if (registrationSession !== registrationSessionRef.current) return;
      setPackageValidated(false);
      setValidatingPackage(false);
      validatingPackageRef.current = false;
      setError(validationError.message);
      storeRegistrationDraft({
        deploymentId: deployment?.id,
        form,
        phase: 'draft',
        error: validationError.message,
        jobId: readRegistrationDraft()?.jobId || '',
        progress: readRegistrationDraft()?.progress || null,
      }, true);
    } finally {
      if (registrationSession === registrationSessionRef.current) {
        validatingPackageRef.current = false;
        setValidatingPackage(false);
      }
    }
  }

  async function handleDeleteVersion(version) {
    const token = localStorage.getItem('vizzio_token');
    if (!token || !window.confirm(`Delete version ${version.versionNumber}? The package file will remain on the server.`)) return;

    // Delete only the catalog record; the package file stays on the server.
    setBusyVersion(version.id);
    setError('');
    try {
      await deleteDeploymentVersion(token, version.id);
      await loadDeployments(deployment.id);
    } catch (deleteError) {
      setError(deleteError.message);
    } finally {
      setBusyVersion('');
    }
  }

  async function updateVersion(version, updates) {
    const token = localStorage.getItem('vizzio_token');
    if (!token || !deployment) return;

    // Block repeated clicks while this version is updating.
    setBusyVersion(version.id);
    setError('');
    try {
      await updateDeploymentVersion(token, deployment.id, version.id, updates);
      await loadDeployments(deployment.id);
    } catch (updateError) {
      setError(updateError.message);
    } finally {
      setBusyVersion('');
    }
  }

  async function handleSaveDetails() {
    const token = localStorage.getItem('vizzio_token');
    if (!token || !deployment || !detailsVersion) return;

    setSavingDetails(true);
    setError('');
    try {
      await updateDeploymentVersion(token, deployment.id, detailsVersion.id, {
        description: detailsDescription,
      });
      await loadDeployments(deployment.id);
      setDetailsVersion(null);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSavingDetails(false);
    }
  }

  return (
    <main className="version-page">
      <header className="version-heading">
        <div>
          <p>Register release folders, choose a channel, and control publication status.</p>
        </div>
        <button className="primary-btn" type="button" disabled={!deployment || saving || validatingPackage} onClick={toggleRegistrationForm}>
          {showForm ? 'Cancel' : '+ Register Version'}
        </button>
      </header>

      <div className="version-toolbar">
        <label className="version-filter">
          Deployment
          <select value={selectedId} onChange={(event) => changeDeployment(event.target.value)} disabled={loading || deployments.length === 0 || saving || validatingPackage}>
            {deployments.length === 0 && <option value="">No deployments available</option>}
            {deployments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
      </div>

      {showForm && deployment && (
        <form className="version-register-card" onSubmit={handleRegister}>
          <div className="form-heading">
            <h2>Register a version for {deployment.name}</h2>
            <p>The version starts as a draft so it can be reviewed before release.</p>
          </div>
          <label>
            Version number
            <input value={form.versionNumber} onChange={(event) => updateVersionNumber(event.target.value)} placeholder="v1.3.0" required />
          </label>
          <label>
            Release channel
            <select value={form.releaseType} onChange={(event) => setForm({ ...form, releaseType: event.target.value })}>
              <option value="stable">Stable</option>
              <option value="beta">Beta</option>
            </select>
          </label>
          <fieldset className="package-source-picker">
            <legend>Package source</legend>
            <div className="package-source-options">
              {packageSources.map((source) => (
                <button
                  type="button"
                  key={source.value}
                  className={`package-source-option${form.sourceType === source.value ? ' selected' : ''}`}
                  onClick={() => selectPackageSource(source.value)}
                  aria-pressed={form.sourceType === source.value}
                >
                  <span className="package-source-icon"><PackageSourceIcon type={source.icon} /></span>
                  <span>
                    <strong>{source.title}</strong>
                    <small>{source.badge}</small>
                  </span>
                  <span className="package-source-radio" aria-hidden="true" />
                </button>
              ))}
            </div>
            <span className="version-field-hint">{getPackageSourceHint(form.sourceType)}</span>
          </fieldset>
          {form.sourceType === 'stagingFolder' && (
            <aside className="staging-folder-guide">
              <div>
                <strong>Prepare one deployment root folder</strong>
                <p>Place all component folders and one launch batch script directly inside it. Exclude runtime caches, logs, and temporary files to avoid unnecessary packaging delays.</p>
              </div>
              <div className="package-tree" aria-label="Example deployment folder structure">
                <code>Deployment-v1.3.0/</code>
                <code>├─ 01_WebUI/</code>
                <code>├─ 04_EXE_Demo/</code>
                <code>├─ 05_NafelVT/</code>
                <code>└─ RunTFIMApp.bat</code>
              </div>
            </aside>
          )}
          {form.sourceType !== 'upload' && (
            <label className="version-path-field">
              {form.sourceType === 'stagingFolder' ? 'Deployment root folder on server' : 'Archive file on server'}
              <input
                value={form.packagePath}
                onChange={(event) => updatePackagePath(event.target.value)}
                placeholder={form.sourceType === 'stagingFolder' ? 'C:\\VIZZIO\\packages\\digital-twin\\v1.3.0' : 'C:\\VIZZIO\\packages\\digital-twin-v1.3.0.zip'}
                required
              />
              <span className="version-field-hint">Enter an absolute path inside the configured backend package root. Paths on your own computer are not accessible to the server.</span>
            </label>
          )}
          {form.sourceType !== 'upload' && (
            <>
              <div className="version-form-actions">
                <button className="secondary-btn" type="button" disabled={validatingPackage || !form.versionNumber.trim() || !form.packagePath || Boolean(selectedFile)} onClick={handleValidatePackage}>
                  {validatingPackage ? 'Preparation running…' : form.sourceType === 'stagingFolder' ? 'Inspect & prepare package' : 'Validate server archive'}
                </button>
                {packageValidated && <span className="version-validation-ok">{form.sourceType === 'stagingFolder' ? 'Package ready. Archive and checksum prepared.' : 'Archive ready. Structure and checksum verified.'}</span>}
              </div>
              {validatingPackage && <PackageProgress progress={preparationProgress} />}
            </>
          )}
          {form.sourceType === 'upload' && (
            <>
              <label className="version-file-field">
                Local ZIP or 7z archive
                <span className="version-field-hint">Choose one prepared archive containing the deployment folders and a root-level launch batch script.</span>
                <input
                  type="file"
                  accept=".zip,.7z,application/zip,application/x-7z-compressed"
                  disabled={validatingPackage}
                  onChange={(event) => {
                    const file = event.target.files?.[0] || null;
                    pendingUploadFile = file;
                    setSelectedFile(file);
                    setPackageValidated(false);
                    setPreparationProgress(null);
                    if (file) {
                      setForm({
                        ...form,
                        sourceType: 'upload',
                        packagePath: file.name,
                        fileName: file.name,
                        fileType: file.type || '',
                        packageSize: String(file.size),
                        checksum: '',
                        batchScriptName: '',
                        preparedPackagePath: '',
                      });
                    }
                  }}
                />
                {selectedFile && (
                  <span className="selected-upload-summary">
                    Selected: <strong>{selectedFile.name}</strong> · {formatPackageSize(selectedFile.size)}
                  </span>
                )}
              </label>
              <div className="version-form-actions">
                <button
                  className="secondary-btn"
                  type="button"
                  disabled={validatingPackage || !form.versionNumber.trim() || !selectedFile}
                  onClick={handleUploadAndValidate}
                >
                  {validatingPackage ? 'Uploading and validating…' : 'Upload & validate archive'}
                </button>
                {packageValidated && <span className="version-validation-ok">Local archive uploaded, validated, and checksummed.</span>}
              </div>
              {validatingPackage && <PackageProgress progress={preparationProgress} />}
            </>
          )}
          <label>
            Initial status
            <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
              <option value="draft">Draft</option>
              <option value="released">Released</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          <label>
            Description
            <textarea
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              placeholder="Describe what's included in this version"
              rows="3"
            />
          </label>
          <label className="version-metadata-field">
            File name
            <input value={form.fileName} readOnly placeholder={form.sourceType === 'stagingFolder' ? 'Created by Inspect & prepare package' : 'Validate or upload a package first'} />
            {form.preparedPackagePath && <span className="version-field-hint">Prepared archive: {form.preparedPackagePath}</span>}
          </label>
          <label className="version-metadata-field">
            File type
            <input value={form.fileType} readOnly placeholder="application/zip" />
          </label>
          <label className="version-metadata-field">
            Detected launch script
            <input value={form.batchScriptName} readOnly placeholder="Validate or upload a package first" />
            <span className="version-field-hint">The launcher runs this top-level batch file after install.</span>
          </label>
          <label className="version-metadata-field">
            Package size in bytes
            <input type="number" min="0" step="1" value={form.packageSize} readOnly placeholder="Available after preparation or validation" />
          </label>
          <label className="version-checksum-field">
            Checksum
            <input value={form.checksum} readOnly placeholder="Calculated during package preparation or validation" />
          </label>
          <div className="version-form-actions">
            <button className="primary-btn" type="submit" disabled={saving || !packageValidated}>{saving ? 'Registering...' : 'Register version'}</button>
          </div>
        </form>
      )}

      {error && <ErrorDialog message={error} onClose={() => setError('')} />}

      <section className="version-list-card">
        <div className="version-list-heading">
          <div>
            <h2>{deployment?.name || 'Versions'}</h2>
            <p>{deployment ? `${deployment.versions.length} registered versions` : 'Create a deployment before registering versions.'}</p>
          </div>
        </div>

        {loading ? (
          <p className="version-empty">Loading versions...</p>
        ) : !deployment || deployment.versions.length === 0 ? (
          <div className="version-empty">
            <h3>No versions registered</h3>
            <p>Register a release folder to create the first draft.</p>
          </div>
        ) : (
          <div className="version-table-wrap">
            <table className="version-table">
              <thead><tr><th>Version</th><th>Package</th><th>Channel</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
              <tbody>
                {groupVersions(deployment.versions).map((group) => (
                  <Fragment key={group.key}>
                    <tr className="version-group-row">
                      <td colSpan="6">{group.label}</td>
                    </tr>
                    {group.versions.map((version) => {
                      const busy = busyVersion === version.id;
                      return (
                        <tr key={version.id}>
                          <td><strong>{version.versionNumber}</strong></td>
                          <td>
                            <div className="version-package-details">
                              <strong>{version.fileName || 'Generated package'}</strong>
                              <span className="version-path" title={version.packagePath || ''}>{version.packagePath || 'Path not set'}</span>
                              <span>{version.packageSource || 'package'} - {version.fileType || 'Type not set'} - {formatPackageSize(version.packageSize)}</span>
                              {version.description && <span className="version-description-preview" title={version.description}>{version.description}</span>}
                              {version.checksum && <span className="version-checksum" title={version.checksum}>Checksum: {version.checksum}</span>}
                            </div>
                          </td>
                          <td>
                            <button className={`channel-toggle channel-${version.releaseType}`} type="button" disabled={busy} onClick={() => updateVersion(version, { releaseType: version.releaseType === 'stable' ? 'beta' : 'stable' })}>
                              {version.releaseType}
                            </button>
                          </td>
                          <td><span className={`version-status status-${version.status}`}>{version.status}</span></td>
                          <td>{new Date(version.createdAt).toLocaleDateString()}</td>
                          <td>
                            <div className="version-actions">
                              <button
                                className="details-btn"
                                type="button"
                                disabled={busy}
                                onClick={() => {
                                  setDetailsVersion(version);
                                  setDetailsDescription(version.description || '');
                                }}
                              >
                                Details
                              </button>
                              {version.status !== 'released' && <button className="release-btn" type="button" disabled={busy} onClick={() => updateVersion(version, { status: 'released' })}>Release</button>}
                              {version.status !== 'archived' && <button className="archive-btn" type="button" disabled={busy} onClick={() => updateVersion(version, { status: 'archived' })}>Archive</button>}
                              {version.status === 'archived' && <button className="draft-btn" type="button" disabled={busy} onClick={() => updateVersion(version, { status: 'draft' })}>Restore draft</button>}
                              <button className="delete-btn" type="button" disabled={busy} onClick={() => handleDeleteVersion(version)}>Delete</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {detailsVersion && (
        <div className="version-modal-backdrop" onClick={() => setDetailsVersion(null)} role="presentation">
          <section
            className="version-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Version details"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="version-modal-header">
              <h3>{detailsVersion.versionNumber}</h3>
              <button type="button" className="details-close-btn" onClick={() => setDetailsVersion(null)}>
                Close
              </button>
            </header>
            <dl className="version-modal-grid">
              <div>
                <dt>Name</dt>
                <dd>{detailsVersion.versionNumber}</dd>
              </div>
              <div>
                <dt>File</dt>
                <dd>{detailsVersion.fileName || 'Generated package'}</dd>
              </div>
              <div>
                <dt>Size</dt>
                <dd>{formatPackageSize(detailsVersion.packageSize)}</dd>
              </div>
              <div>
                <dt>Type</dt>
                <dd>{detailsVersion.fileType || 'Not set'}</dd>
              </div>
              <div>
                <dt>Channel</dt>
                <dd>{titleCase(detailsVersion.releaseType)}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{titleCase(detailsVersion.status)}</dd>
              </div>
              <div className="version-modal-full">
                <dt>Description</dt>
                <dd>
                  <textarea
                    className="version-modal-textarea"
                    value={detailsDescription}
                    onChange={(event) => setDetailsDescription(event.target.value)}
                    rows="4"
                    placeholder="No description provided"
                  />
                </dd>
              </div>
              <div className="version-modal-full">
                <dt>Package path</dt>
                <dd className="version-mono">{detailsVersion.packagePath || 'Path not set'}</dd>
              </div>
              <div className="version-modal-full">
                <dt>Checksum</dt>
                <dd className="version-mono">{detailsVersion.checksum || 'Not available'}</dd>
              </div>
              <div>
                <dt>Created</dt>
                <dd>{new Date(detailsVersion.createdAt).toLocaleString()}</dd>
              </div>
              <div>
                <dt>Released</dt>
                <dd>{detailsVersion.releasedAt ? new Date(detailsVersion.releasedAt).toLocaleString() : 'Not released'}</dd>
              </div>
            </dl>
            <footer className="version-modal-actions">
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setDetailsVersion(null)}
                disabled={savingDetails}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary-btn"
                onClick={handleSaveDetails}
                disabled={savingDetails}
              >
                {savingDetails ? 'Saving...' : 'Save description'}
              </button>
            </footer>
          </section>
        </div>
      )}
    </main>
  );
}

function ErrorDialog({ message, onClose }) {
  return (
    <div className="version-modal-backdrop" onClick={onClose} role="presentation">
      <section
        className="version-modal version-error-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="version-error-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="version-modal-header">
          <h3 id="version-error-title">Version action failed</h3>
        </header>
        <div className="version-error-body">
          <p>{message}</p>
        </div>
        <footer className="version-modal-actions">
          <button className="version-error-ok-btn" type="button" onClick={onClose}>
            OK
          </button>
        </footer>
      </section>
    </div>
  );
}

function groupVersions(versions) {
  const channelOrder = ['stable', 'beta'];
  const statusOrder = ['released', 'archived', 'draft'];

  return channelOrder.flatMap((channel) =>
    statusOrder
      .map((status) => {
        const items = versions.filter((version) => version.releaseType === channel && version.status === status);
        return {
          key: `${channel}-${status}`,
          label: `${titleCase(channel)} / ${titleCase(status)} (${items.length})`,
          versions: items,
        };
      })
      .filter((group) => group.versions.length > 0)
  );
}

function titleCase(value) {
  return String(value || '').slice(0, 1).toUpperCase() + String(value || '').slice(1);
}
