-- Deduplicate memberships per company/email and enforce uniqueness.
-- Keeps the strongest row per (company_id, lower(email)):
-- 1) row with clerk_user_id
-- 2) active status
-- 3) newest updated_at/created_at

with ranked as (
  select
    membership.id,
    membership.company_id,
    lower(membership.email) as email_key,
    row_number() over (
      partition by membership.company_id, lower(membership.email)
      order by
        (membership.clerk_user_id is not null) desc,
        (membership.status = 'active') desc,
        membership.updated_at desc,
        membership.created_at desc,
        membership.id desc
    ) as rn,
    first_value(membership.id) over (
      partition by membership.company_id, lower(membership.email)
      order by
        (membership.clerk_user_id is not null) desc,
        (membership.status = 'active') desc,
        membership.updated_at desc,
        membership.created_at desc,
        membership.id desc
    ) as keep_id
  from public.company_memberships membership
),
dupes as (
  select id as duplicate_id, keep_id
  from ranked
  where rn > 1
)
update public.items i
set assigned_membership_id = d.keep_id
from dupes d
where i.assigned_membership_id = d.duplicate_id

with ranked as (
  select
    membership.id,
    membership.company_id,
    lower(membership.email) as email_key,
    row_number() over (
      partition by membership.company_id, lower(membership.email)
      order by
        (membership.clerk_user_id is not null) desc,
        (membership.status = 'active') desc,
        membership.updated_at desc,
        membership.created_at desc,
        membership.id desc
    ) as rn,
    first_value(membership.id) over (
      partition by membership.company_id, lower(membership.email)
      order by
        (membership.clerk_user_id is not null) desc,
        (membership.status = 'active') desc,
        membership.updated_at desc,
        membership.created_at desc,
        membership.id desc
    ) as keep_id
  from public.company_memberships membership
),
dupes as (
  select id as duplicate_id, keep_id
  from ranked
  where rn > 1
)
update public.items i
set created_by_membership_id = d.keep_id
from dupes d
where i.created_by_membership_id = d.duplicate_id

with ranked as (
  select
    membership.id,
    membership.company_id,
    lower(membership.email) as email_key,
    row_number() over (
      partition by membership.company_id, lower(membership.email)
      order by
        (membership.clerk_user_id is not null) desc,
        (membership.status = 'active') desc,
        membership.updated_at desc,
        membership.created_at desc,
        membership.id desc
    ) as rn,
    first_value(membership.id) over (
      partition by membership.company_id, lower(membership.email)
      order by
        (membership.clerk_user_id is not null) desc,
        (membership.status = 'active') desc,
        membership.updated_at desc,
        membership.created_at desc,
        membership.id desc
    ) as keep_id
  from public.company_memberships membership
),
dupes as (
  select id as duplicate_id, keep_id
  from ranked
  where rn > 1
)
update public.item_movements m
set from_membership_id = d.keep_id
from dupes d
where m.from_membership_id = d.duplicate_id

with ranked as (
  select
    membership.id,
    membership.company_id,
    lower(membership.email) as email_key,
    row_number() over (
      partition by membership.company_id, lower(membership.email)
      order by
        (membership.clerk_user_id is not null) desc,
        (membership.status = 'active') desc,
        membership.updated_at desc,
        membership.created_at desc,
        membership.id desc
    ) as rn,
    first_value(membership.id) over (
      partition by membership.company_id, lower(membership.email)
      order by
        (membership.clerk_user_id is not null) desc,
        (membership.status = 'active') desc,
        membership.updated_at desc,
        membership.created_at desc,
        membership.id desc
    ) as keep_id
  from public.company_memberships membership
),
dupes as (
  select id as duplicate_id, keep_id
  from ranked
  where rn > 1
)
update public.item_movements m
set to_membership_id = d.keep_id
from dupes d
where m.to_membership_id = d.duplicate_id

with ranked as (
  select
    membership.id,
    membership.company_id,
    lower(membership.email) as email_key,
    row_number() over (
      partition by membership.company_id, lower(membership.email)
      order by
        (membership.clerk_user_id is not null) desc,
        (membership.status = 'active') desc,
        membership.updated_at desc,
        membership.created_at desc,
        membership.id desc
    ) as rn,
    first_value(membership.id) over (
      partition by membership.company_id, lower(membership.email)
      order by
        (membership.clerk_user_id is not null) desc,
        (membership.status = 'active') desc,
        membership.updated_at desc,
        membership.created_at desc,
        membership.id desc
    ) as keep_id
  from public.company_memberships membership
),
dupes as (
  select id as duplicate_id, keep_id
  from ranked
  where rn > 1
)
update public.item_movements m
set created_by_membership_id = d.keep_id
from dupes d
where m.created_by_membership_id = d.duplicate_id

with ranked as (
  select
    membership.id,
    membership.company_id,
    lower(membership.email) as email_key,
    row_number() over (
      partition by membership.company_id, lower(membership.email)
      order by
        (membership.clerk_user_id is not null) desc,
        (membership.status = 'active') desc,
        membership.updated_at desc,
        membership.created_at desc,
        membership.id desc
    ) as rn
  from public.company_memberships membership
)
delete from public.company_memberships m
using ranked r
where m.id = r.id
  and r.rn > 1

create unique index if not exists company_memberships_company_email_key
  on public.company_memberships (company_id, lower(email))
