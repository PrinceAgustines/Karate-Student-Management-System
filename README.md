
# Karate Student Management System

This repository contains two main components:

- `frontend/` — React + Vite frontend application
- `backend/` — Django REST API backend

## Deployment targets

- Frontend: Vercel
- Backend: Render
- Database: Supabase / PostgreSQL

## Local development

### Backend

1. Create a Python virtual environment:
   ```cmd
   python -m venv .venv
   .venv\Scripts\activate
   ```
2. Install backend dependencies:
   ```cmd
   pip install -r backend/requirements.txt
   ```
3. Copy `backend/.env.example` to `backend/.env` and configure PostgreSQL or Supabase credentials.
4. Apply database migrations:
   ```cmd
   cd backend
   python manage.py migrate
   ```
5. Start the backend:
   ```cmd
   python manage.py runserver
   ```

### Frontend

1. Install dependencies:
   ```cmd
   cd frontend
   pnpm install
   ```
2. Start the frontend development server:
   ```cmd
   pnpm run dev
   ```

### Build for production

From `frontend/`:
```cmd
pnpm run build
```

## Notes

- The backend uses `users.CustomUser` as the custom Django user model.
- The backend defaults to PostgreSQL via environment variables.
- Generated build artifacts and local environment files are ignored by `.gitignore`.
  