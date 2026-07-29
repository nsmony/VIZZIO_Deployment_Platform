import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import { parseRangeHeader, validateDownloadTokenFileAccess } from '../src/services/downloadManagerService.js';
import { signDownloadManagerToken, verifyDownloadManagerToken } from '../src/downloadManagerToken.js';
import { verifySha256 } from '../src/services/downloadIntegrityService.js';
import { getPackageInstallSize, inspectPackageSource } from '../src/services/packageArchiveService.js';
import { findTopLevelBatchScriptInArchive } from '../src/archiveValidation.js';
import { validatePackage } from '../src/services/deploymentService.js';
import {
  cancelPackagePreparationJob,
  getPackagePreparationJob,
  startPackagePreparationJob,
} from '../src/services/packagePreparationJobService.js';
import {
  appendResumableUploadChunk,
  completeResumableUploadSession,
  createResumableUploadSession,
  getResumableUploadSession,
} from '../src/uploadStore.js';

test('normal ranged download requests parse a byte range', () => {
  assert.deepEqual(parseRangeHeader('bytes=0-99', 1000), { start: 0, end: 99 });
});

test('interrupted download resume requests parse an open-ended byte range', () => {
  assert.deepEqual(parseRangeHeader('bytes=500-', 1000), { start: 500, end: 999 });
});

test('invalid ranges are rejected', () => {
  assert.deepEqual(parseRangeHeader('bytes=1000-1200', 1000), { invalid: true });
});

test('download manager tokens carry file authorization claims', () => {
  const token = signDownloadManagerToken({ fileId: 'package.bin', userId: 'user-1' }, { expiresIn: '1m' });
  const payload = verifyDownloadManagerToken(token);
  assert.equal(payload.fileId, 'package.bin');
  assert.equal(payload.userId, 'user-1');
});

test('expired tokens are rejected', async () => {
  const token = signDownloadManagerToken({ fileId: 'package.bin', userId: 'user-1' }, { expiresIn: '1ms' });
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.throws(() => verifyDownloadManagerToken(token), /expired/i);
});

test('unauthorized file access is blocked when the token file claim does not match', () => {
  const token = signDownloadManagerToken({ fileId: 'allowed.bin', userId: 'user-1' }, { expiresIn: '1m' });
  assert.throws(() => validateDownloadTokenFileAccess(token, 'other.bin'), /does not match/i);
});

test('corrupted file detection fails when SHA-256 does not match', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vizzio-download-test-'));
  const filePath = path.join(tempDir, 'package.bin');
  await fs.writeFile(filePath, 'corrupted content');
  const expected = crypto.createHash('sha256').update('original content').digest('hex');
  assert.equal(await verifySha256(filePath, expected), false);
});

