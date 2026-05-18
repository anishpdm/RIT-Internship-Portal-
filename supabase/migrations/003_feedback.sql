-- ============================================================
-- Migration 003: Assignment feedback (session + trainer rating)
-- Run after 002_quiz.sql. Idempotent.
-- ============================================================

create table if not exists public.assignment_feedback (
  id              uuid primary key default gen_random_uuid(),
  assignment_id   uuid not null references public.assignments(id) on delete cascade,
  student_id      uuid not null references public.profiles(id) on delete cascade,
  session_rating  int check (session_rating between 1 and 5),
  trainer_rating  int check (trainer_rating between 1 and 5),
  overall_rating  int check (overall_rating between 1 and 5),
  comment         text,
  created_at      timestamptz not null default now(),
  unique (assignment_id, student_id)
);

create index if not exists feedback_assignment_idx
  on public.assignment_feedback(assignment_id);
create index if not exists feedback_student_idx
  on public.assignment_feedback(student_id);

alter table public.assignment_feedback enable row level security;

-- Students can read & write their own feedback only
drop policy if exists "feedback_student_own" on public.assignment_feedback;
create policy "feedback_student_own" on public.assignment_feedback for all
using (student_id = auth.uid())
with check (student_id = auth.uid());

-- Admins can read everything
drop policy if exists "feedback_admin_select" on public.assignment_feedback;
create policy "feedback_admin_select" on public.assignment_feedback for select
using (public.is_admin());

-- Mentors can read feedback for assignments in their internships
drop policy if exists "feedback_mentor_select" on public.assignment_feedback;
create policy "feedback_mentor_select" on public.assignment_feedback for select
using (
  exists (
    select 1 from public.assignments a
    join public.mentor_assignments ma on ma.internship_id = a.internship_id
    where a.id = assignment_feedback.assignment_id
      and ma.mentor_id = auth.uid()
  )
);

-- Aggregate view per assignment
create or replace view public.v_assignment_feedback_aggregate as
select
  a.id            as assignment_id,
  a.internship_id,
  a.title         as assignment_title,
  count(f.id)     as response_count,
  round(avg(f.session_rating)::numeric, 2)  as avg_session,
  round(avg(f.trainer_rating)::numeric, 2)  as avg_trainer,
  round(avg(f.overall_rating)::numeric, 2)  as avg_overall
from public.assignments a
left join public.assignment_feedback f on f.assignment_id = a.id
group by a.id, a.internship_id, a.title;
