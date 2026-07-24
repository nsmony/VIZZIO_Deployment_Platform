import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { parseRangeHeader, validateDownloadTokenFileAccess } from '../src/services/downloadManagerService.js';
import { signDownloadManagerToken, verifyDownloadManagerToken } from '../src/downloadManagerToken.js';
import { verifySha256 } from '../src/services/downloadIntegrityService.js';
import { getPackageInstallSize, inspectPackageSource } from '../src/services/packageArchiveService.js';
import { findTopLevelBatchScriptInArchive } from '../src/archiveValidation.js';

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




