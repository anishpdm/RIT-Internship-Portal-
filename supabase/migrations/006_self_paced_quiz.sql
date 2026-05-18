-- ============================================================
-- Migration 006: Self-paced quiz with scheduled window
--
-- Replaces the live-presenter model with a deadline-based one.
-- Mentor sets starts_at + ends_at; students self-pace within that window.
--
-- Also: cleans the 2 test responses so everyone restarts cleanly.
--
-- Run after 005_performance_security.sql. Idempotent except for the
-- one-shot DELETE of existing responses (which is the intent).
-- ============================================================

alter table public.quizzes
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at   timestamptz,
  add column if not exists mode      text default 'self_paced'
    check (mode in ('live', 'self_paced'));

-- Default existing rows to self-paced
update public.quizzes set mode = 'self_paced' where mode is null;

-- Clear any partial test responses (the 2 attempts you mentioned)
truncate table public.quiz_responses;

-- Reset every quiz back to draft so mentors must set a fresh window
update public.quizzes
set
  status = 'draft',
  current_question_index = 0,
  reveal_answer = false,
  started_at = null,
  ended_at = null;

-- Update quiz_responses_insert RLS so students can answer during the
-- scheduled window without needing the manual 'active' status from a presenter
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
      and (
        -- Self-paced mode: open if we're inside the window
        (q.mode = 'self_paced' and q.starts_at <= now() and now() <= q.ends_at)
        -- Live mode (legacy): keep working
        or (q.mode = 'live' and q.status = 'active')
      )
  )
);
