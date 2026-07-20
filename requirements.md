# Requirements Document

## Introduction

VIZZIO Deployment Platform is a Steam-style software distribution system for delivering large Unreal Engine builds to authorized users. It consists of two products:

1. **Admin Web Panel** — a React SPA for managing users, deployments, and versions, served by a Node.js/Express backend with a PostgreSQL database.
2. **Windows Launcher** — a C# .NET 8 WPF desktop application for discovering, downloading, installing, and opening deployments. File delivery is handled by Nginx via HTTP range requests.

The system runs on a single Ubuntu 22.04 LTS server and is deployable to AWS, DigitalOcean, Hetzner, or on-premise environments.

---

## Glossary

- **Admin**: A privileged operator who manages users, deployments, and versions via the Admin Web Panel.
- **User**: An authorized person who authenticates via the Launcher to access and download deployments.
- **Deployment**: A named software product (e.g., a specific Unreal Engine game or application) managed within the platform.
- **Version**: A specific numbered release of a Deployment, distributed as a package archive and installed as a folder on the User's machine.
- **Deployment Package Archive**: A ZIP or 7z archive containing the complete deployment folder contents for one Version, including the Unreal executable folder, two web folders, and the provided batch script.
- **Server Staging Folder**: A completed deployment folder that an Admin has copied directly onto the server before registering it as a Version.
- **Launch Batch Script**: The `.bat` file included in each extracted deployment package that the User runs manually after opening the install folder.
- **Stable Version**: A Version designated as production-ready.
- **Beta Version**: A Version designated for pre-release testing.
- **Released Version**: A Version visible to authorized Users in the Launcher.
- **Archived Version**: A Version hidden from Users in the Launcher; still accessible to Admins.
- **Access Control**: The group-based permission set that determines which Deployments members of each User Group may see and download.
- **Install Root**: A user-configurable local directory under which all Deployment versions are installed in separate subdirectories.
- **Download Token**: A short-lived, signed JWT issued by the API and validated by the File Server to authorize package archive downloads.
- **Admin Web Panel**: The React + Vite SPA for platform administration.
- **Launcher**: The Windows C# .NET 8 WPF desktop application.
- **API**: The Node.js + Express RESTful backend.
- **Database**: The PostgreSQL relational database.
- **File Server**: The Nginx instance serving versioned build files over HTTP with range-request support.
- **Credential Store**: Windows Credential Manager, used by the Launcher to persist authentication tokens securely.
- **bcrypt**: The password hashing algorithm used for storing user credentials.
- **JWT**: JSON Web Token used for session authentication between clients and the API.

---

## Requirements

---

### Requirement 1: Admin Authentication

**User Story:** As an Admin, I want to log in with a username and password, so that I can securely access the Admin Web Panel.

#### Acceptance Criteria

1. THE Admin_Web_Panel SHALL provide a login form accepting a username field (maximum 50 characters) and a password field (maximum 128 characters).
2. WHEN an Admin submits valid credentials, THE API SHALL return a signed JWT with an expiry of exactly 24 hours.
3. WHEN an Admin submits invalid credentials, THE API SHALL return an HTTP 401 response and THE Admin_Web_Panel SHALL display an error message without revealing whether the username or password was incorrect.
4. THE API SHALL store all Admin passwords hashed with bcrypt using a minimum cost factor of 12.
5. WHEN an Admin's JWT expires, THE Admin_Web_Panel SHALL remove the token from client storage, redirect the Admin to the login form, and deny navigation to any protected route until the Admin re-authenticates.
6. IF an Admin submits more than 10 failed login attempts from a single IP address within 15 minutes, THEN THE API SHALL reject further login attempts from that IP address for 15 minutes and return an HTTP 429 response.
7. IF an Admin submits the login form with the username field or password field empty, THEN THE Admin_Web_Panel SHALL display a validation error identifying the missing field and SHALL NOT submit the form to the API.

---

### Requirement 2: User Management

**User Story:** As an Admin, I want to create, edit, disable, and reset passwords for user accounts, so that I can control who can access the platform.

#### Acceptance Criteria

