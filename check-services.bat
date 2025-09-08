@echo off
REM Check which PetApp services are currently running

echo Checking PetApp service status...
echo.

echo Django Backend (python.exe):
tasklist /fi "imagename eq python.exe" /fo table | findstr "python.exe"
if %errorlevel%==1 echo   Not running

echo.
echo Vite Frontend (node.exe):
tasklist /fi "imagename eq node.exe" /fo table | findstr "node.exe"
if %errorlevel%==1 echo   Not running

echo.
echo Nginx (nginx.exe):
tasklist /fi "imagename eq nginx.exe" /fo table | findstr "nginx.exe"
if %errorlevel%==1 echo   Not running

echo.
echo Port usage:
echo Django (8000):
netstat -an | findstr :8000
echo Vite (5173):
netstat -an | findstr :5173
echo Nginx (443):
netstat -an | findstr :443

pause
