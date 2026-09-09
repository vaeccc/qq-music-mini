$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$ManifestPath = Join-Path $RepoRoot "manifest.json"
$Manifest = Get-Content $ManifestPath -Raw | ConvertFrom-Json
$Version = $Manifest.version

$DistDir = Join-Path $RepoRoot "dist"
$StageDir = Join-Path $DistDir "qq-music-mini-$Version"
$ZipPath = Join-Path $DistDir "qq-music-mini-$Version-store.zip"

if (Test-Path $StageDir) { Remove-Item $StageDir -Recurse -Force }
if (Test-Path $ZipPath) { Remove-Item $ZipPath -Force }
New-Item -ItemType Directory -Path $StageDir -Force | Out-Null

$Files = @(
  "manifest.json",
  "background.js"
)

$Directories = @(
  "api",
  "popup",
  "offscreen",
  "storage",
  "icons"
)

foreach ($File in $Files) {
  Copy-Item (Join-Path $RepoRoot $File) (Join-Path $StageDir $File) -Force
}

foreach ($Directory in $Directories) {
  Copy-Item (Join-Path $RepoRoot $Directory) (Join-Path $StageDir $Directory) -Recurse -Force
}

Compress-Archive -Path (Join-Path $StageDir "*") -DestinationPath $ZipPath -CompressionLevel Optimal

Write-Host "Store package created: $ZipPath"
Write-Host "Version: $Version"
