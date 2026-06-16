import fs from 'fs';
import path from 'path';
import prisma from '../prisma.js';
import { listUploadedFiles, findUploadedFile, getUploadedFilePath } from '../uploadStore.js';
import { signDownloadManagerToken, verifyDownloadManagerToken } from '../downloadManagerToken.js';

export function parseRangeHeader(rangeHeader, fileSize) {
  if (!rangeHeader) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
  if (!match) return { invalid: true };

  let start = match[1] === '' ? null : Number(match[1]);
  let end = match[2] === '' ? null : Number(match[2]);

  if (start === null && end === null) return { invalid: true };
  if (start === null) {
    const suffixLength = end;
    if (!Number.isInteger(suffixLength) || suffixLength <= 0) return { invalid: true };
    start = Math.max(fileSize - suffixLength, 0);
    end = fileSize - 1;
  } else {
    if (!Number.isInteger(start) || start < 0) return { invalid: true };
    end = end === null ? fileSize - 1 : end;
  }

  if (!Number.isInteger(end) || end < start || start >= fileSize) return { invalid: true };
  return { start, end: Math.min(end, fileSize - 1) };
}

export async function userCanAccessVersion(user, versionId) {
  if (!versionId) return true;
  if (String(user?.role || '').toLowerCase() === 'admin') return true;

  const membership = await prisma.userGroupMember.findFirst({
    where: {
      userId: user.userId,
      group: {
        deploymentAccesses: {
          some: {
            deployment: {
              versions: {
                some: { id: versionId },
              },
            },
          },
        },
      },
    },
  });

  return Boolean(membership);
}

export async function getDownloadablesForUser(user) {
  const uploads = listUploadedFiles();
  const role = String(user?.role || '').toLowerCase();
  const uploadItems = uploads.map((upload) => ({
    deploymentId: null,
    deploymentName: upload.title || upload.originalName,
    versionId: `upload:${upload.fileId}`,
    versionNumber: 'Uploaded package',
    releaseType: 'package',
    status: 'released',
    fileId: upload.fileId,
    fileName: upload.originalName,
    size: upload.size,
    checksum: upload.checksum || null,
    available: true,
  }));

  const where = role === 'admin'
    ? {}
    : {
        groupAccesses: {
          some: {
            group: {
              members: {
                some: { userId: user.userId },
              },
            },
          },
        },
      };

  let deployments = [];
  try {
    deployments = await prisma.deployment.findMany({
      where,
      include: { versions: { orderBy: { createdAt: 'desc' } } },
      orderBy: { createdAt: 'asc' },
    });
  } catch (error) {
    return uploadItems;
  }

  const versionItems = deployments.flatMap((deployment) =>
    deployment.versions
      .filter((version) => version.status === 'released' || role === 'admin')
      .map((version) => {
        const upload = findUploadForVersion(uploads, version);
        return {
          deploymentId: deployment.id,
          deploymentName: deployment.name,
          versionId: version.id,
          versionNumber: version.versionNumber,
          releaseType: version.releaseType,
          status: version.status,
          fileId: upload?.fileId || version.packagePath || version.fileName || '',
          fileName: upload?.originalName || version.fileName || path.basename(version.packagePath || ''),
          size: upload?.size || (version.packageSize ? Number(version.packageSize) : null),
          checksum: version.checksum,
          available: Boolean(upload),
        };
      })
  );

  const matchedFileIds = new Set(versionItems.map((item) => item.fileId).filter(Boolean));
  const unmatchedUploadItems = uploadItems.filter((upload) => !matchedFileIds.has(upload.fileId));

  return [...versionItems, ...unmatchedUploadItems];
}

