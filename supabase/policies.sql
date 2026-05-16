-- =====================================================================
-- ForgeML — Row-Level Security policies
-- Run AFTER schema.sql.
-- =====================================================================

-- Helper: read current user's role from profiles
create or replace function public.current_role()
returns user_role
language sql stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.is_mentor()
returns boolean
language sql stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'mentor');
$$;

-- Mentor's internships
create or replace function public.mentor_internships(uid uuid)
returns setof uuid
language sql stable
security definer
set search_path = public
as $$
  select internship_id from public.mentor_assignments where mentor_id = uid;
$$;

-- Student's internships
create or replace function public.student_internships(uid uuid)
returns setof uuid
language sql stable
security definer
set search_path = public
as $$
  select internship_id from public.enrollments where student_id = uid;
$$;

-- =====================================================================
-- Enable RLS on every table
-- =====================================================================

alter table public.profiles            enable row level security;
alter table public.internships         enable row level security;
alter table public.levels              enable row level security;
alter table public.mentor_assignments  enable row level security;
alter table public.enrollments         enable row level security;
alter table public.sessions            enable row level security;
alter table public.session_materials   enable row level security;
alter table public.attendance          enable row level security;
alter table public.assignments         enable row level security;
alter table public.submissions         enable row level security;
alter table public.audit_logs          enable row level security;

-- =====================================================================
-- profiles
-- =====================================================================

drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles for select
  using (id = auth.uid() or public.is_admin() or public.is_mentor());

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles for update
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_admin_all on public.profiles for all
  using (public.is_admin()) with check (public.is_admin());

-- =====================================================================
-- internships
-- =====================================================================

drop policy if exists internships_admin on public.internships;
create policy internships_admin on public.internships for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists internships_mentor_read on public.internships;
create policy internships_mentor_read on public.internships for select
  using (id in (select public.mentor_internships(auth.uid())));

drop policy if exists internships_student_read on public.internships;
create policy internships_student_read on public.internships for select
  using (id in (select public.student_internships(auth.uid())));

-- =====================================================================
-- levels
-- =====================================================================

drop policy if exists levels_admin on public.levels;
create policy levels_admin on public.levels for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists levels_visible on public.levels;
create policy levels_visible on public.levels for select using (
  internship_id in (select public.mentor_internships(auth.uid()))
  or internship_id in (select public.student_internships(auth.uid()))
);

-- =====================================================================
-- mentor_assignments
-- =====================================================================

drop policy if exists ma_admin on public.mentor_assignments;
create policy ma_admin on public.mentor_assignments for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists ma_self_read on public.mentor_assignments;
create policy ma_self_read on public.mentor_assignments for select
  using (mentor_id = auth.uid());

-- =====================================================================
-- enrollments
-- =====================================================================

drop policy if exists enroll_admin on public.enrollments;
create policy enroll_admin on public.enrollments for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists enroll_mentor_read on public.enrollments;
create policy enroll_mentor_read on public.enrollments for select
  using (internship_id in (select public.mentor_internships(auth.uid())));

drop policy if exists enroll_mentor_update on public.enrollments;
create policy enroll_mentor_update on public.enrollments for update
  using (internship_id in (select public.mentor_internships(auth.uid())))
  with check (internship_id in (select public.mentor_internships(auth.uid())));

drop policy if exists enroll_student_read on public.enrollments;
create policy enroll_student_read on public.enrollments for select
  using (student_id = auth.uid());

-- =====================================================================
-- sessions
-- =====================================================================

drop policy if exists sessions_admin on public.sessions;
create policy sessions_admin on public.sessions for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists sessions_mentor_all on public.sessions;
create policy sessions_mentor_all on public.sessions for all
  using (internship_id in (select public.mentor_internships(auth.uid())))
  with check (internship_id in (select public.mentor_internships(auth.uid())));

drop policy if exists sessions_student_read on public.sessions;
create policy sessions_student_read on public.sessions for select
  using (internship_id in (select public.student_internships(auth.uid())));

-- =====================================================================
-- session_materials
-- =====================================================================

drop policy if exists materials_admin on public.session_materials;
create policy materials_admin on public.session_materials for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists materials_mentor_all on public.session_materials;
create policy materials_mentor_all on public.session_materials for all
  using (
    session_id in (
      select s.id from public.sessions s
      where s.internship_id in (select public.mentor_internships(auth.uid()))
    )
  )
  with check (
    session_id in (
      select s.id from public.sessions s
      where s.internship_id in (select public.mentor_internships(auth.uid()))
    )
  );

drop policy if exists materials_student_read on public.session_materials;
create policy materials_student_read on public.session_materials for select using (
  session_id in (
    select s.id from public.sessions s
    where s.internship_id in (select public.student_internships(auth.uid()))
  )
);

-- =====================================================================
-- attendance
-- =====================================================================

drop policy if exists att_admin on public.attendance;
create policy att_admin on public.attendance for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists att_mentor_read on public.attendance;
create policy att_mentor_read on public.attendance for select using (
  session_id in (
    select s.id from public.sessions s
    where s.internship_id in (select public.mentor_internships(auth.uid()))
  )
);

drop policy if exists att_student_self on public.attendance;
create policy att_student_self on public.attendance for all
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

-- =====================================================================
-- assignments
-- =====================================================================

drop policy if exists assign_admin on public.assignments;
create policy assign_admin on public.assignments for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists assign_mentor_all on public.assignments;
create policy assign_mentor_all on public.assignments for all
  using (internship_id in (select public.mentor_internships(auth.uid())))
  with check (internship_id in (select public.mentor_internships(auth.uid())));

drop policy if exists assign_student_read on public.assignments;
create policy assign_student_read on public.assignments for select
  using (internship_id in (select public.student_internships(auth.uid())));

-- =====================================================================
-- submissions
-- =====================================================================

drop policy if exists sub_admin on public.submissions;
create policy sub_admin on public.submissions for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists sub_mentor_read on public.submissions;
create policy sub_mentor_read on public.submissions for select using (
  assignment_id in (
    select a.id from public.assignments a
    where a.internship_id in (select public.mentor_internships(auth.uid()))
  )
);

drop policy if exists sub_mentor_update on public.submissions;
create policy sub_mentor_update on public.submissions for update using (
  assignment_id in (
    select a.id from public.assignments a
    where a.internship_id in (select public.mentor_internships(auth.uid()))
  )
) with check (
  assignment_id in (
    select a.id from public.assignments a
    where a.internship_id in (select public.mentor_internships(auth.uid()))
  )
);

drop policy if exists sub_student_self_read on public.submissions;
create policy sub_student_self_read on public.submissions for select
  using (student_id = auth.uid());

drop policy if exists sub_student_self_write on public.submissions;
create policy sub_student_self_write on public.submissions for insert
  with check (student_id = auth.uid());

drop policy if exists sub_student_self_update on public.submissions;
create policy sub_student_self_update on public.submissions for update
  using (student_id = auth.uid() and status in ('submitted','returned'))
  with check (student_id = auth.uid());

-- =====================================================================
-- audit_logs (admin-only read; writes from server with service role)
-- =====================================================================

drop policy if exists audit_admin_read on public.audit_logs;
create policy audit_admin_read on public.audit_logs for select
  using (public.is_admin());
