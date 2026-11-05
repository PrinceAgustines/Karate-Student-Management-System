# Karate Student Management System

A full-stack application for managing karate students, dojo operations, evaluations, and training progress. The system combines a Django REST API with a React single-page application and provides role-specific experiences for administrators, instructors, students, and parents.

## Features

- **Accounts and access:** Role-based authentication for administrators, instructors, students, and parents; parent-child account links; student and parent system IDs.
- **Student management:** Student profiles, enrollment details, belt progression, and promotion records.
- **Dojo operations:** Class schedules, session attendance, attendance logs, and photo-based attendance assistance.
- **Performance:** Kata/stance and kumite evaluations, sparring match records, instructor ratings, performance trends, and analytics.
- **Pose tools:** Image/video pose evaluation, optional live camera evaluation, and labeled reference-pose management.
- **Engagement:** Attendance streaks, achievement badges, and overall/monthly leaderboards.
- **Commerce:** Inventory, shop, cart, and order management.
- **Administration:** Notifications, reports, bug reports, and student ID management.
- **Responsive interfaces:** Dashboards and key workflows adapt to mobile and desktop screens.

## Technology

- **Frontend:** React 18, TypeScript, Vite, React Router, Tailwind CSS, Radix UI, and Recharts.
- **Backend:** Python 3.11, Django, Django REST Framework, and Simple JWT.
- **Database:** PostgreSQL.
- **Computer vision:** MediaPipe and OpenCV for pose analysis; face-recognition/dlib for attendance recognition.

## Repository layout

```text
backend/
  apps/users/                 Custom users, authentication, presence, and bug reports
  apps/students/              Student, attendance, performance, gamification, and shop APIs
  apps/students/pose_evaluation/
                              Pose-analysis services
  apps/students/facial_recognition/
                              Face detection and matching services
  config/                     Django URLs and environment-specific settings
  requirements.txt            Python dependencies
  manage.py                   Django management entry point
frontend/
  src/app/                    Routes, auth provider, and application layouts
  src/features/               Feature pages and components
  src/shared/                 Shared UI components and API client
  package.json                Frontend dependencies and scripts
pnpm-lock.yaml                Locked frontend dependency graph
pnpm-workspace.yaml           pnpm workspace configuration
```

## Requirements

- Python **3.11** (the backend runtime file specifies 3.11.9)
- Node.js with Corepack and pnpm 9
- PostgreSQL
- A webcam and browser camera permission for live pose evaluation

Some computer-vision dependencies (notably `dlib`/`face-recognition` and TensorFlow) can require platform-specific system libraries or supported prebuilt wheels. Install them in a Python 3.11 environment compatible with your operating system.

## Local development (Windows CMD)

### 1. Configure PostgreSQL

Create a PostgreSQL database and user, then set the matching connection values in `backend\.env`. The names and credentials in `.env.example` are placeholders; replace them with your local values.

### 2. Install and start the backend

From the repository root:

```cmd
cd backend
py -3.11 -m venv .venv
.venv\Scripts\activate.bat
python -m pip install --upgrade pip
pip install -r requirements.txt
copy .env.example .env
```

Edit `backend\.env`. Set the database variables and replace `DJANGO_SECRET_KEY` with a private random value. For local development, `DJANGO_DEBUG=True` and the default localhost allowed hosts are suitable.

Then, from `backend\`:

```cmd
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

The API is available at `http://127.0.0.1:8000/`. Keep this terminal running.

### 3. Install and start the frontend

Open another CMD window at the repository root:

```cmd
corepack enable
corepack prepare pnpm@9 --activate
pnpm install --frozen-lockfile
copy frontend\.env.example frontend\.env
cd frontend
pnpm dev
```

The frontend is available at the URL printed by Vite (normally `http://localhost:5173/`). Set `VITE_API_BASE` in `frontend\.env` if the backend is hosted at a different URL.

## Tests and build

