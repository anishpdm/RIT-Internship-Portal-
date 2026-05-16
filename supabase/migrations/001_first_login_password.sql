-- ============================================================
-- Migration: First-login forced password change
-- Run this once in Supabase SQL Editor after deploying the
-- new code. Safe to run multiple times — uses IF NOT EXISTS.
-- ============================================================

alter table public.profiles
  add column if not exists must_change_password boolean default false;

-- Mark all existing users as not needing change (they already have working passwords)
update public.profiles
set must_change_password = false
where must_change_password is null;

-- Add a helper RPC the app uses to clear the flag for the calling user
create or replace function public.clear_must_change_password()
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles
  set must_change_password = false
  where id = auth.uid();
$$;

grant execute on function public.clear_must_change_password() to authenticated;
