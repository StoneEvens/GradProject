# PetApp Domain Configuration Guide

This document outlines the configuration setup for running the PetApp on `petapp.hodgepodge-studio.com`.

## SSL Certificates
- Frontend: `frontend/hodgepodge-studio.com.pem` and `frontend/hodgepodge-studio.com-key.pem`
- Backend: `backend/hodgepodge-studio.com.pem` and `backend/hodgepodge-studio.com-key.pem`

## Domain Setup Requirements

### 1. DNS Configuration
Ensure your DNS records point to your server:
```
petapp.hodgepodge-studio.com A [YOUR-SERVER-IP]
```

### 2. Firewall Configuration
Open the necessary ports:
- Port 443 (HTTPS) for production
- Port 5173 (Frontend dev server)
- Port 8000 (Backend dev server)

## Development Environment

### Frontend (Vite + React)
- **URL**: https://petapp.hodgepodge-studio.com:5173
- **Port**: 5173
- **SSL**: Enabled with provided certificates
- **HMR**: Configured for the domain

### Backend (Django)
- **URL**: https://petapp.hodgepodge-studio.com:8000
- **Port**: 8000
- **SSL**: Enabled with django-sslserver
- **CORS**: Configured for the specific domain

## Quick Start

### Prerequisites
1. Install django-sslserver:
   ```powershell
   pip install -r requirements.txt
   ```

2. Ensure certificates are properly placed in both frontend and backend directories

### Running the Application

#### Option 1: Using the provided scripts
```powershell
# Terminal 1 - Backend
.\start_backend_domain.ps1

# Terminal 2 - Frontend
.\start_frontend_domain.ps1
```

#### Option 2: Manual commands
```powershell
# Backend
cd backend
python manage.py runsslserver --certificate hodgepodge-studio.com.pem --key hodgepodge-studio.com-key.pem 0.0.0.0:8000

# Frontend
cd frontend
npm run dev
```

## Production Configuration

### Environment Variables
For production, set these environment variables:
```bash
DJANGO_SETTINGS_MODULE=gradProject.settings_production
DJANGO_SECRET_KEY=your-super-secure-secret-key
```

### Security Features Enabled
- HTTPS redirect enforced
- HSTS headers configured
- XSS protection enabled
- Content type sniffing disabled
- Secure cookies for session and CSRF
- CORS restricted to specific domains

## API Endpoints
With domain configuration, your API will be accessible at:
- Base URL: https://petapp.hodgepodge-studio.com:8000/api/
- Authentication: https://petapp.hodgepodge-studio.com:8000/api/auth/
- Admin Panel: https://petapp.hodgepodge-studio.com:8000/admin/

## Troubleshooting

### Common Issues

1. **Certificate errors**: Ensure certificates are valid and properly named
2. **CORS errors**: Check CORS_ALLOWED_ORIGINS in settings.py
3. **Port conflicts**: Make sure ports 5173 and 8000 are available
4. **DNS issues**: Verify domain points to your server IP

### Logs
Check Django logs in:
- `backend/logs/django.log` - General application logs
- `backend/logs/auth.log` - Authentication logs  
- `backend/logs/error.log` - Error logs

## Notes

- The configuration supports both development and production environments
- SSL certificates should be renewed before expiration
- Consider using a reverse proxy (nginx/Apache) for production deployment
- For production, consider migrating from SQLite to PostgreSQL
