import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { findUploadedFile } from '../uploadStore.js';
import { ensureSupportedArchive } from '../archiveValidation.js';

// Helpers for validating package paths and creating ZIP archives.
export const DEFAULT_PACKAGE_ROOT = '/var/vizzio/packages';

const ZIP_VERSION_NEEDED = 20;
const ZIP_METHOD_STORE = 0;

let crcTable;

export function getPackageRoot() {
  return path.resolve(process.env.PACKAGE_ROOT || DEFAULT_PACKAGE_ROOT);
}

// Inspect a staged folder, server archive, or uploaded package.
export async function inspectPackageSource({ packagePath, sourceType, deploymentName, versionNumber, deploymentId, createArchive }) {
  const rawPackagePath = String(packagePath || '').trim();
  if (!rawPackagePath) throw new Error('Package source path is required.');
  const normalizedSourceType = String(sourceType || '').trim();

  const upload = findUploadedFile(rawPackagePath);
  if (upload) {
    return {
      packagePath: upload.fileId,
      packageSource: 'upload',
      fileName: upload.originalName,
      fileType: inferFileType(upload.originalName),
      packageSize: BigInt(upload.size),
      checksum: upload.checksum || null,
    };
  }

  const packageRoot = getPackageRoot();
  const resolvedPath = resolveInsidePackageRoot(rawPackagePath, packageRoot);
  const stat = await fs.promises.stat(resolvedPath).catch(() => null);
  if (!stat) throw new Error('Package source was not found.');

  if (normalizedSourceType === 'serverArchive' && stat.isDirectory()) {
    throw new Error('Server archive path must point to a file.');
  }

  if (stat.isDirectory() || normalizedSourceType === 'stagingFolder') {
    if (!stat.isDirectory()) throw new Error('Server staging folder path must point to a directory.');
    const batchScriptName = await findLaunchBatchScript(resolvedPath);
    if (!batchScriptName) throw new Error('Server staging folder must contain a launch batch script.');

    if (!createArchive) {
      return {
        packagePath: resolvedPath,
        packageSource: 'stagingFolder',
        fileName: '',
        fileType: 'application/zip',
        packageSize: null,
        checksum: null,
        batchScriptName,
      };
    }

    const archivePath = await createArchiveFromFolder({
      folderPath: resolvedPath,
      packageRoot,
      deploymentName,
      versionNumber,
      deploymentId,
    });
    const archiveStat = await fs.promises.stat(archivePath);
    return {
      packagePath: archivePath,
      packageSource: 'generatedArchive',
      fileName: path.basename(archivePath),
      fileType: 'application/zip',
      packageSize: BigInt(archiveStat.size),
      checksum: await sha256File(archivePath),
      batchScriptName,
    };
  }

  if (!stat.isFile()) throw new Error('Package source path must point to a file or staging folder.');
  ensureSupportedArchive(resolvedPath);

  return {
    packagePath: resolvedPath,
    packageSource: 'serverArchive',
    fileName: path.basename(resolvedPath),
    fileType: inferFileType(resolvedPath),
    packageSize: BigInt(stat.size),
    checksum: await sha256File(resolvedPath),
  };
}

export function inferFileType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const types = {
    '.zip': 'application/zip',
    '.7z': 'application/x-7z-compressed',
    '.rar': 'application/vnd.rar',
    '.exe': 'application/vnd.microsoft.portable-executable',
    '.msi': 'application/x-msi',
    '.tar': 'application/x-tar',
    '.gz': 'application/gzip',
  };
  return types[extension] || 'application/octet-stream';
}

export async function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  await new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .on('data', (chunk) => hash.update(chunk))
      .on('error', reject)
      .on('end', resolve);
  });
  return hash.digest('hex');
}

export async function getPackageInstallSize(filePath) {
  const extension = path.extname(String(filePath || '')).toLowerCase();
  if (extension === '.zip') {
    return readZipInstallSize(filePath);
  }

  if (extension === '.7z') {
    return read7ZipInstallSize(filePath);
  }

  return null;
}

function resolveInsidePackageRoot(rawPath, packageRoot) {
  const resolvedPath = path.isAbsolute(rawPath)
    ? path.resolve(rawPath)
    : path.resolve(packageRoot, rawPath);
  const relativePath = path.relative(packageRoot, resolvedPath);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error(`Package source must be inside ${packageRoot}.`);
  }
  return resolvedPath;
}

