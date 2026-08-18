# Build/install Android app against production API (https://www.devz.co.in/)
# Usage:
#   .\scripts\run-prod-apk.ps1
#   .\scripts\run-prod-apk.ps1 -ApiBaseUrl https://www.devz.co.in/

param(
    [string]$ApiBaseUrl = "https://www.devz.co.in/"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

function Get-AdbPath {
    $adb = Get-Command adb -ErrorAction SilentlyContinue
    if ($adb) { return $adb.Source }
    $sdk = $env:ANDROID_HOME
    if (-not $sdk) { $sdk = "$env:LOCALAPPDATA\Android\Sdk" }
    $candidate = Join-Path $sdk "platform-tools\adb.exe"
    if (Test-Path $candidate) { return $candidate }
    throw "adb not found. Install Android SDK platform-tools or set ANDROID_HOME."
}

$adb = Get-AdbPath
Write-Host "==> Building prodDebug → $ApiBaseUrl" -ForegroundColor Green
Push-Location $Root
try {
    & .\gradlew.bat installProdDebug "-PapiBaseUrl=$ApiBaseUrl"
    if ($LASTEXITCODE -ne 0) { throw "Gradle install failed." }
    & $adb shell am start -n com.blockvote.android/.MainActivity
    Write-Host "✅ Installed prod flavor (talks to live site / Sepolia via backend)" -ForegroundColor Green
}
finally {
    Pop-Location
}