1. THE Admin_Web_Panel SHALL allow an Admin to create a new User account with a username that is between 3 and 64 characters in length, contains only alphanumeric characters and underscores, and is unique across the platform.
2. THE Admin_Web_Panel SHALL allow an Admin to edit an existing User's username, subject to the same format and uniqueness constraints as creation.
3. THE Admin_Web_Panel SHALL allow an Admin to disable a User account.
4. WHEN a User account is disabled, THE API SHALL reject authentication requests from that User and return an error response indicating the account is inactive.
5. THE Admin_Web_Panel SHALL allow an Admin to reset a User's password, replacing it with a new Admin-specified value.
6. THE API SHALL store all User passwords hashed with bcrypt using a minimum cost factor of 12.
7. IF a User account is created or a password is reset with a password shorter than 8 characters, THEN THE API SHALL return an error response, THE Admin_Web_Panel SHALL display a message stating the minimum password length requirement, and the account or password SHALL NOT be modified.
8. IF an Admin attempts to set a username that is already in use by another account (on creation or edit), THEN THE API SHALL return an HTTP 409 response and THE Admin_Web_Panel SHALL display a message stating the username is already taken.
9. THE Admin_Web_Panel SHALL display a paginated list of all User accounts showing username and enabled/disabled status, with a page size of 25 records per page.

---

### Requirement 3: Deployment Management

**User Story:** As an Admin, I want to create and manage named Deployments, so that I can organize software products on the platform.

#### Acceptance Criteria

1. THE Admin_Web_Panel SHALL allow an Admin to create a new Deployment with a name that is between 1 and 100 characters in length and is unique across the platform.
2. THE Admin_Web_Panel SHALL allow an Admin to edit the name of an existing Deployment, subject to the same length and uniqueness constraints as creation.
3. WHEN an Admin navigates to the Deployments list, THE Admin_Web_Panel SHALL display all Deployments with their names and the count of associated Versions.
4. THE API SHALL enforce that Deployment names are unique across the platform, applying the same uniqueness check on both creation and rename operations.
5. IF an Admin attempts to create or rename a Deployment with a name that already exists, THEN THE API SHALL return an HTTP 409 response and THE Admin_Web_Panel SHALL display a message identifying the name conflict.
6. IF an Admin attempts to rename a Deployment with a name already used by a different Deployment, THEN THE API SHALL return an HTTP 409 response and THE Admin_Web_Panel SHALL display a message identifying the name conflict.

---

### Requirement 4: Version Management

**User Story:** As an Admin, I want to add new versions to a Deployment and manage their metadata, so that I can control what is available to users.

#### Acceptance Criteria

1. THE Admin_Web_Panel SHALL allow an Admin to add a new Version to a Deployment by specifying a version number and one package source: an uploaded Deployment Package Archive, a server-side archive path, or a server-side Server Staging Folder path.
2. WHEN a new Version is added from a server-side archive path, THE API SHALL verify that the archive file exists on the server before recording the Version in the Database.
3. WHEN a new Version is added from a Server Staging Folder path, THE API SHALL verify that the folder exists on the server and contains the expected launch batch script, create a Deployment Package Archive from that folder, and record the generated archive as the Version artifact.
4. IF the specified archive file or Server Staging Folder does not exist, THEN THE API SHALL return an HTTP 422 response and THE Admin_Web_Panel SHALL display an error message indicating the package source was not found.
5. THE Admin_Web_Panel SHALL allow an Admin to designate a Version as Stable or Beta at the time of creation and allow changing this designation at any time after creation.
6. THE Admin_Web_Panel SHALL allow an Admin to designate a Version as Released or Archived at the time of creation and allow changing this designation at any time after creation.
7. WHEN a Version is marked as Archived, THE Launcher SHALL no longer display that Version to Users on the next API refresh.
8. WHEN a Version is marked as Released, THE Launcher SHALL display that Version to all Users who have access to the parent Deployment on the next API refresh.
9. THE Admin_Web_Panel SHALL display all Versions for a Deployment grouped by their channel (Stable / Beta) and status (Released / Archived), including package source, package archive name, size, and checksum status.

---

### Requirement 5: Group-Based Access Control

