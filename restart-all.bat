@echo off
rem 一键重启 = 停止全部 + 启动全部(改代码或重新 build 之后用它刷新服务)
cd /d "%~dp0"

call stop-all.bat --no-pause
call start-all.bat --no-pause
echo.
echo 提示:若页面行为没变化,请确认已在对应项目里执行过 pnpm build。
if /i not "%~1"=="--no-pause" pause
exit /b 0
