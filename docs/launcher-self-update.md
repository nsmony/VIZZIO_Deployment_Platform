# Launcher self-update

The launcher checks the backend after a user signs in or a saved session is
restored:

```text
GET /api/launcher/update?currentVersion=0.1.0
```

The backend response is controlled with environment variables:

```env
LAUNCHER_LATEST_VERSION=0.2.0
LAUNCHER_DOWNLOAD_URL=https://example.com/VIZZIOLauncherSetup-0.2.0.exe
LAUNCHER_RELEASE_NOTES=Bug fixes and launcher improvements.
LAUNCHER_UPDATE_REQUIRED=false
```

If `LAUNCHER_LATEST_VERSION` is newer than the launcher's assembly version, the
launcher prompts the user to install the update. If the user accepts, it
downloads the installer to a temporary folder, starts it, and closes the current
launcher so the installer can replace the app files.

If `LAUNCHER_UPDATE_REQUIRED=true`, declining the update closes the launcher.
