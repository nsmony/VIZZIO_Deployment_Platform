$ErrorActionPreference = 'Stop'

$documentationRoot = Split-Path -Parent $PSScriptRoot
$repositoryRoot = Split-Path -Parent $documentationRoot
$sourceRoot = Join-Path $repositoryRoot 'docs'
$contentRoot = Join-Path $documentationRoot 'content\docs'

$documents = @(
  @{ Source = 'deployment-prerequisites.md'; Destination = 'getting-started\deployment-prerequisites.md'; Title = '03 Deployment Prerequisites'; Description = 'Software, environment, network, and service requirements for deploying the VIZZIO platform.' },
  @{ Source = 'hosted-pc-prerequisites.md'; Destination = 'getting-started\hosted-pc-prerequisites.md'; Title = '04 Hosted PC Prerequisites'; Description = 'Requirements and configuration guidance for the hosted Windows PC environment.' },
  @{ Source = 'architecture.md'; Destination = 'architecture\architecture.md'; Title = '05 System Architecture'; Description = 'Architecture, components, data flow, and deployment topology of the VIZZIO platform.' },
  @{ Source = 'diagrams.md'; Destination = 'architecture\diagrams.md'; Title = '06 Diagrams'; Description = 'System, user-flow, use-case, and download-pipeline diagrams for the VIZZIO platform.' },
  @{ Source = 'admin-user-guide.md'; Destination = 'administration\admin-user-guide.md'; Title = '07 Admin User Guide'; Description = 'Practical guidance for administrators managing users, deployments, versions, and platform operations.' },
  @{ Source = 'code-documentation-audit-2026-07-27.md'; Destination = 'development\code-documentation.md'; Title = '08 Code Documentation'; Description = 'Code and documentation audit findings, validation evidence, and remaining engineering gaps.' },
  @{ Source = 'full-requirements-audit-2026-07-23.md'; Destination = 'development\full-requirements-audit.md'; Title = '09 Full Requirements Audit'; Description = 'Requirements coverage, validation signals, hardened capabilities, and remaining sign-off gaps.' },
  @{ Source = 'implementation-verification.md'; Destination = 'development\implementation-verification.md'; Title = '10 Implementation Verification'; Description = 'Executable verification results and implementation coverage for the VIZZIO platform.' },
  @{ Source = 'launcher-installation.md'; Destination = 'launcher\launcher-installation.md'; Title = '11 Building the Launcher Installer'; Description = 'Prerequisites, configuration, build command, and distribution output for the VIZZIO Windows launcher installer.' },
  @{ Source = 'launcher-self-update.md'; Destination = 'launcher\launcher-self-update.md'; Title = '12 Launcher Self-Update'; Description = 'Configuration and behavior of the VIZZIO Windows launcher self-update mechanism.' },
  @{ Source = 'launcher-error-reporting.md'; Destination = 'launcher\launcher-error-reporting.md'; Title = '13 Launcher Error Reporting'; Description = 'Launcher diagnostics, error reporting, administration, and operational considerations.' },
  @{ Source = 'operations-publishing-guide.md'; Destination = 'operations\operations-publishing.md'; Title = '14 Operations and Publishing'; Description = 'Safe operational workflow for publishing, validating, and rolling back VIZZIO releases.' },
  @{ Source = 'configuration-and-production-handover.md'; Destination = 'operations\configuration-and-production-handover.md'; Title = '15 Configuration and Production Handover'; Description = 'Authoritative configuration, acceptance testing, production deployment, validation, and rollback checklist.' },
  @{ Source = 'handover-document.md'; Destination = 'reference\handover-documentation.md'; Title = '16 Handover Documentation'; Description = 'System ownership, operational procedures, risks, configuration, and support handover guidance.' }
)

foreach ($document in $documents) {
  $sourcePath = Join-Path $sourceRoot $document.Source
  $destinationPath = Join-Path $contentRoot $document.Destination
  $destinationDirectory = Split-Path -Parent $destinationPath
  New-Item -ItemType Directory -Force -Path $destinationDirectory | Out-Null

  $content = Get-Content -Raw -LiteralPath $sourcePath
  # Remove source H1s because the page layout renders the frontmatter title.
  $content = $content -replace '^\uFEFF?#\s+Admin User Guide\s*\r?\n+', ''
  $content = $content -replace '^\uFEFF?#\s+Deployment prerequisites\s*\r?\n+', ''
  $content = $content -replace '^\uFEFF?#\s+Hosted PC prerequisites\s*\r?\n+', ''
  $content = $content -replace '^\uFEFF?#\s+Launcher self-update\s*\r?\n+', ''
  $content = $content -replace '^\uFEFF?#\s+Building the VIZZIO Launcher Installer\s*\r?\n+', ''
  $content = $content -replace '^\uFEFF?#\s+Launcher error reporting\s*\r?\n+', ''
  $content = $content -replace '^\uFEFF?#\s+Architecture Overview\s*\r?\n+', ''
  $content = $content -replace '^\uFEFF?#\s+VIZZIO Diagrams\s*\r?\n+', ''
  $content = $content -replace '^\uFEFF?#\s+Code and Documentation Audit \(2026-07-27\)\s*\r?\n+', ''
  $content = $content -replace '^\uFEFF?#\s+Full Requirements Audit \(2026-07-23\)\s*\r?\n+', ''
  $content = $content -replace '^\uFEFF?#\s+Implementation Verification \(2026-07-24\)\s*\r?\n+', ''
  $content = $content -replace '^\uFEFF?#\s+Handover Document\s*\r?\n+', ''
  $content = $content -replace '^\uFEFF?#\s+Operations Guide: Publishing a New Version\s*\r?\n+', ''
  $content = $content -replace '^\uFEFF?#\s+Configuration and Production Handover\s*\r?\n+', ''
  # The installed Shiki bundle does not include an `env` grammar.
  $content = $content -replace '```env', '```text'

  $frontmatter = "---`ntitle: `"$($document.Title)`"`ndescription: `"$($document.Description)`"`n---`n`n"
  Set-Content -LiteralPath $destinationPath -Value ($frontmatter + $content.TrimStart()) -Encoding UTF8
}

Write-Output "Migrated $($documents.Count) documents without modifying the source docs directory."
