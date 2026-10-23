@echo off
set "PATH=%LOCALAPPDATA%\Programs\Git\cmd;%PATH%"
echo ========================================================
echo Pushing NeuroScreen-PD to https://github.com/Amar-spe/neuroscreen-pd
echo ========================================================
git push -u origin main
pause
