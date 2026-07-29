---
title: "11 Building the Launcher Installer"
description: "Prerequisites, configuration, build command, and distribution output for the VIZZIO Windows launcher installer."
---

## Prerequisites

Install the following on the build computer:

- .NET 8 SDK
- Inno Setup 6
- 7-Zip

Inno Setup should be installed at:

```text
C:\Program Files (x86)\Inno Setup 6\ISCC.exe
```

## Backend Configuration

Before building, confirm the launcher's default API endpoint in:

```text
launcher\DownloadManagerApiClient.cs
```

The production endpoint is:

```text
https://vzdeployment.hardyhutajaya.com/api
```

Do not use `localhost` when distributing the launcher to other computers.

## Build Command

Open PowerShell in the project root:

```powershell
cd "C:\Users\User\Desktop\VIZZIO_Deployment_Platform"
```

Run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File ".\scripts\build_launcher_installer.ps1" `
  -Version "0.1.0" `
  -InnoCompiler "C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
```

The execution-policy bypass applies only to this PowerShell process and does not
permanently change the system policy.

## Installer Output

After a successful build, the installer is generated at:

```text
installer\artifacts\VIZZIO-Launcher-Setup-0.1.0.exe
```

Distribute this `.exe` to users. The installer includes the .NET runtime and
7-Zip extraction support, so users do not need to install those dependencies
separately.

Inno Setup is required only on the computer used to build the installer.

