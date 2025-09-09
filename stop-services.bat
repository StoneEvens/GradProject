@echo off
REM Stop all PetApp services manually

echo Stopping PetApp services...

echo.
echo Stopping Django backend...
taskkill /f /im "python.exe" >nul 2>&1
if %errorlevel%==0 (echo Django stopped successfully) else (echo No Django process found)

echo.
echo Stopping Vite frontend...
taskkill /f /im "node.exe" >nul 2>&1
if %errorlevel%==0 (echo Vite stopped successfully) else (echo No Vite process found)

echo.
echo Stopping Nginx...
taskkill /f /im "nginx.exe" >nul 2>&1
if %errorlevel%==0 (echo Nginx stopped successfully) else (echo No Nginx process found)

echo.
echo All services stopped.
pause
