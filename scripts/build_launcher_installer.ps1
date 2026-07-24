param(
    [string]$Version = "0.1.0",
    [string]$Configuration = "Release",
    [string]$Runtime = "win-x64",
    [string]$InnoCompiler = "iscc.exe",
    [string]$SevenZipPath = "",
    [string]$ClientLogoPath = ""
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$launcherProject = Join-Path $repoRoot "launcher\Launcher.csproj"
$publishDir = Join-Path $repoRoot "launcher\bin\publish\$Runtime"
$toolsDir = Join-Path $repoRoot "launcher\tools"
$installerScript = Join-Path $repoRoot "installer\VIZZIOLauncher.iss"
$artifactsDir = Join-Path $repoRoot "installer\artifacts"

New-Item -ItemType Directory -Force -Path $publishDir | Out-Null
New-Item -ItemType Directory -Force -Path $toolsDir | Out-Null
New-Item -ItemType Directory -Force -Path $artifactsDir | Out-Null

function Resolve-SevenZipExecutable {
    param([string]$RequestedPath)

    if ($RequestedPath) {
        return (Resolve-Path $RequestedPath).Path
    }

    $toolCandidates = @(
        (Join-Path $toolsDir "7za.exe"),
        (Join-Path $toolsDir "7z.exe")
    )

    foreach ($candidate in $toolCandidates) {
        if (Test-Path -LiteralPath $candidate) {
            return (Resolve-Path $candidate).Path
        }
    }

    $installedCandidates = @(
        "C:\Program Files\7-Zip\7z.exe",
        "C:\Program Files (x86)\7-Zip\7z.exe"
    )

    foreach ($candidate in $installedCandidates) {
        if (Test-Path -LiteralPath $candidate) {
            return $candidate
        }
    }

    $pathCommand = Get-Command "7z.exe" -ErrorAction SilentlyContinue
    if ($pathCommand) {
        return $pathCommand.Source
    }

    $pathStandaloneCommand = Get-Command "7za.exe" -ErrorAction SilentlyContinue
    if ($pathStandaloneCommand) {
        return $pathStandaloneCommand.Source
    }

    return ""
}

$resolvedSevenZip = Resolve-SevenZipExecutable -RequestedPath $SevenZipPath
if (-not $resolvedSevenZip) {
    throw "7z extraction support is required for VIZZIO launcher packages. Install 7-Zip or pass -SevenZipPath."
}

$sevenZipFileName = Split-Path $resolvedSevenZip -Leaf
if ($sevenZipFileName -notin @("7z.exe", "7za.exe")) {
    $sevenZipFileName = "7z.exe"
}
Copy-Item -LiteralPath $resolvedSevenZip -Destination (Join-Path $toolsDir $sevenZipFileName) -Force

dotnet publish $launcherProject `
    --configuration $Configuration `
    --runtime $Runtime `
    --self-contained true `
    --output $publishDir `
    /p:Version=$Version `
    /p:AssemblyVersion=$Version `
    /p:FileVersion=$Version `
    /p:PublishSingleFile=false `
    /p:PublishReadyToRun=true

$publishedSevenZip = Get-ChildItem -Path $publishDir -Filter "7z*.exe" -File -ErrorAction SilentlyContinue
if (-not $publishedSevenZip) {
    throw "Launcher publish output is missing 7z.exe or 7za.exe. The installer would not extract .7z packages on user PCs."
}

if ($ClientLogoPath) {
    $resolvedClientLogo = Resolve-Path $ClientLogoPath
    $logoItem = Get-Item -LiteralPath $resolvedClientLogo
    $allowedLogoExtensions = @(".png", ".jpg", ".jpeg", ".ico")
    $logoExtension = $logoItem.Extension.ToLowerInvariant()

    if ($allowedLogoExtensions -notcontains $logoExtension) {
        throw "Client logo must be PNG, JPG, JPEG, or ICO."
    }

    if ($logoItem.Length -gt 5MB) {
        throw "Client logo must be 5 MB or smaller."
    }

    $brandingDir = Join-Path $publishDir "branding"
    New-Item -ItemType Directory -Force -Path $brandingDir | Out-Null

    $packagedLogoName = "logo$logoExtension"
    Copy-Item -LiteralPath $resolvedClientLogo -Destination (Join-Path $brandingDir $packagedLogoName) -Force

    $brandingConfig = @{
        logoPath = "branding/$packagedLogoName"
    } | ConvertTo-Json
    Set-Content -LiteralPath (Join-Path $publishDir "launcher-branding.json") -Value $brandingConfig -Encoding UTF8
}

$env:VIZZIO_LAUNCHER_VERSION = $Version

try {
    & $InnoCompiler $installerScript
} catch {
    throw "Inno Setup compiler was not found or failed. Install Inno Setup and ensure iscc.exe is on PATH, or pass -InnoCompiler."
}

Write-Host "Installer artifacts written to $artifactsDir"
