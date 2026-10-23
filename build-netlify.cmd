@echo off
cd /d "%~dp0"
set /p GAME_SERVER_URL=Masukkan URL WebSocket Render (wss://nama-server.onrender.com): 
node build-netlify.mjs
if errorlevel 1 pause
