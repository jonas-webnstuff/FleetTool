This app is linked to the same Supabase project (`kbgbybjcxjbpiyfxnsaa`) as
the sibling `FleettoolWeb` repo, but does **not** keep its own migration
history — `FleettoolWeb`'s `supabase/migrations/` is canonical for both apps.

`config.toml` here only exists so `supabase db query --linked` and similar
CLI diagnostics still work from this repo. If you need to change the
schema, add the migration in `FleettoolWeb`, not here.

(These two folders drifted apart once, from 2026-06-12 to 2026-08-08,
before this convention was written down — see the migration commit that
reconciled them if you want the history.)
