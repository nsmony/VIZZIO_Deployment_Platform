# Operations Guide: Publishing a New Version

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

Authenticate as admin and navigate to Deployments.

### Step 2: Select or Create Deployment

- Use existing deployment, or
- Create a new deployment with a unique name.

### Step 3: Add Version

When adding a version, choose one package source:

- Upload archive from local machine
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
`.7z` packages instead of relying on small built-in ZIP packaging.

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
- Checksum status after registration
- Correct channel and status

Validation checks package shape and launch-script presence. For large archives,
SHA-256 checksum generation is deferred to registration because it must read the
whole package file.

### Step 5: Grant Access

Grant deployment access to the intended groups.

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
