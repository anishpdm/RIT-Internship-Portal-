-- ============================================================
-- Migration 010: Fair scoring — due-date aware + submission tiebreaker
--
-- Changes:
-- 1. Denominator only counts assignments where:
--      due_at IS NULL  (no deadline = always active)
--      OR due_at <= now() (deadline passed)
--    Future assignments don't penalise students yet.
--
-- 2. Adds submitted_count — how many submissions the student
--    has made (any status). Used as a tiebreaker:
--      same combined → more graded wins
--      still tied → more submitted wins
--    So Jaidev (5 submitted, 4 graded) > CHRISSAN (4 submitted, 4 graded)
--    when both have the same graded scores.
-- ============================================================

drop view if exists public.v_internship_leaderboard cascade;

create view public.v_internship_leaderboard as
select
  e.internship_id,
  e.student_id,
  p.full_name,
  p.email,
  e.current_level,
  e.status,

  -- ── Assignment score ─────────────────────────────────────
  -- Denominator: assignments that are past-due OR have no due date.
  -- Future-dated assignments are excluded (don't penalise yet).
  -- Unsubmitted / ungraded past-due assignments contribute 0.
  case
    when agg.total_weight > 0
      then round(
             (coalesce(agg.earned_weight, 0) / agg.total_weight)::numeric,
             2
           )
    else 0
  end                                       as total_score,

  coalesce(agg.graded_count,     0)         as graded_submissions,
  coalesce(sub_agg.submitted_count, 0)      as submitted_count,
  coalesce(att_agg.attended,     0)         as attended_sessions

from public.enrollments e
join public.profiles p on p.id = e.student_id

-- ── Graded score aggregate ──────────────────────────────────
left join lateral (
  select
    -- Only past-due (or no due date) assignments form the denominator
    sum(a.weight) filter (
      where a.due_at is null or a.due_at <= now()
    )                                                           as total_weight,

    sum(
      case
        when sub.status = 'graded'
         and sub.score  is not null
         and a.max_score > 0
        then (sub.score::numeric / a.max_score) * 100.0 * a.weight
        else 0
      end
    )                                                           as earned_weight,

    count(*) filter (where sub.status = 'graded')              as graded_count
  from public.assignments a
  left join public.submissions sub
         on sub.assignment_id = a.id
        and sub.student_id    = e.student_id
  where a.internship_id = e.internship_id
) agg on true

-- ── Submission count (any status) ───────────────────────────
left join lateral (
  select count(*) as submitted_count
  from public.submissions sub2
  join public.assignments a2 on a2.id = sub2.assignment_id
  where sub2.student_id    = e.student_id
    and a2.internship_id   = e.internship_id
) sub_agg on true

-- ── Attendance ──────────────────────────────────────────────
left join lateral (
  select count(*) as attended
  from public.attendance att
  join public.sessions s on s.id = att.session_id
  where s.internship_id = e.internship_id
    and att.student_id  = e.student_id
    and att.status in ('present', 'partial')
) att_agg on true;
