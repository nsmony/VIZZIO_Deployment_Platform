# VIZZIO Deployment Platform

VIZZIO Deployment Platform is a full software distribution system for managing, releasing, downloading, and installing large deployment packages (including Unreal Engine builds) for authorized users.

The platform contains:

- Admin Web Panel (React + Vite)
- Backend API (Node.js + Express + Prisma + PostgreSQL)
- Windows Launcher (C# .NET 8 WPF)
- Optional Nginx accelerated delivery for large file downloads

This document is the primary project reference for architecture, flows, setup, operations, and delivery.

## 1. Product Scope

### 1.1 Goals

- Centralized deployment/version lifecycle management
- Group-based access control for client/team visibility
- Fast, resumable, range-based package delivery
- Integrity-first installation with checksum verification
- Side-by-side version installs under a configurable install root
- Launcher branding support without code rebuild

### 1.2 Core Personas

- Admin: Manages users, groups, deployments, versions, access, and system settings
- End User: Uses Windows launcher to sign in, discover allowed deployments, download, install, and open folders

## 2. High-Level Architecture

```mermaid
graph TD
    A["Admin Web Panel<br/>React + Vite"] -->|REST /api| B["Backend API<br/>Node.js + Express"]
    L["Windows Launcher<br/>.NET 8 WPF"] -->|REST /api| B
    B -->|Prisma ORM| D[(PostgreSQL)]
    L -->|Tokenized range request| B
    B -->|Node stream or X-Accel-Redirect| F[Nginx or Node Delivery]
    F --> S[(Package Storage)]
    B --> S
```

### 2.1 Components

- Admin Web Panel
- Backend API
- PostgreSQL Database
- File Delivery Layer (Node streaming or Nginx X-Accel-Redirect)
- Windows Launcher

### 2.2 Delivery Modes

- Node delivery mode: backend streams files directly
- Nginx delivery mode: backend authorizes and Nginx serves files via internal redirect

## 3. End-to-End User Flow

```mermaid
flowchart LR
    A1[Admin logs in] --> A2[Create deployment]
    A2 --> A3["Add version<br/>(upload archive OR register server archive OR prepare staging folder)"]
    A3 --> A4["Mark version state<br/>Draft, Released, or Archived"]
    A4 --> A5[Grant group access]

    U1[Launcher user logs in] --> U2[Launcher fetches accessible items]
    U2 --> U3{User starts download?}
    U3 -->|Yes| U4[Create download session + token]
    U4 --> U5["Parallel range download<br/>with resume state"]
    U5 --> U6[SHA-256 verify]
    U6 --> U7[Extract install folder]
    U7 --> U8[Mark Installed]
    U3 -->|No| U9[User can refresh or sign out]
```

## 4. Use Case Diagrams

### 4.1 Admin Use Cases

```mermaid
flowchart TB
    Admin((Admin))
    UC1[Login]
    UC2[Manage Users]
    UC3[Manage Groups]
    UC4[Manage Deployments]
    UC5[Manage Versions]
    UC6[Grant/Revoke Deployment Access]
    UC7[Review Download Logs]
    UC8[Configure Settings and Maintenance]

    Admin --> UC1
    Admin --> UC2
    Admin --> UC3
    Admin --> UC4
    Admin --> UC5
    Admin --> UC6
    Admin --> UC7
    Admin --> UC8
```

### 4.2 Launcher User Use Cases

```mermaid
flowchart TB
    User((Launcher User))
    U1[Login and Persist Session]
    U2[View Accessible Deployments]
    U3[Start Download]
    U4[Pause / Resume / Cancel]
    U5[Verify Checksum]
    U6[Extract and Install]
    U7[Open Installed Folder]
    U8[Manage Install Root]
    U9[Sign Out]

    User --> U1
    User --> U2
    User --> U3
    User --> U4
    User --> U5
    User --> U6
    User --> U7
    User --> U8
    User --> U9
```

## 5. Detailed Project Structure

```text
VIZZIO_Deployment_Platform/
  README.md
  requirements.md
  design.md
  TASKS.md
  docs/
    architecture.md

  backend/
    package.json
    prisma.config.js
    prisma/
      schema.prisma
      migrations/
    src/
      index.js
      db.js
      prisma.js
      auth.js
      archiveValidation.js
      uploadStore.js
      downloadToken.js
      downloadManagerToken.js
      controllers/
      middleware/
      repositories/
      routes/
      services/
    storage/
      downloads/
    test/
      downloadManagerService.test.js

  frontend/
    index.html
    package.json
    vite.config.js
    src/
      main.jsx
      App.jsx
      api/
      components/
      hooks/
      layouts/
      pages/
      styles/
      utils/

  launcher/
    Launcher.csproj
    App.xaml
    MainWindow.xaml
    DownloadManagerWindow.cs
    ChunkedDownloadManager.cs
    DownloadManagerApiClient.cs
    DownloadManagerModels.cs
    WindowsCredentialStore.cs
    launcher-branding.json

  installer/
    VIZZIOLauncher.iss

  infra/
    nginx.conf

  scripts/
    build_launcher_installer.ps1
    convert_new_to_utf8.ps1
```

## 6. Backend Architecture and Responsibilities

### 6.1 Layering

- routes: endpoint registration and middleware binding
- controllers: request validation and response formatting
- services: business logic, orchestration, policy
- repositories: Prisma data access
- middleware: auth enforcement and rate limiting

### 6.2 Key Domains

- Authentication: admin + launcher user JWT login
- User and group management
- Deployment and version management
- Access control mapping (group to deployment)
- Download manager sessions and audit logging
- Package path validation, staging archive creation, checksum and install-size metadata
- Admin notifications for deployment/version lifecycle changes, download requests,
  and launcher-side failure reports

## 7. Frontend Architecture

- React SPA with authentication-gated portal routes
- Token-aware auth handling with expiry checks
- Central API client with auth headers and session cleanup on unauthorized responses
- Admin modules for users, groups, deployments, versions, settings, and logs
- Six-row user pagination and four-card group pagination with shared
  user/email/group search
- Confirmed group deletion that cascades membership and deployment-access
  mappings without deleting users or deployments
- Dashboard overview with real deployment/version/group counts, quick actions, and
  setup attention items for missing versions or group access
- Notification bell and Notifications page backed by persisted notification
  records with read, individual delete, and user-scoped clear-all controls

## 8. Launcher Architecture

- WPF desktop UX for Login, Library, Installed, Download, and Settings
- Deployment-first package catalog that groups all released versions under one
  deployment while preserving Stable/Beta/Installed filters and per-version
  actions
- Branded maintenance-mode dialog for non-admin users blocked by HTTP 503
- Parallel chunked downloader with persisted resume state
- Session token storage in Windows Credential Manager
- Disk-space checks using archive size plus extracted install-size estimates
- Post-download checksum verification and extraction lifecycle

## 9. Data and Access Model

### 9.1 Core Entities

- User
- Group
- GroupMembership
- Deployment
- DeploymentVersion
- GroupDeploymentAccess
- DownloadSession
- DownloadLog
- File-backed admin settings

### 9.2 Access Rules

- A user can only see released versions of deployments granted through one or more of the user groups
- Archived versions are hidden from launcher users
- Deployment/version write handlers and admin reporting/settings endpoints
  enforce the Admin role.
- The frontend portal guard requires an unexpired JWT with the Admin role.
- `/api/users` applies reusable Admin-role middleware to all user and group
  management routes.
- Download files require valid, short-lived scoped tokens

## 10. Security Model

- Password hashing with bcrypt (cost factor 12+)
- Shared JWT-based authentication for admin and launcher users
- Download token with bounded lifetime and file/session scope
- Login rate limiting middleware for brute-force reduction
- Server-side path validation to avoid traversal and out-of-root access
- Maintenance mode enforcement with admin bypass rules

## 11. Download and Install Pipeline

```mermaid
sequenceDiagram
    participant U as Launcher User
    participant L as Launcher App
    participant B as Backend API
    participant F as File Delivery

    U->>L: Start download
    L->>B: Create session request
    B-->>L: Session + file metadata + token
    L->>B: Parallel HTTP range requests with token
    B->>B: Validate token, session, access, and path
    B-->>F: Stream directly or authorize internal redirect
    F-->>L: Streamed chunks
    L->>L: Merge chunks and validate SHA-256
    L->>L: Extract archive to install root
    L->>B: Report completion/activity
```

### 11.1 Reliability Features

- Resume after app restart using persisted part files/state
- Queue-based download sequencing
- Pause/resume/cancel controls
- Token refresh before expiry
- Install state detection from extracted folder and expected launch script

## 12. Configuration

### 12.1 Backend Environment (example)

```env
PORT=4000
NODE_ENV=production
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/vizzio
JWT_SECRET=replace-with-a-long-random-secret
DOWNLOAD_SECRET=replace-with-a-different-long-random-secret
DOWNLOAD_MANAGER_SECRET=replace-with-a-third-long-random-secret
PACKAGE_ROOT=C:\VIZZIO\packages
DOWNLOAD_DELIVERY_MODE=node
DOWNLOAD_ROOT=/srv/vizzio/packages
DOWNLOAD_ACCEL_PREFIX=/_vizzio_downloads
PACKAGE_UPLOAD_MAX_BYTES=85899345920
LAUNCHER_ERROR_REPORT_ROOT=C:\VIZZIO\launcher-error-reports
LAUNCHER_LATEST_VERSION=0.1.0
LAUNCHER_DOWNLOAD_URL=
LAUNCHER_RELEASE_NOTES=
LAUNCHER_UPDATE_REQUIRED=false
ENABLE_DEMO_USERS=false
```

For Nginx delivery, every registered or uploaded package that should use
`X-Accel-Redirect` must resolve inside `DOWNLOAD_ROOT`. The simplest production
layout is to make `PACKAGE_ROOT` and `DOWNLOAD_ROOT` the same directory.

### 12.2 Frontend Environment (example)

```env
VITE_API_BASE=http://localhost:4000/api
VITE_DOWNLOAD_BASE=http://localhost:4000/downloads
```

### 12.3 Launcher Runtime

- Environment override for API base URL
- Install root path persisted per user
- Branding loaded from launcher branding configuration and branding asset folder

## 13. Local Development Setup

### 13.1 Prerequisites

- Node.js 20+
- npm 10+
- PostgreSQL 15+
- .NET 8 SDK (Windows Desktop)
- Windows OS for launcher execution
- Optional Inno Setup 6 for installer builds

### 13.2 Backend

```powershell
cd backend
npm install
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

If Windows PowerShell blocks `npm.ps1` under its execution policy, use
`npm.cmd` and `npx.cmd` for the same commands.

For an existing hosted database, apply committed migrations before starting or
restarting the backend:

```powershell
cd backend
npx prisma migrate deploy
npx prisma generate
```

### 13.3 Frontend

```powershell
cd frontend
npm install
npm run dev
```

If Windows PowerShell blocks `npm.ps1`, run the equivalent commands with
`npm.cmd`.

Production build:

```powershell
cd frontend
npm run build
```

### 13.4 Launcher

```powershell
dotnet build launcher\Launcher.csproj -p:Configuration=Debug
```

## 14. Installer and Distribution

Install the .NET 8 SDK, Inno Setup 6, and 7-Zip on the build computer. The
default Inno Setup compiler location is:

```text
C:\Program Files (x86)\Inno Setup 6\ISCC.exe
```

Before distribution, confirm that the default API endpoint in
`launcher\DownloadManagerApiClient.cs` points to a backend reachable from user
computers. The production endpoint is:

```text
https://vzdeployment.hardyhutajaya.com/api
```

Do not use `localhost` for a launcher distributed to another computer.

From the project root, build the installer with:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File ".\scripts\build_launcher_installer.ps1" `
  -Version "0.1.0" `
  -InnoCompiler "C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
```

The bypass applies only to the new PowerShell process and does not permanently
change the system execution policy. With a custom client logo, add:

```powershell
-ClientLogoPath "C:\Clients\Acme\logo.png"
```

The completed installer is:

```text
installer\artifacts\VIZZIO-Launcher-Setup-0.1.0.exe
```

It includes the .NET runtime and `7z.exe` or `7za.exe`; end users do not need to
install .NET, 7-Zip, or Inno Setup.

## 15. Operational Runbook

### 15.1 Recommended Startup Order

1. Start PostgreSQL
2. Start backend API
3. Start frontend dev server (or deploy built assets)
4. Run launcher for integration validation

### 15.2 Key Admin Operational Tasks

1. Create deployment
2. Add version from upload, archive path, or staging folder
3. Set channel and release state
4. Grant deployment access to groups
5. Verify launcher visibility with a real user account
6. Monitor notifications, download logs, launcher reports, and failed activity

### 15.3 Maintenance Mode

- Used to temporarily restrict non-admin operations
- Intended for controlled rollout windows and server maintenance

## 16. Quality and Validation

### 16.1 Build Validation Commands

```powershell
cd frontend
npm run build
cd ..
dotnet build launcher\Launcher.csproj -p:Configuration=Debug
```

### 16.2 Backend Notes

- The backend has Node test files but currently has no `npm test` script.
- Run the existing suite from the repository root with:

```powershell
node --test backend\test\downloadManagerService.test.js
```

## 17. Known Risks and Mitigations

- Large file transfers may be interrupted by endpoint/network policies
  - Mitigation: resumable chunk pipeline and retry-friendly UX
- Token expiry during long downloads
  - Mitigation: pre-expiry token refresh and scoped session checks
- Disk under-provisioning during extraction
  - Mitigation: upfront and in-flight free-space checks
- Multi-instance operational confusion with stale local ports
  - Mitigation: enforce single active backend instance in development and scripted health checks
- Authorization regression risk
  - Mitigation: reusable Admin-role middleware protects user/group routes,
    frontend routing validates the token role, and middleware regression tests
    assert HTTP 403 behavior.

## 18. Troubleshooting Guide

### 18.1 Backend does not start

- Check port conflicts (for example port 4000 already in use)
- Verify DATABASE_URL and database reachability
- Confirm Prisma migration state

### 18.2 Launcher cannot download

- Verify user access/group grants to deployment
- Verify released status of the target version
- Verify download token issuance and expiry refresh behavior
- Verify file path is valid under package root and delivery mode configuration

### 18.3 Download logs appear empty

- Verify session creation path and log insert path in backend services
- Verify session identifier validity checks and database persistence path
- Validate against the currently running backend instance and port

### 18.4 Notifications appear empty

- Confirm an event source has occurred after the notification feature was enabled.
- Notifications are created for active admin users when deployments or versions
  change, users request downloads, or the launcher submits an error report.
- Confirm the signed-in admin maps to a managed user record with an active Admin
  role.

## 19. Reference Documents

- requirements.md: source of product acceptance criteria
- design.md: deeper design decisions, properties, and diagrams
- docs/architecture.md: architecture-focused narrative
- docs/diagrams.md: reusable architecture, user flow, use-case, and sequence diagrams
- docs/admin-user-guide.md: administrator operating guide
- docs/operations-publishing-guide.md: release publishing runbook and rollback flow
- docs/handover-document.md: technical and operational handover package
- docs/hosted-pc-prerequisites.md: supervisor-PC hosted deployment prerequisites
- docs/launcher-self-update.md: launcher update endpoint and release metadata
- docs/launcher-error-reporting.md: launcher diagnostic upload behavior
- docs/implementation-verification.md: current implementation check results and requirement coverage snapshot
- docs/full-requirements-audit-2026-07-23.md: broad cross-stack requirement audit and sign-off gaps
- docs/code-documentation-audit-2026-07-27.md: latest code/documentation alignment check and remaining code gaps
- backend/README.md: backend-local development specifics
- frontend/README.md: frontend-local development specifics
- launcher/README.md: launcher-local development specifics

## 20. Future Enhancements

- CI pipeline for backend tests, frontend build, and launcher build/package
- Automated environment health checks and port guard scripts
- Deployment lifecycle dashboards (release cadence, failed installs, recovery metrics)
- Optional multi-tenant operational hardening and environment promotion workflows

---

If this README diverges from implementation details, treat code behavior and requirements.md as source-of-truth, then update this document in the same pull request as the related code changes.
