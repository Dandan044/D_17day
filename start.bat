@echo off
cd /d "%~dp0"
title 七日之前
powershell -NoProfile -ExecutionPolicy Bypass -NoLogo -File "%~dp0start.ps1" %*
if errorlevel 1 pause
