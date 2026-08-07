drop function if exists public.get_company_items_with_assignments()

create or replace function public.get_company_items_with_assignments()
returns table (
  id uuid,
  name text,
  notes text,
  image_url text,
  created_at timestamptz,
  assignment_type text,
  status text,
  vehicle_id uuid,
  assigned_membership_id uuid,
  category_name text,
  assigned_full_name text,
  assigned_email text
)
language sql
stable
security definer
set search_path = public
as $$
  with my_membership as (
    select membership.company_id
    from public.get_my_membership() membership
    where membership.status = 'active'
    order by membership.updated_at desc
    limit 1
  )
  select
    item.id,
    item.name,
    item.notes,
    item.image_url,
    item.created_at,
    item.assignment_type::text,
    item.status::text,
    item.vehicle_id,
    item.assigned_membership_id,
    category.name as category_name,
    nullif(trim(assigned_membership.full_name), '') as assigned_full_name,
    assigned_membership.email as assigned_email
  from public.items item
  join my_membership on my_membership.company_id = item.company_id
  left join public.categories category on category.id = item.category_id
  left join public.company_memberships assigned_membership on assigned_membership.id = item.assigned_membership_id
  where item.status is null or item.status <> 'retired'
  order by item.created_at desc;
$$

grant execute on function public.get_company_items_with_assignments() to authenticated
