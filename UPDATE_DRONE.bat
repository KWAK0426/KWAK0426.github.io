@echo off
setlocal
cd /d "%~dp0"
set "PY=python"
if exist "%USERPROFILE%\anaconda3\python.exe" set "PY=%USERPROFILE%\anaconda3\python.exe"
echo Copying the public drone dashboard into drone/ (privacy check included)...
"%PY%" -X utf8 tools\sync_drone.py
if errorlevel 1 goto failed
git status --short
git diff --stat
choice /m "Commit and push these changes to GitHub"
if errorlevel 2 exit /b 1
git add -A
git commit -m "drone: update public dashboard"
git push
if errorlevel 1 goto failed
echo Done. The site updates in about a minute.
pause
exit /b 0
:failed
echo Failed. Nothing was pushed.
pause
exit /b 1
