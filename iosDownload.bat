@echo off
cd /d "%~dp0"
if errorlevel 1 exit /b 1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\ios-download.ps1" "%~1"
set "download_result=%errorlevel%"
pause
exit /b %download_result%
