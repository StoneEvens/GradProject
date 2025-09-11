"""
Production settings for gradProject.
"""
from .settings import *

# Override settings for production
DEBUG = False

ALLOWED_HOSTS = [
    'petapp.geniusbee.net',
    'localhost',
    '127.0.0.1',
    'geniusbee.net',
    '.geniusbee.net',  # Allows all subdomains
    '140.119.19.25',
]

# CORS configuration for production
CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOWED_ORIGINS = [
    "https://petapp.geniusbee.net",
    "https://geniusbee.net",
    "http://localhost:3000",  # Local development
    "http://localhost:5173",  # Vite default port
    "http://localhost:8000",  # Django development server
    "https://localhost:443",
    "http://127.0.0.1:5173",  # Vite on 127.0.0.1
    "https://127.0.0.1:5173"  # Vite on 127.0.0.1 (HTTPS)
]

# Security settings for production
SECURE_SSL_REDIRECT = True
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SECURE_HSTS_SECONDS = 31536000  # 1 year
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_BROWSER_XSS_FILTER = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
X_FRAME_OPTIONS = 'DENY'

# File upload settings for production - Set max upload size to 10MB
FILE_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024  # 10MB
DATA_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024  # 10MB

# Use a more secure secret key in production
# You should set this via environment variable
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', SECRET_KEY)

# Database configuration for production
# Consider using PostgreSQL instead of SQLite for production
# DATABASES = {
#     'default': {
#         'ENGINE': 'django.db.backends.postgresql',
#         'NAME': os.environ.get('DB_NAME', 'petapp'),
#         'USER': os.environ.get('DB_USER', 'petapp_user'),
#         'PASSWORD': os.environ.get('DB_PASSWORD'),
#         'HOST': os.environ.get('DB_HOST', 'localhost'),
#         'PORT': os.environ.get('DB_PORT', '5432'),
#     }
# }

# Logging configuration for production
LOGGING['handlers']['file']['filename'] = '/var/log/django/django.log'
LOGGING['handlers']['auth_file']['filename'] = '/var/log/django/auth.log'
LOGGING['handlers']['error_file']['filename'] = '/var/log/django/error.log'
