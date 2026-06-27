-- ============================================================
-- Migration 012: Fix v_student_quiz_aggregate
-- Bugs fixed:
--  1. total_questions was never exposed (display showed blank quiz column)
--  2. "ended" detection used only q.status='ended'; self-paced quizzes
--     close via ends_at < now() and may keep status 'live'/'active'.
--  3. quiz_score_pct used (correct / answered) as denominator, which
--     inflates scores. It now uses (correct / total questions in ended
--     quizzes) so unanswered questions correctly count as wrong.
-- ============================================================

drop view if exists public.v_student_quiz_aggregate;

create view public.v_student_quiz_aggregate
with (security_invoker = on)
as
with ended_quizzes as (
  select q.id, q.session_id
  from public.quizzes q
  where q.status = 'ended'
     or (q.ends_at is not null and q.ends_at < now())
)
select
  e.student_id,
  e.internship_id,
  count(distinct q.id) as total_quizzes,
  -- total questions across all ended quizzes for this internship
  count(distinct qq.id) as total_questions,
  count(distinct qq.id) filter (where r.id is not null) as questions_answered,
  count(distinct qq.id) filter (where r.is_correct = true) as questions_correct,
  case
    when count(distinct qq.id) > 0 then
      round(
        100.0
        * count(distinct qq.id) filter (where r.is_correct = true)
        / count(distinct qq.id)::numeric,
        2
      )
    else 0
  end as quiz_score_pct
from public.enrollments e
left join public.sessions s on s.internship_id = e.internship_id
left join ended_quizzes q on q.session_id = s.id
left join public.quiz_questions qq on qq.quiz_id = q.id
left join public.quiz_responses r on r.question_id = qq.id and r.student_id = e.student_id
group by e.student_id, e.internship_id;

grant select on public.v_student_quiz_aggregate to authenticated;
