# Build and install Android app on USB physical device.
# Default: Wi-Fi LAN IP (works for app + phone browser). Also sets adb reverse as backup.
# Prerequisite: run .\scripts\dev-server.ps1 in another terminal
# Usage:
#   .\scripts\run-device.ps1
#   .\scripts\run-device.ps1 -LanIp 10.151.108.30
#   .\scripts\run-device.ps1 -UseAdbReverse

param(
    [string]$LanIp = "",
    [switch]$UseAdbReverse
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

function Get-WifiLanIp {
    $wifi = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object {
            $_.InterfaceAlias -match "Wi-?Fi|WLAN" -and
            $_.IPAddress -notlike "127.*" -and
            $_.IPAddress -notlike "169.254.*"
        } |
        Select-Object -First 1
    if ($wifi) { return $wifi.IPAddress }

    $fallback = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object {
            $_.IPAddress -match "^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)" -and
            $_.InterfaceAlias -notmatch "vEthernet|Virtual|WSL|Hyper-V|VMware|Loopback|Ethernet 3" -and
            $_.IPAddress -notlike "169.254.*"
        } |
        Select-Object -First 1
    return $fallback.IPAddress
}

function Ensure-CleartextDomain([string]$ip) {
    $xmlPath = Join-Path $Root "app\src\local\res\xml\network_security_config.xml"
    if (-not (Test-Path $xmlPath)) { return }
    $text = Get-Content $xmlPath -Raw
    if ($text -notmatch [regex]::Escape($ip)) {
        $insert = "        <domain includeSubdomains=`"true`">$ip</domain>`r`n"
        $updated = $text -replace "(</domain-config>)", "$insert`$1"
        Set-Content -Path $xmlPath -Value $updated -NoNewline
        Write-Host "==> Added $ip to network_security_config.xml" -ForegroundColor DarkGray
    }
}

$adb = Get-AdbPath

$serials = @(& $adb devices | ForEach-Object {
    if ($_ -match "^(\S+)\s+device$" -and $Matches[1] -notmatch "^emulator-") {
        $Matches[1]
    }
})
if (-not $serials) {
    throw "No physical device detected. Enable USB debugging and run: adb devices"
}

$serial = $serials | Where-Object { $_ -notmatch "adb-|\._tcp|:5555" } | Select-Object -First 1
if (-not $serial) { $serial = $serials[0] }
Write-Host "==> Using device $serial" -ForegroundColor Cyan

& $adb -s $serial reverse tcp:3000 tcp:3000 | Out-Null
Write-Host "==> adb reverse tcp:3000 restored" -ForegroundColor DarkGray

if ($UseAdbReverse) {
    $apiUrl = "http://127.0.0.1:3000/"
    Write-Host "==> USB reverse mode: $apiUrl" -ForegroundColor Cyan
} else {
    if (-not $LanIp) { $LanIp = Get-WifiLanIp }
    if (-not $LanIp) {
        Write-Host "WARNING: No Wi-Fi IP found - falling back to adb reverse only" -ForegroundColor Yellow
        $apiUrl = "http://127.0.0.1:3000/"
    } else {
        Ensure-CleartextDomain $LanIp
        $apiUrl = "http://${LanIp}:3000/"
        Write-Host "==> LAN mode: $apiUrl" -ForegroundColor Green
        Write-Host "    Phone browser: $apiUrl" -ForegroundColor Cyan
        Write-Host "    Phone + PC must be on the same Wi-Fi." -ForegroundColor DarkGray
    }
}

Write-Host "==> Building and installing localDebug (apiBaseUrl=$apiUrl)" -ForegroundColor Green
Push-Location $Root
try {
    $env:ANDROID_SERIAL = $serial
    & .\gradlew.bat installLocalDebug "-PapiBaseUrl=$apiUrl"
    if ($LASTEXITCODE -ne 0) { throw "Gradle install failed." }

    Write-Host "==> Launching com.blockvote.android" -ForegroundColor Green
    & $adb -s $serial shell am start -n com.blockvote.android/.MainActivity
    Write-Host ""
    Write-Host "Open on phone browser: $apiUrl" -ForegroundColor Cyan
}
finally {
    Pop-Location
}
