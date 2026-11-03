@echo off
cd /d "%~dp0"
if errorlevel 1 exit /b 1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\ios-build.ps1"
set "build_result=%errorlevel%"
pause
exit /b %build_result%
