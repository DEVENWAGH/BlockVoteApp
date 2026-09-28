# Build a sideloadable BlockVote APK that talks to the live server.
# The prodDebug APK is signed with the debug keystore so a friend can install it
# without a Play Store release key.
#
# Usage:
#   .\scripts\build-share-apk.ps1
#   .\scripts\build-share-apk.ps1 -ApiBaseUrl https://www.devz.co.in/

param(
    [string]$ApiBaseUrl = "https://www.devz.co.in/",
    [string]$OutDir = "$env:USERPROFILE\Downloads"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

if (-not $ApiBaseUrl.EndsWith("/")) {
    $ApiBaseUrl = "$ApiBaseUrl/"
}

Write-Host "==> Building prodDebug APK for $ApiBaseUrl" -ForegroundColor Green
Push-Location $Root
try {
    & .\gradlew.bat assembleProdDebug "-PapiBaseUrl=$ApiBaseUrl" --no-daemon
    if ($LASTEXITCODE -ne 0) {
        throw "Gradle assembleProdDebug failed (exit $LASTEXITCODE)."
    }

    $apkDir = Join-Path $Root "app\build\outputs\apk\prod\debug"
    $apk = Get-ChildItem -Path $apkDir -Filter "*.apk" | Select-Object -First 1
    if (-not $apk) {
        throw "APK not found in $apkDir"
    }

    if (-not (Test-Path $OutDir)) {
        New-Item -ItemType Directory -Path $OutDir | Out-Null
    }

    $dest = Join-Path $OutDir "BlockVote-devz.apk"
    Copy-Item -Path $apk.FullName -Destination $dest -Force
    $sizeMb = [math]::Round((Get-Item $dest).Length / 1MB, 1)

    Write-Host ""
    Write-Host "APK ready: $dest" -ForegroundColor Green
    Write-Host "Server:    $ApiBaseUrl"
    Write-Host "Size:      $sizeMb MB"
    Write-Host "Install:   send the file, then open it on the phone and allow unknown apps."
}
finally {
    Pop-Location
}
