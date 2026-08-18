# Build & install Android app on emulator (API → host via 10.0.2.2:3000)
# Prerequisite: run .\scripts\dev-server.ps1 in another terminal
# Usage: .\scripts\run-emulator.ps1 [-AvdName "Pixel_7_API_34"]

param(
    [string]$AvdName = ""
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

function Get-EmulatorPath {
    $sdk = $env:ANDROID_HOME
    if (-not $sdk) { $sdk = "$env:LOCALAPPDATA\Android\Sdk" }
    $candidate = Join-Path $sdk "emulator\emulator.exe"
    if (Test-Path $candidate) { return $candidate }
    throw "emulator not found. Install Android Emulator via Android Studio."
}

$adb = Get-AdbPath
$emulator = Get-EmulatorPath

# Start emulator if none running
$devices = & $adb devices | Select-String "emulator-" | ForEach-Object { $_.Line.Split("`t")[0] }
if (-not $devices) {
    if (-not $AvdName) {
        $avds = & $emulator -list-avds
        if (-not $avds) { throw "No AVDs found. Create one in Android Studio > Device Manager." }
        $AvdName = $avds[0]
        Write-Host "==> Starting AVD: $AvdName" -ForegroundColor Cyan
    }
    Start-Process -FilePath $emulator -ArgumentList "-avd", $AvdName -WindowStyle Normal
    Write-Host "==> Waiting for emulator boot..." -ForegroundColor Yellow
    & $adb wait-for-device
    $deadline = (Get-Date).AddMinutes(3)
    do {
        Start-Sleep -Seconds 2
        $boot = & $adb shell getprop sys.boot_completed 2>$null
    } while ($boot.Trim() -ne "1" -and (Get-Date) -lt $deadline)
    if ($boot.Trim() -ne "1") { throw "Emulator boot timed out." }
}

Write-Host "==> Building & installing localDebug (apiBaseUrl=http://10.0.2.2:3000/)" -ForegroundColor Green
Push-Location $Root
try {
    & .\gradlew.bat installLocalDebug -PapiBaseUrl=http://10.0.2.2:3000/
    if ($LASTEXITCODE -ne 0) { throw "Gradle install failed." }

    Write-Host "==> Launching com.blockvote.android" -ForegroundColor Green
    & $adb shell am start -n com.blockvote.android/.MainActivity
    Write-Host ""
    Write-Host "Deep link test:" -ForegroundColor Cyan
    Write-Host "  adb shell am start -a android.intent.action.VIEW -d blockvote://vote/<electionId>" -ForegroundColor DarkGray
}
finally {
    Pop-Location
}
