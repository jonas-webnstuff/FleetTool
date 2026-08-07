create extension if not exists pgcrypto

create type public.app_role as enum ('owner', 'admin', 'manager', 'field_user')

create type public.membership_status as enum ('invited', 'active', 'suspended')

create type public.plan_slug as enum ('starter', 'growth', 'scale')

create type public.subscription_state as enum ('trialing', 'active', 'past_due', 'canceled', 'incomplete')

create type public.asset_assignment_type as enum ('unassigned', 'person', 'vehicle')

create type public.asset_status as enum ('available', 'assigned', 'maintenance', 'retired')

create type public.movement_type as enum ('created', 'assigned', 'moved', 'returned', 'retired', 'audited')

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  clerk_org_id text not null unique,
  slug text not null unique,
  name text not null,
  billing_email text,
  active_plan public.plan_slug not null default 'starter',
  subscription_status public.subscription_state not null default 'trialing',
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
)

create table public.company_memberships (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  clerk_user_id text not null,
  email text not null,
  full_name text,
  role public.app_role not null default 'field_user',
  status public.membership_status not null default 'invited',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (company_id, clerk_user_id)
)

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  registration_number text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (company_id, name),
  unique (company_id, registration_number)
)

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (company_id, name)
)

create table public.items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  assigned_membership_id uuid references public.company_memberships(id) on delete set null,
  created_by_membership_id uuid references public.company_memberships(id) on delete set null,
  assignment_type public.asset_assignment_type not null default 'unassigned',
  status public.asset_status not null default 'available',
  name text not null,
  serial_number text,
  image_url text,
  notes text,
  last_seen_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
)

create table public.item_movements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  from_vehicle_id uuid references public.vehicles(id) on delete set null,
  to_vehicle_id uuid references public.vehicles(id) on delete set null,
  from_membership_id uuid references public.company_memberships(id) on delete set null,
  to_membership_id uuid references public.company_memberships(id) on delete set null,
  created_by_membership_id uuid references public.company_memberships(id) on delete set null,
  movement_type public.movement_type not null,
  note text,
  created_at timestamptz not null default timezone('utc', now())
)

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references public.companies(id) on delete cascade,
  plan public.plan_slug not null,
  status public.subscription_state not null default 'trialing',
  seats_included integer not null default 3,
  seat_price_sek integer not null default 0,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  current_period_ends_at timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
)

create index company_memberships_company_idx on public.company_memberships (company_id)

create index company_memberships_user_idx on public.company_memberships (clerk_user_id)

create index vehicles_company_idx on public.vehicles (company_id)

create index categories_company_idx on public.categories (company_id)

create index items_company_idx on public.items (company_id)

create index items_vehicle_idx on public.items (vehicle_id)

create index items_assigned_membership_idx on public.items (assigned_membership_id)

create index item_movements_company_idx on public.item_movements (company_id)

create index item_movements_item_idx on public.item_movements (item_id)

create trigger set_companies_updated_at
before update on public.companies
for each row
execute function public.set_updated_at()

create trigger set_company_memberships_updated_at
before update on public.company_memberships
for each row
execute function public.set_updated_at()

create trigger set_vehicles_updated_at
before update on public.vehicles
for each row
execute function public.set_updated_at()

create trigger set_categories_updated_at
before update on public.categories
for each row
execute function public.set_updated_at()

create trigger set_items_updated_at
before update on public.items
for each row
execute function public.set_updated_at()

create trigger set_subscriptions_updated_at
before update on public.subscriptions
for each row
execute function public.set_updated_at()

create or replace function public.current_clerk_user_id()
returns text
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'sub', '');
$$

create or replace function public.current_clerk_org_id()
returns text
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'org_id', '');
$$

create or replace function public.current_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.id
  from public.companies c
  where c.clerk_org_id = public.current_clerk_org_id()
  limit 1;
$$

create or replace function public.has_company_role(target_company_id uuid, allowed_roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_memberships membership
    where membership.company_id = target_company_id
      and membership.clerk_user_id = public.current_clerk_user_id()
      and membership.status = 'active'
      and membership.role = any(allowed_roles)
  );
$$

alter table public.companies enable row level security

alter table public.company_memberships enable row level security

alter table public.vehicles enable row level security

alter table public.categories enable row level security

alter table public.items enable row level security

alter table public.item_movements enable row level security

alter table public.subscriptions enable row level security

create policy "companies_select_own_company"
on public.companies
for select
using (id = public.current_company_id())

create policy "companies_update_admins"
on public.companies
for update
using (public.has_company_role(id, array['owner', 'admin']::public.app_role[]))
with check (public.has_company_role(id, array['owner', 'admin']::public.app_role[]))

create policy "memberships_select_company"
on public.company_memberships
for select
using (company_id = public.current_company_id())

create policy "memberships_manage_admins"
on public.company_memberships
for all
using (public.has_company_role(company_id, array['owner', 'admin']::public.app_role[]))
with check (public.has_company_role(company_id, array['owner', 'admin']::public.app_role[]))

create policy "vehicles_select_company"
on public.vehicles
for select
using (company_id = public.current_company_id())

create policy "vehicles_manage_admins"
on public.vehicles
for all
using (public.has_company_role(company_id, array['owner', 'admin', 'manager']::public.app_role[]))
with check (public.has_company_role(company_id, array['owner', 'admin', 'manager']::public.app_role[]))

create policy "categories_select_company"
on public.categories
for select
using (company_id = public.current_company_id())

create policy "categories_manage_admins"
on public.categories
for all
using (public.has_company_role(company_id, array['owner', 'admin', 'manager']::public.app_role[]))
with check (public.has_company_role(company_id, array['owner', 'admin', 'manager']::public.app_role[]))

create policy "items_select_company"
on public.items
for select
using (company_id = public.current_company_id())

create policy "items_insert_company_members"
on public.items
for insert
with check (
  company_id = public.current_company_id()
  and public.has_company_role(company_id, array['owner', 'admin', 'manager', 'field_user']::public.app_role[])
)

create policy "items_update_company_members"
on public.items
for update
using (company_id = public.current_company_id())
with check (
  company_id = public.current_company_id()
  and public.has_company_role(company_id, array['owner', 'admin', 'manager', 'field_user']::public.app_role[])
)

create policy "items_delete_managers"
on public.items
for delete
using (public.has_company_role(company_id, array['owner', 'admin', 'manager']::public.app_role[]))

create policy "item_movements_select_company"
on public.item_movements
for select
using (company_id = public.current_company_id())

create policy "item_movements_insert_company_members"
on public.item_movements
for insert
with check (
  company_id = public.current_company_id()
  and public.has_company_role(company_id, array['owner', 'admin', 'manager', 'field_user']::public.app_role[])
)

create policy "item_movements_delete_managers"
on public.item_movements
for delete
using (public.has_company_role(company_id, array['owner', 'admin', 'manager']::public.app_role[]))

create policy "subscriptions_select_company"
on public.subscriptions
for select
using (company_id = public.current_company_id())

create policy "subscriptions_manage_admins"
on public.subscriptions
for all
using (public.has_company_role(company_id, array['owner', 'admin']::public.app_role[]))
with check (public.has_company_role(company_id, array['owner', 'admin']::public.app_role[]))
