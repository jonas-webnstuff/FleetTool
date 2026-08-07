-- "Users can read their own membership" predates the current RLS policy set
-- and is redundant: memberships_select_company already grants SELECT on any
-- membership row in the caller's own company (via current_company_id(),
-- which resolves the caller's company server-side and covers their own
-- row), and does so with the same email/Clerk-id matching logic used
-- elsewhere. The legacy policy was also broken for the same reason
-- move_item_to_person was: `(auth.uid())::text = clerk_user_id` casts the
-- JWT sub claim to uuid, which fails for Clerk's non-UUID user ids.

drop policy if exists "Users can read their own membership" on public.company_memberships;