**User Story:** As an Admin, I want to grant deployment access to groups of users, so that each client or team can be managed without assigning deployments to every user individually.

#### Acceptance Criteria

1. THE Admin_Web_Panel SHALL allow an Admin to create and edit User Groups with unique group names.
2. THE Admin_Web_Panel SHALL allow an Admin to add Users to and remove Users from User Groups.
3. THE Admin_Web_Panel SHALL allow an Admin to grant and revoke Deployment access for a User Group.
4. WHEN an Admin grants a User Group access to a Deployment, THE API SHALL record the group-to-deployment permission and THE Admin_Web_Panel SHALL display a confirmation that access was granted.
5. IF an Admin attempts to grant a User Group access to a Deployment that the group already has access to, THEN THE API SHALL return an HTTP 409 response and THE Admin_Web_Panel SHALL display a message indicating the group already has access.
6. WHEN an Admin revokes a User Group's access to a Deployment, THE API SHALL remove the group-to-deployment permission and THE Admin_Web_Panel SHALL display a confirmation that access was revoked.
7. IF an Admin attempts to revoke a User Group's access to a Deployment that the group does not currently have access to, THEN THE API SHALL return an HTTP 404 response and THE Admin_Web_Panel SHALL display a message indicating no active access record was found.
8. WHEN a User requests the deployment list, THE API SHALL return only the Deployments granted to at least one User Group that contains that User.
9. WHEN an Admin changes a User's group membership or changes a User Group's Deployment access, THE API SHALL reflect the resulting Deployment visibility in subsequent requests from affected Users within 5 seconds.
10. WHEN an Admin navigates to a User Group detail view, THE Admin_Web_Panel SHALL display the Users in that group and the Deployments granted to that group.
11. WHEN an Admin navigates to a User detail view, THE Admin_Web_Panel SHALL display the User's group memberships and the Deployments inherited through those groups.

---

### Requirement 6: User Authentication in the Launcher

**User Story:** As a User, I want to log in to the Launcher with my username and password, so that I can securely access my authorized deployments.

#### Acceptance Criteria

1. WHILE no JWT is present in the Windows Credential Manager with an `exp` claim set to a future timestamp, THE Launcher SHALL display the login screen with username and password fields.
2. WHEN a User submits valid credentials, THE API SHALL return a signed JWT and THE Launcher SHALL persist the token in the Windows Credential Manager.
3. IF persisting the JWT to the Windows Credential Manager fails, THEN THE Launcher SHALL display an error message indicating that the session could not be saved and SHALL NOT proceed to the deployment list.
4. WHEN a User submits invalid credentials, THE API SHALL return an HTTP 401 response and THE Launcher SHALL display a message stating the credentials are incorrect.
5. WHEN the Launcher starts and a JWT is found in the Windows Credential Manager with an `exp` claim set to a future timestamp, THE Launcher SHALL skip the login screen and proceed to the deployment list.
6. WHEN the `exp` claim of the persisted JWT is in the past, THE Launcher SHALL discard the token, clear the Credential Store entry, and present the login screen.
7. IF the persisted JWT is structurally invalid or the `exp` claim is absent for reasons other than expiry, THE Launcher SHALL NOT discard or clear the token; it SHALL attempt to use the token and handle any resulting API error at the time of the API call.
8. WHEN a User activates the "Sign out" option, THE Launcher SHALL discard the current JWT and clear the Credential Store entry.
9. IF a User account has been disabled, THEN THE API SHALL return an HTTP 403 response and THE Launcher SHALL display a message stating the account is disabled.
10. IF the Launcher receives an HTTP 429 response on a login attempt, THEN THE Launcher SHALL disable the submit button for the duration specified in the `Retry-After` response header, defaulting to 60 seconds if the header is absent, and SHALL display a message informing the User how long to wait before retrying.

---

### Requirement 7: Deployment Discovery in the Launcher

**User Story:** As a User, I want to see only the deployments I have access to, so that I can find and manage my authorized software.

#### Acceptance Criteria

