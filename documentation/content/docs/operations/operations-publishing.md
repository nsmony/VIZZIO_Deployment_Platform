---
title: "14 Operations and Publishing"
description: "Safe operational workflow for publishing, validating, and rolling back VIZZIO releases."
---

## 1. Purpose

This guide defines the standard operating procedure for publishing a new deployment version from package intake through launcher visibility verification.

## 2. Preconditions

- Admin account with deployment/version permissions
- Backend API running and database healthy
- Package source prepared:
  - archive file, or
  - server staging folder
- Expected launch batch script is included at the archive root or inside the
  only top-level folder
- Target deployment exists (or will be created in this process)

## 3. Release Checklist

1. Confirm package identity and version number.
2. Confirm deployment target name.
3. Confirm package source path or file.
4. Confirm channel assignment (Stable or Beta).
5. Confirm status assignment (Draft, Released, or Archived).
6. Confirm target group access plan.
7. Confirm rollback option (previous released version still available).
8. Confirm notification and monitoring plan.

## 4. Publish Workflow

### Step 1: Log in to Admin Panel

Authenticate as an administrator and open **Deployments**.

### Step 2: Select or Create Deployment

- Use existing deployment, or
- Create a new deployment with a unique name.

### Step 3: Register Version

Open **Versions**, choose the deployment, and select **+ Register Version**.
Enter the version number before preparing a server folder because it is used
for the generated archive name.

When adding a version, choose one package source:

- Upload and validate an archive from the local machine
- Register existing server archive path
- Register server staging folder path (system archives folder into package)

ZIP and 7z archives must contain a launch `.bat` file at the archive root or
inside one wrapper folder. Both of these are accepted:

```text
SICC-v2.zip
  Launch.bat
  Windows/
```

```text
SICC-v2.zip
  SICC/
    Launch.bat
    Windows/
```

Deeply nested or ambiguous layouts, such as `Builds/SICC/Launch.bat`, are
rejected because the launcher expects the script at the installed package root
after extraction. 7z validation requires `7z` or `7za` on the backend server.

For 50-60 GiB Unreal deployments, prefer the server staging-folder flow. With
7-Zip installed on the backend PC, staging folders are converted into generated
`.7z` packages using store mode instead of relying on small built-in ZIP
packaging. Remove runtime caches, logs, crash dumps, and temporary files from
the staging folder before preparation; every included file must be scanned and
written to the archive. Select the individual deployment folder, never
`PACKAGE_ROOT` itself, because generated packages are written below
`PACKAGE_ROOT/_generated`.

Set:

- Version number
- Channel: Stable or Beta
- Initial status: Draft, Released, or Archived

Deployment-level Archive/Restore/Delete actions are available on the
Deployments page and apply to every version in that deployment. Version-level
Archive/Restore/Delete actions are available on the Versions page and apply
only to the selected version.

Use Draft while reviewing package metadata. Use Released only when the package
should appear in the launcher for authorized users. Use Archived to keep the
record hidden from launcher users.

### Step 4: Validate Version Metadata

Verify the newly added version includes:

- Expected package artifact path/name
- Size metadata
- Checksum calculated during preparation or validation
- Correct channel and status

Validation checks package shape and launch-script presence. Server-folder
preparation creates a fresh archive and calculates SHA-256. Existing
server-archive validation also calculates SHA-256. Registration reuses that
checksum and does not read the entire archive again. Registration rejects raw
staging-folder paths and server archives that have not returned validation
metadata. A successful preparation must display the generated file name,
nonzero size, detected launch script, and SHA-256 checksum before
**Register version** is available.

For a local archive, select the file and run **Upload & validate archive**
before registration. Upload progress is measured in the browser. The backend
streams the file to disk and calculates SHA-256 in the same pass, then validates
the archive layout and launch script. Registration reuses that stored package
record and does not transfer the archive again.

Only one preparation job runs for a deployment/version output at a time within
the backend process. Duplicate requests wait for the same job. Packaging and
checksum time still scale with package size, file count, and storage speed; this
is expected for large builds and is not an instant metadata operation.

Preparation is exposed as a background job. The admin page polls its authenticated
status endpoint and displays scanning, archive creation, checksum, elapsed time,
and ETA when a percentage is available. Navigating within the portal does not
stop the job. Parallel archive creation is intentionally not used because
multiple writers compete for the same source and destination disk and were
observed to reduce throughput.

If preparation fails or is interrupted, retry **Inspect & prepare package**.
Failed jobs remove their temporary archive file, while an older completed
archive remains available until a fresh replacement has completed.

### Step 5: Grant Access

Open **Users & Permissions**, find or create the intended group, select
**Manage**, choose the deployment under **Deployment Access**, and save the
group.

### Step 6: Functional Verification

Use a real launcher test user account in target group and validate:

- Deployment appears in library
- Target version appears in correct channel
- Archived versions are hidden
- Download session can start
- Download logs register activity
- Admin notification appears for the version/deployment change or download
  request
- Launcher Reports stays clear of new launch, prerequisite, install, or download
  failures

### Step 7: Release Communication

Record and share:

- Deployment name
- Version number
- Channel and status
- Accessed groups
- Release time
- Known caveats

## 5. Rollback Procedure

If release is bad:

1. Set bad version status to Archived.
2. Ensure prior known-good version is Released.
3. Notify stakeholders.
4. Document root cause and corrective action.

## 6. Naming and Versioning Guidelines

- Keep deployment names stable and descriptive.
- Use consistent semantic-style version numbering where possible.
- Avoid reusing version numbers for different package contents.

## 7. Operational Safety Rules

- Do not publish directly to broad groups without staged validation.
- Validate access changes after group updates.
- Avoid deleting records needed for traceability; prefer archive/disable states.
- Run smoke checks immediately after each release.

## 8. Troubleshooting During Publish

### 8.1 Path not found or invalid source

- Verify source exists on server.
- Verify source is under configured package root.
- Verify staging folder contains expected launch script.

### 8.2 Users cannot see released version

- Confirm version status is Released.
- Confirm deployment access grants exist for user groups.
- Confirm user group membership.
- Trigger launcher manual refresh and retest.

### 8.3 Download starts but no logs appear

- Confirm active backend instance and port.
- Confirm download session creation path succeeded.
- Confirm download log insert path and database connectivity.

### 8.4 Notifications do not appear

- Confirm the admin account is active and has Admin role in the managed users
  table.
- Confirm the event happened after notification support was enabled.
- Confirm backend notification writes are not failing in the backend terminal
  logs.
- Download-request notifications are created when the launcher creates a managed
  download session.

## 9. Post-Release Audit

Capture these fields in release notes:

- Deployment
- Version
- Channel
- Status
- Source type
- Groups granted
- Verification account used
- Verification timestamp
- Result
- Notification/log/report review result

