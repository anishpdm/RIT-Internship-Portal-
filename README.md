# ForgeML — AI/ML Training Platform

Complete internship management platform built for the **45-Day AI/ML Practical Training Program** described in the curriculum PDF. Supports any multi-level, milestone-gated cohort.

**Stack:** Next.js 14 (App Router, TypeScript) · Supabase (Postgres + Auth + Storage + RLS) · Tailwind CSS

**Three role-based portals:**

- **Admin** — internships, levels, students, mentors, sessions, assignments, submissions, audit logs
- **Mentor** — assigned internships only: students, sessions, materials, evaluation
- **Student** — own profile, attendance, materials, assignment submission, scores

---

## What's inside

| Feature | Where |
|---|---|
| Multi-level internships (Level 1 → 2 → 3 progression) | Admin → Internships → Levels |
| Add / search / filter / delete students | Admin → Students |
| Assign students to internships, promote / filter at level boundaries | Admin → Internship detail → Students tab |
| Live, recorded, self-learning sessions (materials + file uploads) | Admin/Mentor → Sessions |
| **Anti-bypass attendance** — rotating code for live, watched-time + active-tab heartbeats for recorded/self | Student → Session detail |
| Daily / weekly / monthly / assessment assignments with GitHub link + file upload | Admin/Mentor → Assignments |
| Submission review with score + feedback | Mentor/Admin → Submissions |
| Full audit log of every admin / mentor action | Admin → Logs |
| Per-level sorting & promotion (ranks students after each milestone) | Admin → Internship → Levels → Rank view |
| Row-Level Security on every table | `supabase/policies.sql` |

---

## Anti-bypass attendance (the hard part)

Three session types, three different mechanisms:

**1. Live sessions — rotating attendance code**
- The mentor's session page generates a fresh 6-digit code every **90 seconds**, only visible to the mentor while the session is live.
- Mentor speaks/shares the code during the call.
- Students enter the code on their session page. Server accepts only if (a) session is within its scheduled window, and (b) code matches the current 90-second slot, derived server-side from `ATTENDANCE_SECRET + session_id + slot`.
- Codes cannot be predicted client-side, and the slot rolls before a screenshot can spread.

**2. Recorded sessions — active-tab heartbeats**
- The video page sends a heartbeat every 15s with `document.visibilityState === 'visible'` and the current video timestamp.
- Server only counts a heartbeat when the tab is active AND the video timestamp has advanced since the last heartbeat (proves the user isn't muting and walking away).
- Attendance is marked once accumulated active-watch time ≥ 80% of the video duration.

**3. Self-learning sessions — dwell + reflection**
- Heartbeats every 15s while the tab is active. Requires ≥ a configurable minimum dwell time plus a short reflection note before attendance counts.

This isn't unbreakable (no browser-side check ever is), but it stops the three common bypasses: opening the tab and walking away, starting the video on mute, and sharing a friend's code.

---

## Local setup (15 minutes)

### 1. Prerequisites
- Node.js 18+ and npm
- A free Supabase account: https://supabase.com

### 2. Create the Supabase project
1. Go to https://supabase.com → New project. Pick the free tier, region near India (Mumbai or Singapore).
2. Wait ~2 minutes for provisioning.
3. SQL Editor → paste `supabase/schema.sql` → run.
4. Then `supabase/policies.sql` → run.
5. Optionally `supabase/seed.sql` for sample data.
6. Authentication → Providers → ensure Email is enabled. For testing, Authentication → Settings → turn off "Confirm email". Re-enable for production.
7. Storage → create two **public** buckets named `materials` and `submissions`.

### 3. Environment variables
Copy `.env.local.example` to `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...          # Settings → API → service_role
ATTENDANCE_SECRET=any-long-random-string  # used to derive rotating codes
```

### 4. Install and run
```bash
npm install
npm run dev
```
Open http://localhost:3000.

### 5. First admin user
Supabase → Authentication → Users → Add user. Then in SQL Editor:
```sql
update public.profiles set role = 'admin' where id = (select id from auth.users where email = 'you@example.com');
```

---

## Free hosting

This stack is genuinely free at the scale of one cohort (50–500 students):

| Component | Free tier | Notes |
|---|---|---|
| **Vercel** (Next.js frontend) | 100 GB bandwidth/mo, serverless included | Auto-deploys from GitHub |
| **Supabase** (DB + Auth + Storage) | 500 MB DB, 1 GB storage, 50,000 MAU | Plenty for one cohort |
| **GitHub** (source code) | Unlimited public + private repos | — |

### Deploy to Vercel (5 minutes)
1. Push this folder to a GitHub repo.
2. https://vercel.com → New Project → Import the repo.
3. Vercel auto-detects Next.js. Paste the same four env variables from `.env.local`.
4. Click Deploy. You get a `your-app.vercel.app` URL.
5. Optional: custom domain via Vercel → Domains.

---

## Project layout

```
src/
├── app/                      # Next.js App Router
│   ├── login/                # Single sign-in (auto-routes by role)
│   ├── admin/                # Admin portal
│   ├── mentor/               # Mentor portal
│   ├── student/              # Student portal
│   └── api/                  # Attendance, heartbeat, session-code
├── components/               # DashboardShell, DataTable, ui/*
├── lib/
│   ├── supabase/             # Client / server / middleware factories
│   ├── audit.ts              # Audit-log helper
│   ├── attendance.ts         # Code derivation + verification
│   └── types.ts              # Shared types
├── middleware.ts             # Role-gating
supabase/
├── schema.sql                # Tables, indexes, triggers
├── policies.sql              # Row-Level Security
└── seed.sql                  # Demo data
```

---

## Extending

1. **Email notifications** — Supabase Auth has built-in email; hook a webhook to `session_reminder` and `submission_graded`.
2. **Discord/Telegram webhook** — your training plan mentions cohort Discord; broadcast new assignments via env-configured URL.
3. **Auto-grading** — for the Level 1 manual-computation tasks, a notebook diff / sklearn-equivalence checker fits as a Vercel serverless function.
4. **Plagiarism** — submissions store GitHub URLs; a nightly job can pairwise-compare.
5. **Leaderboard** — already computable from `submissions.score`; one view + one page.

License: MIT.
