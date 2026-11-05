import os

from django.core.exceptions import ImproperlyConfigured

from .base import *

if SECRET_KEY == 'django-insecure-change-this':
    raise ImproperlyConfigured('DJANGO_SECRET_KEY must be configured for production.')

if not ALLOWED_HOSTS or ALLOWED_HOSTS == ['localhost', '127.0.0.1']:
    raise ImproperlyConfigured('Set DJANGO_ALLOWED_HOSTS for production.')

DEBUG = False
CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv('DJANGO_CORS_ALLOWED_ORIGINS', '').split(',')
    if origin.strip()
]
CSRF_COOKIE_SECURE = True
SESSION_COOKIE_SECURE = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_SSL_REDIRECT = os.getenv('DJANGO_SECURE_SSL_REDIRECT', 'True') == 'True'
