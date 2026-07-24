# Backend

Node.js + Express backend for the VIZZIO Deployment Platform.

## Setup

1. cd backend
2. npm install
3. npm run dev

## Notes

- Uses PostgreSQL for persistent storage.
- Uses JWT authentication for API access.
- Nginx is expected to serve large file delivery externally.
- Admin package uploads stream to disk under `storage/downloads`; set `PACKAGE_UPLOAD_MAX_BYTES` to cap upload size. Use a large cap, such as 80 GiB, for Unreal-scale deployments.
- ZIP and 7z package sources must contain a launch `.bat` at the archive root
  or inside the only top-level folder. ZIP validation is built in; 7z validation
  requires `7z` or `7za`. On Windows, the backend also checks the standard
  `C:\Program Files\7-Zip\7z.exe` path.
- Server staging folders are packaged as generated `.7z` archives when 7-Zip is
  available, which is the expected path for 50-60 GiB deployment folders.
- Notifications are persisted per active admin user. Backend services create
  notifications for deployment/version lifecycle changes, launcher download
  requests, and launcher error reports. Notification write failures are logged
  in development and do not block the triggering action.
