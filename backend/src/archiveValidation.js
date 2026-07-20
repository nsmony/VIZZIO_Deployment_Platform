import path from 'path';

const SUPPORTED_ARCHIVE_EXTENSIONS = new Set(['.zip', '.7z']);

export function ensureSupportedArchive(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (!SUPPORTED_ARCHIVE_EXTENSIONS.has(extension)) {
    throw new Error('Deployment package archive must be a ZIP or 7z file.');
  }
}
