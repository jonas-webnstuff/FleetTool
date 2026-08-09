create or replace function public.get_company_assignment_mode()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(company.default_item_assignment_type, 'person')
  from public.companies company
  where company.id = public.current_company_id();
$$;

grant execute on function public.get_company_assignment_mode() to authenticated;

create or replace function public.get_company_people_with_items()
returns table (
  membership_id uuid,
  full_name text,
  email text,
  item_count integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_default_assignment text;
begin
  v_company_id := public.current_company_id();

  if v_company_id is null then
    return;
  end if;

  select coalesce(company.default_item_assignment_type, 'person')
  into v_default_assignment
  from public.companies company
  where company.id = v_company_id;

  if v_default_assignment = 'vehicle' then
    return query
    with vehicles_for_company as (
      select
        vehicle.id,
        coalesce(nullif(trim(vehicle.name), ''), 'Namnlost fordon') as vehicle_name,
        coalesce(nullif(trim(vehicle.registration_number), ''), '-') as vehicle_registration
      from public.vehicles vehicle
      where vehicle.company_id = v_company_id
        and vehicle.is_active = true
    ),
    item_counts as (
      select
        item.vehicle_id,
        count(*)::int as item_count
      from public.items item
      where item.company_id = v_company_id
        and item.assignment_type = 'vehicle'
        and item.vehicle_id is not null
        and (item.status is null or item.status <> 'retired')
      group by item.vehicle_id
    )
    select
      vehicle.id as membership_id,
      vehicle.vehicle_name as full_name,
      vehicle.vehicle_registration as email,
      coalesce(item_counts.item_count, 0)::int as item_count
    from vehicles_for_company vehicle
    left join item_counts on item_counts.vehicle_id = vehicle.id
    order by vehicle.vehicle_name;

    return;
  end if;

  return query
  with people as (
    select
      membership.id as membership_id,
      coalesce(nullif(trim(membership.full_name), ''), membership.email) as full_name,
      membership.email
    from public.company_memberships membership
    where membership.company_id = v_company_id
      and membership.status = 'active'
  ),
  item_counts as (
    select
      item.assigned_membership_id as membership_id,
      count(*)::int as item_count
    from public.items item
    where item.company_id = v_company_id
      and item.assignment_type = 'person'
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
end;
$$;

grant execute on function public.get_company_people_with_items() to authenticated;

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
    coalesce(
      nullif(trim(assigned_membership.full_name), ''),
      assigned_membership.email,
      nullif(trim(assigned_vehicle.name), '')
    ) as assigned_full_name,
    coalesce(
      assigned_membership.email,
      nullif(trim(assigned_vehicle.registration_number), '')
    ) as assigned_email
  from public.items item
  join my_membership on my_membership.company_id = item.company_id
  left join public.categories category on category.id = item.category_id
  left join public.company_memberships assigned_membership on assigned_membership.id = item.assigned_membership_id
  left join public.vehicles assigned_vehicle on assigned_vehicle.id = item.vehicle_id
  where item.status is null or item.status <> 'retired'
  order by item.created_at desc;
$$;

grant execute on function public.get_company_items_with_assignments() to authenticated;

create or replace function public.move_item_to_person(
  p_item_id uuid,
  p_target_membership_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id text;
  v_item items%rowtype;
  v_actor company_memberships%rowtype;
  v_target company_memberships%rowtype;
  v_target_vehicle vehicles%rowtype;
  v_default_assignment text;
begin
  v_user_id := auth.uid()::text;
  if v_user_id is null then
    return false;
  end if;

  select *
  into v_item
  from items
  where id = p_item_id
    and (status is null or status <> 'retired')
  for update;

  if not found then
    return false;
  end if;

  select *
  into v_actor
  from company_memberships
  where company_id = v_item.company_id
    and clerk_user_id = v_user_id
    and status = 'active'
  order by created_at asc
  limit 1;

  if not found then
    return false;
  end if;

  if v_actor.role not in ('owner', 'admin', 'manager', 'field_user') then
    return false;
  end if;

  if v_actor.role = 'field_user'
     and v_item.assignment_type = 'person'
     and v_item.assigned_membership_id is not null
     and v_item.assigned_membership_id <> v_actor.id then
    return false;
  end if;

  select coalesce(company.default_item_assignment_type, 'person')
  into v_default_assignment
  from companies company
  where company.id = v_item.company_id;

  if v_default_assignment = 'vehicle' then
    select *
    into v_target_vehicle
    from vehicles
    where id = p_target_membership_id
      and company_id = v_item.company_id
      and is_active = true
    limit 1;

    if not found then
      return false;
    end if;

    update items
    set assignment_type = 'vehicle',
        assigned_membership_id = null,
        vehicle_id = v_target_vehicle.id,
        status = 'assigned'
    where id = v_item.id;

    return true;
  end if;

  select *
  into v_target
  from company_memberships
  where id = p_target_membership_id
    and company_id = v_item.company_id
    and status = 'active'
  limit 1;

  if not found then
    return false;
  end if;

  update items
  set assignment_type = 'person',
      assigned_membership_id = v_target.id,
      vehicle_id = null,
      status = 'assigned'
  where id = v_item.id;

  return true;
end;
$$;

grant execute on function public.move_item_to_person(uuid, uuid) to authenticated;
