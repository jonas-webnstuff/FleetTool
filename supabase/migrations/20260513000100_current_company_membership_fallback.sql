create or replace function public.current_clerk_email()
returns text
language sql
stable
as $$
  select lower(nullif(auth.jwt() ->> 'email', ''));
$$

create or replace function public.current_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  with ctx as (
    select
      public.current_clerk_user_id() as clerk_user_id,
      public.current_clerk_org_id() as clerk_org_id,
      public.current_clerk_email() as clerk_email
  ),
  membership_rows as (
    select
      membership.company_id,
      case when membership.status = 'active' then 0 else 1 end as status_rank,
      membership.updated_at
    from public.company_memberships membership
    cross join ctx
    where membership.status in ('active', 'invited')
      and (
        (ctx.clerk_user_id is not null and membership.clerk_user_id = ctx.clerk_user_id)
        or (ctx.clerk_email is not null and lower(membership.email) = ctx.clerk_email)
      )
  ),
  membership_companies as (
    select
      company_id,
      min(status_rank) as best_status_rank,
      max(updated_at) as latest_update
    from membership_rows
    group by company_id
  ),
  membership_choice as (
    select
      company_id,
      count(*) over () as company_count
    from membership_companies
    order by best_status_rank asc, latest_update desc
  ),
  org_choice as (
    select companies.id as company_id
    from public.companies companies
    cross join ctx
    where ctx.clerk_org_id is not null
      and companies.clerk_org_id = ctx.clerk_org_id
      and not exists (select 1 from membership_companies)
    limit 1
  )
  select company_id
  from membership_choice
  where company_count = 1
  union all
  select company_id
  from org_choice
  limit 1;
$$
