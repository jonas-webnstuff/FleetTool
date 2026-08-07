alter table public.companies
  add column if not exists contact_person text,
  add column if not exists phone text,
  add column if not exists address_line1 text,
  add column if not exists postal_code text,
  add column if not exists city text,
  add column if not exists organization_number text,
  add column if not exists vat_number text
