# FitPulse Club

A full-stack fitness club app. Members book classes in one tap and join waitlists that auto-promote. Trainers take attendance, and admins run the schedule, plans and trainer approvals.

**Live:** https://fitpulse-club.vercel.app  ·  **API:** https://fitpulse-api-1g3y.onrender.com/api/health

> The API runs on Render's free plan and sleeps after 15 minutes without traffic, so the first request after a break can take 30–60 seconds.

---

## Demo accounts

| Role | Username | Password | Notes |
|---|---|---|---|
| Admin | `admin` | `admin123` | Club overview, schedule builder, plans, trainer approvals |
| Member | `somchai` | `member123` | Basic plan (8 classes / month) |
| Member | `ploy` | `member123` | Premium plan (unlimited classes), the best account for booking tests |
| Member | `mike` | `member123` | No plan yet, so he has to pick one before booking |
| Trainer | `praewa` | `trainer123` | HIIT / strength coach |
| Trainer | `kitti` | `trainer123` | Yoga / Pilates coach |
| Trainer | `napat` | `trainer123` | Pending, so can't sign in until an admin approves |

The login page has one-click buttons for admin, somchai and praewa.

---

## Features

**Members**
- Dashboard with a weekly attendance streak, a live countdown to the next class, and monthly quota usage
- Class browser with day, type, level and trainer filters, live capacity bars, and one-tap booking (with confetti)
- Full classes offer a **waitlist**. When someone cancels, the first person in line is promoted automatically, and the app tells them next time they open *My Bookings*
- Profile with several phone numbers and plan selection

**Trainers**
- Upcoming classes grouped by day, with fill rates
- Class roster with Attended / No-show check-in, plus "mark all attended"

**Admins**
- KPI overview: active members, today's classes, occupancy, pending trainers, and a live bookings feed
- Schedule builder with **live collision detection**, so the same trainer or room can't be double-booked
- Membership plan management, and trainer application approve / reject

**Data rules**
- Gender is Man (`M`) or Woman (`F`)
- Dates are shown and entered as `YYYY-MM-DD`, the same format the database stores
- "Today" means today in Bangkok time (`APP_TIMEZONE`)

---

## Tech stack

| Layer | Tech | Hosted on |
|---|---|---|
| Frontend (`client/`) | React 19, TypeScript, Vite, Tailwind CSS v4, Framer Motion, Zustand, React Router, lucide-react | Vercel |
| Backend (`server/`) | Node.js, Express 5, TypeScript, `pg`, JWT auth | Render |
| Database | PostgreSQL | Supabase |

```
 Browser ──► Vercel (React app) ──HTTPS──► Render (Express API) ──TLS──► Supabase Postgres
             VITE_API_URL                  DATABASE_URL, JWT_SECRET       Session pooler :5432
```

Every push to `main` redeploys both Vercel and Render.

---

## Project structure

```
FitPulse-Club/
├── client/                    React frontend
│   ├── src/
│   │   ├── components/ui/     Button, Card, Modal, DateInput, CapacityBar, Toast, …
│   │   ├── components/layout/ Navbar, ProtectedRoute, AppLayout
│   │   ├── pages/             auth/, member/, trainer/, admin/
│   │   ├── lib/               api.ts (fetch + JWT), utils.ts, hooks.ts, waitlist.ts
│   │   ├── stores/            authStore (persisted), toastStore
│   │   └── types/             shared TypeScript types
│   └── vercel.json            SPA rewrite so deep links work on refresh
├── server/                    Express API
│   ├── src/
│   │   ├── routes/            auth, members, trainers, plans, classes, bookings, admin
│   │   ├── db/                database.ts (pg pool), seed.ts (db:setup script)
│   │   ├── middleware/auth.ts JWT + role checks
│   │   └── index.ts           app, CORS, /api/health
│   └── db/supabase.sql        schema + demo data (resets all tables)
├── DEPLOYMENT.md              step-by-step Supabase → Render → Vercel guide
└── README.md
```

---

## Running locally

**Requirements:** Node.js 20.12+ and a PostgreSQL database. You can point local dev at your Supabase database, or run Postgres on your machine.

```bash
git clone https://github.com/Wuttipat1/FitPulse-Club.git
cd FitPulse-Club
```

**1. API**

```bash
cd server
cp .env.example .env        # then fill in DATABASE_URL and JWT_SECRET
npm install
npm run dev                 # http://localhost:3001
```

**2. Database (first time only).** Load the tables and demo data, in either of two ways:
- paste `server/db/supabase.sql` into the Supabase SQL Editor and run it, or
- run `npm run db:setup -- --reset` in `server/`, which runs the same script against `DATABASE_URL`.

⚠ Both **wipe and re-create every table**. Don't run them against a database you want to keep.

