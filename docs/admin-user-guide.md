# Admin User Guide

## 1. Purpose

This guide explains how platform administrators use the VIZZIO Deployment
Platform Admin Web Panel to manage users, groups, deployment access, deployment
families, versions, notifications, logs, launcher reports, and platform
settings.

## 2. Access and Login

1. Open the Admin Web Panel URL.
2. Enter an administrator username or email address.
3. Enter the password.
4. Select **Sign In**.

Expected behavior:

- Invalid credentials return an authentication error.
- Disabled managed accounts cannot sign in.
- Repeated failed attempts from the same client can cause temporary rate
  limiting.
- An invalid or expired session returns the administrator to the login page.

## 3. Admin Navigation

The sidebar contains:

- **Overview**
- **Deployments**
- **Versions**
- **Users & Permissions**
- **Download Logs**
- **Launcher Reports**
- **Settings**
- **Help & Docs**

Groups are managed inside **Users & Permissions**. Notifications are available
from the notification bell in the top navigation. A full Notifications page
also exists at `/notifications`, although the current sidebar and bell menu do
not link to it.

## 4. Dashboard Overview

Use **Overview** as the daily starting point. It shows:

- Deployment, version, released stable-version, and group counts
- The number of active users
- Quick actions for creating deployments, registering versions, managing
  access, and reviewing launcher reports
- **Needs Attention** items for deployments without versions, deployments
  without a released version, and groups without deployment access
- Recent deployment, version, and group activity

Use **Needs Attention** as a setup checklist before asking launcher users to
test.

## 5. User Management

Open **Users & Permissions** to search and filter users, manage accounts, and
assign group-based deployment access. The user list is paginated at 6 users per
page. The shared search matches user names, usernames, email addresses, group
names, and group membership.

### 5.1 Create User

1. Go to **Users & Permissions**.
2. Select **New User**.
3. Enter the user's name, username, and email address.
4. Select the role: **Admin** or **User**.
5. Select the initial status: **Active** or **Inactive**.
6. Optionally select one or more groups.
7. Enter a temporary password, or leave **Temporary Password** blank to
   generate one.
8. Select **Save User**.
9. Copy the temporary credentials when they are displayed. The password is
   shown in this dialog after creation.

Validation rules:

- Name, username, and email are required in the Admin Web Panel.
- Username must contain 3-64 letters, numbers, or underscores.
- Username must be unique, ignoring letter case.
- Email must be unique, ignoring letter case.
- A manually entered password must contain at least 8 characters.
- If no password is entered, the platform generates a temporary password.

Implementation note: the API can derive a missing username from the part of the
email address before `@`, replacing unsupported characters with underscores.
The Admin Web Panel normally does not use this fallback because its username
field is required.

Users can authenticate with either their username or email address.

### 5.2 View Access

1. Open the user's actions menu.
2. Select **View Access**.

The dialog shows the username, email, role, status, assigned groups, and
deployments inherited from those groups.

### 5.3 Edit User

1. Open the user's actions menu.
2. Select **Edit**.
3. Update the name, username, email, role, status, or group assignments.
4. Select **Save User**.

The same username and email uniqueness rules used during creation also apply to
edits. Passwords are changed through **Reset Password**, not the edit form.

### 5.4 Disable User

1. Open the user's actions menu.
2. Select **Disable**.
3. Confirm the action.

Disabled users cannot authenticate. The current interface does not provide a
separate re-enable action; an administrator can open **Edit**, change
**Status** to **Active**, and save the user.

### 5.5 Reset User Password

1. Open the user's actions menu.
2. Select **Reset Password**.
3. Enter a new password of at least 8 characters.
4. Select **Reset Password**.
5. Copy the credentials shown after the reset.

### 5.6 Delete User

1. Open the user's actions menu.
2. Select **Delete**.
3. Confirm the permanent deletion.

Deleting a user cannot be undone from the Admin Web Panel. Prefer disabling an
account when its history may still be needed.

## 6. Group and Deployment Access Management

Groups and their deployment grants are managed together in **Users &
Permissions**. Users inherit access to all deployments selected for their
groups.

### 6.1 Create Group

1. Go to **Users & Permissions**.
2. Select **New Group** or **Create Group**.
3. Enter a unique group name.
4. Expand **Members** and select any users to add.
5. Expand **Deployment Access** and select any deployments to grant.
6. Select **Save Group**.

Group names are required and unique.

The **Group Access** catalog is paginated at 4 groups per page. Member and
deployment lists inside each group card are independently scrollable.

### 6.2 Manage Membership and Deployment Access

1. Find the group under **Group Access**.
2. Select **Manage**.
3. Add or remove users under **Members**.
4. Grant or revoke deployments under **Deployment Access**.
5. Select **Save Group**.

