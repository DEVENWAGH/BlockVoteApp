# BlockVote local dev launcher
# MongoDB: use local mongod + Compass (scripts do NOT start Docker Mongo).
# Usage:
#   .\scripts\dev-all.ps1 server              # Hardhat + Next.js (needs local Mongo)
#   .\scripts\dev-all.ps1 emulator            # install & run on emulator
#   .\scripts\dev-all.ps1 device              # install & run on USB phone
#   .\scripts\dev-all.ps1 device -LanIp x.x.x.x

param(
    [Parameter(Mandatory = $true, Position = 0)]
    [ValidateSet("server", "emulator", "device")]
    [string]$Target,

    [string]$AvdName = "",
    [string]$LanIp = ""
)

$ScriptDir = $PSScriptRoot

switch ($Target) {
    "server" {
        & (Join-Path $ScriptDir "dev-server.ps1")
    }
    "emulator" {
        if ($AvdName) {
            & (Join-Path $ScriptDir "run-emulator.ps1") -AvdName $AvdName
        } else {
            & (Join-Path $ScriptDir "run-emulator.ps1")
        }
    }
    "device" {
        if ($LanIp) {
            & (Join-Path $ScriptDir "run-device.ps1") -LanIp $LanIp
        } else {
            & (Join-Path $ScriptDir "run-device.ps1")
        }
    }
}
