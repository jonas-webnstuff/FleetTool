create type public.invoice_status as enum ('draft', 'sent', 'paid')

create table if not exists public.company_invoice_settings (
  company_id uuid primary key references public.companies(id) on delete cascade,
  invoice_prefix text not null default '',
  next_invoice_sequence integer not null default 1,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
)

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  invoice_number text not null,
  issue_date date not null,
  due_date date not null,
  status public.invoice_status not null default 'draft',
  currency text not null default 'SEK',
  net_total numeric(14,2) not null default 0,
  vat_total numeric(14,2) not null default 0,
  gross_total numeric(14,2) not null default 0,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (company_id, invoice_number)
)

create table if not exists public.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  line_index integer not null,
  line_type text not null default 'item' check (line_type in ('item', 'text')),
  description text not null,
  quantity numeric(14,3) not null,
  unit_price numeric(14,2) not null,
  vat_rate numeric(5,2) not null check (vat_rate in (0, 6, 12, 25)),
  net_total numeric(14,2) not null,
  vat_total numeric(14,2) not null,
  gross_total numeric(14,2) not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (invoice_id, line_index)
)

create index if not exists idx_invoices_company_issue on public.invoices(company_id, issue_date desc)

create index if not exists idx_invoices_company_status on public.invoices(company_id, status)

create index if not exists idx_invoice_lines_invoice on public.invoice_lines(invoice_id)

create trigger set_company_invoice_settings_updated_at
before update on public.company_invoice_settings
for each row
execute function public.set_updated_at()

create trigger set_invoices_updated_at
before update on public.invoices
for each row
execute function public.set_updated_at()

create or replace function public.reserve_next_invoice_number(
  company_id_input uuid,
  issue_date_input date default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  org_company_id uuid;
  next_sequence integer;
  invoice_prefix_value text;
  issue_year text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  org_company_id := public.current_company_id();
  if org_company_id is null or org_company_id <> company_id_input then
    raise exception 'Company access denied';
  end if;

  insert into public.company_invoice_settings (company_id)
  values (company_id_input)
  on conflict (company_id) do nothing;

  update public.company_invoice_settings
  set next_invoice_sequence = next_invoice_sequence + 1
  where company_id = company_id_input
  returning next_invoice_sequence - 1, invoice_prefix into next_sequence, invoice_prefix_value;

  issue_year := to_char(coalesce(issue_date_input, current_date), 'YYYY');

  if coalesce(invoice_prefix_value, '') <> '' then
    return invoice_prefix_value || '-' || issue_year || '-' || lpad(next_sequence::text, 4, '0');
  end if;

  return issue_year || '-' || lpad(next_sequence::text, 4, '0');
end;
$$

revoke all on function public.reserve_next_invoice_number(uuid, date) from public

grant execute on function public.reserve_next_invoice_number(uuid, date) to authenticated

alter table public.company_invoice_settings enable row level security

alter table public.invoices enable row level security

alter table public.invoice_lines enable row level security

create policy "invoice_settings_select_company"
on public.company_invoice_settings
for select
using (company_id = public.current_company_id())

create policy "invoice_settings_manage_admins"
on public.company_invoice_settings
for all
using (public.has_company_role(company_id, array['owner', 'admin']::public.app_role[]))
with check (public.has_company_role(company_id, array['owner', 'admin']::public.app_role[]))

create policy "invoices_select_company"
on public.invoices
for select
using (company_id = public.current_company_id())

create policy "invoices_manage_managers"
on public.invoices
for all
using (public.has_company_role(company_id, array['owner', 'admin', 'manager']::public.app_role[]))
with check (public.has_company_role(company_id, array['owner', 'admin', 'manager']::public.app_role[]))

create policy "invoice_lines_select_company"
on public.invoice_lines
for select
using (
  exists (
    select 1
    from public.invoices i
    where i.id = invoice_lines.invoice_id
      and i.company_id = public.current_company_id()
  )
)

create policy "invoice_lines_manage_managers"
on public.invoice_lines
for all
using (
  exists (
    select 1
    from public.invoices i
    where i.id = invoice_lines.invoice_id
      and public.has_company_role(i.company_id, array['owner', 'admin', 'manager']::public.app_role[])
  )
)
with check (
  exists (
    select 1
    from public.invoices i
    where i.id = invoice_lines.invoice_id
      and public.has_company_role(i.company_id, array['owner', 'admin', 'manager']::public.app_role[])
  )
)