Run backend tests from `backend\` with the virtual environment activated:

```cmd
python manage.py test
```

Build the frontend from the repository root:

```cmd
pnpm --dir frontend build
```

The frontend currently defines development and production-build scripts; it does not define a separate test script.

## Configuration

Copy the example files and provide local values:

- `backend/.env.example` → `backend/.env`
- `frontend/.env.example` → `frontend/.env`

Backend configuration is read from `backend/.env`. Common settings include:

| Variable | Purpose |
| --- | --- |
| `DJANGO_SECRET_KEY` | Django signing key; use a private, randomly generated value |
| `DJANGO_DEBUG` | Enables Django debug behavior for local development; disable in production |
| `DJANGO_ALLOWED_HOSTS` | Comma-separated backend host names |
| `DJANGO_DB_ENGINE` | Database engine; defaults to Django's PostgreSQL backend |
| `DJANGO_DB_NAME` | PostgreSQL database name |
| `DJANGO_DB_USER` / `DJANGO_DB_PASSWORD` | PostgreSQL credentials |
| `DJANGO_DB_HOST` / `DJANGO_DB_PORT` | PostgreSQL connection address |
| `DJANGO_CORS_ALLOWED_ORIGINS` | Allowed frontend origins for production |
| `DJANGO_SECURE_SSL_REDIRECT` | Controls HTTPS redirection in production settings |
| `VITE_API_BASE` | Frontend API base URL; defaults to `http://127.0.0.1:8000` |

`backend/manage.py` selects development settings by default. For deployment, select `config.settings.production`, set a unique secret key and production allowed hosts/origins, use `DEBUG=False`, and serve the application over HTTPS. The production settings reject the development secret key and default localhost hosts. Configure production database, static-file, media-file, and hosting services for your environment; this repository does not include a Docker or cloud deployment recipe.

Inventory images and student portraits are served from `backend/media/inventory_images/` and `backend/media/student_photos/`, respectively, including when `DEBUG=False`. Production deployments must retain the `backend/media/` directory across application restarts and releases, or configure persistent media storage, so uploaded images remain available.

## API and application flow

The frontend calls the Django API through the shared client in `frontend/src/shared/lib/api.ts`. Authentication uses JWT access/refresh tokens. Application routes are declared in `frontend/src/app/routes.tsx`; role guards restrict dashboard and management areas. The backend mounts user endpoints under `/api/users/` and student/domain endpoints under `/api/students/`.

The main backend domain is `backend/apps/students/`, which contains student profiles, system IDs, sessions, attendance, performance ratings, sparring, belt progression, gamification, notifications, inventory, and orders. Shared user and authentication behavior is in `backend/apps/users/`. Performance aggregation and belt progression live in `backend/apps/students/services/performance_services.py`.

Pose evaluation can analyze uploaded images/videos or live-camera frames. Labeled reference images are stored as application data; pose models are initialized/downloaded as needed by the backend services. Treat uploaded images, attendance records, and any biometric data as sensitive personal information: obtain appropriate consent, restrict access, and use secure storage and transport.

## Data and migrations

- Apply schema changes with `python manage.py migrate`.
- Back up the database before applying migrations that remove or transform data.
- Migrations `0028` and `0029` remove unused legacy `Match`, `Payment`, `Sale`, `ChallengeDefinition`, and `StudentChallenge` tables and move belt-readiness data into `PerformanceSummary`. The removed legacy tables may contain data; review and back up the database before migrating.
- Sparring results and shop purchases are stored separately in `SparringMatch` and `Order`/`OrderItem`.
- Belt progression is stored in a `PerformanceSummary` row using the `belt_progression` period. Ordinary performance-summary endpoints and analytics exclude these rows.

## Publishing and security

- Commit `pnpm-lock.yaml` so frontend installs can be reproduced.
- Keep `.env`, database credentials, secret keys, production configuration, database dumps, uploaded media, and downloaded model weights out of Git. The root `.gitignore` excludes local environment files and generated/private runtime data while allowing the `.env.example` templates.
- Review every file before staging or pushing. If a secret was ever committed or shared, removing it from the latest version is not enough—revoke or rotate it and clean the affected Git history before publishing.
- Configure GitHub repository secrets for any CI or deployment credentials; never put credentials in source files or README examples.
