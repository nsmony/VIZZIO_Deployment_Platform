# VIZZIO Deployment Platform

VIZZIO Deployment Platform is a full deployment-management stack for packaging, releasing, downloading, and installing large VIZZIO/Unreal Engine deployments.

The repository contains three main applications:

- `backend/` - Node.js, Express, Prisma, PostgreSQL API.
- `frontend/` - React + Vite admin portal.
- `launcher/` - .NET 8 WPF Windows launcher for end users.

## Architecture

The admin portal is used to manage deployments, versions, users, groups, and download logs. The backend owns authentication, authorization, release metadata, package lookup, download sessions, and range-capable file streaming. The launcher signs in to the same backend, lists packages available to the user, queues downloads, resumes interrupted downloads from `.part*` files, validates checksums, and installs packages locally.

Important download flow:

1. Admin registers or uploads a deployment package.
2. Backend exposes released versions through `/api/download-manager/items`.
3. Launcher creates a session through `/api/download-manager/sessions`.
4. Backend returns a short-lived download token and file metadata.
5. Launcher downloads with multiple HTTP range streams.
6. Partial chunks stay as `.part*` files until every chunk is complete.
7. Launcher merges chunks, verifies SHA-256, extracts the package, and records completion.

## Prerequisites

- Node.js 20+.
- npm 10+.
- PostgreSQL 15+.
- .NET 8 SDK with Windows Desktop support.
- Windows for running the WPF launcher.
- Inno Setup 6 if building the installer.
- Optional: `7za.exe` if launcher packages may use `.7z` archives.

## Repository Map

```text
backend/
  prisma/                  Database schema and migrations.
  src/controllers/         HTTP request handlers.
  src/routes/              Express route definitions.
  src/services/            Business logic and download authorization.
  src/repositories/        Prisma data access helpers.
  src/middleware/          Auth and rate limiting middleware.

frontend/
  src/api/                 Browser API client.
  src/components/          Shared admin UI components.
  src/layouts/             Admin shell layout.
  src/pages/admin/         Admin portal pages.
  src/styles/              CSS for admin pages and components.

launcher/
  ChunkedDownloadManager.cs      Multi-stream, resumable downloader.
  DownloadManagerWindow.cs       WPF UI, queue, pause/resume, install flow.
  DownloadManagerApiClient.cs    Backend API client.
  DownloadManagerModels.cs       Backend JSON DTOs.
  WindowsCredentialStore.cs      Saved launcher session token.

installer/
  VIZZIOLauncher.iss       Inno Setup installer script.

scripts/
  build_launcher_installer.ps1   Publishes launcher and builds installer.
```

## Backend Setup

Create `backend/.env`:

```env
PORT=4000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/vizzio
JWT_SECRET=change-me
DOWNLOAD_MANAGER_TOKEN_SECRET=change-me-too
PACKAGE_ROOT=C:\VIZZIO\packages
DOWNLOAD_DELIVERY_MODE=node
```

Useful backend variables:

- `PORT` - API port. Defaults to `4000`.
- `DATABASE_URL` - PostgreSQL connection string used by Prisma.
- `JWT_SECRET` - signs user login tokens.
- `DOWNLOAD_MANAGER_TOKEN_SECRET` - signs launcher file download tokens.
- `PACKAGE_ROOT` - root folder for server-staged package files.
- `DOWNLOAD_DELIVERY_MODE` - use `node` for Express streaming or `nginx` for `X-Accel-Redirect`.
- `DOWNLOAD_ROOT` - Nginx file root when `DOWNLOAD_DELIVERY_MODE=nginx`.
- `DOWNLOAD_ACCEL_PREFIX` - internal Nginx location prefix. Defaults to `/_vizzio_downloads`.

Install and run:

