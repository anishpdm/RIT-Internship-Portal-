-- ============================================================
-- Migration 005: Performance & security fixes flagged by Supabase Advisor
--
-- Fixes:
-- 1. "Auth RLS Initialization Plan" warnings — every RLS policy that
--    calls auth.uid() directly is rewritten to use (select auth.uid()).
--    This makes Postgres cache the call per query instead of per row,
--    a HUGE win on tables with many rows.
--
-- 2. "Security Definer View" critical warnings — recreate the four
--    aggregate views with security_invoker=on so RLS is enforced by the
--    querying user, not the view creator.
--
-- Run after 004_feedback_visibility.sql. Idempotent.
-- ============================================================

-- ============================================================
-- PART 1 — RLS policy rewrites for performance
-- ============================================================

-- Helper functions: replace direct auth.uid() with cached (select auth.uid())
create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

create or replace function public.is_mentor()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'mentor'
  );
$$;

-- ---------- profiles ----------
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select
using (
  id = (select auth.uid())
  or public.is_admin()
  or public.is_mentor()
);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update
using (id = (select auth.uid()) or public.is_admin())
with check (id = (select auth.uid()) or public.is_admin());

-- ---------- internships ----------
drop policy if exists "internships_select" on public.internships;
create policy "internships_select" on public.internships for select
using (
  public.is_admin()
  or public.is_mentor()
  or exists (
    select 1 from public.enrollments
    where enrollments.internship_id = internships.id
      and enrollments.student_id = (select auth.uid())
  )
);

-- ---------- levels ----------
drop policy if exists "levels_select" on public.levels;
create policy "levels_select" on public.levels for select
using (
  public.is_admin()
  or public.is_mentor()
  or exists (
    select 1 from public.enrollments
    where enrollments.internship_id = levels.internship_id
      and enrollments.student_id = (select auth.uid())
  )
);

-- ---------- mentor_assignments ----------
drop policy if exists "mentor_assignments_select" on public.mentor_assignments;
create policy "mentor_assignments_select" on public.mentor_assignments for select
using (
  public.is_admin()
  or mentor_id = (select auth.uid())
);

-- ---------- enrollments ----------
drop policy if exists "enrollments_select" on public.enrollments;
create policy "enrollments_select" on public.enrollments for select
using (
  public.is_admin()
  or student_id = (select auth.uid())
  or exists (
    select 1 from public.mentor_assignments ma
    where ma.internship_id = enrollments.internship_id
      and ma.mentor_id = (select auth.uid())
  )
);

-- ---------- attendance ----------
drop policy if exists "attendance_select" on public.attendance;
create policy "attendance_select" on public.attendance for select
using (
  public.is_admin()
  or student_id = (select auth.uid())
  or exists (
    select 1 from public.sessions s
    join public.mentor_assignments ma on ma.internship_id = s.internship_id
    where s.id = attendance.session_id
      and ma.mentor_id = (select auth.uid())
  )
);

drop policy if exists "attendance_insert_own" on public.attendance;
create policy "attendance_insert_own" on public.attendance for insert
with check (student_id = (select auth.uid()));

drop policy if exists "attendance_update_own" on public.attendance;
create policy "attendance_update_own" on public.attendance for update
using (student_id = (select auth.uid()))
with check (student_id = (select auth.uid()));

-- ---------- Quiz tables ----------
drop policy if exists "quizzes_select" on public.quizzes;
create policy "quizzes_select" on public.quizzes for select
using (
  public.is_admin()
  or (public.is_mentor() and exists (
    select 1 from public.sessions s
    join public.mentor_assignments ma on ma.internship_id = s.internship_id
    where s.id = quizzes.session_id and ma.mentor_id = (select auth.uid())
  ))
  or exists (
    select 1 from public.sessions s
    join public.enrollments e on e.internship_id = s.internship_id
    where s.id = quizzes.session_id and e.student_id = (select auth.uid())
  )
);