1. WHEN a User requests the deployment list, THE API SHALL require a valid JWT and SHALL return only the Deployments granted to at least one User Group that contains that User; THE Launcher SHALL display the returned Deployments.
2. THE Launcher SHALL display all Released Versions of each accessible Deployment, grouped by channel: Stable versions listed separately from Beta versions.
3. THE Launcher SHALL NOT display Archived Versions to the User.
4. WHEN a Version becomes Archived after the deployment list has been loaded, THE Launcher SHALL remove it from the display on the next API refresh.
5. THE Launcher SHALL poll the API for deployment list updates every 5 minutes while the User is authenticated.
6. THE Launcher SHALL provide a manual refresh control that immediately requests an updated deployment list from the API.
7. WHEN the User's access list changes on the server, THE Launcher SHALL reflect newly granted and newly revoked Deployments within one polling cycle (at most 5 minutes) or immediately upon manual refresh.
8. WHEN the authenticated User has no accessible Deployments, THE Launcher SHALL display a message indicating that no deployments are currently available.

---

### Requirement 8: Package Download

**User Story:** As a User, I want to download a selected version package with fast, resumable parallel downloads, so that I can install large Unreal Engine builds reliably even over unstable connections.

#### Acceptance Criteria

1. WHEN a User initiates a download for a Version, THE Launcher SHALL request a short-lived Download Token from the API for that Version's Deployment Package Archive.
2. THE API SHALL issue a Download Token as a signed JWT valid for no more than 1 hour, scoped to the specific Version and User.
3. THE File_Server SHALL validate each package archive request against the API and SHALL reject requests with missing or invalid Download Tokens with an HTTP 401 response.
4. WHEN a download is in progress, THE Launcher SHALL download the package archive using between 4 and 16 parallel HTTP range-request streams per Version download.
5. THE Launcher SHALL support a minimum of 4 concurrent download streams per Version download.
6. WHEN a download is interrupted by a network failure or application restart, THE Launcher SHALL automatically resume the package archive download from the last successfully received byte offset for each incomplete range upon reconnection or restart, without requiring User intervention.
7. THE Launcher SHALL persist package download progress state to disk so that resumption survives a machine restart.
8. THE Launcher SHALL provide Pause, Resume, and Cancel controls for each active or paused download.
9. WHEN a download is cancelled, THE Launcher SHALL remove all partially downloaded package archive parts for that Version from disk.
10. WHILE a download is in progress, THE Launcher SHALL update and display the current download speed in MB/s, the remaining data size in MB or GB, and the estimated time remaining, refreshing these values at intervals of no more than 2 seconds.
11. WHEN a User initiates a download for a Version, THE Launcher SHALL calculate the total size required for both the package archive and the extracted deployment folder, then verify that the Install Root has enough free disk space before beginning any file transfers.
12. IF the available disk space is insufficient to accommodate the package archive and extracted deployment folder, THEN THE Launcher SHALL display a message stating both the required size and the available size in MB (if less than 1 GB) or GB with two decimal places (if 1 GB or more), and SHALL NOT begin the download.
13. WHILE a download is active and the Download Token age reaches 55 minutes, THE Launcher SHALL request a refreshed Download Token from the API and replace the expiring token before the 60-minute expiry is reached.
14. WHEN available disk space on the Install Root falls below the remaining package download or extraction size during an active operation, THE Launcher SHALL pause the operation and display a message stating the size shortfall in MB or GB.

---

### Requirement 9: Package Integrity Verification and Extraction

**User Story:** As a User, I want downloaded package archives to be verified and extracted cleanly, so that I can trust that the installed deployment folder is complete and uncorrupted.

#### Acceptance Criteria

