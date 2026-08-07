drop function if exists public.claim_current_membership(text, text, text, text)

drop function if exists public.claim_current_membership(text, text, text)

drop function if exists public.claim_current_membership(text, text)

drop function if exists public.claim_current_membership(text)

drop function if exists public.claim_current_membership()

create or replace function public.claim_current_membership(
  p_clerk_user_id text,
  p_email text default null,
  p_pending_email text default null,
  p_full_name text default null
)
returns setof public.company_memberships
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id text := public.current_clerk_user_id();
  v_email text := lower(nullif(trim(coalesce(p_email, '')), ''));
  v_pending_email text := lower(nullif(trim(coalesce(p_pending_email, '')), ''));
  v_claim_email text;
  v_target_company_id uuid;
  v_target_membership_id uuid;
begin
  if v_auth_user_id is null then
    return;
  end if;

  if p_clerk_user_id is null or trim(p_clerk_user_id) = '' then
    raise exception 'missing clerk user id';
  end if;

  if p_clerk_user_id <> v_auth_user_id then
    raise exception 'clerk user mismatch';
  end if;

  v_claim_email := coalesce(v_pending_email, v_email, public.current_clerk_email());

  if v_claim_email is null then
    return;
  end if;

  with candidates as (
    select
      membership.id,
      membership.company_id,
      case when membership.status = 'active' then 0 else 1 end as status_rank,
      membership.updated_at
    from public.company_memberships membership
    where membership.status in ('active', 'invited')
      and lower(membership.email) = v_claim_email
      and (membership.clerk_user_id is null or membership.clerk_user_id = v_auth_user_id)
  ),
  company_rollup as (
    select
      company_id,
      min(status_rank) as best_status_rank,
      max(updated_at) as latest_update
    from candidates
    group by company_id
  ),
  chosen_company as (
    select
      company_id,
      count(*) over () as company_count,
      row_number() over (order by best_status_rank asc, latest_update desc) as rn
    from company_rollup
  ),
  chosen_membership as (
    select candidates.id
    from candidates
    join chosen_company on chosen_company.company_id = candidates.company_id
    where chosen_company.company_count = 1
      and chosen_company.rn = 1
    order by candidates.status_rank asc, candidates.updated_at desc
    limit 1
  )
  select
    chosen_company.company_id,
    chosen_membership.id
  into v_target_company_id, v_target_membership_id
  from chosen_company
  join chosen_membership on true
  where chosen_company.company_count = 1
    and chosen_company.rn = 1;

  if v_target_membership_id is null then
    return;
  end if;

  update public.company_memberships membership
  set
    clerk_user_id = v_auth_user_id,
    full_name = case
      when p_full_name is null or trim(p_full_name) = '' then membership.full_name
      else trim(p_full_name)
    end,
    status = case when membership.status = 'invited' then 'active' else membership.status end,
    updated_at = timezone('utc', now())
  where membership.id = v_target_membership_id;

  return query
  select membership.*
  from public.company_memberships membership
  where membership.id = v_target_membership_id;
end;
$$

drop function if exists public.get_my_membership()

create or replace function public.get_my_membership()
returns setof public.company_memberships
language sql
security definer
set search_path = public
as $$
  select membership.*
  from public.company_memberships membership
  where membership.clerk_user_id = public.current_clerk_user_id()
    and membership.status in ('active', 'invited')
  order by case when membership.status = 'active' then 0 else 1 end,
           membership.updated_at desc;
$$