async function findLaunchBatchScript(folderPath) {
  const entries = await fs.promises.readdir(folderPath, { withFileTypes: true });
  const batch = entries.find((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.bat'));
  return batch?.name || null;
}

async function createArchiveFromFolder({ folderPath, packageRoot, deploymentName, versionNumber, deploymentId }) {
  const outputDir = path.join(packageRoot, '_generated', sanitizePathPart(deploymentName || deploymentId || 'deployment'));
  await fs.promises.mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, `${sanitizePathPart(versionNumber || 'version')}.zip`);
  const tempPath = `${outputPath}.${process.pid}.${Date.now()}.tmp`;
  if (!await trySystemZip(folderPath, tempPath)) {
    await fs.promises.rm(tempPath, { force: true });
    await writeStoredZip(folderPath, tempPath);
  }
  await fs.promises.rename(tempPath, outputPath);
  return outputPath;
}

async function readZipInstallSize(filePath) {
  const handle = await fs.promises.open(filePath, 'r');

  try {
    const stat = await handle.stat();
    const tailLength = Math.min(Number(stat.size), 0xffff + 22 + 1024);
    const tailBuffer = Buffer.alloc(tailLength);
    await handle.read(tailBuffer, 0, tailLength, Number(stat.size) - tailLength);

    let eocdOffset = -1;
    for (let index = tailBuffer.length - 22; index >= 0; index -= 1) {
      if (tailBuffer.readUInt32LE(index) === 0x06054b50) {
        eocdOffset = index;
        break;
      }
    }

    if (eocdOffset < 0) {
      return null;
    }

    const centralDirectorySize = tailBuffer.readUInt32LE(eocdOffset + 12);
    const centralDirectoryOffset = tailBuffer.readUInt32LE(eocdOffset + 16);
    if (centralDirectorySize === 0xffffffff || centralDirectoryOffset === 0xffffffff) {
      return null;
    }

    const centralDirectory = Buffer.alloc(centralDirectorySize);
    await handle.read(centralDirectory, 0, centralDirectorySize, centralDirectoryOffset);

    let totalSize = 0;
    let offset = 0;
    while (offset + 46 <= centralDirectory.length) {
      if (centralDirectory.readUInt32LE(offset) !== 0x02014b50) {
        return null;
      }

      const uncompressedSize = centralDirectory.readUInt32LE(offset + 24);
      const fileNameLength = centralDirectory.readUInt16LE(offset + 28);
      const extraLength = centralDirectory.readUInt16LE(offset + 30);
      const commentLength = centralDirectory.readUInt16LE(offset + 32);
      const fileName = centralDirectory
        .subarray(offset + 46, offset + 46 + fileNameLength)
        .toString('utf8');

      if (!fileName.endsWith('/')) {
        totalSize += uncompressedSize;
      }

      offset += 46 + fileNameLength + extraLength + commentLength;
    }

    return totalSize;
  } finally {
    await handle.close();
  }
}

async function read7ZipInstallSize(filePath) {
  return new Promise((resolve, reject) => {
    const child = spawn('7z', ['l', '-slt', filePath], { stdio: ['ignore', 'pipe', 'ignore'] });
    let output = '';

    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
    });

    child.on('error', (error) => {
      if (error.code === 'ENOENT') {
        resolve(null);
        return;
      }

      reject(error);
    });

    child.on('exit', (code) => {
      if (code !== 0) {
        resolve(null);
        return;
      }

      let totalSize = 0;
      let currentRecord = {};

      const flushRecord = () => {
        if (!currentRecord.Path || currentRecord.Type || currentRecord.Folder === '+') {
          currentRecord = {};
          return;
        }

        const size = Number(currentRecord.Size || 0);
        if (Number.isFinite(size) && size > 0) {
          totalSize += size;
        }
        currentRecord = {};
      };

      for (const rawLine of output.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line) {
          flushRecord();
          continue;
        }

        const separator = line.indexOf(' = ');
        if (separator <= 0) continue;
        const key = line.slice(0, separator);
        const value = line.slice(separator + 3);
        currentRecord[key] = value;
      }
      flushRecord();
      resolve(totalSize > 0 ? totalSize : null);
    });
  });
}

async function trySystemZip(folderPath, outputPath) {
  return new Promise((resolve, reject) => {
    const child = spawn('zip', ['-r', '-q', outputPath, '.'], { cwd: folderPath, stdio: 'ignore' });
    child.on('error', (error) => {
      if (error.code === 'ENOENT') resolve(false);
      else reject(error);
    });
    child.on('exit', (code) => resolve(code === 0));
  });
}

