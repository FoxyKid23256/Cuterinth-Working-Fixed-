@echo off

:: Check for administrator privileges
openfiles >nul 2>&1
if %errorlevel% neq 0 (
    echo Requesting administrator privileges...
    powershell -Command "Start-Process '%~f0' -Verb RunAs" >nul 2>&1
    exit
)

:: Set the download URL and output file name
set "NODE_URL=https://nodejs.org/dist/v20.14.0/node-v20.14.0-x64.msi"
set "OUTPUT_FILE=%TEMP%\node-installer.msi"
set "LOG_FILE=%TEMP%\node-install.log"

:: Download the Node.js installer
echo Downloading Node.js 20...
powershell -Command "(New-Object System.Net.WebClient).DownloadFile('%NODE_URL%', '%OUTPUT_FILE%')"

:: Run the installer with a progress bar and logging
echo Installing Node.js 20...
echo A detailed log will be saved to %LOG_FILE%
msiexec /i "%OUTPUT_FILE%" /qb /L*v "%LOG_FILE%" /norestart

:: Clean up the downloaded file
echo Cleaning up...
del "%OUTPUT_FILE%"

echo.
echo Node.js 20 has been installed.
echo.
echo Installation log saved to: %LOG_FILE%
pause