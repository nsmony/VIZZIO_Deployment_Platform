# Admin User Guide

## 1. Purpose

This guide explains how platform administrators operate the VIZZIO Deployment Platform Admin Web Panel for user, group, deployment, and version lifecycle management.

## 2. Access and Login

1. Open the Admin Web Panel URL.
2. Enter admin username and password.
3. Submit the form.

Expected behavior:

- Invalid credentials return an authentication error.
- Excessive failed login attempts may trigger temporary rate limiting.
- Expired session tokens require re-login.

## 3. Admin Navigation

Typical sections:

- Dashboard
- Users
- Groups
- Deployments
- Notifications
- Download Logs
- Launcher Reports
- Settings

## 4. Dashboard Overview

Use Dashboard as the daily starting point. It shows:

- Real deployment, version, stable-release, and group counts
- Quick actions for creating deployments, registering versions, managing access,
  and reviewing launcher reports
- Needs Attention items for deployments without versions, deployments without a
  released version, and groups without deployment access

Use Needs Attention as a setup checklist before asking launcher users to test.

## 5. User Management

### 5.1 Create User

1. Go to Users.
2. Select Create User.
3. Enter username and password.
4. Save.

Validation rules:

- Username must be unique.
- Username format and length must match platform policy.
- Password must meet minimum length.

### 5.2 Edit User

1. Open the target user record.
2. Update username.
3. Save changes.

### 5.3 Disable User

1. Open the target user record.
2. Select Disable.
3. Confirm action.

Result:

- Disabled users cannot authenticate in launcher.

### 5.4 Reset User Password

1. Open the target user record.
2. Select Reset Password.
3. Enter a new admin-defined password.
4. Save.

## 6. Group Management

### 6.1 Create Group

1. Go to Groups.
2. Select Create Group.
3. Enter a unique group name.
4. Save.

### 6.2 Manage Membership

1. Open group details.
2. Add users to group or remove users from group.
3. Save changes.

## 7. Deployment Access Control

### 7.1 Grant Deployment Access to Group

1. Open a group.
2. Select Grant Deployment Access.
3. Choose a deployment.
4. Confirm.

Behavior:

- Granting access that already exists should return a conflict response.

### 7.2 Revoke Deployment Access from Group

1. Open a group.
2. Find granted deployment.
3. Revoke access.

Behavior:

- Revoking a non-existing mapping should return not found.

## 8. Deployment Management

### 8.1 Create Deployment

1. Go to Deployments.
2. Select Create Deployment.
3. Enter deployment name.
4. Save.

Rules:

- Deployment names must be unique.

### 8.2 Rename Deployment

1. Open deployment details.
2. Edit deployment name.
3. Save.

### 8.3 Archive, Restore, or Delete Deployment

Deployment lifecycle actions apply to the whole deployment family.

- Archive deployment: archives every non-deleted version under that deployment.
- Restore deployment: restores archived versions under that deployment back to draft.
- Delete deployment: removes the deployment record and its associated version records.

Use deployment-level actions only when the whole product/module/client package
family should change state.

## 9. Version Management

### 9.1 Add Version

Create a version using one package source:

- Uploaded archive
- Existing server archive path
- Server staging folder path to be archived

Every source must include a launch batch script either at the archive root or
inside the only top-level folder. ZIP archives are inspected directly; 7z
archives require `7z` or `7za` on the backend server for validation.

For large Unreal deployments, prefer Server staging folder on the backend PC.
When 7-Zip is available, the backend turns staging folders into generated `.7z`
packages so 50-60 GiB deployments are supported.

1. Open a deployment.
2. Select Add Version.
3. Set version number.
4. Select package source and provide path/file.
5. Choose channel and status.
6. Save.

### 9.2 Channel and Status

- Channel: Stable or Beta
- Initial status: Draft, Released, or Archived

Effects:

- Released versions are visible to authorized launcher users.
- Archived versions are hidden from launcher users.
- Version-level archive, restore, or delete actions affect only the selected
  version of the selected deployment.

## 10. Notifications, Logs, and Monitoring

### 10.1 Notifications

Notifications are generated for active admin users when:

- A deployment is created, archived, restored, or deleted
- A version is registered, updated, released, archived, restored, or deleted
- A launcher user requests a download
- The launcher submits an error report

Use the notification bell for quick triage. Use the Notifications page to filter
all, unread, and read notifications, mark notifications as read, mark all as
read, or delete resolved notifications.

### 10.2 Download Logs

Use Download Logs or related activity pages to verify:

- Which user downloaded which version
- Time of download session creation or activity
- Success/failure signals for troubleshooting

### 10.3 Launcher Reports

Use Launcher Reports to review launcher-side download, install, prerequisite,
update, and launch failures submitted by signed-in users.

## 11. Settings and Maintenance Mode

If enabled in the platform:

- Maintenance mode restricts non-admin operations.
- Use before major migration or package maintenance windows.

## 12. Admin Best Practices

- Use group-based access rather than user-by-user exception mappings.
- Keep deployment names and version numbers consistent.
- Archive obsolete versions instead of deleting active records.
- Validate a release with a real launcher test account after access grant.
- Review notifications, download logs, and launcher reports after releases.

## 13. Common Admin Issues

### 13.1 User cannot see deployment

Check:

- User is enabled
- User belongs to at least one group
- Group has deployment grant
- Target version is marked Released

### 13.2 Version add fails from server path

Check:

- Path exists on server
- Path is within allowed package root
- Archive or staging folder contains a launch `.bat` at the root or inside the
  only top-level folder

### 13.3 Repeated login failures

Check:

- Correct credentials
- Account status
- Temporary rate-limit cooldown

### 13.4 Notifications are empty

Check:

- A real notification-producing event has happened
- Signed-in admin is an active managed user with Admin role
- Backend database is reachable