async function writeStoredZip(folderPath, outputPath) {
  const files = await listFiles(folderPath);
  const centralDirectory = [];
  let offset = 0;

  await usingResource(
    fs.createWriteStream(outputPath),
    async (output) => {
      for (const file of files) {
        const data = await fs.promises.readFile(file.absolutePath);
        const nameBuffer = Buffer.from(file.zipPath, 'utf8');
        const crc = crc32(data);
        const localHeader = createLocalFileHeader(nameBuffer, crc, data.length);
        await writeBuffer(output, localHeader);
        await writeBuffer(output, data);
        centralDirectory.push({ nameBuffer, crc, size: data.length, offset });
        offset += localHeader.length + data.length;
      }

      const centralStart = offset;
      for (const entry of centralDirectory) {
        const centralHeader = createCentralDirectoryHeader(entry);
        await writeBuffer(output, centralHeader);
        offset += centralHeader.length;
      }

      await writeBuffer(output, createEndOfCentralDirectory(centralDirectory.length, offset - centralStart, centralStart));
    }
  );
}

async function listFiles(rootPath) {
  const files = [];

  async function walk(directory) {
    const entries = await fs.promises.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(absolutePath);
      } else if (entry.isFile()) {
        files.push({
          absolutePath,
          zipPath: path.relative(rootPath, absolutePath).split(path.sep).join('/'),
        });
      }
    }
  }

  await walk(rootPath);
  if (files.length === 0) throw new Error('Server staging folder must contain files.');
  return files.sort((a, b) => a.zipPath.localeCompare(b.zipPath));
}

async function usingResource(stream, work) {
  try {
    await work(stream);
    await new Promise((resolve, reject) => {
      stream.end((error) => error ? reject(error) : resolve());
    });
  } catch (error) {
    stream.destroy();
    throw error;
  }
}

function createLocalFileHeader(nameBuffer, crc, size) {
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(ZIP_VERSION_NEEDED, 4);
  header.writeUInt16LE(0, 6);
  header.writeUInt16LE(ZIP_METHOD_STORE, 8);
  header.writeUInt16LE(0, 10);
  header.writeUInt16LE(0, 12);
  header.writeUInt32LE(crc, 14);
  header.writeUInt32LE(size, 18);
  header.writeUInt32LE(size, 22);
  header.writeUInt16LE(nameBuffer.length, 26);
  header.writeUInt16LE(0, 28);
  return Buffer.concat([header, nameBuffer]);
}

function createCentralDirectoryHeader(entry) {
  const header = Buffer.alloc(46);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(ZIP_VERSION_NEEDED, 4);
  header.writeUInt16LE(ZIP_VERSION_NEEDED, 6);
  header.writeUInt16LE(0, 8);
  header.writeUInt16LE(ZIP_METHOD_STORE, 10);
  header.writeUInt16LE(0, 12);
  header.writeUInt16LE(0, 14);
  header.writeUInt32LE(entry.crc, 16);
  header.writeUInt32LE(entry.size, 20);
  header.writeUInt32LE(entry.size, 24);
  header.writeUInt16LE(entry.nameBuffer.length, 28);
  header.writeUInt16LE(0, 30);
  header.writeUInt16LE(0, 32);
  header.writeUInt16LE(0, 34);
  header.writeUInt16LE(0, 36);
  header.writeUInt32LE(0, 38);
  header.writeUInt32LE(entry.offset, 42);
  return Buffer.concat([header, entry.nameBuffer]);
}

function createEndOfCentralDirectory(count, size, offset) {
  const header = Buffer.alloc(22);
  header.writeUInt32LE(0x06054b50, 0);
  header.writeUInt16LE(0, 4);
  header.writeUInt16LE(0, 6);
  header.writeUInt16LE(count, 8);
  header.writeUInt16LE(count, 10);
  header.writeUInt32LE(size, 12);
  header.writeUInt32LE(offset, 16);
  header.writeUInt16LE(0, 20);
  return header;
}

function writeBuffer(stream, buffer) {
  return new Promise((resolve, reject) => {
    stream.write(buffer, (error) => error ? reject(error) : resolve());
  });
}

function crc32(buffer) {
  if (!crcTable) crcTable = createCrcTable();
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createCrcTable() {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let value = i;
    for (let bit = 0; bit < 8; bit++) {
      value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
    }
    table[i] = value >>> 0;
  }
  return table;
}

function sanitizePathPart(value) {
  return String(value || '')
    .trim()
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    || 'package';
}
