@echo off
REM PetApp Service Manager - Complete service management for Django + Vite + Nginx
REM Usage: petapp.bat [start|stop|status|restart]

title PetApp Service Manager

if "%1"=="stop" goto :stop
if "%1"=="status" goto :status  
if "%1"=="restart" goto :restart
if "%1"=="start" goto :start
if "%1"=="" goto :start

echo Usage: %0 [start^|stop^|status^|restart]
echo.
echo Commands:
echo   start   - Start all services (default)
echo   stop    - Stop all services
echo   status  - Check service status
echo   restart - Restart all services
echo.
pause
exit /b

:start
cls
echo ========================================
echo          PetApp Service Manager
echo ========================================
echo.

REM Stop any existing services first
echo Cleaning up existing services...
call :stop_quiet

REM Set paths
set BACKEND_PATH=c:\Users\GeniusBee\GradProject\backend
set FRONTEND_PATH=c:\Users\GeniusBee\GradProject\frontend

echo Starting services...
echo.

REM Start Django backend
echo [1/3] Django Backend (port 8000)...
cd /d "%BACKEND_PATH%"
start /min "" python manage.py runserver 127.0.0.1:8000 --noreload
echo     Status: Starting...

REM Wait and start Vite frontend
timeout /t 3 /nobreak >nul
echo [2/3] Vite Frontend (port 4173)...
cd /d "%FRONTEND_PATH%"  
start /min "" npm run preview
echo     Status: Starting...

REM Wait and start Nginx
timeout /t 3 /nobreak >nul
echo [3/3] Nginx Reverse Proxy (port 443)...

REM Ensure nginx directories exist and copy config
if not exist "C:\nginx\logs" mkdir "C:\nginx\logs"
copy /Y "%~dp0nginx.conf" "C:\nginx\conf\nginx.conf" >nul 2>&1
if errorlevel 1 (
    echo     Error: Failed to copy nginx configuration
    pause
    exit /b 1
)

cd /d "C:\nginx"
start /min "" "C:\nginx\nginx.exe"
echo     Status: Starting...

REM Final wait for all services to initialize
timeout /t 4 /nobreak >nul

echo.
echo ========================================
echo            Services Ready!
echo ========================================
echo.
echo  🌐 Website:  https://petapp.geniusbee.net
echo  🔧 API:      https://petapp.geniusbee.net/api/v1
echo  ⚙️  Admin:    https://petapp.geniusbee.net/admin
echo.
echo  Local Development URLs:
echo  📦 Django:   http://127.0.0.1:8000
echo  ⚛️  Vite:     http://127.0.0.1:4173
echo.
echo ========================================
echo Commands: petapp stop ^| petapp status
echo Press any key to STOP all services...
echo ========================================
pause >nul
goto :stop

:stop
echo.
echo Stopping all services...
taskkill /f /im "python.exe" >nul 2>&1 && echo ✓ Django stopped || echo ✗ Django not running
taskkill /f /im "node.exe" >nul 2>&1 && echo ✓ Vite stopped || echo ✗ Vite not running  
taskkill /f /im "nginx.exe" >nul 2>&1 && echo ✓ Nginx stopped || echo ✗ Nginx not running
echo.
echo All services stopped.
if "%1"=="stop" exit /b
echo.
pause
exit /b

:stop_quiet
taskkill /f /im "python.exe" >nul 2>&1
taskkill /f /im "node.exe" >nul 2>&1
taskkill /f /im "nginx.exe" >nul 2>&1
exit /b

:status
cls
echo ========================================
echo          Service Status Check
echo ========================================
echo.

echo Django Backend (python.exe):
tasklist /fi "imagename eq python.exe" /fo table 2>nul | findstr "python.exe" && echo ✓ Running || echo ✗ Not running
echo.

echo Vite Frontend (node.exe):
tasklist /fi "imagename eq node.exe" /fo table 2>nul | findstr "node.exe" && echo ✓ Running || echo ✗ Not running
echo.

echo Nginx (nginx.exe):
tasklist /fi "imagename eq nginx.exe" /fo table 2>nul | findstr "nginx.exe" && echo ✓ Running || echo ✗ Not running
echo.

echo Port Status:
echo Django (8000): 
netstat -an 2>nul | findstr ":8000 " && echo ✓ Port active || echo ✗ Port inactive
echo Vite (5173):
netstat -an 2>nul | findstr ":5173 " && echo ✓ Port active || echo ✗ Port inactive  
echo Nginx (443):
netstat -an 2>nul | findstr ":443 " && echo ✓ Port active || echo ✗ Port inactive
echo.
echo ========================================
pause
exit /b

:restart
echo Restarting all services...
call :stop_quiet
timeout /t 2 /nobreak >nul
goto :start
