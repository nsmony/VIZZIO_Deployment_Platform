# Hosted PC prerequisites

Use this checklist when the backend runs on a supervisor Windows PC and is
exposed through Cloudflare Tunnel.

## Required software

- Node.js LTS
- PostgreSQL
- 7-Zip CLI on the backend PC for `.7z` package validation
- .NET 8 SDK on the build/admin PC for launcher builds
- Inno Setup 6 if building the Windows launcher installer
- Cloudflare Tunnel configured to forward the public hostname to the backend
  port

## Backend environment

Set production values in `backend/.env` before exposing the backend:

```env
DATABASE_URL=postgresql://postgres:strong-password@localhost:5432/vizzio
JWT_SECRET=replace-this-with-a-long-random-secret
DOWNLOAD_SECRET=replace-this-with-a-different-long-random-secret
DOWNLOAD_MANAGER_SECRET=replace-this-with-a-third-long-random-secret
PORT=4000
PACKAGE_ROOT=C:\VIZZIO\packages
DOWNLOAD_ROOT=C:\VIZZIO\downloads
PACKAGE_UPLOAD_MAX_BYTES=85899345920
LAUNCHER_ERROR_REPORT_ROOT=C:\VIZZIO\launcher-error-reports
LAUNCHER_LATEST_VERSION=0.1.0
LAUNCHER_DOWNLOAD_URL=https://example.com/VIZZIO-Launcher-Setup-0.1.0.exe
LAUNCHER_RELEASE_NOTES=Initial hosted release.
LAUNCHER_UPDATE_REQUIRED=false
```

Do not use the default JWT or download secrets when the backend is reachable
through Cloudflare Tunnel.

Before starting the hosted backend after pulling updates, apply database
migrations and regenerate Prisma Client:

```powershell
cd C:\Users\User\Desktop\VIZZIO_Deployment_Platform\backend
npx prisma migrate deploy
npx prisma generate
```

`PACKAGE_ROOT` limits server-side archive and staging-folder paths. Put files
there only when registering by server path. Browser uploads can be selected from
any admin computer location and are copied into backend storage after
validation.

## 7z backend setup

Install 7-Zip on the backend PC and make sure this folder is on the system
`PATH`:

```text
C:\Program Files\7-Zip
```

Restart the backend terminal or Windows service, then verify:

```powershell
7z i
```

The backend accepts ZIP and 7z package sources, but each package must contain a
launch `.bat` at the archive root or inside the only top-level folder. ZIP
validation is built in. 7z validation requires `7z` or `7za` on the backend PC.

Large Unreal deployments are expected to be tens of GiB. For server staging
folders, the backend creates a generated `.7z` package when 7-Zip is available.
Install 7-Zip on the backend PC before publishing 50-60 GiB deployments.

## Launcher 7z extraction

User machines do not need to install 7-Zip manually. The launcher installer must
bundle `7z.exe` or `7za.exe` beside `Launcher.exe`; otherwise `.7z` downloads
will finish but installation will fail during extraction.

```powershell
.\scripts\build_launcher_installer.ps1 -Version 0.1.0 -SevenZipPath "C:\Program Files\7-Zip\7z.exe"
```

The build script auto-detects `launcher\tools\7za.exe`,
`launcher\tools\7z.exe`, the standard Windows 7-Zip install path, or `PATH`.
If no extractor is available, installer creation fails so a broken launcher is
not shipped.

At runtime the launcher checks beside `Launcher.exe` first, then falls back to
`PATH`.

## Admin readiness check

In the web admin panel, open `Settings > Server` and run `Test Connection`.
The readiness check reports:

- Database URL configuration
- JWT and download secret configuration
- Package root accessibility
- Upload storage accessibility
- Download root configuration
- 7z / 7za availability
- Backend port

Fix any required error before giving launcher users access through the tunnel.

## Frontend and launcher URLs

When building or hosting the frontend, set:

```env
VITE_API_BASE=https://your-cloudflare-hostname.example/api
VITE_DOWNLOAD_BASE=https://your-cloudflare-hostname.example/downloads
```

For the Windows launcher, point it at the Cloudflare backend URL in the Server
URL field, or set:

```powershell
$env:VIZZIO_API_BASE = "https://your-cloudflare-hostname.example/api"
```
