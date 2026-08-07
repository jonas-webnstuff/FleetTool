drop policy if exists "memberships_manage_admins" on public.company_memberships

create policy "memberships_manage_admins"
on public.company_memberships
for all
using (public.has_company_role(company_id, array['owner', 'admin', 'manager']::public.app_role[]))
with check (public.has_company_role(company_id, array['owner', 'admin', 'manager']::public.app_role[]))