export async function createManagedDownloadSession({ user, fileId, versionId }) {
  const file = findUploadedFile(fileId);
  const filePath = getUploadedFilePath(fileId);
  if (!file || !filePath) {
    const error = new Error('File not found');
    error.status = 404;
    throw error;
  }

  if (!versionId) {
    const error = new Error('Version ID is required for managed downloads');
    error.status = 400;
    throw error;
  }

  const uploadOnlySession = String(versionId).startsWith('upload:');
  const canWriteSession = isUuid(user?.userId) && isUuid(versionId);
  const allowed = uploadOnlySession || await userCanAccessVersion(user, versionId);
  if (!allowed) {
    const error = new Error('You are not allowed to download this version');
    error.status = 403;
    throw error;
  }

  const session = canWriteSession
    ? await prisma.downloadSession.create({
        data: {
          userId: user.userId,
          versionId,
          status: 'pending',
          progressPercentage: 0,
          downloadedSize: 0,
        },
      })
    : createVirtualSession({ user, versionId });

  const token = signDownloadManagerToken({
    fileId,
    userId: user.userId,
    versionId,
    sessionId: session.id,
  });

  return {
    session: serializeSession(session),
    token,
    file: {
      fileId,
      name: file.originalName,
      size: file.size,
    },
  };
}

export async function updateManagedDownloadSession({ sessionId, user, status, downloadedSize, totalSize }) {
  if (String(sessionId || '').startsWith('virtual:')) {
    return {
      id: sessionId,
      userId: user.userId,
      versionId: null,
      status: status || 'downloading',
      progressPercentage: totalSize && Number(totalSize) > 0
        ? Math.min(100, Math.round((Number(downloadedSize || 0) / Number(totalSize)) * 10000) / 100)
        : 0,
      downloadedSize: String(downloadedSize || 0),
      startedAt: new Date().toISOString(),
      completedAt: status === 'completed' ? new Date().toISOString() : null,
    };
  }

  const session = await prisma.downloadSession.findUnique({ where: { id: sessionId } });
  if (!session || session.userId !== user.userId) {
    const error = new Error('Download session not found');
    error.status = 404;
    throw error;
  }

  const progressPercentage = totalSize && Number(totalSize) > 0
    ? Math.min(100, Math.round((Number(downloadedSize || 0) / Number(totalSize)) * 10000) / 100)
    : Number(session.progressPercentage);

  const updated = await prisma.downloadSession.update({
    where: { id: sessionId },
    data: {
      status: status || session.status,
      downloadedSize: BigInt(downloadedSize || session.downloadedSize || 0),
      progressPercentage,
      completedAt: status === 'completed' ? new Date() : session.completedAt,
    },
  });

  if (status === 'completed') {
    await prisma.downloadLog.create({
      data: {
        userId: user.userId,
        versionId: session.versionId,
      },
    });
  }

  return serializeSession(updated);
}

export function getTokenizedFileRequest({ fileId, token }) {
  const payload = validateDownloadTokenFileAccess(token, fileId);

  const file = findUploadedFile(fileId);
  const filePath = getUploadedFilePath(fileId);
  if (!file || !filePath) {
    const error = new Error('File not found');
    error.status = 404;
    throw error;
  }

  return { payload, file, filePath, stat: fs.statSync(filePath) };
}

export function validateDownloadTokenFileAccess(token, fileId) {
  const payload = verifyDownloadManagerToken(token);
  if (payload.fileId !== fileId) {
    const error = new Error('Download token does not match this file');
    error.status = 401;
    throw error;
  }
  return payload;
}

function findUploadForVersion(uploads, version) {
  const candidates = [version.packagePath, version.fileName].filter(Boolean);
  return uploads.find((upload) =>
    candidates.some((candidate) => candidate === upload.fileId || candidate === upload.originalName)
  );
}

function serializeSession(session) {
  return {
    id: session.id,
    userId: session.userId,
    versionId: session.versionId,
    status: session.status,
    progressPercentage: Number(session.progressPercentage),
    downloadedSize: session.downloadedSize?.toString(),
    startedAt: session.startedAt.toISOString(),
    completedAt: session.completedAt?.toISOString() || null,
  };
}

function createVirtualSession({ user, versionId }) {
  const now = new Date();
  return {
    id: `virtual:${Date.now()}`,
    userId: user.userId,
    versionId,
    status: 'pending',
    progressPercentage: 0,
    downloadedSize: 0,
    startedAt: now,
    completedAt: null,
  };
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(
    String(value || '')
  );
}