Saving applies the membership changes and then adds or removes deployment
grants as needed. Granting an existing mapping returns a conflict at API level;
revoking a mapping that does not exist returns not found. The checkbox-based
interface normally avoids both conditions.

### 6.3 Delete Group

1. Find the group under **Group Access**.
2. Select **Manage**.
3. Select **Delete Group**.
4. Review and confirm the warning.

Deleting a group removes its user-membership rows and deployment-access grants.
It does not delete the associated user accounts or deployments.

## 7. Deployment Management

### 7.1 Create Deployment

1. Go to **Deployments**.
2. Select **+ New Deployment**.
3. Enter a unique deployment name.
4. Optionally enter a logo URL and description.
5. Select **Create Deployment**.

Deployment names are required and unique, ignoring letter case.

### 7.2 View or Edit Deployment

1. Find the deployment in grid or list view.
2. Select **View** to review its metadata and versions, or select
   **Edit**.
3. Update the name, logo URL, or description.
4. Save the deployment.

The page supports search, status and channel filters, sorting, grid/list views,
and pagination.

### 7.3 Archive, Restore, or Delete Deployment

Open the deployment's additional-actions menu and choose the required action:

- **Archive deployment** changes every non-deleted version in that deployment
  to **Archived**. A deployment without versions cannot be archived.
- **Restore draft** changes archived versions in that deployment back to
  **Draft**.
- **Delete deployment** asks for confirmation and removes the deployment and
  its associated version records from the platform database.

Package files are not documented as being removed by these actions. Use
deployment-level lifecycle actions only when the whole package family should
change state.

## 8. Version Management

### 8.1 Register Version

1. Go to **Versions**.
2. Select the target deployment.
3. Select **+ Register Version**.
4. Enter the version number.
5. Choose **Stable** or **Beta**.
6. Choose one package source:
   - **Package server folder**
   - **Register server archive**
   - **Upload local archive**
7. For **Package server folder**, prepare one deployment root containing the
   component folders and one root-level launch batch file, enter its absolute
   server path, enter the version number, and select
   **Inspect & prepare package**.
   For **Register server archive**, enter the existing ZIP/7z server path and
   select **Validate server archive**. For **Upload local archive**, select a
   prepared ZIP or 7z from the current computer, then select
   **Upload & validate archive**. The page displays transfer percentage, bytes,
   elapsed time, and estimated remaining time. The backend calculates SHA-256
   while streaming the upload to disk, then checks its structure and launch
   script. Server-folder preparation and
   server-archive validation calculate the package checksum during this step.
8. Select the initial status: **Draft**, **Released**, or **Archived**.
9. Optionally enter a description.
10. Review the detected file, batch-script, size, and checksum metadata.
11. Select **Register version**.

The version number is required and must be unique within its deployment.
Selecting **Cancel** discards the complete registration draft, including the
package path, selected upload, prepared archive metadata, checksum, validation
state, and description. Switching deployments also starts with a clean draft.
Navigating to another admin page does not cancel preparation or registration.
The current draft and phase are retained for the browser session and restored
when returning to **Versions**. If registration finishes while another page is
open, the registered version appears when the Versions list reloads. Closing or
refreshing the browser is not a supported way to monitor an active request.
After a server package is prepared or validated, registration reuses its
calculated checksum instead of reading the complete archive a second time.
The page enables registration only after preparation returns a generated
archive path, file name, nonzero size, launch script, and checksum. The backend
also rejects direct registration of an unprepared staging folder, preventing
packaging from unexpectedly starting during **Register version**.
Local archive registration is enabled only after upload and validation return
the stored file identifier, nonzero size, launch script, and checksum. Register
does not upload the file a second time.

### 8.2 Package Requirements

- Archives must be ZIP or 7z files.
- The package must contain a launch `.bat` file either at the archive root or
  inside its only top-level folder.
- A server path must exist and be inside the backend's configured package root.
- A server archive path must point to a file.
- A server staging-folder path must point to a non-empty directory containing a
  launch batch script.
- Select a deployment subfolder, not `PACKAGE_ROOT` itself; generated archives
  are written under `PACKAGE_ROOT/_generated`.
- ZIP archives are inspected directly.
- Reading or creating 7z archives requires `7z` or `7za` on the backend server.

For large Unreal deployments, prefer **Server staging folder** on the backend
PC. When 7-Zip is available, the backend creates a generated 7z archive.
Without 7-Zip, it creates a ZIP when the staging folder is within the built-in
ZIP size limit.

Preparation always rebuilds the generated archive from the current staging
folder and then calculates SHA-256. Duplicate preparation clicks or requests
share one backend job. Large builds can still take several minutes depending on
total bytes, file count, and disk speed. Remove runtime caches, logs, crash
dumps, and temporary files before preparation. A failed job removes its partial
temporary archive; select **Inspect & prepare package** again after correcting
the reported error.

