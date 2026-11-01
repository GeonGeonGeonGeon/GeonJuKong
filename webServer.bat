@echo off
setlocal
cd /d "%~dp0"
if errorlevel 1 goto error

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js 20 or later is required. Install Node.js and try again.
  goto error
)

set PORT=4173
echo Starting GeonJuKong at http://localhost:4173
echo Keep this window open. Press Ctrl+C to stop the server.
node --preserve-symlinks --preserve-symlinks-main scripts/serve.mjs --open
if errorlevel 1 goto error
exit /b 0

:error
echo Could not start the server. Check the messages above.
pause
exit /b 1
