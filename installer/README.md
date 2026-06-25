# Installer

The launcher installer uses Inno Setup.

## Build

```powershell
.\scripts\build_launcher_installer.ps1 -Version 0.1.0
```

The script publishes the launcher as a self-contained `win-x64` app and then compiles `VIZZIOLauncher.iss`.

Install Inno Setup first and ensure `iscc.exe` is on `PATH`, or pass `-InnoCompiler`.

## 7z Support

The launcher can extract `.7z` packages when `7za.exe` is installed beside `Launcher.exe`. To bundle it into the installer:

```powershell
.\scripts\build_launcher_installer.ps1 -Version 0.1.0 -SevenZipPath C:\Tools\7za.exe
```

If `7za.exe` is not bundled, ZIP packages still work and 7z packages work only when `7z.exe` or `7za.exe` is already on the user's `PATH`.
