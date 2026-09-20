@echo off
rem 一键停止 3000 主站与 3001 后台,按端口找进程,未运行则跳过
cd /d "%~dp0"

call :kill_port 3000 "主站"
call :kill_port 3001 "后台"
if /i not "%~1"=="--no-pause" pause
exit /b 0

rem ---------- 子过程:杀掉监听该端口的所有进程 ----------
:kill_port
set "found="
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /r /c:":%~1 .*LISTENING"') do (
  taskkill /f /pid %%p >nul 2>&1
  echo [停止] %~2 %~1 PID %%p
  set found=1
)
if not defined found echo [跳过] %~2 %~1 未在运行
exit /b 0
