@echo off
rem 管理后台:totoro-admin,端口 3001
cd /d "%~dp0totoro-admin"
set PORT=3001
node .output\server\index.mjs >> "%~dp0totoro-admin.log" 2>&1
