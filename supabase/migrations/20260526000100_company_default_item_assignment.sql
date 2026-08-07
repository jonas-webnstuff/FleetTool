alter table public.companies
  add column if not exists default_item_assignment_type text not null default 'person'

alter table public.companies
  drop constraint if exists companies_default_item_assignment_type_check

alter table public.companies
  add constraint companies_default_item_assignment_type_check
  check (default_item_assignment_type in ('person', 'vehicle'))
