@echo off
REM Run from CMD or double-click. Forwards args to the PowerShell script.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run-emulator.ps1" %*
