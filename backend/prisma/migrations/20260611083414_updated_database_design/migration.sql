/*
  Warnings:

  - You are about to drop the `Deployment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Group` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "Deployment";

-- DropTable
DROP TABLE "Group";

-- DropTable
DROP TABLE "User";

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'User',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_groups" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_group_members" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_group_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deployments" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "logoUrl" TEXT,
    "createdBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deployments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deployment_versions" (
    "id" UUID NOT NULL,
    "deploymentId" UUID NOT NULL,
    "versionNumber" TEXT NOT NULL,
    "releaseType" TEXT NOT NULL DEFAULT 'stable',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "packagePath" TEXT,
    "fileName" TEXT,
    "fileType" TEXT,
    "packageSize" BIGINT,
    "checksum" TEXT,
    "releasedBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" TIMESTAMP(3),

    CONSTRAINT "deployment_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_deployment_access" (
    "id" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "deploymentId" UUID NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_deployment_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "download_sessions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "versionId" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "progressPercentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "downloadedSize" BIGINT NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "download_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "download_logs" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "versionId" UUID NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "downloadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "download_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "installed_versions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "versionId" UUID NOT NULL,
    "installPath" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastOpened" TIMESTAMP(3),

    CONSTRAINT "installed_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_logs" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "resetBy" UUID,
    "resetAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_groups_name_key" ON "user_groups"("name");

-- CreateIndex
CREATE UNIQUE INDEX "user_group_members_userId_groupId_key" ON "user_group_members"("userId", "groupId");

-- CreateIndex
CREATE UNIQUE INDEX "deployment_versions_deploymentId_versionNumber_key" ON "deployment_versions"("deploymentId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "group_deployment_access_groupId_deploymentId_key" ON "group_deployment_access"("groupId", "deploymentId");

-- CreateIndex
CREATE UNIQUE INDEX "installed_versions_userId_versionId_key" ON "installed_versions"("userId", "versionId");

-- AddForeignKey
ALTER TABLE "user_group_members" ADD CONSTRAINT "user_group_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_group_members" ADD CONSTRAINT "user_group_members_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "user_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deployments" ADD CONSTRAINT "deployments_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deployment_versions" ADD CONSTRAINT "deployment_versions_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "deployments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deployment_versions" ADD CONSTRAINT "deployment_versions_releasedBy_fkey" FOREIGN KEY ("releasedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_deployment_access" ADD CONSTRAINT "group_deployment_access_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "user_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_deployment_access" ADD CONSTRAINT "group_deployment_access_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "deployments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "download_sessions" ADD CONSTRAINT "download_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "download_sessions" ADD CONSTRAINT "download_sessions_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "deployment_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "download_logs" ADD CONSTRAINT "download_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "download_logs" ADD CONSTRAINT "download_logs_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "deployment_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installed_versions" ADD CONSTRAINT "installed_versions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installed_versions" ADD CONSTRAINT "installed_versions_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "deployment_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_logs" ADD CONSTRAINT "password_reset_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_logs" ADD CONSTRAINT "password_reset_logs_resetBy_fkey" FOREIGN KEY ("resetBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
