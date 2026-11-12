@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install Node.js 20 or newer, then run this script again.
  pause
  exit /b 1
)
echo Starting the OpusMC server...
echo Close this window or press Ctrl+C to stop and save every room.
echo.
node server\index.mjs
set EXITCODE=%ERRORLEVEL%
if not "%EXITCODE%"=="0" (
  echo.
  echo The server exited with code %EXITCODE%. If the port is busy, edit server\config.json.
  pause
)
endlocal
