# FitPulse Club — Production Deployment

**Supabase** (PostgreSQL) → **Render** (Express API) → **Vercel** (React app)

```
 Browser ──► Vercel (client/)  ──HTTPS──►  Render (server/)  ──TLS──►  Supabase Postgres
            VITE_API_URL                   DATABASE_URL, JWT_SECRET,     Session pooler :5432
                                           CLIENT_URL
```

Do the steps in order. Step 3 (Render) gives you the API URL that Vercel needs, and Step 4 (Vercel) gives you the site URL that Render's CORS needs, so you'll go back to Render once at the end.

> **Tip:** use the **Singapore** region on both Supabase and Render. It's the closest to Bangkok, and the API and the database talk to each other on every request.

---

## 0. Before you start (on your computer, once)

Open a terminal in `C:\Users\realw\Downloads\Fitness-Club`.

```powershell
# 1. Install the new Postgres driver (this also removes better-sqlite3 and updates package-lock.json)
cd server
npm install

# 2. Make sure both projects compile. Render and Vercel run these exact builds.
npm run build
cd ..\client
npm install
npm run build
cd ..
```

If either build prints errors, fix them before you deploy. A failed build here means a failed deploy there.

**Optional cleanup:** you can delete `server/fitpulse.db` and `server/src/db/schema.sql`. Both are SQLite leftovers the app no longer uses. The real schema now lives in `server/db/supabase.sql`.

---

## 1. Supabase: create the database

1. Go to **https://supabase.com** → **Sign in** (GitHub login is easiest).
2. Click **New project**.
   - **Organization:** your personal org
   - **Project name:** `fitpulse-club`
   - **Database password:** click **Generate a password**, then **copy it somewhere safe**. You'll need it in step 1.7 and it can't be shown again.
   - **Region:** **Southeast Asia (Singapore)**
   - Click **Create new project** and wait about a minute for it to finish provisioning.
3. In the left sidebar, click **SQL Editor** (the `>_` icon).
4. Click **+ New query** (or **New SQL snippet**).
5. Open `server/db/supabase.sql` from the repo, select everything (**Ctrl+A**), copy, and paste it into the editor.
6. Click **Run** (or press **Ctrl+Enter**).
   - Supabase may show a *"Potential issue detected: destructive operation"* warning because the script starts with `DROP TABLE IF EXISTS`. Click **Run this query**. On a brand-new project there's nothing to lose.
   - The results panel should end with one row: `users 7 · plans 4 · members 3 · trainers 3 · class_types 6 · schedules 15 · bookings 14`.
   - Optional check: open **Table Editor**. All 9 tables should be listed with RLS enabled (no "Unrestricted" label). The script locks them away from Supabase's public REST API. Your Express server still has full access.
7. Get the connection string:
   - Click **Connect** at the top of the project page.
   - Choose the **Session pooler** connection type. Don't use "Direct connection": that address is IPv6-only and Render can't reach it.
   - Copy the **URI**. It looks like this:
     ```
     postgresql://postgres.abcdefghijklmnop:[YOUR-PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres
     ```
   - Replace `[YOUR-PASSWORD]` (including the brackets) with the password from step 1.2. If the password contains `@ : / ? # %`, URL-encode those characters or generate a new password without them. Keep this string private; it's your `DATABASE_URL`.

**Resetting later:** running the script again wipes everything and re-seeds with fresh dates. The seeded classes are dated from the day you run it, so re-run it whenever you want a fresh demo week.

---

## 2. GitHub: push the code

The project folder is already a git repository.

1. Go to **https://github.com/new**.
   - **Repository name:** `fitpulse-club`
   - **Private** (recommended)
   - Do **not** tick "Add a README", ".gitignore" or "license". The repo must be empty.
   - Click **Create repository**.
2. In your terminal, from `C:\Users\realw\Downloads\Fitness-Club`:

```powershell
git status                 # check: no .env files and no fitpulse.db in the list
git add .
git commit -m "Deploy: PostgreSQL (Supabase), Render API, Vercel client"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/fitpulse-club.git
git push -u origin main
```

- If `git remote add` says *remote origin already exists*, run `git remote set-url origin https://github.com/YOUR-USERNAME/fitpulse-club.git` instead.
- Refresh the GitHub page. You should see `client/`, `server/`, `DEPLOYMENT.md`, and **no** `.env` or `*.db` files.