drop policy if exists "quizzes_write" on public.quizzes;
create policy "quizzes_write" on public.quizzes for all
using (
  public.is_admin()
  or exists (
    select 1 from public.sessions s
    join public.mentor_assignments ma on ma.internship_id = s.internship_id
    where s.id = quizzes.session_id and ma.mentor_id = (select auth.uid())
  )
)
with check (
  public.is_admin()
  or exists (
    select 1 from public.sessions s
    join public.mentor_assignments ma on ma.internship_id = s.internship_id
    where s.id = quizzes.session_id and ma.mentor_id = (select auth.uid())
  )
);

drop policy if exists "quiz_questions_select" on public.quiz_questions;
create policy "quiz_questions_select" on public.quiz_questions for select
using (
  public.is_admin()
  or exists (
    select 1 from public.quizzes q
    join public.sessions s on s.id = q.session_id
    join public.mentor_assignments ma on ma.internship_id = s.internship_id
    where q.id = quiz_questions.quiz_id and ma.mentor_id = (select auth.uid())
  )
  or exists (
    select 1 from public.quizzes q
    join public.sessions s on s.id = q.session_id
    join public.enrollments e on e.internship_id = s.internship_id
    where q.id = quiz_questions.quiz_id and e.student_id = (select auth.uid())
  )
);

drop policy if exists "quiz_questions_write" on public.quiz_questions;
create policy "quiz_questions_write" on public.quiz_questions for all
using (
  public.is_admin()
  or exists (
    select 1 from public.quizzes q
    join public.sessions s on s.id = q.session_id
    join public.mentor_assignments ma on ma.internship_id = s.internship_id
    where q.id = quiz_questions.quiz_id and ma.mentor_id = (select auth.uid())
  )
)
with check (
  public.is_admin()
  or exists (
    select 1 from public.quizzes q
    join public.sessions s on s.id = q.session_id
    join public.mentor_assignments ma on ma.internship_id = s.internship_id
    where q.id = quiz_questions.quiz_id and ma.mentor_id = (select auth.uid())
  )
);

drop policy if exists "quiz_responses_select" on public.quiz_responses;
create policy "quiz_responses_select" on public.quiz_responses for select
using (
  public.is_admin()
  or student_id = (select auth.uid())
  or exists (
    select 1 from public.quiz_questions qq
    join public.quizzes q on q.id = qq.quiz_id
    join public.sessions s on s.id = q.session_id
    join public.mentor_assignments ma on ma.internship_id = s.internship_id
    where qq.id = quiz_responses.question_id and ma.mentor_id = (select auth.uid())
  )
);

drop policy if exists "quiz_responses_insert" on public.quiz_responses;
create policy "quiz_responses_insert" on public.quiz_responses for insert
with check (
  student_id = (select auth.uid())
  and exists (
    select 1 from public.quiz_questions qq
    join public.quizzes q on q.id = qq.quiz_id
    join public.sessions s on s.id = q.session_id
    join public.enrollments e on e.internship_id = s.internship_id
    where qq.id = quiz_responses.question_id
      and e.student_id = (select auth.uid())
      and q.status = 'active'
  )
);

-- ---------- Feedback ----------
drop policy if exists "feedback_student_own" on public.assignment_feedback;
create policy "feedback_student_own" on public.assignment_feedback for all
using (student_id = (select auth.uid()))
with check (student_id = (select auth.uid()));

drop policy if exists "feedback_admin_select" on public.assignment_feedback;
create policy "feedback_admin_select" on public.assignment_feedback for select
using (public.is_admin());

drop policy if exists "feedback_mentor_select" on public.assignment_feedback;
create policy "feedback_mentor_select" on public.assignment_feedback for select
using (
  exists (
    select 1 from public.assignments a
    join public.internships i on i.id = a.internship_id
    join public.mentor_assignments ma on ma.internship_id = a.internship_id
    where a.id = assignment_feedback.assignment_id
      and ma.mentor_id = (select auth.uid())
      and i.feedback_visible_to_mentors = true
  )
);

-- ============================================================
-- PART 2 — Recreate views with security_invoker=on
-- ============================================================
-- Views in Supabase default to SECURITY DEFINER, bypassing RLS.
-- Setting security_invoker=on makes them respect the calling user's RLS.

