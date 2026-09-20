@echo off
rem cloudflared 未安装时给出明确提示,而不是静默失败
where cloudflared >nul 2>&1
if errorlevel 1 (
  echo [错误] 未找到 cloudflared,请先安装: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
  pause
  exit /b 1
)
cloudflared tunnel --config "%USERPROFILE%\.cloudflared\config.yml" run totoro >> "%~dp0cloudflared.log" 2>&1
