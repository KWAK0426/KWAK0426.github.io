@echo off
setlocal
rem Update the mosaic viewer now (same as the daily 05:00 run).
cd /d "%~dp0tools\mosaic"
if not exist node_modules (
  echo Installing libraries once...
  call npm install --no-audit --no-fund
)
echo Checking Google Drive folder and updating the mosaic viewer...
node --disable-warning=ExperimentalWarning update.mjs --push
echo.
echo Log: tools\mosaic\update.log
pause
