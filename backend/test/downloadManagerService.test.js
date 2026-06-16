import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { parseRangeHeader, validateDownloadTokenFileAccess } from '../src/services/downloadManagerService.js';
import { signDownloadManagerToken, verifyDownloadManagerToken } from '../src/downloadManagerToken.js';
import { verifySha256 } from '../src/services/downloadIntegrityService.js';

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




