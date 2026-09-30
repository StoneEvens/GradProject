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
REM Paths are relative to this script, so it works on any machine
set BACKEND_PATH=%~dp0backend
set FRONTEND_PATH=%~dp0frontend

REM Always use the project's Python venv (one folder above this script)
set VENV_PATH=%~dp0..\.venv
if not exist "%VENV_PATH%\Scripts\activate.bat" (
    echo     Error: Python venv not found at %VENV_PATH%
    echo     Create it with: python -m venv "%VENV_PATH%"
    pause
    exit /b 1
)
call "%VENV_PATH%\Scripts\activate.bat"
echo Using Python venv: %VENV_PATH%

REM Local testing: backend AI agent talks to the local MCP server, not the domain
set MCP_SERVER_URL=http://127.0.0.1:5000
REM Frontend API address (overrides VITE_API_URL in frontend\.env files).
REM Relative path: Vite forwards /api to Django, so it works locally and via the domain.
set VITE_API_URL=/api/v1
REM Store uploaded images on this machine (backend\uploaded_images) instead of Firebase
set IMAGE_STORAGE_BACKEND=local
REM Absolute image links, so the frontend hosted on the VPS can load them
set PUBLIC_MEDIA_BASE_URL=https://peter.hodgepodge-studio.com

echo Starting services...
echo.

REM Start Django backend with ASGI support
echo [1/4] Django Backend (port 8000)...
cd /d "%BACKEND_PATH%"
start /min "" python -m uvicorn gradProject.asgi:application --host 127.0.0.1 --port 8000
echo     Status: Starting...

REM Start MCP server
echo [2/4] MCP Server (port 5000)...
cd /d "%BACKEND_PATH%"
REM Output goes to backend\logs\mcp_server.log so startup errors are not lost
start "MCP Server" /min cmd /c "python -m mcp_server.start > logs\mcp_server.log 2>&1"
echo     Status: Starting...

REM Wait and start Vite frontend
timeout /t 3 /nobreak >nul
echo [3/4] Vite Frontend (port 4173)...
cd /d "%FRONTEND_PATH%"  
REM dev server reads frontend\.env (VITE_API_URL); preview would serve the old prebuilt dist
start /min "" npm run dev
echo     Status: Starting...

REM Wait and start Nginx
timeout /t 3 /nobreak >nul
echo [4/4] Nginx Reverse Proxy (port 8080)...

if not exist "C:\nginx\nginx.exe" (
    echo     Skipped: C:\nginx\nginx.exe not found
    goto :nginx_done
)
REM Ensure nginx directories exist and copy config (nginx.conf is gitignored,
REM so it may not exist on this machine - fall back to the existing config)
if not exist "C:\nginx\logs" mkdir "C:\nginx\logs"
if exist "%~dp0nginx.conf" (
    copy /Y "%~dp0nginx.conf" "C:\nginx\conf\nginx.conf" >nul 2>&1
    if errorlevel 1 echo     Warning: Failed to copy nginx.conf, using existing config
) else (
    echo     Note: no nginx.conf in project, using C:\nginx\conf\nginx.conf
)

cd /d "C:\nginx"
start /min "" "C:\nginx\nginx.exe"
echo     Status: Starting...
:nginx_done

REM Final wait for all services to initialize
timeout /t 4 /nobreak >nul

echo.
echo ========================================
echo            Services Ready!
echo ========================================
echo.
echo Website:  https://peter.hodgepodge-studio.com   (via Cloudflare Tunnel)
echo API:      https://peter.hodgepodge-studio.com/api/v1
echo Admin:    https://peter.hodgepodge-studio.com/admin
echo.
echo  Local Development URLs:
echo Django:   http://127.0.0.1:8000
echo MCP:      http://127.0.0.1:5000   (local only, not exposed)
echo Nginx:    http://127.0.0.1:8080   (unified entry point)
echo Vite:     http://127.0.0.1:4173
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
taskkill /f /fi "windowtitle eq Django*" /im "python.exe" >nul 2>&1 && echo ✓ Django stopped || echo ✗ Django not running
taskkill /f /fi "windowtitle eq MCP*" /im "python.exe" >nul 2>&1 && echo ✓ MCP Server stopped || echo ✗ MCP Server not running
taskkill /f /im "node.exe" >nul 2>&1 && echo ✓ Vite stopped || echo ✗ Vite not running  
taskkill /f /im "nginx.exe" >nul 2>&1 && echo ✓ Nginx stopped || echo ✗ Nginx not running
echo.
echo All services stopped.
if "%1"=="stop" exit /b
echo.
pause
exit /b

:stop_quiet
taskkill /f /fi "windowtitle eq Django*" /im "python.exe" >nul 2>&1
taskkill /f /fi "windowtitle eq MCP*" /im "python.exe" >nul 2>&1
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

echo MCP Server (python.exe):
tasklist /fi "windowtitle eq MCP*" /fi "imagename eq python.exe" /fo table 2>nul | findstr "python.exe" && echo ✓ Running || echo ✗ Not running
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
echo MCP (5000):
netstat -an 2>nul | findstr ":5000 " && echo ✓ Port active || echo ✗ Port inactive
echo Vite (4173):
netstat -an 2>nul | findstr ":4173 " && echo ✓ Port active || echo ✗ Port inactive  
echo Nginx (8080):
netstat -an 2>nul | findstr ":8080 " && echo ✓ Port active || echo ✗ Port inactive
echo.
echo ========================================
pause
exit /b

:restart
echo Restarting all services...
call :stop_quiet
timeout /t 2 /nobreak >nul
goto :start
