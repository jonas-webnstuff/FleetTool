create or replace function public.sync_current_membership()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id text := public.current_clerk_user_id();
  v_email text := public.current_clerk_email();
  v_company_id uuid := public.current_company_id();
begin
  if v_user_id is null or v_email is null or v_company_id is null then
    return v_company_id;
  end if;

  update public.company_memberships membership
  set
    clerk_user_id = v_user_id,
    status = case when membership.status = 'invited' then 'active' else membership.status end,
    updated_at = timezone('utc', now())
  where membership.company_id = v_company_id
    and lower(membership.email) = v_email
    and membership.status in ('invited', 'active')
    and (membership.clerk_user_id is null or membership.clerk_user_id = v_user_id);

  return v_company_id;
end;
$$
