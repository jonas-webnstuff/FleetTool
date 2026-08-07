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
$$

grant execute on function public.move_item_to_person(uuid, uuid) to authenticated
