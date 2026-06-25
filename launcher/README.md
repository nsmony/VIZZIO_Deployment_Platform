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

## Self-Contained Publish

```powershell
dotnet publish launcher\Launcher.csproj `
  --configuration Release `
  --runtime win-x64 `
  --self-contained true `
  --output launcher\bin\publish\win-x64
```

The publish output includes the .NET runtime, so the launcher can run on a clean Windows machine without installing .NET separately.

## Installer

Install Inno Setup, then run:

```powershell
.\scripts\build_launcher_installer.ps1 -Version 0.1.0
```

The installer is written to `installer\artifacts`.

To bundle 7z extraction support for clean machines, provide `7za.exe`:

```powershell
.\scripts\build_launcher_installer.ps1 -Version 0.1.0 -SevenZipPath C:\Tools\7za.exe
```

User settings are stored under `%LOCALAPPDATA%\VIZZIO\Launcher`, and the JWT is stored in Windows Credential Manager, so installer upgrades replace app binaries while preserving user configuration.
