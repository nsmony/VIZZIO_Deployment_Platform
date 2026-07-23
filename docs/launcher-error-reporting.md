# Launcher error reporting

The Windows launcher uploads diagnostic reports to the backend when a signed-in
user hits a launcher-side failure.

Current report sources:

- Download failures, including insufficient disk space.
- Launch failures, including missing `Launch.bat`, missing package content,
  missing prerequisites, and declared port conflicts.
- Launcher self-update check failures after sign-in.

Reports are written as JSON files by the backend. The default folder is:

```text
backend/storage/launcher-error-reports
```

Set this environment variable in production to keep reports on persistent
storage:

```env
LAUNCHER_ERROR_REPORT_ROOT=C:\VIZZIO\launcher-error-reports
```

Each report includes the signed-in user identity, launcher version, machine and
OS details, the deployment/version when available, the user-facing error
message, request metadata, and the tail of the local launcher log.

Admins can review reports in the web panel at `Logs > Launcher Reports`.

Endpoint:

```text
POST /api/download-manager/error-reports
```

The endpoint requires the normal launcher bearer token. If the user is not
signed in, the launcher keeps the error local and skips upload.
