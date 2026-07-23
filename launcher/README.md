# Launcher

C# .NET 8 WPF launcher for the VIZZIO Deployment Platform.

## Development

```powershell
dotnet run --project launcher\Launcher.csproj
```

Set `VIZZIO_API_BASE` to point the launcher at a non-local backend:

```powershell
$env:VIZZIO_API_BASE = "https://example.com/api"
dotnet run --project launcher\Launcher.csproj
```

Run launcher resilience policy tests:

```powershell
dotnet test launcher\Launcher.Tests\Launcher.Tests.csproj
```

## Self-Contained Publish

```powershell
dotnet publish launcher\Launcher.csproj `
  --configuration Release `
  --runtime win-x64 `
  --self-contained true `
  --output launcher\bin\publish\win-x64
```

The publish output includes the .NET runtime, so the launcher can run on a clean Windows machine without installing .NET separately.

## Client Branding

The launcher uses one binary for all clients. Branding is applied by files beside the executable:

```text
Launcher.exe
launcher-branding.json
branding/
  logo.png
```

The default configuration points at `branding/logo.png`:

```json
{
  "logoPath": "branding/logo.png"
}
```

For simple ZIP distribution, replace `branding/logo.png` in the published launcher folder before zipping it. For installer distribution, pass a logo at build time:

```powershell
.\scripts\build_launcher_installer.ps1 -Version 0.1.0 -ClientLogoPath C:\Clients\Acme\logo.png
```

Client logos may be PNG, JPG, JPEG, or ICO and must be 5 MB or smaller. If the configured logo is missing or invalid at runtime, the launcher falls back to the default `V` mark without showing an error.

## Installer

Install Inno Setup, then run:

```powershell
.\scripts\build_launcher_installer.ps1 -Version 0.1.0
```

The installer is written to `installer\artifacts`.
The `-Version` value is stamped into both the installer metadata and the
launcher assembly version used by the self-update check.

To bundle 7z extraction support for clean machines, provide `7za.exe`:

```powershell
.\scripts\build_launcher_installer.ps1 -Version 0.1.0 -SevenZipPath C:\Tools\7za.exe
```

User settings are stored under `%LOCALAPPDATA%\VIZZIO\Launcher`, and the JWT is stored in Windows Credential Manager, so installer upgrades replace app binaries while preserving user configuration.

## Download Resilience

The launcher is tuned for large packages on slow or interrupted networks:

- Per-chunk resume using HTTP range requests and persisted `.part` files.
- Adaptive stream selection between 4 and 16 streams based on file size and configured bandwidth cap.
- Jittered exponential retry backoff to reduce reconnect storms on unstable links.
- In-flight disk-space checks that pause downloads before writes fail.

User controls in Settings:

- `Parallel streams (4-16)`: upper bound for concurrent range streams.
- `Bandwidth cap in MB/s (0 = unlimited)`: shared cap across all active streams.
