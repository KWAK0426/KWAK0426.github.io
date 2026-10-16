@echo off
rem Run daily at 05:00 by Task Scheduler: check Google Drive, make viewer files, compute Z_est/GSD, push if changed.
rem Log: tools\mosaic\update.log
cd /d "%~dp0"
if not exist node_modules call npm install --no-audit --no-fund
node --disable-warning=ExperimentalWarning update.mjs --push
