-- ============================================================
-- Migration 009: Fix assignment scoring in leaderboard
--
-- THE BUG: v_internship_leaderboard reads total_score from
-- enrollments.total_score which is a stored value computed only
-- over graded submissions. A student who submitted 2 assignments
-- and scored 99% on both appears at 99%, ranking ABOVE a student
-- who submitted all 4 and averaged 95%.
--
-- THE FIX: Compute total_score dynamically from ALL assignments
-- in the internship. Unsubmitted or ungraded = 0, not excluded.
-- Formula:
--   total_score = Σ(score_pct × weight) / Σ(all weights in internship)
-- where score_pct = (graded_score / max_score) × 100 for graded,
--                   0 for everything else.
--
-- This view change propagates automatically to every leaderboard
-- and performance page — no code changes needed.
-- ============================================================

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

  -- ── Assignment score (THE FIX) ──────────────────────────────
  -- Denominator = sum of ALL assignment weights in the internship.
  -- Numerator   = sum of (score_pct × weight) for graded only.
  -- Unsubmitted / ungraded / pending assignments contribute 0.
  case
    when agg.total_weight > 0
      then round(
             (coalesce(agg.earned_weight, 0) / agg.total_weight)::numeric,
             2
           )
    else 0
  end                                      as total_score,

  coalesce(agg.graded_count, 0)            as graded_submissions,
  coalesce(att_agg.attended, 0)            as attended_sessions

from public.enrollments e
join public.profiles p on p.id = e.student_id

-- ── Per-student, per-internship submission aggregate ────────────
left join lateral (
  select
    sum(a.weight)                                           as total_weight,
    sum(
      case
        when sub.status = 'graded'
         and sub.score  is not null
         and a.max_score > 0
        then (sub.score::numeric / a.max_score) * 100.0 * a.weight
        else 0
      end
    )                                                       as earned_weight,
    count(case when sub.status = 'graded' then 1 end)       as graded_count
  from public.assignments a
  left join public.submissions sub
         on sub.assignment_id = a.id
        and sub.student_id    = e.student_id
  where a.internship_id = e.internship_id
) agg on true

-- ── Attendance ──────────────────────────────────────────────────
left join lateral (
  select count(*) as attended
  from public.attendance att
  join public.sessions s on s.id = att.session_id
  where s.internship_id = e.internship_id
    and att.student_id  = e.student_id
    and att.status in ('present', 'partial')
) att_agg on true;
