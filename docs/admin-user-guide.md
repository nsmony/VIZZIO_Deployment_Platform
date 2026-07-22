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
- Notifications or Download Logs
- Settings

## 4. User Management

### 4.1 Create User

1. Go to Users.
2. Select Create User.
3. Enter username and password.
4. Save.

Validation rules:

- Username must be unique.
- Username format and length must match platform policy.
- Password must meet minimum length.

### 4.2 Edit User

1. Open the target user record.
2. Update username.
3. Save changes.

### 4.3 Disable User

1. Open the target user record.
2. Select Disable.
3. Confirm action.

Result:

- Disabled users cannot authenticate in launcher.

### 4.4 Reset User Password

1. Open the target user record.
2. Select Reset Password.
3. Enter a new admin-defined password.
4. Save.

## 5. Group Management

### 5.1 Create Group

1. Go to Groups.
2. Select Create Group.
3. Enter a unique group name.
4. Save.

### 5.2 Manage Membership

1. Open group details.
2. Add users to group or remove users from group.
3. Save changes.

## 6. Deployment Access Control

### 6.1 Grant Deployment Access to Group

1. Open a group.
2. Select Grant Deployment Access.
3. Choose a deployment.
4. Confirm.

Behavior:

- Granting access that already exists should return a conflict response.

### 6.2 Revoke Deployment Access from Group

1. Open a group.
2. Find granted deployment.
3. Revoke access.

Behavior:

- Revoking a non-existing mapping should return not found.

## 7. Deployment Management

### 7.1 Create Deployment

1. Go to Deployments.
2. Select Create Deployment.
3. Enter deployment name.
4. Save.

Rules:

- Deployment names must be unique.

### 7.2 Rename Deployment

1. Open deployment details.
2. Edit deployment name.
3. Save.

## 8. Version Management

### 8.1 Add Version

Create a version using one package source:

- Uploaded archive
- Existing server archive path
- Server staging folder path to be archived

1. Open a deployment.
2. Select Add Version.
3. Set version number.
4. Select package source and provide path/file.
5. Choose channel and status.
6. Save.

### 8.2 Channel and Status

- Channel: Stable or Beta
- Status: Released or Archived

Effects:

- Released versions are visible to authorized launcher users.
- Archived versions are hidden from launcher users.

## 9. Download Logs and Monitoring

Use Download Logs or related activity pages to verify:

- Which user downloaded which version
- Time of download session creation or activity
- Success/failure signals for troubleshooting

## 10. Settings and Maintenance Mode

If enabled in the platform:

- Maintenance mode restricts non-admin operations.
- Use before major migration or package maintenance windows.

## 11. Admin Best Practices

- Use group-based access rather than user-by-user exception mappings.
- Keep deployment names and version numbers consistent.
- Archive obsolete versions instead of deleting active records.
- Validate a release with a real launcher test account after access grant.
- Review download logs after releases.

## 12. Common Admin Issues

### 12.1 User cannot see deployment

Check:

- User is enabled
- User belongs to at least one group
- Group has deployment grant
- Target version is marked Released

### 12.2 Version add fails from server path

Check:

- Path exists on server
- Path is within allowed package root
- Archive or staging folder contains expected launch script

### 12.3 Repeated login failures

Check:

- Correct credentials
- Account status
- Temporary rate-limit cooldown
