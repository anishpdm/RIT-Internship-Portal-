-- =====================================================================
-- ForgeML Internship Platform — Schema
-- Run this in Supabase SQL Editor.
-- =====================================================================

-- Enable extensions
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- =====================================================================
-- Enums
-- =====================================================================

do $$ begin
  create type user_role as enum ('admin', 'mentor', 'student');
exception when duplicate_object then null; end $$;

do $$ begin
  create type internship_status as enum ('draft', 'active', 'completed', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type enrollment_status as enum ('active', 'promoted', 'filtered', 'completed', 'dropped');
exception when duplicate_object then null; end $$;

do $$ begin
  create type session_type as enum ('live', 'recorded', 'self_learning');
exception when duplicate_object then null; end $$;

do $$ begin
  create type session_status as enum ('scheduled', 'live', 'ended', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type attendance_status as enum ('present', 'partial', 'absent');
exception when duplicate_object then null; end $$;

do $$ begin
  create type assignment_kind as enum ('daily', 'weekly', 'monthly', 'assessment', 'milestone');
exception when duplicate_object then null; end $$;

do $$ begin
  create type submission_status as enum ('submitted', 'under_review', 'graded', 'returned');
exception when duplicate_object then null; end $$;

-- =====================================================================
-- profiles — extends auth.users
-- =====================================================================

create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text unique not null,
  full_name     text,
  role          user_role not null default 'student',
  phone         text,
  avatar_url    text,
  bio           text,
  metadata      jsonb default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles(role);
create index if not exists profiles_email_idx on public.profiles(email);

-- Auto-create a profile row whenever a user is created in auth.users.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'student')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
-- internships
-- =====================================================================

create table if not exists public.internships (
  id            uuid primary key default uuid_generate_v4(),
  title         text not null,
  slug          text unique,
  description   text,
  cover_image_url text,
  total_levels  int not null default 1 check (total_levels between 1 and 10),
  start_date    date,
  end_date      date,
  status        internship_status not null default 'draft',
  created_by    uuid references public.profiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists internships_status_idx on public.internships(status);

-- =====================================================================
-- levels — per-internship level definitions
-- =====================================================================

create table if not exists public.levels (
  id              uuid primary key default uuid_generate_v4(),
  internship_id   uuid not null references public.internships(id) on delete cascade,
  level_number    int not null check (level_number > 0),
  title           text not null,
  description     text,
  pass_threshold  numeric(5,2) not null default 60.00, -- percentage
  start_date      date,
  end_date        date,
  created_at      timestamptz not null default now(),
  unique (internship_id, level_number)
);

create index if not exists levels_internship_idx on public.levels(internship_id);

-- =====================================================================
-- mentor_assignments
-- =====================================================================

create table if not exists public.mentor_assignments (
  id            uuid primary key default uuid_generate_v4(),
  internship_id uuid not null references public.internships(id) on delete cascade,
  mentor_id     uuid not null references public.profiles(id) on delete cascade,
  assigned_at   timestamptz not null default now(),
  assigned_by   uuid references public.profiles(id),
  unique (internship_id, mentor_id)
);

create index if not exists mentor_assign_mentor_idx on public.mentor_assignments(mentor_id);
create index if not exists mentor_assign_internship_idx on public.mentor_assignments(internship_id);

-- =====================================================================
-- enrollments — student ↔ internship
-- =====================================================================

create table if not exists public.enrollments (
  id              uuid primary key default uuid_generate_v4(),
  internship_id   uuid not null references public.internships(id) on delete cascade,
  student_id      uuid not null references public.profiles(id) on delete cascade,
  current_level   int not null default 1,
  status          enrollment_status not null default 'active',
  total_score     numeric(7,2) not null default 0,
  enrolled_at     timestamptz not null default now(),
  enrolled_by     uuid references public.profiles(id),
  promoted_at     timestamptz,
  filtered_at     timestamptz,
  completed_at    timestamptz,
  notes           text,
  unique (internship_id, student_id)
);

create index if not exists enroll_student_idx on public.enrollments(student_id);
create index if not exists enroll_internship_idx on public.enrollments(internship_id);
create index if not exists enroll_status_idx on public.enrollments(status);

-- =====================================================================
-- sessions
-- =====================================================================

create table if not exists public.sessions (
  id                  uuid primary key default uuid_generate_v4(),
  internship_id       uuid not null references public.internships(id) on delete cascade,
  level_id            uuid references public.levels(id) on delete set null,
  title               text not null,
  description         text,
  session_type        session_type not null,
  status              session_status not null default 'scheduled',
  scheduled_at        timestamptz,
  duration_minutes    int not null default 90,
  meeting_url         text,             -- for live (Zoom / Meet)
  recording_url       text,             -- for recorded
  video_duration_sec  int,              -- for recorded (used for 80% threshold)
  min_dwell_minutes   int default 20,   -- for self_learning
  required_for_progression boolean not null default false,
  created_by          uuid references public.profiles(id),
  created_at          timestamptz not null default now()
);

create index if not exists sessions_internship_idx on public.sessions(internship_id);
create index if not exists sessions_scheduled_idx on public.sessions(scheduled_at);

-- =====================================================================
-- session_materials — files & links attached to sessions
-- =====================================================================

create table if not exists public.session_materials (
  id          uuid primary key default uuid_generate_v4(),
  session_id  uuid not null references public.sessions(id) on delete cascade,
  title       text not null,
  link_url    text,
  file_url    text,              -- supabase storage URL when uploaded
  file_type   text,              -- 'pdf' | 'video' | 'slides' | 'notebook' | 'image' | 'other'
  added_by    uuid references public.profiles(id),
  created_at  timestamptz not null default now()
);

create index if not exists materials_session_idx on public.session_materials(session_id);

-- =====================================================================
-- attendance — one row per (session, student)
-- =====================================================================

create table if not exists public.attendance (
  id              uuid primary key default uuid_generate_v4(),
  session_id      uuid not null references public.sessions(id) on delete cascade,
  student_id      uuid not null references public.profiles(id) on delete cascade,
  status          attendance_status not null default 'absent',
  marked_at       timestamptz,
  active_seconds  int not null default 0,      -- accumulated active-tab seconds
  last_heartbeat  timestamptz,
  last_position   int,                          -- video position for recorded
  code_used       text,                         -- the slot code submitted for live
  reflection_note text,                         -- for self-learning
  ip_address      inet,
  unique (session_id, student_id)
);

create index if not exists attendance_session_idx on public.attendance(session_id);
create index if not exists attendance_student_idx on public.attendance(student_id);

-- =====================================================================
-- assignments
-- =====================================================================

create table if not exists public.assignments (
  id                    uuid primary key default uuid_generate_v4(),
  internship_id         uuid not null references public.internships(id) on delete cascade,
  level_id              uuid references public.levels(id) on delete set null,
  title                 text not null,
  description           text,
  kind                  assignment_kind not null,
  max_score             numeric(6,2) not null default 100,
  due_at                timestamptz,
  allow_github          boolean not null default true,
  allow_file_upload     boolean not null default true,
  attachment_url        text,                -- spec or starter notebook
  weight                numeric(5,2) not null default 1.0,
  created_by            uuid references public.profiles(id),
  created_at            timestamptz not null default now()
);

create index if not exists assignments_internship_idx on public.assignments(internship_id);
create index if not exists assignments_level_idx on public.assignments(level_id);
create index if not exists assignments_due_idx on public.assignments(due_at);

-- =====================================================================
-- submissions
-- =====================================================================

create table if not exists public.submissions (
  id              uuid primary key default uuid_generate_v4(),
  assignment_id   uuid not null references public.assignments(id) on delete cascade,
  student_id      uuid not null references public.profiles(id) on delete cascade,
  github_url      text,
  file_url        text,
  notes           text,
  submitted_at    timestamptz not null default now(),
  status          submission_status not null default 'submitted',
  score           numeric(6,2),
  feedback        text,
  evaluated_by    uuid references public.profiles(id),
  evaluated_at    timestamptz,
  unique (assignment_id, student_id)
);

create index if not exists submissions_assignment_idx on public.submissions(assignment_id);
create index if not exists submissions_student_idx on public.submissions(student_id);
create index if not exists submissions_status_idx on public.submissions(status);

-- =====================================================================
-- audit_logs
-- =====================================================================

create table if not exists public.audit_logs (
  id           uuid primary key default uuid_generate_v4(),
  actor_id     uuid references public.profiles(id) on delete set null,
  actor_role   user_role,
  action       text not null,            -- e.g. 'create_internship'
  entity_type  text not null,            -- e.g. 'internship'
  entity_id    uuid,
  details      jsonb default '{}'::jsonb,
  ip_address   inet,
  created_at   timestamptz not null default now()
);

create index if not exists audit_actor_idx on public.audit_logs(actor_id);
create index if not exists audit_entity_idx on public.audit_logs(entity_type, entity_id);
create index if not exists audit_created_idx on public.audit_logs(created_at desc);

-- =====================================================================
-- Updated-at triggers
-- =====================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_updated_at_profiles on public.profiles;
create trigger set_updated_at_profiles before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_internships on public.internships;
create trigger set_updated_at_internships before update on public.internships
  for each row execute function public.set_updated_at();

-- =====================================================================
-- View: student leaderboard per internship (used by Admin rank page)
-- =====================================================================

create or replace view public.v_internship_leaderboard as
select
  e.internship_id,
  e.student_id,
  p.full_name,
  p.email,
  e.current_level,
  e.status,
  e.total_score,
  coalesce(round(avg(s.score)::numeric, 2), 0) as avg_score,
  count(s.id) filter (where s.status = 'graded') as graded_submissions,
  count(distinct a.id) as attended_sessions
from public.enrollments e
join public.profiles p on p.id = e.student_id
left join public.submissions s on s.student_id = e.student_id
left join public.assignments asg on asg.id = s.assignment_id and asg.internship_id = e.internship_id
left join public.attendance a on a.student_id = e.student_id and a.status in ('present','partial')
left join public.sessions ses on ses.id = a.session_id and ses.internship_id = e.internship_id
group by e.internship_id, e.student_id, p.full_name, p.email, e.current_level, e.status, e.total_score;