**3. Web app**

```bash
cd client
npm install
npm run dev                 # http://localhost:5173
```

Leave `VITE_API_URL` unset locally. Vite proxies `/api` to `localhost:3001`.

From the repo root you can also use `npm run server` and `npm run client`.

---

## Environment variables

**Server (`server/.env`, or Render → Environment)**

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | ✅ | Postgres connection string. For Supabase, use the **Session pooler** URI (port 5432). |
| `JWT_SECRET` | ✅ | Long random string that signs login tokens |
| `CLIENT_URL` | ✅ in production | Allowed browser origin(s) for CORS, comma-separated. `localhost:5173` is always allowed. |
| `NODE_ENV` | recommended | `production` makes a missing secret fail at startup |
| `APP_TIMEZONE` | optional | What "today" means for schedules and plans (default `Asia/Bangkok`) |
| `PG_POOL_MAX` | optional | Max DB connections (default 5) |
| `DATABASE_CA_CERT` | optional | Supabase CA certificate, for full TLS verification |

**Client (Vercel → Environment Variables)**

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | API base, e.g. `https://fitpulse-api-1g3y.onrender.com/api`. It's built into the bundle, so redeploy after changing it. |

Never commit `.env` files. They're in `.gitignore`, and `.env.example` shows the shape.

---

## Scripts

| Where | Command | What it does |
|---|---|---|
| `server/` | `npm run dev` | API with auto-reload (tsx) |
| `server/` | `npm run build` | Compile TypeScript to `dist/` |
| `server/` | `npm start` | Run the compiled API (what Render runs) |
| `server/` | `npm run db:setup -- --reset` | Reset and seed the database from `db/supabase.sql` |
| `client/` | `npm run dev` | Vite dev server |
| `client/` | `npm run build` | Type-check and build to `dist/` (what Vercel runs) |
| `client/` | `npm run lint` | Lint with oxlint |

---

## API overview

All routes are under `/api`. Protected routes need `Authorization: Bearer <token>` from `/auth/login`.

| Area | Endpoints | Access |
|---|---|---|
| Health | `GET /health` | public |
| Auth | `POST /auth/register`, `POST /auth/login` | public |
| Plans | `GET /plans` · `GET /plans/all`, `POST /plans`, `PUT /plans/:id` | public · admin |
| Classes | `GET /classes/types`, `GET /classes/schedule?date=&class_type_id=&trainer_id=` · `POST /classes/types`, `POST /classes/schedule`, `PUT /classes/schedule/:id` | public · admin |
| Trainers | `GET /trainers` · `GET /trainers/me`, `GET /trainers/me/classes`, `GET /trainers/classes/:id/roster`, `POST /trainers/classes/:id/checkin` | public · trainer |
| Members | `GET/PUT /members/me`, `POST /members/me/phones`, `DELETE /members/me/phones/:phone`, `POST /members/me/plan` | member |
| Bookings | `POST /bookings`, `DELETE /bookings/:id`, `GET /bookings/my` | member |
| Admin | `GET /admin/stats`, `GET /admin/trainers/pending`, `POST /admin/trainers/:userId/approve` / `reject`, `POST /admin/schedule/check-collision`, `GET /admin/bookings/recent` | admin |

**Booking rules:**
- **Active plan:** the member must have an active plan.
- **Monthly quota:** counts Booked, Attended and No-show classes this month. Unlimited plans skip it.
- **One booking per class:** the database itself blocks a second live booking.
- **Full classes:** the booking goes to the waitlist (first in, first out).
- **Safe under load:** booking and cancelling lock the class row, so two people can't take the last seat.

---

## Database

There are nine tables: `user_account`, `membership_plan`, `member`, `member_phone`, `trainer`, `trainer_phone`, `class_type`, `class_schedule`, `class_booking`. Each user account links to one member or trainer profile. Phone numbers are multi-valued tables, and bookings connect members to scheduled classes.

- The full schema and demo data are in [`server/db/supabase.sql`](server/db/supabase.sql).
- The demo schedule is dated from the day the script runs. Re-run it for a fresh week.
- Row Level Security is on for every table, and Supabase's public API has no access. Only the Express API, connecting as the table owner, reads and writes data.

---

## Deployment

See **[DEPLOYMENT.md](DEPLOYMENT.md)** for the full Supabase → Render → Vercel walkthrough, including environment variables and troubleshooting.

---

## Known limitations

- **Passwords** are stored as unsalted SHA-256. Fine for a demo; switch to bcrypt (or Supabase Auth) before real members sign up.
- **Render free plan** sleeps when idle, so expect slow first loads.
- **Supabase free projects** pause after a period of inactivity. Restore them from the dashboard if the API can't connect.
