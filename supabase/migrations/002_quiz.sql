-- ============================================================
-- Migration 002: Live Quiz feature
-- Run after 001_first_login_password.sql. Idempotent.
-- ============================================================

do $$ begin
  create type quiz_status as enum ('draft', 'active', 'reveal', 'ended');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.quizzes (
  id                       uuid primary key default gen_random_uuid(),
  session_id               uuid not null references public.sessions(id) on delete cascade,
  title                    text not null,
  status                   quiz_status not null default 'draft',
  current_question_index   integer not null default 0,
  reveal_answer            boolean not null default false,
  created_by               uuid references public.profiles(id),
  created_at               timestamptz not null default now(),
  started_at               timestamptz,
  ended_at                 timestamptz,
  unique (session_id)
);
create index if not exists quizzes_session_idx on public.quizzes(session_id);

create table if not exists public.quiz_questions (
  id                  uuid primary key default gen_random_uuid(),
  quiz_id             uuid not null references public.quizzes(id) on delete cascade,
  order_index         integer not null default 0,
  question_text       text not null,
  options             jsonb not null default '[]'::jsonb,
  correct_option      integer not null default 0,
  time_limit_seconds  integer not null default 30,
  created_at          timestamptz not null default now()
);
create index if not exists quiz_questions_quiz_idx on public.quiz_questions(quiz_id, order_index);

create table if not exists public.quiz_responses (
  id                 uuid primary key default gen_random_uuid(),
  question_id        uuid not null references public.quiz_questions(id) on delete cascade,
  student_id         uuid not null references public.profiles(id) on delete cascade,
  selected_option    integer not null,
  is_correct         boolean not null,
  response_time_ms   integer,
  submitted_at       timestamptz not null default now(),
  unique (question_id, student_id)
);
create index if not exists quiz_responses_question_idx on public.quiz_responses(question_id);
create index if not exists quiz_responses_student_idx on public.quiz_responses(student_id);

alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_responses enable row level security;

-- Helper: which internship a quiz belongs to
create or replace function public.quiz_internship_id(p_quiz_id uuid)
returns uuid language sql stable as $$
  select s.internship_id from public.sessions s
  join public.quizzes q on q.session_id = s.id
  where q.id = p_quiz_id
$$;

-- ----- Policies -----

drop policy if exists "quizzes_select" on public.quizzes;
create policy "quizzes_select" on public.quizzes for select
using (
  public.is_admin()
  or public.is_mentor() and exists (
    select 1 from public.sessions s
    join public.mentor_assignments ma on ma.internship_id = s.internship_id
    where s.id = quizzes.session_id and ma.mentor_id = auth.uid()
  )
  or exists (
    select 1 from public.sessions s
    join public.enrollments e on e.internship_id = s.internship_id
    where s.id = quizzes.session_id and e.student_id = auth.uid()
  )
);

drop policy if exists "quizzes_write" on public.quizzes;
create policy "quizzes_write" on public.quizzes for all
using (
  public.is_admin()
  or exists (
    select 1 from public.sessions s
    join public.mentor_assignments ma on ma.internship_id = s.internship_id
    where s.id = quizzes.session_id and ma.mentor_id = auth.uid()
  )
)
with check (
  public.is_admin()
  or exists (
    select 1 from public.sessions s
    join public.mentor_assignments ma on ma.internship_id = s.internship_id
    where s.id = quizzes.session_id and ma.mentor_id = auth.uid()
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
    where q.id = quiz_questions.quiz_id and ma.mentor_id = auth.uid()
  )
  or exists (
    select 1 from public.quizzes q
    join public.sessions s on s.id = q.session_id
    join public.enrollments e on e.internship_id = s.internship_id
    where q.id = quiz_questions.quiz_id and e.student_id = auth.uid()
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
    where q.id = quiz_questions.quiz_id and ma.mentor_id = auth.uid()
  )
)
with check (
  public.is_admin()
  or exists (
    select 1 from public.quizzes q
    join public.sessions s on s.id = q.session_id
    join public.mentor_assignments ma on ma.internship_id = s.internship_id
    where q.id = quiz_questions.quiz_id and ma.mentor_id = auth.uid()
  )
);

drop policy if exists "quiz_responses_select" on public.quiz_responses;
create policy "quiz_responses_select" on public.quiz_responses for select
using (
  public.is_admin()
  or student_id = auth.uid()
  or exists (
    select 1 from public.quiz_questions qq
    join public.quizzes q on q.id = qq.quiz_id
    join public.sessions s on s.id = q.session_id
    join public.mentor_assignments ma on ma.internship_id = s.internship_id
    where qq.id = quiz_responses.question_id and ma.mentor_id = auth.uid()
  )
);

drop policy if exists "quiz_responses_insert" on public.quiz_responses;
create policy "quiz_responses_insert" on public.quiz_responses for insert
with check (
  student_id = auth.uid()
  and exists (
    select 1 from public.quiz_questions qq
    join public.quizzes q on q.id = qq.quiz_id
    join public.sessions s on s.id = q.session_id
    join public.enrollments e on e.internship_id = s.internship_id
    where qq.id = quiz_responses.question_id
    and e.student_id = auth.uid()
    and q.status = 'active'
  )
);

-- Per-student quiz aggregate per internship
create or replace view public.v_student_quiz_aggregate as
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
