alter table public.companies
  add column if not exists allow_admin_assignment boolean not null default true

alter table public.companies
  add column if not exists allow_manager_assignment boolean not null default true
