
# Karate Student Management System

A full-stack student management platform for karate institutions, combining a Django REST backend with a React + Vite frontend.

## What this repository contains

- `backend/` — Django REST API, authentication, student management, facial recognition, pose evaluation, attendance, analytics, gamification, inventory, and shop flows.
- `frontend/` — React + Vite SPA with role-based dashboards and pages for admin/instructors, students, and parents.

## Key features

- Role-based access for admin/instructor, student, and parent users.
- Student registration and system ID management.
- Class scheduling and attendance tracking.
- Facial recognition support for class photo attendance.
- Pose evaluation and performance scoring using MediaPipe/TensorFlow.
- Gamification: XP, badges, challenges, and leaderboards.
- Inventory and shop order management.
- Analytics dashboards for attendance, progress, and performance.

## Architecture overview

- Backend: Django, Django REST Framework, Simple JWT authentication.
- Frontend: React, Vite, React Router, and custom role guards.
- Database: PostgreSQL / Supabase-compatible.
- Media & ML: MediaPipe for pose and face detection, TensorFlow and YOLO support for pose analysis.

## Repository structure

- `backend/manage.py` — Django management entrypoint.
- `backend/dojo_backend/settings.py` — project settings, DB config, auth, CORS, and media storage.
- `backend/users/` — custom user model, registration, login, and profile APIs.
- `backend/students/` — core student data models, serializers, views, and routes.
- `backend/students/facial_recognition/` — face detection, encoding, and matching service.
- `backend/students/pose_evaluation/` — pose landmark extraction, template creation, and media analysis.
- `frontend/src/app/` — application router, auth provider, API client, and page components.

## Local development

### Backend setup

1. Open CMD and navigate to the repository root.
2. Create and activate a Python virtual environment:
   ```cmd
   py -3.11 -m venv .venv
   .venv\Scripts\activate
   ```
3. Install backend dependencies:
   ```cmd
   pip install -r backend/requirements.txt
   ```
4. Copy `backend/.env.example` to `backend/.env` and configure your database settings.
5. Apply database migrations:
   ```cmd
   cd backend
   python manage.py migrate
   ```
6. Start the backend server:
   ```cmd
   python manage.py runserver
   ```

### Frontend setup

1. Open CMD and navigate to the frontend folder:
   ```cmd
   cd frontend
   ```
2. Install dependencies:
   ```cmd
   npm install
   ```
3. Start the frontend development server:
   ```cmd
   npm run dev
   ```

### Production build

From the `frontend/` directory:
```cmd
npm run build
```

## Environment variables

Copy `backend/.env.example` to `backend/.env` and set:

- `DJANGO_DB_ENGINE`
- `DJANGO_DB_NAME`
- `DJANGO_DB_USER`
- `DJANGO_DB_PASSWORD`
- `DJANGO_DB_HOST`
- `DJANGO_DB_PORT`
- `DJANGO_SECRET_KEY`
- `DJANGO_DEBUG`
- `DJANGO_ALLOWED_HOSTS`

## Running the system

- Backend API default: `http://127.0.0.1:8000`
- Frontend dev server default: `http://127.0.0.1:5173`
- Make sure the frontend `VITE_API_BASE` is set to your backend URL if needed.

## How the system works

- Admins/instructors manage student profiles, schedule sessions, and track attendance.
- Students can log in, view performance data, and submit pose media for evaluation.
- Parents can register with a valid parent system ID and monitor their child’s progress.
- Facial recognition can identify students from class photos and create attendance records.
- Pose templates and media analysis support form classification and scoring for martial arts stances.

## Notes

- `users.CustomUser` is the custom auth model for email-based login and role management.
- `students.SystemID` supports pre-generated code usage for student and parent onboarding.
- Media files and ML models may be downloaded automatically by the backend services when first used.

## Additional resources

- See `backend/README.md` for backend-specific setup details.
- See `frontend/package.json` for frontend dependencies and tooling.