@echo off
rem ============================================================
rem  一键启动全部服务,双击即可:
rem    主站 3000 = 用户前端 + 后端 API,同一 Node 进程
rem    后台 3001 = 管理前端 + 管理代理,同一 Node 进程
rem  已在运行的服务自动跳过;启动后显示状态,按任意键关闭本窗口。
rem  以后装好 cloudflared,删除下面 tunnel 行的 rem 即可连同隧道一起启动。
rem ============================================================
cd /d "%~dp0"

call :ensure 3000 "主站" start-totoro-hidden.vbs
call :ensure 3001 "后台" start-totoro-admin-hidden.vbs
rem call :ensure 443 "隧道" start-totoro-tunnel-hidden.vbs

echo.
echo ===============================================
call :status 3000 "主站  http://localhost:3000"
call :status 3001 "后台  http://localhost:3001"
echo ===============================================
if /i not "%~1"=="--no-pause" pause
exit /b 0

rem ---------- 子过程:未运行才启动,最多等 20 秒 ----------
:ensure
netstat -ano | findstr /r /c:":%~1 .*LISTENING" >nul 2>&1
if not errorlevel 1 (
  echo [跳过] %~2 %~1 已在运行
  exit /b 0
)
echo [启动] %~2 %~1 ...
wscript.exe "%~dp0%~3"
set /a tries=0
:ensure_wait
ping -n 2 127.0.0.1 >nul
netstat -ano | findstr /r /c:":%~1 .*LISTENING" >nul 2>&1
if not errorlevel 1 exit /b 0
set /a tries+=1
if %tries% lss 20 goto ensure_wait
echo [失败] %~2 %~1 20 秒内未就绪,请查看 totoro-app.log 或 totoro-admin.log
exit /b 1

rem ---------- 子过程:打印端口状态 ----------
:status
netstat -ano | findstr /r /c:":%~1 .*LISTENING" >nul 2>&1
if errorlevel 1 (
  echo   [未运行] %~2
) else (
  echo   [运行中] %~2
)
exit /b 0
