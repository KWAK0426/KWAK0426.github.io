@echo off
setlocal
cd /d "%~dp0"
set "PY=python"
if exist "%USERPROFILE%\anaconda3\python.exe" set "PY=%USERPROFILE%\anaconda3\python.exe"
echo Get latest, then upload your changes with a one-line note (recorded in CHANGELOG.md).
"%PY%" -X utf8 tools\save.py %*
if errorlevel 1 (
  echo Failed. Nothing was uploaded. If it says "conflict", ask Claude or run: git status
  pause
  exit /b 1
)
pause
exit /b 0