test('server staging folders are packaged into downloadable archives', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'vizzio-package-root-'));
  const previousRoot = process.env.PACKAGE_ROOT;
  process.env.PACKAGE_ROOT = tempRoot;

  try {
    const stagingFolder = path.join(tempRoot, 'digital-twin', 'v1.0.0');
    await fs.mkdir(path.join(stagingFolder, 'web'), { recursive: true });
    await fs.writeFile(path.join(stagingFolder, 'launch.bat'), 'echo launch');
    await fs.writeFile(path.join(stagingFolder, 'web', 'index.html'), '<h1>ok</h1>');

    const result = await inspectPackageSource({
      packagePath: stagingFolder,
      sourceType: 'stagingFolder',
      deploymentName: 'Digital Twin',
      versionNumber: 'v1.0.0',
      deploymentId: 'deployment-1',
      createArchive: true,
    });

    assert.equal(result.packageSource, 'generatedArchive');
    assert.match(result.fileName, /^v1\.0\.0\.(zip|7z)$/);
    assert.match(result.fileType, /^application\/(zip|x-7z-compressed)$/);
    assert.ok(result.packageSize > 0n);
    assert.match(result.checksum, /^[a-f0-9]{64}$/);

    const archive = await fs.readFile(result.packagePath);
    if (result.fileName.endsWith('.zip')) {
      assert.equal(archive.subarray(0, 2).toString('utf8'), 'PK');
    } else {
      assert.equal(archive.subarray(0, 6).toString('hex'), '377abcaf271c');
    }
  } finally {
    if (previousRoot === undefined) delete process.env.PACKAGE_ROOT;
    else process.env.PACKAGE_ROOT = previousRoot;
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test('generated ZIP archives report extracted install size', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'vizzio-package-root-'));
  const previousRoot = process.env.PACKAGE_ROOT;
  process.env.PACKAGE_ROOT = tempRoot;

  try {
    const stagingFolder = path.join(tempRoot, 'digital-twin', 'v1.0.3');
    await fs.mkdir(path.join(stagingFolder, 'web'), { recursive: true });
    await fs.writeFile(path.join(stagingFolder, 'launch.bat'), 'echo launch');
    await fs.writeFile(path.join(stagingFolder, 'web', 'index.html'), '<h1>ok</h1>');

    const archive = await inspectPackageSource({
      packagePath: stagingFolder,
      sourceType: 'stagingFolder',
      deploymentName: 'Digital Twin',
      versionNumber: 'v1.0.3',
      deploymentId: 'deployment-1',
      createArchive: true,
    });

    const installSize = await getPackageInstallSize(archive.packagePath);
    const expectedSize = Buffer.byteLength('echo launch') + Buffer.byteLength('<h1>ok</h1>');

    assert.equal(installSize, expectedSize);
  } finally {
    if (previousRoot === undefined) delete process.env.PACKAGE_ROOT;
    else process.env.PACKAGE_ROOT = previousRoot;
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test('server staging folders must contain a launch batch script', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'vizzio-package-root-'));
  const previousRoot = process.env.PACKAGE_ROOT;
  process.env.PACKAGE_ROOT = tempRoot;

  try {
    const stagingFolder = path.join(tempRoot, 'digital-twin', 'v1.0.1');
    await fs.mkdir(path.join(stagingFolder, 'web'), { recursive: true });
    await fs.writeFile(path.join(stagingFolder, 'web', 'index.html'), '<h1>ok</h1>');

    await assert.rejects(
      inspectPackageSource({
        packagePath: stagingFolder,
        sourceType: 'stagingFolder',
        deploymentName: 'Digital Twin',
        versionNumber: 'v1.0.1',
        deploymentId: 'deployment-1',
        createArchive: true,
      }),
      /launch batch script/i
    );
  } finally {
    if (previousRoot === undefined) delete process.env.PACKAGE_ROOT;
    else process.env.PACKAGE_ROOT = previousRoot;
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test('server archive paths must point to ZIP or 7z packages', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'vizzio-package-root-'));
  const previousRoot = process.env.PACKAGE_ROOT;
  process.env.PACKAGE_ROOT = tempRoot;

  try {
    const packagePath = path.join(tempRoot, 'notes.txt');
    await fs.writeFile(packagePath, 'not a deployment archive');

    await assert.rejects(
      inspectPackageSource({
        packagePath,
        sourceType: 'serverArchive',
        createArchive: false,
      }),
      /zip or 7z/i
    );
  } finally {
    if (previousRoot === undefined) delete process.env.PACKAGE_ROOT;
    else process.env.PACKAGE_ROOT = previousRoot;
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test('server archive source rejects staging folder paths', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'vizzio-package-root-'));
  const previousRoot = process.env.PACKAGE_ROOT;
  process.env.PACKAGE_ROOT = tempRoot;

  try {
    const stagingFolder = path.join(tempRoot, 'digital-twin', 'v1.0.2');
    await fs.mkdir(stagingFolder, { recursive: true });
    await fs.writeFile(path.join(stagingFolder, 'launch.bat'), 'echo launch');

    await assert.rejects(
      inspectPackageSource({
        packagePath: stagingFolder,
        sourceType: 'serverArchive',
        createArchive: false,
      }),
      /must point to a file/i
    );
  } finally {
    if (previousRoot === undefined) delete process.env.PACKAGE_ROOT;
    else process.env.PACKAGE_ROOT = previousRoot;
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test('local archive uploads resume from a persisted confirmed offset', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'vizzio-upload-root-'));
  const previousRoot = process.env.PACKAGE_UPLOAD_ROOT;
  process.env.PACKAGE_UPLOAD_ROOT = tempRoot;

  try {
    const archivePath = path.join(tempRoot, 'source.zip');
    await writeSimpleZip(archivePath, [
      { name: 'launch.bat', content: 'echo launch' },
      { name: 'content.bin', content: 'resumable package content' },
    ]);
    const archive = await fs.readFile(archivePath);
    await fs.rm(archivePath);
    const request = {
      originalName: 'package.zip',
      title: 'Deployment v1',
      size: archive.length,
      fingerprint: `package.zip:${archive.length}:123`,
      uploadedBy: 'admin-1',
    };
    const created = await createResumableUploadSession(request);
    const split = Math.floor(archive.length / 2);
    const first = await appendResumableUploadChunk({
      sessionId: created.id,
      uploadedBy: 'admin-1',
      offset: 0,
      stream: Readable.from(archive.subarray(0, split)),
    });
    assert.equal(first.offset, split);

    const resumed = await createResumableUploadSession(request);
    assert.equal(resumed.id, created.id);
    assert.equal(resumed.offset, split);

    const second = await appendResumableUploadChunk({
      sessionId: created.id,
      uploadedBy: 'admin-1',
      offset: split,
      stream: Readable.from(archive.subarray(split)),
    });
    assert.equal(second.offset, archive.length);

    const completed = await completeResumableUploadSession(created.id, 'admin-1');
    assert.equal(completed.status, 'completed');
    assert.equal(completed.package.size, archive.length);
    assert.equal(
      completed.package.checksum,
      crypto.createHash('sha256').update(archive).digest('hex')
    );
    assert.equal(completed.package.batchScriptName, 'launch.bat');
    assert.equal(getResumableUploadSession(created.id, 'other-admin'), null);
  } finally {
    if (previousRoot === undefined) delete process.env.PACKAGE_UPLOAD_ROOT;
    else process.env.PACKAGE_UPLOAD_ROOT = previousRoot;
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test('resumable uploads reject stale offsets without duplicating bytes', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'vizzio-upload-root-'));
  const previousRoot = process.env.PACKAGE_UPLOAD_ROOT;
  process.env.PACKAGE_UPLOAD_ROOT = tempRoot;

  try {
    const created = await createResumableUploadSession({
      originalName: 'package.zip',
      title: 'Deployment v2',
      size: 8,
      fingerprint: 'package.zip:8:456',
      uploadedBy: 'admin-1',
    });
    await appendResumableUploadChunk({
      sessionId: created.id,
      uploadedBy: 'admin-1',
      offset: 0,
      stream: Readable.from(Buffer.from('1234')),
    });
    await assert.rejects(
      appendResumableUploadChunk({
        sessionId: created.id,
        uploadedBy: 'admin-1',
        offset: 0,
        stream: Readable.from(Buffer.from('1234')),
      }),
      /resume from byte 4/i
    );
    assert.equal(getResumableUploadSession(created.id, 'admin-1').offset, 4);
  } finally {
    if (previousRoot === undefined) delete process.env.PACKAGE_UPLOAD_ROOT;
    else process.env.PACKAGE_UPLOAD_ROOT = previousRoot;
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test('staging preparation requires a version number', async () => {
  await assert.rejects(
    validatePackage({
      packagePath: 'unused',
      sourceType: 'stagingFolder',
      versionNumber: '   ',
    }),
    /version number before preparing/i
  );
});

test('staging validation returns a complete prepared package', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'vizzio-package-root-'));
  const previousRoot = process.env.PACKAGE_ROOT;
  process.env.PACKAGE_ROOT = tempRoot;

  try {
    const stagingFolder = path.join(tempRoot, 'validated-build');
    await fs.mkdir(stagingFolder, { recursive: true });
    await fs.writeFile(path.join(stagingFolder, 'launch.bat'), 'echo launch');
    await fs.writeFile(path.join(stagingFolder, 'content.bin'), Buffer.alloc(4096, 3));

    const result = await validatePackage({
      packagePath: stagingFolder,
      sourceType: 'stagingFolder',
      versionNumber: 'v2.0.0',
      deploymentName: 'Validated Build',
      deploymentId: 'deployment-validated',
    });

    assert.equal(result.packageSource, 'generatedArchive');
    assert.match(result.fileName, /^v2\.0\.0\.(zip|7z)$/);
    assert.ok(Number(result.packageSize) > 0);
    assert.match(result.checksum, /^[a-f0-9]{64}$/);
    assert.equal(result.batchScriptName, 'launch.bat');
  } finally {
    if (previousRoot === undefined) delete process.env.PACKAGE_ROOT;
    else process.env.PACKAGE_ROOT = previousRoot;
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test('background preparation jobs report progress and coalesce duplicates', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'vizzio-package-root-'));
  const previousRoot = process.env.PACKAGE_ROOT;
  process.env.PACKAGE_ROOT = tempRoot;

  try {
    const stagingFolder = path.join(tempRoot, 'background-build');
    await fs.mkdir(stagingFolder, { recursive: true });
    await fs.writeFile(path.join(stagingFolder, 'launch.bat'), 'echo launch');
    await fs.writeFile(path.join(stagingFolder, 'content.bin'), Buffer.alloc(2 * 1024 * 1024, 5));
    const request = {
      packagePath: stagingFolder,
      sourceType: 'stagingFolder',
      versionNumber: 'v3.0.0',
      deploymentName: 'Background Build',
      deploymentId: 'deployment-background',
    };

    const first = startPackagePreparationJob(request);
    const duplicate = startPackagePreparationJob(request);
    assert.equal(duplicate.id, first.id);

    let job = first;
    const deadline = Date.now() + 10000;
    while (job.status === 'queued' || job.status === 'running') {
      assert.ok(Date.now() < deadline, 'background preparation job timed out');
      await new Promise((resolve) => setTimeout(resolve, 25));
      job = getPackagePreparationJob(first.id);
    }

    assert.equal(job.status, 'completed');
    assert.equal(job.phase, 'completed');
    assert.equal(job.phasePercent, 100);
    assert.match(job.package.checksum, /^[a-f0-9]{64}$/);
    assert.ok(job.elapsedSeconds >= 0);
  } finally {
    if (previousRoot === undefined) delete process.env.PACKAGE_ROOT;
    else process.env.PACKAGE_ROOT = previousRoot;
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test('package preparation jobs can be cancelled before completion', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'vizzio-package-root-'));
  const previousRoot = process.env.PACKAGE_ROOT;
  process.env.PACKAGE_ROOT = tempRoot;

  try {
    const stagingFolder = path.join(tempRoot, 'cancelled-build');
    await fs.mkdir(stagingFolder, { recursive: true });
    await fs.writeFile(path.join(stagingFolder, 'launch.bat'), 'echo launch');
    const job = startPackagePreparationJob({
      packagePath: stagingFolder,
      sourceType: 'stagingFolder',
      versionNumber: 'v1.0.0',
      deploymentName: 'Cancelled Build',
      deploymentId: 'deployment-cancelled',
    });

    const cancelled = cancelPackagePreparationJob(job.id);
    assert.equal(cancelled.status, 'cancelled');
    assert.equal(cancelled.phase, 'cancelled');
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(getPackagePreparationJob(job.id).status, 'cancelled');
  } finally {
    if (previousRoot === undefined) delete process.env.PACKAGE_ROOT;
    else process.env.PACKAGE_ROOT = previousRoot;
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test('validated server archive metadata is safely reused when the file is unchanged', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'vizzio-package-root-'));
  const previousRoot = process.env.PACKAGE_ROOT;
  process.env.PACKAGE_ROOT = tempRoot;

  try {
    const archivePath = path.join(tempRoot, 'already-validated.zip');
    await writeSimpleZip(archivePath, [
      { name: 'launch.bat', content: 'echo launch' },
      { name: 'content.bin', content: 'metadata fast path' },
    ]);
    const validated = await inspectPackageSource({
      packagePath: archivePath,
      sourceType: 'serverArchive',
      createArchive: false,
    });
    const result = await inspectPackageSource({
      packagePath: archivePath,
      sourceType: 'serverArchive',
      createArchive: true,
      knownChecksum: validated.checksum,
      knownBatchScriptName: 'launch.bat',
      knownPackageSize: validated.packageSize,
    });

    assert.equal(result.checksum, validated.checksum);
    assert.equal(result.batchScriptName, 'launch.bat');
  } finally {
    if (previousRoot === undefined) delete process.env.PACKAGE_ROOT;
    else process.env.PACKAGE_ROOT = previousRoot;
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test('package root cannot be used as a staging folder', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'vizzio-package-root-'));
  const previousRoot = process.env.PACKAGE_ROOT;
  process.env.PACKAGE_ROOT = tempRoot;

  try {
    await fs.writeFile(path.join(tempRoot, 'launch.bat'), 'echo launch');
    await assert.rejects(
      inspectPackageSource({
        packagePath: tempRoot,
        sourceType: 'stagingFolder',
        deploymentName: 'Unsafe Root',
        versionNumber: 'v1.0.0',
        deploymentId: 'deployment-root',
        createArchive: true,
      }),
      /cannot be the package root/i
    );
  } finally {
    if (previousRoot === undefined) delete process.env.PACKAGE_ROOT;
    else process.env.PACKAGE_ROOT = previousRoot;
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test('concurrent preparation requests share one generated archive job', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'vizzio-package-root-'));
  const previousRoot = process.env.PACKAGE_ROOT;
  process.env.PACKAGE_ROOT = tempRoot;

  try {
    const stagingFolder = path.join(tempRoot, 'shared-build');
    await fs.mkdir(path.join(stagingFolder, 'client'), { recursive: true });
    await fs.writeFile(path.join(stagingFolder, 'launch.bat'), 'echo launch');
    await fs.writeFile(path.join(stagingFolder, 'client', 'app.bin'), Buffer.alloc(1024 * 1024, 7));

    const request = {
      packagePath: stagingFolder,
      sourceType: 'stagingFolder',
      deploymentName: 'Shared Build',
      versionNumber: 'v1.0.0',
      deploymentId: 'deployment-shared',
      createArchive: true,
    };
    const [first, second] = await Promise.all([
      inspectPackageSource(request),
      inspectPackageSource(request),
    ]);

    assert.equal(first.packagePath, second.packagePath);
    assert.equal(first.checksum, second.checksum);
    assert.match(first.checksum, /^[a-f0-9]{64}$/);

    const generatedFiles = await fs.readdir(path.dirname(first.packagePath));
    assert.deepEqual(generatedFiles, [path.basename(first.packagePath)]);
  } finally {
    if (previousRoot === undefined) delete process.env.PACKAGE_ROOT;
    else process.env.PACKAGE_ROOT = previousRoot;
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test('preparing again rebuilds the archive when staging content changes', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'vizzio-package-root-'));
  const previousRoot = process.env.PACKAGE_ROOT;
  process.env.PACKAGE_ROOT = tempRoot;

  try {
    const stagingFolder = path.join(tempRoot, 'changing-build');
    const contentPath = path.join(stagingFolder, 'content.txt');
    await fs.mkdir(stagingFolder, { recursive: true });
    await fs.writeFile(path.join(stagingFolder, 'launch.bat'), 'echo launch');
    await fs.writeFile(contentPath, 'first build');

    const request = {
      packagePath: stagingFolder,
      sourceType: 'stagingFolder',
      deploymentName: 'Changing Build',
      versionNumber: 'v1.0.0',
      deploymentId: 'deployment-changing',
      createArchive: true,
    };
    const first = await inspectPackageSource(request);
    await fs.writeFile(contentPath, 'second build with updated content');
    const second = await inspectPackageSource(request);

    assert.equal(first.packagePath, second.packagePath);
    assert.notEqual(first.checksum, second.checksum);
    const generatedFiles = await fs.readdir(path.dirname(second.packagePath));
    assert.deepEqual(generatedFiles, [path.basename(second.packagePath)]);
  } finally {
    if (previousRoot === undefined) delete process.env.PACKAGE_ROOT;
    else process.env.PACKAGE_ROOT = previousRoot;
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test('ZIP archives may contain one wrapper folder with a launch batch script', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'vizzio-package-root-'));
  const previousRoot = process.env.PACKAGE_ROOT;
  process.env.PACKAGE_ROOT = tempRoot;

  try {
    const packagePath = path.join(tempRoot, 'wrapped.zip');
    await writeSimpleZip(packagePath, [
      { name: 'SICC/Launch.bat', content: 'echo launch' },
      { name: 'SICC/Windows/readme.txt', content: 'ok' },
    ]);

    assert.equal(await findTopLevelBatchScriptInArchive(packagePath), 'SICC/Launch.bat');
  } finally {
    if (previousRoot === undefined) delete process.env.PACKAGE_ROOT;
    else process.env.PACKAGE_ROOT = previousRoot;
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test('ZIP archives reject deeply nested launch batch scripts', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'vizzio-package-root-'));
  const previousRoot = process.env.PACKAGE_ROOT;
  process.env.PACKAGE_ROOT = tempRoot;

  try {
    const packagePath = path.join(tempRoot, 'deep.zip');
    await writeSimpleZip(packagePath, [
      { name: 'Builds/SICC/Launch.bat', content: 'echo launch' },
    ]);

    assert.equal(await findTopLevelBatchScriptInArchive(packagePath), null);
  } finally {
    if (previousRoot === undefined) delete process.env.PACKAGE_ROOT;
    else process.env.PACKAGE_ROOT = previousRoot;
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

async function writeSimpleZip(filePath, entries) {
  const buffers = [];
  const centralDirectory = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuffer = Buffer.from(entry.name, 'utf8');
    const data = Buffer.from(entry.content, 'utf8');
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt32LE(0, 10);
    localHeader.writeUInt32LE(0, 14);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);
    buffers.push(localHeader, nameBuffer, data);
    centralDirectory.push({ nameBuffer, size: data.length, offset });
    offset += localHeader.length + nameBuffer.length + data.length;
  }

  const centralStart = offset;
  for (const entry of centralDirectory) {
    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt32LE(0, 12);
    centralHeader.writeUInt32LE(0, 16);
    centralHeader.writeUInt32LE(entry.size, 20);
    centralHeader.writeUInt32LE(entry.size, 24);
    centralHeader.writeUInt16LE(entry.nameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(entry.offset, 42);
    buffers.push(centralHeader, entry.nameBuffer);
    offset += centralHeader.length + entry.nameBuffer.length;
  }

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(centralDirectory.length, 8);
  eocd.writeUInt16LE(centralDirectory.length, 10);
  eocd.writeUInt32LE(offset - centralStart, 12);
  eocd.writeUInt32LE(centralStart, 16);
  eocd.writeUInt16LE(0, 20);
  buffers.push(eocd);

  await fs.writeFile(filePath, Buffer.concat(buffers));
}




