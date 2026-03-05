@echo off
setlocal
cd /d "%~dp0"
title Labour App Runner

echo ===================================================
echo   Starting Labour App...
echo ===================================================

REM Free port 3000 aggressively (find PID by port and kill)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" ^| findstr LISTENING') do (
  echo Killing PID %%a on port 3000...
  taskkill /F /PID %%a >nul 2>nul
)
REM Also stop any stray Node.js processes
taskkill /F /IM node.exe >nul 2>nul

REM Open Chrome
start "" cmd /c "timeout /t 4 >nul && start chrome --new-window http://localhost:3000"

REM Start Server
if exist "node_modules\next\dist\bin\next" (
    node "node_modules\next\dist\bin\next" dev -H 0.0.0.0 --port 3000
) else (
    call npm install
    node "node_modules\next\dist\bin\next" dev -H 0.0.0.0 --port 3000
)

pause
