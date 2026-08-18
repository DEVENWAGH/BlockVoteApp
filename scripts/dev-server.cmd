@echo off
REM Starts Hardhat + Next.js on :3000
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0dev-server.ps1" %*
