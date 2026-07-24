import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const SUPPORTED_ARCHIVE_EXTENSIONS = new Set(['.zip', '.7z']);
const ZIP_CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const ZIP_END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const ZIP64_END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06064b50;
const ZIP64_END_OF_CENTRAL_DIRECTORY_LOCATOR_SIGNATURE = 0x07064b50;
export const SEVEN_ZIP_EXECUTABLES = process.platform === 'win32'
  ? ['7z', '7za', 'C:\\Program Files\\7-Zip\\7z.exe', 'C:\\Program Files (x86)\\7-Zip\\7z.exe']
  : ['7z', '7za'];

export function ensureSupportedArchive(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (!SUPPORTED_ARCHIVE_EXTENSIONS.has(extension)) {
    throw new Error('Deployment package archive must be a ZIP or 7z file.');
  }
}

export async function findTopLevelBatchScriptInArchive(filePath) {
  ensureSupportedArchive(filePath);
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.zip') {
    return findTopLevelBatchScriptInZip(filePath);
  }

  return findTopLevelBatchScriptIn7Zip(filePath);
}

export async function getSevenZipStatus() {
  for (const executable of SEVEN_ZIP_EXECUTABLES) {
    try {
      await runSevenZipExecutable(executable, null);
      return { available: true, command: executable };
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      return { available: true, command: executable };
    }
  }

  return {
    available: false,
    command: '',
    message: '7z package validation requires 7z or 7za on the backend server.',
  };
}

async function findTopLevelBatchScriptInZip(filePath) {
  const entries = await readZipEntryNames(filePath);
  return entries.find(isTopLevelBatchScript) || null;
}

async function readZipEntryNames(filePath) {
  const handle = await fs.promises.open(filePath, 'r');

  try {
    const stat = await handle.stat();
    const tailLength = Math.min(Number(stat.size), 0xffff + 22 + 1024);
    const tailBuffer = Buffer.alloc(tailLength);
    await handle.read(tailBuffer, 0, tailLength, Number(stat.size) - tailLength);

    let eocdOffset = -1;
    for (let index = tailBuffer.length - 22; index >= 0; index -= 1) {
      if (tailBuffer.readUInt32LE(index) === ZIP_END_OF_CENTRAL_DIRECTORY_SIGNATURE) {
        eocdOffset = index;
        break;
      }
    }

    if (eocdOffset < 0) {
      throw new Error('ZIP package could not be inspected.');
    }

    const directoryInfo = await readZipCentralDirectoryInfo(handle, tailBuffer, eocdOffset, Number(stat.size));

    const centralDirectory = Buffer.alloc(directoryInfo.size);
    await handle.read(centralDirectory, 0, directoryInfo.size, directoryInfo.offset);

    const entries = [];
    let offset = 0;
    while (offset + 46 <= centralDirectory.length) {
      if (centralDirectory.readUInt32LE(offset) !== ZIP_CENTRAL_DIRECTORY_SIGNATURE) {
        throw new Error('ZIP package central directory could not be inspected.');
      }

      const fileNameLength = centralDirectory.readUInt16LE(offset + 28);
      const extraLength = centralDirectory.readUInt16LE(offset + 30);
      const commentLength = centralDirectory.readUInt16LE(offset + 32);
      const fileName = centralDirectory
        .subarray(offset + 46, offset + 46 + fileNameLength)
        .toString('utf8');

      entries.push(fileName);
      offset += 46 + fileNameLength + extraLength + commentLength;
    }

    return entries;
  } finally {
    await handle.close();
  }
}

async function readZipCentralDirectoryInfo(handle, tailBuffer, eocdOffset, archiveSize) {
  const centralDirectorySize = tailBuffer.readUInt32LE(eocdOffset + 12);
  const centralDirectoryOffset = tailBuffer.readUInt32LE(eocdOffset + 16);
  if (centralDirectorySize !== 0xffffffff && centralDirectoryOffset !== 0xffffffff) {
    return {
      size: centralDirectorySize,
      offset: centralDirectoryOffset,
    };
  }

  const locatorOffset = eocdOffset - 20;
  if (locatorOffset < 0 || tailBuffer.readUInt32LE(locatorOffset) !== ZIP64_END_OF_CENTRAL_DIRECTORY_LOCATOR_SIGNATURE) {
    throw new Error('ZIP64 package central directory could not be inspected.');
  }

  const zip64EocdOffset = Number(tailBuffer.readBigUInt64LE(locatorOffset + 8));
  if (!Number.isSafeInteger(zip64EocdOffset) || zip64EocdOffset < 0 || zip64EocdOffset >= archiveSize) {
    throw new Error('ZIP64 package central directory offset is invalid.');
  }

  const zip64Eocd = Buffer.alloc(56);
  await handle.read(zip64Eocd, 0, zip64Eocd.length, zip64EocdOffset);
  if (zip64Eocd.readUInt32LE(0) !== ZIP64_END_OF_CENTRAL_DIRECTORY_SIGNATURE) {
    throw new Error('ZIP64 package central directory could not be inspected.');
  }

  const size = Number(zip64Eocd.readBigUInt64LE(40));
  const offset = Number(zip64Eocd.readBigUInt64LE(48));
  if (!Number.isSafeInteger(size) || !Number.isSafeInteger(offset) || size < 0 || offset < 0) {
    throw new Error('ZIP64 package central directory is too large to inspect.');
  }

  return { size, offset };
}

async function findTopLevelBatchScriptIn7Zip(filePath) {
  const output = await runSevenZipList(filePath);
  const entries = parseSevenZipListOutput(output);
  return entries.find(isTopLevelBatchScript) || null;
}

async function runSevenZipList(filePath) {
  const errors = [];
  for (const executable of SEVEN_ZIP_EXECUTABLES) {
    try {
      return await runSevenZipExecutable(executable, filePath);
    } catch (error) {
      if (error.code === 'ENOENT') {
        errors.push(error);
        continue;
      }
      throw error;
    }
  }

  const error = new Error('7z package validation requires 7z or 7za on the backend server.');
  error.cause = errors[0];
  throw error;
}

function runSevenZipExecutable(executable, filePath) {
  return new Promise((resolve, reject) => {
    const args = filePath ? ['l', '-slt', filePath] : ['i'];
    const child = spawn(executable, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    let errorOutput = '';

    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      errorOutput += chunk.toString();
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve(output);
        return;
      }

      reject(new Error(errorOutput.trim() || '7z package could not be inspected.'));
    });
  });
}

function parseSevenZipListOutput(output) {
  const entries = [];
  let current = {};

  const flushRecord = () => {
    if (current.Path && current.Folder !== '+') {
      entries.push(current.Path);
    }
    current = {};
  };

  for (const rawLine of String(output || '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      flushRecord();
      continue;
    }

    const separator = line.indexOf(' = ');
    if (separator <= 0) continue;
    current[line.slice(0, separator)] = line.slice(separator + 3);
  }
  flushRecord();
  return entries;
}

function isTopLevelBatchScript(entryName) {
  const normalized = String(entryName || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized || normalized.endsWith('/')) return false;
  if (normalized.includes('/')) return false;
  return normalized.toLowerCase().endsWith('.bat');
}
