drop function if exists public.get_company_people_with_items()

create or replace function public.get_company_people_with_items()
returns table (
  membership_id uuid,
  full_name text,
  email text,
  item_count integer
)
language sql
stable
security definer
set search_path = public
as $$
  with my_membership as (
    select membership.company_id
    from public.get_my_membership() membership
    order by
      case when membership.status = 'active' then 0 else 1 end,
      membership.updated_at desc
    limit 1
  ),
  people as (
    select
      membership.id as membership_id,
      coalesce(nullif(trim(membership.full_name), ''), membership.email) as full_name,
      membership.email
    from public.company_memberships membership
    join my_membership on my_membership.company_id = membership.company_id
    where membership.status = 'active'
  ),
  item_counts as (
    select
      item.assigned_membership_id as membership_id,
      count(*)::int as item_count
    from public.items item
    join my_membership on my_membership.company_id = item.company_id
    where item.assignment_type = 'person'
      and item.assigned_membership_id is not null
      and (item.status is null or item.status <> 'retired')
    group by item.assigned_membership_id
  )
  select
    people.membership_id,
    people.full_name,
    people.email,
    coalesce(item_counts.item_count, 0)::int as item_count
  from people
  left join item_counts on item_counts.membership_id = people.membership_id
  order by people.full_name;
$$

grant execute on function public.get_company_people_with_items() to authenticated