1. WHEN a Version is added to the platform, THE API SHALL compute and store a SHA-256 checksum for the Deployment Package Archive.
2. WHEN a package archive download completes, THE Launcher SHALL compute the SHA-256 checksum of the downloaded archive and compare it against the checksum provided by the API.
3. IF the package archive checksum does not match, THEN THE Launcher SHALL delete the corrupted archive, display an error message identifying the affected Version, and offer the User the option to retry the download; IF the archive fails checksum verification 3 consecutive times, THEN THE Launcher SHALL abort the download and display a message advising the User to contact support.
4. WHEN a package archive passes checksum verification, THE Launcher SHALL extract the archive into the Version's install subdirectory under the Install Root.
5. WHEN extraction completes successfully and the expected batch script is present in the extracted deployment folder, THE Launcher SHALL mark that Version as fully installed.
6. IF extraction fails, THEN THE Launcher SHALL leave the Version marked as Not Installed, remove the incomplete extracted folder, and display a friendly error message advising the User to retry.
7. IF the API does not provide a SHA-256 checksum for the package archive, THEN THE Launcher SHALL NOT install the package and SHALL display an error stating that the package could not be verified.

---

### Requirement 10: Side-by-Side Version Installation

**User Story:** As a User, I want to install multiple versions of a deployment simultaneously, so that I can keep a known-good stable version while testing a beta.

#### Acceptance Criteria

1. THE Launcher SHALL install each Version into a distinct subdirectory under the Install Root, using a path of the form `<InstallRoot>/<DeploymentName>/<VersionNumber>/`.
2. THE Launcher SHALL allow multiple Versions of the same Deployment to be installed concurrently without overwriting or modifying other installed Versions.
3. IF a User initiates a download for a Version that is already fully installed, THEN THE Launcher SHALL display a message indicating the Version is already installed and SHALL NOT begin a new download.
4. THE Launcher SHALL track the installation state of each Version as either Installed or Not Installed, where Installed means the Version's extracted subdirectory exists and contains the expected batch script.
5. WHEN a User uninstalls a specific Version, THE Launcher SHALL delete only the subdirectory for that Version and SHALL leave other installed Versions of the same Deployment intact.

---

### Requirement 11: Install Location Configuration

**User Story:** As a User, I want to configure where the Launcher installs deployments, so that I can direct installs to a drive with sufficient space.

#### Acceptance Criteria

1. THE Launcher SHALL provide a Settings screen where the User can specify the Install Root directory using a path of no more than 260 characters.
2. WHEN the Install Root is changed, THE Launcher SHALL apply the new path to all subsequent downloads and SHALL NOT move previously installed Versions.
3. THE Launcher SHALL persist the Install Root setting across application restarts.
4. IF the User specifies an Install Root path that does not exist, THEN THE Launcher SHALL prompt the User to confirm creation of the directory; IF the User confirms, THE Launcher SHALL create the directory and apply the path; IF the User cancels, THE Launcher SHALL retain the previous Install Root path without modification.
5. THE Launcher SHALL display the currently configured Install Root path on the Settings screen.
6. IF the User specifies an Install Root path that exists but is not writable by the Launcher process, THEN THE Launcher SHALL display an error message indicating the path is not writable and SHALL NOT apply the new path.
7. IF the User specifies a path that contains invalid characters or exceeds 260 characters, THEN THE Launcher SHALL display an error message indicating the path is invalid and SHALL NOT apply the new path.

---

### Requirement 12: Installed Version Access

**User Story:** As a User, I want to open the install folder of an installed version, so that I can run the deployment's batch file or inspect the files.

#### Acceptance Criteria

1. WHILE a Version's installation is complete and its extracted install subdirectory exists with the expected batch script, THE Launcher SHALL display an "Open Folder" button for that Version.
2. WHEN the User activates the "Open Folder" button for an installed Version, THE Launcher SHALL open the Version's install subdirectory in Windows File Explorer.
3. IF the Version's install subdirectory no longer exists when the User activates the "Open Folder" button, THEN THE Launcher SHALL display an error message stating the folder could not be found and SHALL NOT attempt to open File Explorer.

---

### Requirement 13: Error Handling and User Feedback

**User Story:** As a User, I want the Launcher to display clear and friendly error messages, so that I understand what went wrong and what action I can take.

#### Acceptance Criteria

