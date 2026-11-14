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
echo Starting the OpusMC server for your local network...
echo All devices on the same Wi-Fi must open the SAME "local network address" printed below.
echo If Windows Firewall asks, allow Node.js on Private networks.
echo Full guide: docs\deployment\LAN.md
echo.
node server\index.mjs --lan
set EXITCODE=%ERRORLEVEL%
if not "%EXITCODE%"=="0" (
  echo.
  echo The server exited with code %EXITCODE%. See docs\deployment\LAN.md.
  pause
)
endlocal
