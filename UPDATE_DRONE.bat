@echo off
setlocal
cd /d "%~dp0"
set "PY=python"
if exist "%USERPROFILE%\anaconda3\python.exe" set "PY=%USERPROFILE%\anaconda3\python.exe"
echo Copying the public drone dashboard into drone/ (privacy check included)...
"%PY%" -X utf8 tools\sync_drone.py
if errorlevel 1 goto failed
"%PY%" -X utf8 tools\save.py
if errorlevel 1 goto failed
pause
exit /b 0
:failed
echo Failed. Nothing was uploaded.
pause
exit /b 1