Preparation runs as a background backend job. The Version form reports:

- Current phase: scanning, archive creation, archive validation, or checksum
- Phase percentage when 7-Zip or checksum processing can measure it
- Elapsed time
- Estimated remaining time after measurable progress begins
- Processed and total bytes during checksum generation

The scanning phase shows an indeterminate progress bar because 7-Zip must first
discover the package files before it can calculate a meaningful percentage.
Admins may navigate to other portal pages and return to the Version page; the
page reconnects to the same job. Starting the same deployment/version/path
again returns the active job instead of launching another archive process.

### 8.3 Manage a Version

The version table provides these actions:

- Select the channel control to switch between **Stable** and **Beta**.
- Select the status control to choose **Draft**, **Released**, or **Archived**.
- Select **Release** to make a non-released version released.
- Select **Archive** to hide a non-archived version.
- Select **Restore draft** to return an archived version to draft.
- Select **View details** to review metadata and edit the description, channel,
  or status.
- Select **Delete** and confirm to remove the version record from active use.

Only **Released** versions are visible to authorized launcher users. Draft,
archived, and deleted versions are hidden. Deleting a version does not delete
its package file from the server.

## 9. Notifications, Logs, and Monitoring

### 9.1 Notifications

Notifications are created for active managed administrators when:

- A deployment is created, archived, restored, or deleted
- A version is registered, updated, released, archived, restored, or deleted
- A launcher user requests a download
- The launcher submits an error report

Use the notification bell for quick triage. Its menu supports **Mark all read**,
deleting individual notifications, and **Clear all**. Clear all requires
confirmation and permanently removes every notification belonging to the
signed-in administrator.

From the full Notifications page, filter **All**, **Unread**, or **Read**
notifications, mark individual or all notifications as read, and delete
resolved notifications individually.

### 9.2 Download Logs

Go to **Download Logs** to:

- View download time, user, username, deployment, version, channel, and IP
  address
- Filter the list by deployment
- Export the current deployment scope as a CSV file

### 9.3 Launcher Reports

Go to **Launcher Reports** to review failures submitted by signed-in launcher
users. Reports can be filtered by deployment and by:

- **Download / Install**
- **Deployment Launch**
- **Launcher Update**

Select **View** to inspect the report time, user, launcher version, machine,
operating system, deployment/version context, and diagnostic details.

## 10. Settings and Maintenance Mode

The **Settings** page contains four tabs:

- **General**: view the Admin Web Panel version and edit the product name and
  support email.
- **Server**: view API/download URLs and run **Test Connection** to check the
  database URL, token secrets, package root, upload/download storage, backend
  port, and 7-Zip readiness.
- **Security**: view the signed-in username and role, or sign out. The displayed
  **Change Password** action is not implemented yet; reset an administrator's
  password from **Users & Permissions** instead.
- **Maintenance**: enable maintenance mode, set its message, open Download Logs
  for export, reset settings to their defaults, and save maintenance settings.

Maintenance mode blocks non-admin download-manager listing, session, and file
streaming operations. Administrators remain able to use the system. Enter a
maintenance message before saving if launcher users need a specific
explanation.

## 11. Admin Best Practices

- Use group-based access rather than user-by-user exception mappings.
- Keep deployment names and version numbers consistent.
- Keep new versions in **Draft** until their package and access have been
  tested.
- Archive obsolete versions instead of deleting records when history matters.
- Validate a release with a real active launcher test account after granting
  group access.
- Review notifications, download logs, and launcher reports after releases.
- Copy generated or reset credentials before closing the credentials dialog.

## 12. Common Admin Issues

### 12.1 User cannot sign in

Check:

- The username or email and password are correct
- The account status is **Active**
- A temporary rate-limit cooldown is not in effect
- Maintenance mode is not blocking the user's launcher operation after login

### 12.2 User cannot see deployment

Check:

- The user is active
- The user belongs to at least one group
- At least one of those groups has access to the deployment
- The target version is **Released**

### 12.3 Version registration or validation fails

Check:

- The source path exists on the backend server
- The source is within the configured package root
- The selected source type matches a file, folder, or upload
- The archive is ZIP or 7z
- The package contains a launch `.bat` at its root or inside its only top-level
  folder
- 7-Zip is available when reading or creating a 7z package
- The version number is not already registered for that deployment

### 12.4 Notifications are empty

Check:

- A notification-producing event has occurred
- The signed-in account is an active managed user with the **Admin** role
- The backend database is reachable

### 12.5 Server readiness shows warnings or offline

Open **Settings > Server**, select **Test Connection**, and review each check.
Correct required database or package-root failures before publishing packages.
Treat a missing 7-Zip check as a warning unless the workflow requires 7z
inspection or large staging-folder packaging.
