# Configuration and Production Handover

## 1. Purpose

This is the authoritative configuration checklist for local acceptance testing,
supervisor review, and production deployment of the VIZZIO Deployment Platform.
Do not promote a build until every item in the relevant checklist passes.

## 2. Components and URL Ownership

| Component | Local testing | Production |
| --- | --- | --- |
| Backend API | `http://localhost:4000/api` | `https://<public-host>/api` |
| Backend health | `http://localhost:4000/api/health` | `https://<public-host>/api/health` |
| Admin frontend | Vite development URL | Public frontend hostname |
| Frontend API/download paths | Same-origin `/api`, `/downloads` | Same-origin `/api`, `/downloads` |
| Launcher API | Built as `http://localhost:4000/api` | Build with `-ApiBaseUrl "https://<public-host>/api"` |
| PostgreSQL | `localhost:5432` | Private database address |

The launcher first uses the `VIZZIO_API_BASE` environment variable when it is
present. Otherwise it uses the URL stamped into the launcher assembly at build
time. Local builds default to `http://localhost:4000/api`.

## 3. Local Acceptance-Test Configuration

### 3.1 Backend

Create `backend/.env` from `backend/.env.example` and use:

```env
DATABASE_URL=postgresql://postgres:<password>@localhost:5432/vizzio_deployment
NODE_ENV=development
JWT_SECRET=<local-secret>
DOWNLOAD_SECRET=<different-local-secret>
DOWNLOAD_MANAGER_SECRET=<third-local-secret>
PORT=4000

PACKAGE_ROOT=C:\VIZZIO\packages
PACKAGE_UPLOAD_ROOT=C:\VIZZIO\uploads
PACKAGE_UPLOAD_MAX_BYTES=85899345920
UPLOAD_SESSION_RETENTION_MS=604800000

DOWNLOAD_DELIVERY_MODE=node
DOWNLOAD_ROOT=C:\VIZZIO\packages
DOWNLOAD_ACCEL_PREFIX=/_vizzio_downloads

HTTP_REQUEST_TIMEOUT_MS=0
HTTP_HEADERS_TIMEOUT_MS=60000
HTTP_KEEP_ALIVE_TIMEOUT_MS=5000

LAUNCHER_ERROR_REPORT_ROOT=C:\VIZZIO\launcher-error-reports
LAUNCHER_LATEST_VERSION=0.1.0
LAUNCHER_DOWNLOAD_URL=
LAUNCHER_RELEASE_NOTES=Local acceptance build
LAUNCHER_UPDATE_REQUIRED=false
ENABLE_DEMO_USERS=false
```

Create these directories and grant the backend service account read/write
permission:

```text
C:\VIZZIO\packages
C:\VIZZIO\uploads
C:\VIZZIO\uploads\.sessions
C:\VIZZIO\launcher-error-reports
```

Install 7-Zip and verify `C:\Program Files\7-Zip\7z.exe` exists.

### 3.2 Database and backend startup

```powershell
cd backend
npm install
npx prisma generate
npx prisma migrate deploy
node src/index.js
```

Verify:

```powershell
Invoke-RestMethod http://localhost:4000/api/health
node --test test/*.test.js
```

Expected health result:

```json
{"status":"ok"}
```

### 3.3 Admin frontend

No frontend `.env` is required when frontend and backend share a hostname.
During `npm run dev`, Vite proxies `/api` and `/downloads` to port 4000.

```powershell
cd frontend
npm install
npm run dev
```

For an explicit local override:

```env
VITE_API_BASE=http://localhost:4000/api
VITE_DOWNLOAD_BASE=http://localhost:4000/downloads
```

### 3.4 Local launcher

Build and run:

```powershell
dotnet run --project launcher\Launcher.csproj
```

The default local API is `http://localhost:4000/api`. An override for one
terminal session is:

```powershell
$env:VIZZIO_API_BASE = "http://localhost:4000/api"
dotnet run --project launcher\Launcher.csproj
```

Clear an old override before testing the build-stamped endpoint:

```powershell
Remove-Item Env:VIZZIO_API_BASE -ErrorAction SilentlyContinue
```

## 4. Local End-to-End Acceptance Checklist

1. Backend readiness reports database, secrets, storage roots, and 7-Zip ready.
2. Admin can log in and create a deployment.
3. Local archive upload can pause/interruption-retry and resume from its
   confirmed 64 MB chunk offset.
4. Existing server ZIP/7z validation returns file, launch script, size, and
   SHA-256.
5. Server staging-folder preparation creates a generated archive and SHA-256.
6. Final registration does not upload or checksum an unchanged package again.
7. Released versions appear only for launcher users with group access.
8. Launcher creates a download session and performs parallel range downloads.
9. Pausing/restarting the launcher resumes `.part` files.
10. SHA-256 verification and extraction succeed.
11. The detected root-level launch batch script starts successfully.
12. Download logs, notifications, and launcher error reporting are visible in
    the admin panel.

## 5. Production Backend Configuration

Use three independently generated cryptographic secrets. Never copy sample or
local secrets into production. Rotating them invalidates active sessions and
download tokens.

