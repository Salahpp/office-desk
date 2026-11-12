@echo off
title Office Desk Server
echo ============================================================
echo   Starting Office Desk Enterprise PWA
echo   Opening: http://localhost:3000
echo ============================================================
timeout /t 1 /nobreak >nul
start http://localhost:3000
node server.js
pause
