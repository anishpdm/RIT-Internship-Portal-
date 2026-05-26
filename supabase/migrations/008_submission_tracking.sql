-- ============================================================
-- Migration 008: Submission tracking — late flag + resubmission count
--
-- Adds two columns to submissions:
--   resubmission_count  — increments each time a student resubmits
--   first_submitted_at  — timestamp of their FIRST submission; never updated
--
-- Together these let us show "Late" and "Resubmitted" badges
-- without querying history tables.
--
-- Run after 007_manual_attendance.sql. Idempotent.
-- ============================================================

alter table public.submissions
  add column if not exists resubmission_count integer not null default 0,
  add column if not exists first_submitted_at  timestamptz;

-- Backfill existing rows: treat submitted_at as the first submission
update public.submissions
set first_submitted_at = submitted_at
where first_submitted_at is null;
