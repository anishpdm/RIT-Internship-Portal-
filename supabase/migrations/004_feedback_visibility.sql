-- ============================================================
-- Migration 004: Per-internship feedback visibility for mentors
-- Run after 003_feedback.sql. Idempotent.
-- ============================================================

alter table public.internships
  add column if not exists feedback_visible_to_mentors boolean default false;

-- Update the mentor select policy on assignment_feedback to also require
-- the internship's flag to be turned on.

drop policy if exists "feedback_mentor_select" on public.assignment_feedback;
create policy "feedback_mentor_select" on public.assignment_feedback for select
using (
  exists (
    select 1 from public.assignments a
    join public.internships i on i.id = a.internship_id
    join public.mentor_assignments ma on ma.internship_id = a.internship_id
    where a.id = assignment_feedback.assignment_id
      and ma.mentor_id = auth.uid()
      and i.feedback_visible_to_mentors = true
  )
);

-- Aggregate view: feedback rollup per internship for the overview pages
create or replace view public.v_internship_feedback_summary as
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
