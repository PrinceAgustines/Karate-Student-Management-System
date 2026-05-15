# Karate Student Management System Backend

This backend is built with Django and Django REST Framework.

## Requirements

- Python 3.11+
- PostgreSQL / Supabase-compatible database
- `pnpm` for frontend development if using the complete repository

## Setup

1. Create a Python virtual environment:
   ```cmd
   python -m venv .venv
   .venv\Scripts\activate
   ```
2. Install backend dependencies:
   ```cmd
   pip install -r requirements.txt
   ```
3. Copy `.env.example` to `.env` and configure database credentials:
   - `DJANGO_DB_ENGINE=django.db.backends.postgresql`
   - `DJANGO_DB_NAME`
   - `DJANGO_DB_USER`
   - `DJANGO_DB_PASSWORD`
   - `DJANGO_DB_HOST`
   - `DJANGO_DB_PORT`
4. Run migrations:
   ```cmd
   python manage.py migrate
   ```
5. Create a superuser:
   ```cmd
   python manage.py createsuperuser
   ```
6. Start the backend:
   ```cmd
   python manage.py runserver
   ```

## TensorFlow / pose analysis

If you need pose evaluation or facial recognition features, install the additional TensorFlow dependencies:

```cmd
pip install -r requirements-tf.txt
```

## Deployment

For Render, point the service to `backend/manage.py` and use environment variables from your Supabase or PostgreSQL provider.

## Notes

- The backend uses `users.CustomUser` as the custom auth model.
- The backend defaults to PostgreSQL via environment variables.
- `CORS_ALLOW_ALL_ORIGINS = True` is enabled for development and should be restricted in production.
