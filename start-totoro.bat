@echo off
cd /d "%~dp0totoro-paradise"
node .output\server\index.mjs >> "%~dp0totoro-app.log" 2>&1
