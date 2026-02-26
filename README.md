# Student Dashboard

Student Dashboard is a full-stack academic management application built with Next.js, Prisma, and PostgreSQL.

## Core Modules

- Authentication with secure session cookie
- Student profile and academic identity
- Semester management
- Course management with weekly class sessions
- Schedule view with filtering and search
- Exam planner with status tracking
- Planner items (tasks, assignments, study plan)
- Real-time sync via SSE across modules
- Reminder notifications (API + browser alerts)
- Calendar ICS export
- Folder-based file manager
- File upload, pinning, filtering, tagging, preview, download

## Tech Stack

- Next.js 16 (App Router + Route Handlers)
- React 19 + TypeScript
- Tailwind CSS v4 + shadcn-style components
- Prisma ORM
- PostgreSQL via Docker

## Quick Start

1. Install dependencies:

```bash
pnpm install
```

2. Copy environment template:

```bash
cp .env.example .env
```

3. Start PostgreSQL:

```bash
pnpm db:up
```

4. Generate Prisma client and push schema:

```bash
pnpm db:generate
pnpm db:push
```

5. Seed initial student account:

```bash
pnpm db:seed
```

6. Run app:

```bash
pnpm dev
```

Open `http://localhost:3000`.

## Docker (One Command)

Run the entire stack (PostgreSQL + DB init + Prisma schema + seed + app):

```bash
docker compose up --build -d
```

or:

```bash
pnpm docker:up
```

What this does automatically:

- Starts PostgreSQL
- Creates `student_dashboard` database if it does not exist
- Runs Prisma `db push` to create/update tables
- Runs seed (idempotent; skips if seed user already exists)
- Starts the Next.js app on port `3000`

Useful commands:

```bash
pnpm docker:logs
pnpm docker:down
```

## Production (PM2 + Nginx)

Files added for production deployment:

- `ecosystem.config.cjs` (PM2 process definition)
- `deployment/nginx/student-dashboard.conf` (Nginx reverse proxy, TLS, SSE, 1GB upload)
- `deployment/pm2/deploy-checklist.md` (server setup commands)

Recommended flow:

```bash
pnpm install --frozen-lockfile
cp .env.example .env
# update .env for production
pnpm prod:prepare
pnpm pm2:start
```

PM2 helpers:

```bash
pnpm pm2:restart
pnpm pm2:logs
pnpm pm2:stop
pnpm pm2:delete
```

Nginx notes:

- Set your domain in `deployment/nginx/student-dashboard.conf`
- Set real certificate paths
- Validate config: `sudo nginx -t`
- Reload: `sudo systemctl reload nginx`

## Main API Groups

- `/api/v1/auth/*`
- `/api/v1/profile`
- `/api/v1/semesters*`
- `/api/v1/courses*`
- `/api/v1/schedule`
- `/api/v1/calendar`
- `/api/v1/calendar/ics`
- `/api/v1/exams*`
- `/api/v1/planner*`
- `/api/v1/notifications/reminders`
- `/api/v1/folders*`
- `/api/v1/files*`
- `/api/v1/dashboard/summary`

## File Preview Notes

- In-app preview: image, video, audio, PDF, and text files.
- Office files (`docx`, `pptx`, etc.) are managed via upload/download metadata flow and external editor workflow.
