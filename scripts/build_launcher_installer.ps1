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

if ($SevenZipPath) {
    $resolvedSevenZip = Resolve-Path $SevenZipPath
    Copy-Item -LiteralPath $resolvedSevenZip -Destination (Join-Path $toolsDir "7za.exe") -Force
}

dotnet publish $launcherProject `
    --configuration $Configuration `
    --runtime $Runtime `
    --self-contained true `
    --output $publishDir `
    /p:PublishSingleFile=false `
    /p:PublishReadyToRun=true

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
