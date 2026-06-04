-- Add template_id to internships so cloned cohorts track their source
alter table public.internships
  add column if not exists template_id uuid references public.internships(id) on delete set null;

create index if not exists idx_internships_template_id
  on public.internships(template_id);
