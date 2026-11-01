@echo off
cd /d "%~dp0"
if errorlevel 1 goto error

call npm install --cache .npm-cache
if errorlevel 1 goto error

call npm run native:android
if errorlevel 1 goto error

echo Android project preparation completed.
pause
exit /b 0

:error
echo Command failed. Check the messages above.
pause
exit /b 1
