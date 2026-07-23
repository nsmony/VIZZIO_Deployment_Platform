const DEFAULT_LAUNCHER_VERSION = process.env.LAUNCHER_LATEST_VERSION || '0.1.0';

function compareVersions(left, right) {
  const leftParts = String(left || '0').split('.').map((part) => Number.parseInt(part, 10) || 0);
  const rightParts = String(right || '0').split('.').map((part) => Number.parseInt(part, 10) || 0);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const diff = (leftParts[index] || 0) - (rightParts[index] || 0);
    if (diff !== 0) return Math.sign(diff);
  }

  return 0;
}

export function getLauncherUpdate(currentVersion) {
  const latestVersion = DEFAULT_LAUNCHER_VERSION;
  const updateAvailable = compareVersions(latestVersion, currentVersion) > 0;

  return {
    currentVersion: currentVersion || '',
    latestVersion,
    updateAvailable,
    required: process.env.LAUNCHER_UPDATE_REQUIRED === 'true',
    downloadUrl: process.env.LAUNCHER_DOWNLOAD_URL || '',
    releaseNotes: process.env.LAUNCHER_RELEASE_NOTES || '',
  };
}
