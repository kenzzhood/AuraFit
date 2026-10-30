@echo off
setlocal EnableExtensions
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 goto :nonode

if not exist "node_modules\next\dist\bin\next" goto :install
goto :run

:install
echo.
echo First run: installing dependencies. This step needs the internet.
echo After this, the stall runs offline except for live Azure generation.
echo.
call npm.cmd install
if errorlevel 1 goto :installfail

:run
echo.
echo Starting Autofit.
echo Chrome opens at http://localhost:3000/stall when the stall is ready.
echo Leave this window open. Close it to stop the stall.
echo.
start "Autofit browser" /min node "%~dp0scripts\open-stall-browser.mjs"
call npm.cmd run stall
echo.
echo The stall server stopped.
pause
exit /b 0

:installfail
echo.
echo npm install failed. Connect to the internet and double-click this file again.
pause
exit /b 1

:nonode
echo.
echo Node.js is not installed.
echo Install the LTS version from https://nodejs.org/ and then double-click this file again.
echo.
start "" "https://nodejs.org/"
pause
exit /b 1
