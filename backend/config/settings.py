# Django REST Framework 配置
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.SessionAuthentication',
        'rest_framework.authentication.TokenAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'EXCEPTION_HANDLER': 'utils.exception_handler.custom_exception_handler',
    'DEFAULT_PAGINATION_CLASS': 'utils.pagination.StandardResultsSetPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '60/hour',                # 匿名用戶每小時最多 60 次請求
        'user': '1000/hour',              # 認證用戶每小時最多 1000 次請求
        'feed_upload': '20/hour',         # 飼料上傳每小時最多 20 次
        'feed_calculate': '60/hour',      # 飼料計算每小時最多 60 次
        'user_profile': '100/hour',       # 用戶資料請求每小時最多 100 次
        'burst': '10/minute',             # 短時間內的突發請求限制
    },
}

# Swagger 配置
SWAGGER_SETTINGS = {
    'SECURITY_DEFINITIONS': {
        'Bearer': {
            'type': 'apiKey',
            'name': 'Authorization',
            'in': 'header'
        }
    },
    'USE_SESSION_AUTH': True,
    'LOGIN_URL': '/admin/login/',
    'LOGOUT_URL': '/admin/logout/',
    'DEFAULT_INFO': 'config.urls.schema_info',
    'REFETCH_SCHEMA_WITH_AUTH': True,
    'PERSIST_AUTH': True,
    'DOC_EXPANSION': 'none',
    'OPERATIONS_SORTER': 'alpha',
    'TAGS_SORTER': 'alpha',
    'DEFAULT_MODEL_RENDERING': 'example',
}

# 日誌配置
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {process:d} {thread:d} {message}',
            'style': '{',
        },
        'simple': {
            'format': '{levelname} {message}',
            'style': '{',
        },
        'standard': {
            'format': '[%(asctime)s] [%(levelname)s] [%(name)s:%(lineno)s] %(message)s',
            'datefmt': '%Y-%m-%d %H:%M:%S',
        },
    },
    'filters': {
        'require_debug_true': {
            '()': 'django.utils.log.RequireDebugTrue',
        },
    },
    'handlers': {
        'console': {
            'level': 'DEBUG',
            'filters': ['require_debug_true'],
            'class': 'logging.StreamHandler',
            'formatter': 'standard',
        },
        'file': {
            'level': 'INFO',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': 'logs/app.log',  # 确保此目录存在
            'maxBytes': 10 * 1024 * 1024,  # 10MB
            'backupCount': 5,
            'formatter': 'standard',
        },
        'error_file': {
            'level': 'ERROR',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': 'logs/error.log',  # 确保此目录存在
            'maxBytes': 10 * 1024 * 1024,  # 10MB
            'backupCount': 5,
            'formatter': 'standard',
        },
    },
    'loggers': {
        'django': {
            'handlers': ['console', 'file'],
            'level': 'INFO',
            'propagate': True,
        },
        'django.db.backends': {
            'handlers': ['console'],
            'level': 'DEBUG',
            'propagate': False,
        },
        'feeds': {
            'handlers': ['console', 'file', 'error_file'],
            'level': 'DEBUG',
            'propagate': False,
        },
        'utils': {
            'handlers': ['console', 'file', 'error_file'],
            'level': 'DEBUG',
            'propagate': False,
        },
    },
} 