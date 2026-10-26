@echo off
title BANCRUPT lokalus serveris
cd /d "%~dp0server"
echo Paleidziamas BANCRUPT serveris...
echo Atidaryk narsykleje: http://localhost:3000
echo Sustabdyti: uzdaryk si langa arba spausk Ctrl+C
echo.
npm start
pause
