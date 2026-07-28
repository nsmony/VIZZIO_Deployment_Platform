# Backend

Node.js + Express backend for the VIZZIO Deployment Platform.

## Setup

```powershell
cd backend
Copy-Item .env.example .env
npm install
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

Replace all example database credentials and token secrets before exposing the
backend. Set `ENABLE_DEMO_USERS=false` outside local demo use.

If Windows PowerShell blocks `npm.ps1` or `npx.ps1`, use `npm.cmd` and
`npx.cmd`.

## Notes

- Uses PostgreSQL for persistent storage.
- Uses JWT authentication for API access.
- Node can stream packages directly. Nginx accelerated delivery is optional and
  enabled with `DOWNLOAD_DELIVERY_MODE=nginx`.
- In Nginx mode, downloadable package files must be inside `DOWNLOAD_ROOT`; use
  the same directory for `PACKAGE_ROOT` and `DOWNLOAD_ROOT`, or ensure all
  registered/uploaded artifacts resolve below both roots.
- Admin package uploads stream to disk under `storage/downloads`; SHA-256 is
  calculated during that stream, then ZIP/7z structure and the launch script
  are validated before metadata is returned. Version registration reuses the
  stored upload and does not transfer or hash it again. Set
  `PACKAGE_UPLOAD_MAX_BYTES` to cap upload size. Use a large cap, such as
  80 GiB, for Unreal-scale deployments.
- ZIP and 7z package sources must contain a launch `.bat` at the archive root
  or inside the only top-level folder. ZIP validation is built in; 7z validation
  requires `7z` or `7za`. On Windows, the backend also checks the standard
  `C:\Program Files\7-Zip\7z.exe` path.
- Server staging folders are packaged as generated `.7z` archives when 7-Zip is
  available, which is the expected path for 50-60 GiB deployment folders.
  Preparation uses store mode, rebuilds from current staging content, calculates
  SHA-256 before registration, coalesces duplicate requests within the backend
  process, and removes partial temporary archives after failures. Large file
  counts and runtime cache folders still increase packaging time.
- Staging preparation requires a version number and must return complete
  archive metadata. Version registration rejects raw staging folders and
  unvalidated server archives so expensive packaging and inspection cannot
  unexpectedly move into the registration request.
- Package preparation uses authenticated background-job endpoints under
  `/api/deployment-versions/package-jobs`. Job status includes phase progress,
  elapsed time, ETA when measurable, byte progress during SHA-256, completion
  metadata, and errors. Identical active requests are coalesced into one job.
- Notifications are persisted per active admin user. Backend services create
  notifications for deployment/version lifecycle changes, launcher download
  requests, and launcher error reports. Notification write failures are logged
  in development and do not block the triggering action.
- Notification routes support per-item deletion and user-scoped clear-all.
- Deleting a group cascades its membership and deployment-access rows through
  database relations; user accounts and deployments remain intact.
- Existing backend tests can be run from the repository root with
  `node --test backend\test\authMiddleware.test.js backend\test\downloadManagerService.test.js`.
  There is currently no `npm test` script.
- All `/api/users` user and group routes require the Admin role through
  `requireAdmin` middleware after JWT authentication.
