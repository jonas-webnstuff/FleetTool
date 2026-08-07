-- Reconciles two objects that were changed directly against the database
-- (outside of tracked migrations) as part of the "enforce role checks
-- server-side" security pass, and fixes a regression that change introduced:
--
--   move_item_to_person gained vehicle-mode support but went back to using
--   auth.uid()::text for the caller's identity. auth.uid() casts the JWT
--   "sub" claim to uuid, which fails for this project since auth is handled
--   by Clerk and Clerk user ids are not UUIDs (e.g. "user_3EGQy..."). Every
--   call to this RPC was failing with:
--     invalid input syntax for type uuid: "user_..."
--
-- Fixed by using public.current_clerk_user_id() (the helper already used by
-- has_company_role and friends) instead of auth.uid().

create or replace function public.get_company_assignment_mode()
returns text
language sql
stable security definer
set search_path to 'public'
as $$
  select coalesce(company.default_item_assignment_type, 'person')
  from public.companies company
  where company.id = public.current_company_id();
$$;

create or replace function public.move_item_to_person(p_item_id uuid, p_target_membership_id uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id text;
  v_item items%rowtype;
  v_actor company_memberships%rowtype;
  v_target company_memberships%rowtype;
  v_target_vehicle vehicles%rowtype;
  v_default_assignment text;
begin
  v_user_id := public.current_clerk_user_id();
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
$function$;
