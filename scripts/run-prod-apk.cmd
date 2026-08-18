@echo off
REM Installs APK pointed at https://www.devz.co.in/
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run-prod-apk.ps1" %*
