-- companies_update_admins only allowed owner/admin, but the web app's
-- updateCompanyAssignmentSettingsAction (FleettoolWeb) has always let
-- manager save the assignment-mode/role settings too. In practice this was
-- harmless because that action runs through the Supabase service-role
-- client, which bypasses RLS entirely — but it left the RLS policy as a
-- stale, incorrect backstop that didn't match the app's real authorization
-- rules. Widen it to manager so the DB-level policy agrees with what the
-- server already enforces.

drop policy if exists "companies_update_admins" on public.companies;

create policy "companies_update_admins"
on public.companies
for update
using (public.has_company_role(id, array['owner', 'admin', 'manager']::public.app_role[]))
with check (public.has_company_role(id, array['owner', 'admin', 'manager']::public.app_role[]));
