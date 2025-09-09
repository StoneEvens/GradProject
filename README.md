# PetApp Setup Guide

Complete setup guide for running Django backend + React frontend + Nginx reverse proxy.

## Quick Start

1. **Run the service manager:**
   ```cmd
   petapp.bat
   ```

2. **Access your app:**
   - 🌐 **Website**: https://petapp.geniusbee.net
   - 🔧 **API**: https://petapp.geniusbee.net/api/v1
   - ⚙️ **Admin**: https://petapp.geniusbee.net/admin

## Commands

```cmd
petapp.bat          # Start all services (default)
petapp.bat start    # Start all services
petapp.bat stop     # Stop all services
petapp.bat status   # Check service status
petapp.bat restart  # Restart all services
```

## Architecture

```
https://petapp.geniusbee.net → Nginx (Port 443) → Routes to:
├── /api/*    → Django Backend (Port 8000)
├── /admin/*  → Django Backend (Port 8000)
└── /*        → React Frontend (Port 5173)
```

## Prerequisites

### 1. Nginx Installation
- Download from: https://nginx.org/en/download.html
- Extract to `C:\nginx`

### 2. Nginx Configuration
```cmd
# Copy our config to nginx
copy "nginx.conf" "C:\nginx\conf\conf.d\petapp.conf"

# Add to C:\nginx\conf\nginx.conf inside http block:
include conf.d/*.conf;
```

## File Structure

```
GradProject/
├── petapp.bat          # 👈 Main service manager
├── nginx.conf          # 👈 Nginx configuration  
├── README.md           # 👈 This setup guide
├── backend/            # Django backend
├── frontend/           # React frontend
└── [other files...]
```

## Configuration Files

### Frontend Environment (`.env`)
```env
VITE_API_URL=https://petapp.geniusbee.net/api/v1
```

### Django Settings (Key parts)
```python
ALLOWED_HOSTS = ['petapp.geniusbee.net', 'localhost', '127.0.0.1']
USE_X_FORWARDED_HOST = True
USE_X_FORWARDED_PORT = True
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
```

## Troubleshooting

### Services not starting?
```cmd
petapp.bat status    # Check what's running
```

### Port conflicts?
```cmd
netstat -an | findstr "8000 5173 443"
```

### Nginx config issues?
```cmd
cd C:\nginx
nginx.exe -t    # Test configuration
```

## Benefits

✅ **Single command** to start/stop everything  
✅ **No port numbers** in URLs  
✅ **SSL termination** at Nginx  
✅ **Hot reload** preserved  
✅ **Cloudflare compatible**  

## Production Notes

For production, uncomment the production config block in `nginx.conf` and:
1. Build frontend: `npm run build`
2. Update nginx to serve from `dist` folder
3. Use Gunicorn for Django
4. Set `DEBUG = False`