1. WHEN a network error occurs during a package archive download, THE Launcher SHALL display a descriptive message indicating a connection problem and offer the User the option to retry or pause the download; IF the network error recurs on 3 consecutive retry attempts, THE Launcher SHALL pause the download automatically and display a message advising the User to check their connection.
2. WHEN the API returns an unexpected error (HTTP 5xx), THE Launcher SHALL display a message stating that the server is temporarily unavailable and to try again later.
3. WHEN a package archive integrity check fails, THE Launcher SHALL display a message naming the affected Version and offering a retry option; IF the integrity check fails 3 consecutive times for the same Version, THE Launcher SHALL abort the download and display a message advising the User to contact support.
4. WHEN disk space is insufficient to begin a package download or extraction, THE Launcher SHALL display the required space and the available space — in MB if the value is less than 1 GB, or in GB with two decimal places otherwise — and SHALL offer the User the option to choose a different Install Root or cancel; IF the disk space information cannot be determined, THE Launcher SHALL display a message stating that available space could not be checked and offer the User the option to choose a different Install Root or cancel.
5. THE Launcher SHALL NOT display raw HTTP status codes, stack traces, or internal error identifiers to the User in any error message.

---

### Requirement 14: Launcher Branding

**User Story:** As a deployer, I want the Launcher's visual identity to be configurable, so that the application can be rebranded for different clients or products.

#### Acceptance Criteria

1. THE Launcher SHALL display a logo image on the login screen, main deployment list screen, and Settings screen, loaded from an asset path specified in the application configuration file.
2. THE Launcher SHALL use a white background as the default theme on the login screen, main deployment list screen, Settings screen, and download progress screen.
3. WHERE a custom logo asset path is set in the application configuration, THE Launcher SHALL display the image at that path in place of the default logo; IF the file at the custom path is unreadable or is not a valid image format, THE Launcher SHALL display the default logo without showing an error to the User.
4. THE Launcher SHALL accept logo images in PNG, JPEG, or ICO format and SHALL NOT accept files larger than 5 MB; IF a file exceeding 5 MB or in an unsupported format is specified, THE Launcher SHALL fall back to the default logo.
5. THE Launcher distribution SHALL support client-specific branding without rebuilding application code by packaging a client logo and launcher branding configuration alongside the same launcher executable.
6. THE default Launcher branding configuration SHALL use `branding/logo.png` relative to the executable as the standard client logo location for ZIP/manual distribution.

---

### Requirement 15: Download Token Security

**User Story:** As a platform operator, I want package archive downloads to require short-lived signed tokens, so that unauthorized users cannot access deployment packages directly.

#### Acceptance Criteria

1. THE File_Server SHALL reject all requests for Version package archives that do not include a valid Download Token, returning HTTP 401.
2. THE API SHALL sign Download Tokens using a secret key not exposed to clients.
3. WHEN a Download Token's remaining lifetime falls below 60 seconds or the token has expired, THE Launcher SHALL request a new Download Token from the API; THE API SHALL issue new Download Tokens with a lifetime between 60 and 900 seconds.
4. THE API SHALL scope each Download Token to a specific User and a specific Version; IF a token is presented for a different User or Version than the one it was issued for, THE API SHALL return an HTTP 403 response.
5. WHEN the File Server receives a package archive request, THE File Server SHALL verify the Download Token is valid and has not expired before serving any archive data.
6. IF the token validation service is unavailable when the File Server receives a package archive request, THEN THE File Server SHALL deny the request and SHALL NOT serve any archive data.

---

### Requirement 16: Launcher Installation and Updates

**User Story:** As a platform operator, I want the Launcher to be distributed as a Windows installer, so that end-users can install it with a standard setup experience.

#### Acceptance Criteria

1. THE Launcher SHALL be packaged as a Windows installer using NSIS or Inno Setup.
2. THE Launcher installer SHALL create desktop and Start Menu shortcuts pointing to the installed Launcher executable; IF shortcut creation fails due to system permissions or policy restrictions, THE installer SHALL continue and complete the installation without the shortcuts.
3. THE Launcher SHALL be self-contained such that installation completes successfully on a clean Windows machine without internet access and without requiring the end-user to separately install the .NET 8 runtime.
4. WHEN a newer version of the Launcher installer is run on a machine that already has the Launcher installed, THE installer SHALL replace the existing Launcher binaries with the new version and SHALL preserve the User's existing configuration (Install Root path and persisted JWT) without requiring the User to reconfigure the application.