```powershell
cd backend
npm install
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

## Frontend Setup

Create `frontend/.env` if the backend is not using defaults:

```env
VITE_API_BASE=http://localhost:4000/api
VITE_DOWNLOAD_BASE=http://localhost:4000/downloads
```

Install and run:

```powershell
cd frontend
npm install
npm run dev
```

Build for production:

```powershell
cd frontend
npm run build
```

## Launcher Development

Build the launcher:

```powershell
dotnet build launcher\Launcher.csproj
```

Run the launcher from the build output or Visual Studio. To point it at a different backend, set:

```powershell
$env:VIZZIO_API_BASE = "http://localhost:4000/api"
```

Launcher download behavior:

- Uses 4 to 16 range streams per package.
- Saves chunk progress in `.part*` files beside the cached package.
- Keeps a persisted queue and active download state under `%LOCALAPPDATA%\VIZZIO\Launcher`.
- Supports pause/resume without deleting partial files.
- Cancels by deleting partial package artifacts for that item.
- Applies one shared bandwidth cap across all active streams.
- Verifies SHA-256 before extracting.

Launcher client branding:

- The same launcher binary is used for every client.
- Default branding path is `branding/logo.png` beside `Launcher.exe`.
- For ZIP/manual delivery, replace `branding/logo.png` before packaging.
- For installer delivery, pass `-ClientLogoPath` to the installer build script.
- Bad, missing, unsupported, or oversized logos fall back to the default mark at runtime.

Package expectations:

- Released versions should have a checksum.
- Installable archives must contain the expected launch batch script.
- Server package paths must stay inside `PACKAGE_ROOT`.

## Installer Build

The installer uses a self-contained launcher publish. That means the output includes the .NET runtime files needed by the WPF app, so target machines do not need a separate .NET runtime install.

Build the installer:

```powershell
.\scripts\build_launcher_installer.ps1 -Version "0.1.0"
```

If `iscc.exe` is not on `PATH`:

```powershell
.\scripts\build_launcher_installer.ps1 -InnoCompiler "C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
```

If `.7z` extraction should be bundled:

```powershell
.\scripts\build_launcher_installer.ps1 -SevenZipPath "C:\Tools\7za.exe"
```

To build a client-branded installer:

```powershell
.\scripts\build_launcher_installer.ps1 -Version "0.1.0" -ClientLogoPath "C:\Clients\Acme\logo.png"
```

Installer artifacts are written to `installer/artifacts/`.

## Development Workflow

1. Start PostgreSQL.
2. Start backend with `npm run dev`.
3. Start frontend with `npm run dev`.
4. Build or run launcher with `dotnet build launcher\Launcher.csproj`.
5. Create or release packages from the admin portal.
6. Test launcher login, queue, pause, resume, cancel, extraction, and checksum behavior.

Recommended verification before handing off changes:

```powershell
dotnet build launcher\Launcher.csproj
cd frontend
npm run build
```

Backend currently has no test script in `package.json`; add one before relying on automated backend regression tests.

## Troubleshooting

Launcher says connection failed:

- Confirm backend is reachable from the launcher machine.
- Confirm `/api/download-manager/files/:fileId` supports `Range` requests.
- Check that the download token has not expired during a long transfer.
- Check proxy, VPN, firewall, or antivirus interruption on large streams.

Resume does not continue:

- Confirm `.part*` files still exist in the package cache folder.
- Confirm the server file did not change after the first download attempt.
- Confirm backend still returns the same file size and checksum.

Package downloads but does not install:

- Confirm the archive contains the expected launch batch script.
- Confirm the archive can be opened manually.
- Confirm there is enough disk space for both the cached archive and extracted files.

Admin cannot see a deployment:

- Confirm the deployment version status is `released`.
- Confirm the user belongs to a group with deployment access.
- Confirm the package path is inside `PACKAGE_ROOT`.

## Code Commenting Standard

Comments should explain intent, ownership, security assumptions, and failure modes. Avoid comments that restate simple syntax. Add comments when changing:

- Authorization or group-access logic.
- Download tokens, range requests, chunk files, pause/resume, or queue behavior.
- Package path validation and extraction.
- Installer or publish behavior.
- State persisted to localStorage, Windows credentials, or `%LOCALAPPDATA%`.

This keeps the code understandable for future maintainers without burying the important logic under obvious line-by-line notes.
