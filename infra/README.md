# Infrastructure

This directory contains starter configuration for the VIZZIO Deployment Platform.

## Nginx Setup

- Proxy `/api/` traffic to the backend API.
- Serve large build files through an internal `/_vizzio_downloads/` location.
- Use Nginx to offload large file delivery from the API server.
- The launcher/browser calls `/api/download-manager/files/:fileId?token=...`.
- The backend validates the signed token and returns `X-Accel-Redirect`.
- Nginx then serves the private server file with HTTP Range support.

## Notes

- Configure the `alias` in `nginx.conf` to the build storage path used by your Unreal package repository.
- Set backend env vars so the backend can map registered package paths to the same Nginx alias:

```env
DOWNLOAD_DELIVERY_MODE=nginx
DOWNLOAD_ROOT=/var/www/vizzio/builds
DOWNLOAD_ACCEL_PREFIX=/_vizzio_downloads
PACKAGE_ROOT=/var/www/vizzio/builds
PACKAGE_UPLOAD_ROOT=/var/www/vizzio/uploads
PACKAGE_UPLOAD_MAX_BYTES=85899345920
HTTP_REQUEST_TIMEOUT_MS=0
```

- Server-path registration only accepts sources inside `PACKAGE_ROOT`, while
  Nginx acceleration only applies to files inside `DOWNLOAD_ROOT`. Keeping both
  variables pointed at the same private package directory is the simplest
  supported layout.
- Admins should copy/drop large packages into that shared private directory,
  then register the full server path in Version Management.
- The supplied Nginx configuration streams request bodies without proxy
  buffering and permits packages up to 80 GB. Keep `client_max_body_size` and
  `PACKAGE_UPLOAD_MAX_BYTES` aligned if the production limit changes.
- Do not expose `/_vizzio_downloads/` directly; it must remain `internal`.