drop view if exists public.v_internship_leaderboard cascade;
create view public.v_internship_leaderboard
with (security_invoker = on)
as
select
  e.internship_id,
  e.student_id,
  p.full_name,
  p.email,
  e.current_level,
  e.status,
  coalesce(e.total_score, 0)                                            as total_score,
  (select count(*) from public.submissions s
   join public.assignments a on a.id = s.assignment_id
   where s.student_id = e.student_id and a.internship_id = e.internship_id
     and s.status = 'graded')                                           as graded_submissions,
  (select count(*) from public.attendance att
   join public.sessions ss on ss.id = att.session_id
   where att.student_id = e.student_id and ss.internship_id = e.internship_id
     and att.status in ('present', 'partial'))                          as attended_sessions
from public.enrollments e
join public.profiles p on p.id = e.student_id;

drop view if exists public.v_student_quiz_aggregate cascade;
create view public.v_student_quiz_aggregate
with (security_invoker = on)
as
select
  e.student_id,
  e.internship_id,
  count(distinct q.id) filter (where q.status = 'ended') as total_quizzes,
  count(distinct qq.id) filter (where r.id is not null) as questions_answered,
  count(distinct qq.id) filter (where r.is_correct = true) as questions_correct,
  case
    when count(distinct qq.id) filter (where r.id is not null) > 0 then
      round(
        100.0
        * count(distinct qq.id) filter (where r.is_correct = true)
        / count(distinct qq.id) filter (where r.id is not null)::numeric,
        2
      )
    else 0
  end as quiz_score_pct
from public.enrollments e
left join public.sessions s on s.internship_id = e.internship_id
left join public.quizzes q on q.session_id = s.id
left join public.quiz_questions qq on qq.quiz_id = q.id
left join public.quiz_responses r on r.question_id = qq.id and r.student_id = e.student_id
group by e.student_id, e.internship_id;

drop view if exists public.v_assignment_feedback_aggregate cascade;
create view public.v_assignment_feedback_aggregate
with (security_invoker = on)
as
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

drop view if exists public.v_internship_feedback_summary cascade;
create view public.v_internship_feedback_summary
with (security_invoker = on)
as
select
  i.id                                          as internship_id,
  i.title                                       as internship_title,
  count(f.id)                                   as response_count,
  count(distinct f.student_id)                  as unique_responders,
  round(avg(f.session_rating)::numeric, 2)      as avg_session,
  round(avg(f.trainer_rating)::numeric, 2)      as avg_trainer,
  round(avg(f.overall_rating)::numeric, 2)      as avg_overall
from public.internships i
left join public.assignments a on a.internship_id = i.id
left join public.assignment_feedback f on f.assignment_id = a.id
group by i.id, i.title;

-- ============================================================
-- PART 3 — Helpful indexes for the most-common query patterns
-- ============================================================
-- These speed up the joins inside RLS policies.

create index if not exists enrollments_student_id_idx
  on public.enrollments(student_id);
create index if not exists enrollments_internship_id_idx
  on public.enrollments(internship_id);
create index if not exists mentor_assignments_mentor_id_idx
  on public.mentor_assignments(mentor_id);
create index if not exists mentor_assignments_internship_id_idx
  on public.mentor_assignments(internship_id);
create index if not exists sessions_internship_id_idx
  on public.sessions(internship_id);
create index if not exists assignments_internship_id_idx
  on public.assignments(internship_id);
create index if not exists submissions_student_id_idx
  on public.submissions(student_id);
create index if not exists submissions_assignment_id_idx
  on public.submissions(assignment_id);
create index if not exists attendance_student_id_idx
  on public.attendance(student_id);
create index if not exists attendance_session_id_idx
  on public.attendance(session_id);

-- Analyze tables so the planner picks the new indexes
analyze public.profiles;
analyze public.internships;
analyze public.enrollments;
analyze public.mentor_assignments;
analyze public.sessions;
analyze public.assignments;
analyze public.submissions;
analyze public.attendance;
analyze public.quizzes;
analyze public.quiz_questions;
analyze public.quiz_responses;
analyze public.assignment_feedback;
