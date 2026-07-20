import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { parseRangeHeader, validateDownloadTokenFileAccess } from '../src/services/downloadManagerService.js';
import { signDownloadManagerToken, verifyDownloadManagerToken } from '../src/downloadManagerToken.js';
import { verifySha256 } from '../src/services/downloadIntegrityService.js';
import { inspectPackageSource } from '../src/services/packageArchiveService.js';

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

test('server staging folders are packaged into downloadable ZIP archives', async () => {
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
    assert.equal(result.fileName, 'v1.0.0.zip');
    assert.equal(result.fileType, 'application/zip');
    assert.ok(result.packageSize > 0n);
    assert.match(result.checksum, /^[a-f0-9]{64}$/);

    const archive = await fs.readFile(result.packagePath);
    assert.equal(archive.subarray(0, 2).toString('utf8'), 'PK');
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