---

## 3. Render: deploy the API (`server/`)

1. Make a JWT secret (any long random string). In a terminal:
   ```powershell
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```
   Copy the output.
2. Go to **https://dashboard.render.com** → sign in with **GitHub**.
3. Click **+ New** (top right) → **Web Service**.
4. Under **Git Provider**, choose **GitHub**. If `fitpulse-club` isn't listed, click **Configure account** and give Render access to the repo. Select **fitpulse-club** and click **Connect**.
5. Fill in the form:

   | Field | Value |
   |---|---|
   | **Name** | `fitpulse-api` (becomes `https://fitpulse-api.onrender.com`; Render adds a suffix if the name is taken) |
   | **Language** | `Node` |
   | **Branch** | `main` |
   | **Region** | `Singapore (Southeast Asia)` |
   | **Root Directory** | `server` |
   | **Build Command** | `npm install --include=dev && npm run build` |
   | **Start Command** | `npm start` |
   | **Instance Type** | `Free` (or Starter if you don't want it to sleep) |

   `--include=dev` matters: TypeScript is a dev dependency, and the build needs it.

6. Scroll to **Environment Variables** → **Add Environment Variable** for each row:

   | Key | Value |
   |---|---|
   | `DATABASE_URL` | the Session pooler URI from step 1.7 (with your password) |
   | `JWT_SECRET` | the random string from step 3.1 |
   | `NODE_ENV` | `production` |
   | `CLIENT_URL` | leave as `http://localhost:5173` for now; you'll change it in step 5 |
   | `APP_TIMEZONE` | `Asia/Bangkok` (optional; this is the default) |

7. Expand **Advanced** → **Health Check Path** → `/api/health`.
8. Click **Deploy Web Service**. The **Logs** tab shows the build. Success looks like:
   ```
   🐘 Connected to Postgres at aws-0-ap-southeast-1.pooler.supabase.com (Asia/Bangkok)
   ⚡ FitPulse API running on port 10000
   ```
9. Copy the service URL from the top of the page, for example `https://fitpulse-api.onrender.com`, and test it in your browser:
   - `https://fitpulse-api.onrender.com/api/health` → `{"status":"ok","database":"ok",...}`
   - `https://fitpulse-api.onrender.com/api/plans` → the 4 membership plans

**If the deploy fails:**
- `Could not connect to Postgres`: the `DATABASE_URL` is wrong. Check that it's the **Session pooler** string (host ends in `pooler.supabase.com`, port `5432`, user `postgres.<ref>`) and that you replaced `[YOUR-PASSWORD]`.
- `tsc: not found`: the Build Command is missing `--include=dev`.
- `JWT_SECRET is not set`: add it under **Environment** and click **Manual Deploy** → **Deploy latest commit**.

---

## 4. Vercel: deploy the React app (`client/`)

1. Go to **https://vercel.com** → sign in with **GitHub**.
2. Click **Add New…** → **Project**.
3. Find **fitpulse-club** under *Import Git Repository* → **Import**. If it's missing, click **Adjust GitHub App Permissions** and grant access.
4. Configure the project:

   | Field | Value |
   |---|---|
   | **Project Name** | `fitpulse-club` (gives `https://fitpulse-club.vercel.app` if available) |
   | **Framework Preset** | `Vite` (usually detected automatically) |
   | **Root Directory** | click **Edit** → choose `client` → **Continue** |
   | **Build Command** | `npm run build` (default) |
   | **Output Directory** | `dist` (default) |
   | **Install Command** | `npm install` (default) |

5. Expand **Environment Variables** and add:

   | Key | Value |
   |---|---|
   | `VITE_API_URL` | `https://fitpulse-api.onrender.com/api`, i.e. your Render URL from step 3.9 **plus `/api`** |

6. Click **Deploy**. When it finishes, click the preview to open the site and copy its domain, for example `https://fitpulse-club.vercel.app`.

`client/vercel.json` sends every path to `index.html`, so refreshing on `/member/classes` or other deep links works.

> `VITE_` variables are baked in **when the site builds**. If you change `VITE_API_URL` later, go to **Deployments** → `⋯` on the latest one → **Redeploy**.

---

## 5. Connect them: allow the Vercel site in the API's CORS

1. Back in **Render** → **fitpulse-api** → **Environment**.
2. Edit `CLIENT_URL` and set it to your Vercel domain, with **no trailing slash**:
   ```
   https://fitpulse-club.vercel.app
   ```
   To allow several origins (e.g. a custom domain too), separate them with commas:
   `https://fitpulse-club.vercel.app,https://fitpulse.example.com`
3. Click **Save, rebuild, and deploy** (or **Save and deploy**). Wait for the deploy to go **Live**.

---

## 6. Smoke test the live site

Open your Vercel URL:

1. **Login → Admin** demo button (`admin / admin123`) → the overview shows KPIs and today's classes.
2. Admin → **Trainers** → approve **Napat**.
3. Sign out → **Member** demo (`somchai / member123`) → **Classes** → book a class → confetti.
   - Somchai's Basic plan allows 8 classes a month and the seed already uses most of them. If you hit *"Monthly class quota reached"*, use `ploy / member123` (unlimited plan).
4. **My Bookings** → cancel the booking.
5. Refresh the browser on `/member/bookings`. The page should load, not show a 404.
6. Sign out → **Trainer** demo (`praewa / trainer123`) → open a roster → mark Attended / No-show.

---

## Environment variables reference

**Render (`server/`)**

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | ✅ | Supabase **Session pooler** URI |
| `JWT_SECRET` | ✅ | Signs login tokens. Changing it signs everyone out. |
| `CLIENT_URL` | ✅ | Allowed browser origin(s) for CORS, comma-separated |
| `NODE_ENV` | recommended | `production` makes missing secrets fail loudly at boot |
| `APP_TIMEZONE` | optional | Defines "today" for schedules and plan expiry (default `Asia/Bangkok`) |
| `PG_POOL_MAX` | optional | Max DB connections (default 5; Supabase free tier allows only a few) |
| `DATABASE_CA_CERT` | optional | Supabase CA certificate (PEM) for full TLS verification; see below |
| `PORT` | automatic | Set by Render; the server listens on it |

**Vercel (`client/`)**

| Variable | Required | Purpose |
|---|---|---|
| `VITE_API_URL` | ✅ | `https://<render-service>.onrender.com/api` |

---

## Local development after the migration

The server now talks to PostgreSQL only. The simplest setup is to point local dev at your Supabase database:

1. Copy `server/.env.example` to `server/.env` and fill in `DATABASE_URL` and `JWT_SECRET`. This file is git-ignored.
2. Run `npm run dev` in `server/` and in `client/` as before. Leave `VITE_API_URL` unset locally; Vite proxies `/api` to `localhost:3001`.

To use a separate local Postgres instead, set `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/fitpulse` (or leave it unset to use that default), then create the tables with:

```powershell
cd server
npm run db:setup -- --reset     # ⚠ wipes and re-seeds whatever DATABASE_URL points to
```

Be careful: if `server/.env` points at Supabase, `db:setup` resets production.

---

## Good to know

- **Free-tier cold starts:** Render's free web services spin down after 15 minutes without traffic. The first request after that takes roughly 30–60 seconds while it wakes up, and the login page may show "It may be waking up". Upgrade the service to **Starter** to keep it always on.
- **Supabase free projects** are paused after a period of inactivity. Open the dashboard and click **Restore** if the API starts logging connection errors.
- **TLS:** the API always connects to Supabase over TLS. By default it doesn't verify Supabase's certificate chain (the usual setup for `pg` on Render). To verify it, open Supabase → **Project Settings → Database → SSL Configuration** → **Download certificate**, then paste the file's contents into Render as `DATABASE_CA_CERT`.
- **Passwords** are stored as unsalted SHA-256, same as before. That works for a demo; before real members sign up, switch to `bcrypt` (or Supabase Auth). Every existing password then has to be reset.
- **What changed in the backend:**
  - `pg` replaces `better-sqlite3`, and all queries use `$1, $2…` placeholders.
  - Booking and cancelling run in row-locked transactions, so two people can't both take the last seat.
  - The database itself now blocks duplicate live bookings and enforces waitlist consistency.
  - `CURRENT_DATE` follows `APP_TIMEZONE`.
  - The JSON shapes the API returns are unchanged (dates `YYYY-MM-DD`, times `HH:MM`, numbers as numbers).
