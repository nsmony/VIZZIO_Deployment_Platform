# Installer

The launcher installer uses Inno Setup.

## Build

Install the .NET 8 SDK, Inno Setup 6, and 7-Zip on the build computer. The
expected Inno Setup compiler path is
`C:\Program Files (x86)\Inno Setup 6\ISCC.exe`.

Confirm that `launcher\DownloadManagerApiClient.cs` uses a backend URL reachable
from user computers. The production URL is
`https://vzdeployment.hardyhutajaya.com/api`; do not distribute a launcher
configured for `localhost`.

From the project root, run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File ".\scripts\build_launcher_installer.ps1" `
  -Version "0.1.0" `
  -InnoCompiler "C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
```

The execution-policy bypass applies only to this PowerShell process. The script
publishes the launcher as a self-contained `win-x64` app and then compiles
`VIZZIOLauncher.iss`.

The completed installer is:

```text
installer\artifacts\VIZZIO-Launcher-Setup-0.1.0.exe
```

End users do not need to install .NET, 7-Zip, or Inno Setup.

## Client Branding

Use the same launcher code for every client and stamp branding during packaging:

```powershell
.\scripts\build_launcher_installer.ps1 -Version 0.1.0 -ClientLogoPath C:\Clients\Acme\logo.png
```

The script copies the logo into the publish output under `branding/` and updates `launcher-branding.json` before the installer is compiled. Logos must be PNG, JPG, JPEG, or ICO and 5 MB or smaller.

## 7z Support

The launcher can extract `.7z` packages when `7za.exe` is installed beside `Launcher.exe`. To bundle it into the installer:

```powershell
.\scripts\build_launcher_installer.ps1 -Version 0.1.0 -SevenZipPath C:\Tools\7za.exe
```

The build fails when no extractor is found, preventing distribution of a
launcher that cannot install `.7z` packages.
