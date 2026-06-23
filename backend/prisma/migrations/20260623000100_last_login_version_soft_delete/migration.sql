ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3);

ALTER TABLE "deployment_versions" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "deployment_versions" ADD COLUMN IF NOT EXISTS "deletedBy" UUID;
