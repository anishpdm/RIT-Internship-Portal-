-- ============================================================
-- Migration 007: Manual attendance marking by mentor/admin
--
-- Adds two columns to track when attendance was marked manually
-- (vs by the student via live code / heartbeat / dwell timer),
-- and policies so mentors/admins can write to other students' rows.
--
-- Run after 006_self_paced_quiz.sql. Idempotent.
-- ============================================================

alter table public.attendance
  add column if not exists marked_manually_by uuid references public.profiles(id),
  add column if not exists marked_manually_at timestamptz;

create index if not exists attendance_marked_manually_by_idx
  on public.attendance(marked_manually_by);

-- Allow mentors to update/insert attendance for students in their internships
drop policy if exists "attendance_mentor_write" on public.attendance;
create policy "attendance_mentor_write" on public.attendance for all
using (
  exists (
    select 1 from public.sessions s
    join public.mentor_assignments ma on ma.internship_id = s.internship_id
    where s.id = attendance.session_id
      and ma.mentor_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.sessions s
    join public.mentor_assignments ma on ma.internship_id = s.internship_id
    where s.id = attendance.session_id
      and ma.mentor_id = (select auth.uid())
  )
);

-- Allow admins to do everything
drop policy if exists "attendance_admin_write" on public.attendance;
create policy "attendance_admin_write" on public.attendance for all
using (public.is_admin())
with check (public.is_admin());
