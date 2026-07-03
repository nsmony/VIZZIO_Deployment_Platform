import crypto from 'crypto';
import fs from 'fs';

// Calculate SHA-256 checksums for package integrity checks.
export async function calculateSha256(filePath) {
  const hash = crypto.createHash('sha256');
  await new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .on('data', (chunk) => hash.update(chunk))
      .on('error', reject)
      .on('end', resolve);
  });
  return hash.digest('hex');
}

export async function verifySha256(filePath, expectedChecksum) {
  if (!expectedChecksum) return true;
  const actualChecksum = await calculateSha256(filePath);
  return actualChecksum.toLowerCase() === String(expectedChecksum).toLowerCase();
}
