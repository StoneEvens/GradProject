"""
Production settings for gradProject.
"""
from .settings import *

# Override settings for production
DEBUG = False

ALLOWED_HOSTS = [
    'petapp.geniusbee.net',
    'geniusbee.net',
    '.geniusbee.net',
]

# CORS configuration for production
CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOWED_ORIGINS = [
    "https://petapp.geniusbee.net",
    "https://geniusbee.net",
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
