# RIT Internship Portal

Internship management platform for the Rajiv Gandhi Institute of Technology, Kottayam.
Built for multi-level, cohort-based training programmes.

**Stack:** Next.js 14 (App Router, TypeScript) · Supabase (Postgres + Auth + Storage + RLS) · Tailwind CSS

## Three portals

- **Admin** — full control: internships, levels, students, mentors, sessions, assignments, submissions, audit logs.
- **Mentor** — assigned internships only: add students, create sessions, post assignments, evaluate submissions.
- **Student** — own profile, attendance, materials, assignment submission, scores.

## What's inside

| Capability | Where |
|---|---|
| Multi-level internships with promotion/filtering | Admin → Internships |
| Add students (admin & mentor) | Admin/Mentor → Students |
| Anti-bypass attendance — rotating code (live), heartbeat (recorded), dwell (self) | Student → Session detail |
| GitHub or file submissions, weighted scoring | Student/Mentor → Assignments |
| Full audit log of every privileged action | Admin → Logs |
| Row-level security on every table | `supabase/policies.sql` |

## Local setup (Mac / Linux / Windows)

1. **Install Node.js 20+** (`brew install node@20` on Mac).
2. `npm install` in this folder.
3. **Create a Supabase project** at supabase.com.
4. In SQL Editor, run in order: `supabase/schema.sql` → `supabase/policies.sql` → optionally `supabase/seed.sql`.
5. In Storage, create two public buckets: `materials` and `submissions`.
6. `cp .env.local.example .env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from Supabase → Settings → API
   - `SUPABASE_SERVICE_ROLE_KEY` from the same page (keep secret)
   - `ATTENDANCE_SECRET` — generate with `openssl rand -hex 32`
7. `npm run dev` and open http://localhost:3000

## First admin

1. In Supabase → Authentication → Users → **Add user**, create yourself (tick auto-confirm).
2. In SQL Editor: `update profiles set role='admin' where email='you@example.com';`
3. Sign in at `/login`.

## Deploying to Vercel (free)

1. `git init && git add . && git commit -m "Initial"`, push to GitHub.
2. Import the repo at vercel.com → New Project.
3. Add the four env vars (same as `.env.local`) under **Environment Variables**.
4. Deploy.
5. In Supabase → Authentication → URL Configuration, add the Vercel URL to **Site URL** and **Redirect URLs** (append `/auth/callback`).

## Updating a deployed Vercel app

Just push to the same branch. Vercel auto-deploys every commit to `main`:

```bash
git add .
git commit -m "Update UI and mentor capabilities"
git push origin main
```

The new deployment goes live in 2–3 minutes. The env vars persist.

## Anti-bypass attendance (the interesting bit)

- **Live sessions** — A 6-digit code rotates on the mentor's screen every 90 seconds, derived from `HMAC(ATTENDANCE_SECRET, session_id || slot)`. Mentor announces it verbally; students enter it. One-slot grace window for lag.
- **Recorded sessions** — Browser sends `{visibility, position, playing}` every 15s. Server credits the slot only if tab is visible, video is playing, position advanced by ≤20s (kills 2× speed and skip-ahead). Marked present at 80% active watch.
- **Self-learning** — Dwell timer (pauses when tab is hidden) + reflection note ≥ 50 chars.

Every privileged action — including failed code attempts — lands in `audit_logs`.