```env
DATABASE_URL=postgresql://<user>:<password>@<private-db-host>:5432/<database>
NODE_ENV=production
JWT_SECRET=<random-production-secret-1>
DOWNLOAD_SECRET=<random-production-secret-2>
DOWNLOAD_MANAGER_SECRET=<random-production-secret-3>
PORT=4000

PACKAGE_ROOT=<durable-package-directory>
PACKAGE_UPLOAD_ROOT=<durable-upload-directory>
PACKAGE_UPLOAD_MAX_BYTES=85899345920
UPLOAD_SESSION_RETENTION_MS=604800000

HTTP_REQUEST_TIMEOUT_MS=0
HTTP_HEADERS_TIMEOUT_MS=60000
HTTP_KEEP_ALIVE_TIMEOUT_MS=5000

LAUNCHER_ERROR_REPORT_ROOT=<durable-report-directory>
LAUNCHER_LATEST_VERSION=<released-launcher-version>
LAUNCHER_DOWNLOAD_URL=https://<public-host>/<installer-file>
LAUNCHER_RELEASE_NOTES=<release-summary>
LAUNCHER_UPDATE_REQUIRED=false
ENABLE_DEMO_USERS=false
```

### 5.1 Windows/Cloudflare with Node file delivery

```env
DOWNLOAD_DELIVERY_MODE=node
DOWNLOAD_ROOT=C:\VIZZIO\packages
DOWNLOAD_ACCEL_PREFIX=/_vizzio_downloads
```

Cloudflare must forward the public hostname to the backend/frontend reverse
proxy. Confirm its upload-size and request-duration limits are compatible with
the intended package size. Resumable 64 MB upload chunks avoid one multi-hour
request, but the proxy must permit each chunk.

### 5.2 Linux/Nginx accelerated delivery

```env
PACKAGE_ROOT=/var/www/vizzio/builds
PACKAGE_UPLOAD_ROOT=/var/www/vizzio/uploads
DOWNLOAD_ROOT=/var/www/vizzio/builds
DOWNLOAD_DELIVERY_MODE=nginx
DOWNLOAD_ACCEL_PREFIX=/_vizzio_downloads
```

Deploy `infra/nginx.conf` after replacing `server_name` and confirming its
filesystem alias. The supplied configuration includes:

- `client_max_body_size 80g`
- `proxy_request_buffering off`
- 24-hour proxy send/read timeouts
- internal `X-Accel-Redirect` delivery
- range-friendly file serving

Never select Nginx mode on a Windows host that is not actually behind the
configured Nginx instance.

## 6. Production Frontend

Preferred topology: serve frontend and API through one public hostname. Leave
`VITE_API_BASE` and `VITE_DOWNLOAD_BASE` unset; the compiled frontend uses
same-origin `/api` and `/downloads`.

If separate hostnames are required, set both variables before building:

```env
VITE_API_BASE=https://api.example.com/api
VITE_DOWNLOAD_BASE=https://api.example.com/downloads
```

Build:

```powershell
cd frontend
npm ci
npm run build
```

Never ship a production bundle containing `http://localhost:4000`.

## 7. Production Launcher and Installer

Local installer:

```powershell
.\scripts\build_launcher_installer.ps1 `
  -Version "0.1.0" `
  -ApiBaseUrl "http://localhost:4000/api" `
  -InnoCompiler "C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
```

Production installer:

```powershell
.\scripts\build_launcher_installer.ps1 `
  -Version "0.1.0" `
  -ApiBaseUrl "https://<public-host>/api" `
  -InnoCompiler "C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
```

The script bundles the self-contained .NET runtime, branding files, and 7-Zip.
The output is `installer/artifacts/VIZZIO-Launcher-Setup-<version>.exe`.

Before distribution:

1. Install on a clean Windows test account.
2. Confirm the launcher Settings page displays the intended API endpoint.
3. Confirm the binary does not contain the wrong local/production endpoint.
4. Log in with a non-admin acceptance account.
5. Download, pause, resume, verify, extract, launch, and uninstall one package.
6. Confirm launcher update metadata and installer URL are reachable.

`VIZZIO_API_BASE` can override an installed launcher for diagnostics, but a
normal production deployment should rely on the build-stamped URL.

## 8. Production Security and Operations

- Store `.env` and database credentials outside source control.
- Give package/upload directories only the permissions required by the backend
  service account.
- Terminate public traffic with valid HTTPS.
- Restrict PostgreSQL to private hosts.
- Back up PostgreSQL, package artifacts, upload manifests, and configuration.
- Monitor disk capacity for both archives and extracted-size estimates.
- Run one backend instance unless upload-session and preparation-job
  coordination is moved to shared storage.
- Keep `ENABLE_DEMO_USERS=false`.
- Review launcher reports, failed downloads, and authentication failures.
- Rotate secrets through an approved maintenance window.

## 9. Production Promotion Checklist

```powershell
cd backend
npx prisma validate
npx prisma migrate deploy
node --test test/*.test.js

cd ..\frontend
npm run build

cd ..\launcher
dotnet test Launcher.Tests\Launcher.Tests.csproj --configuration Release
dotnet build Launcher.csproj --configuration Release
```

Then verify:

- Public `/api/health` returns HTTP 200.
- Unauthenticated `/api/download-manager/items` returns HTTP 401.
- Admin Settings readiness has no required errors.
- Frontend bundle contains no localhost production endpoint.
- Launcher assembly contains the intended production endpoint.
- One complete real-user download and launch passes.

## 10. Supervisor Sign-Off Record

Record:

| Field | Value |
| --- | --- |
| Environment | Local acceptance / Staging / Production |
| Backend commit | |
| Frontend build timestamp | |
| Launcher version | |
| Public hostname | |
| Delivery mode | Node / Nginx |
| Package root | |
| Upload root | |
| Database migration | Pass / Fail |
| Backend tests | Pass / Fail |
| Frontend build | Pass / Fail |
| Launcher tests/build | Pass / Fail |
| End-to-end package | |
| Download/resume/checksum/extract/launch | Pass / Fail |
| Reviewer | |
| Date | |
| Notes | |
