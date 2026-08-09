-- The Stripe webhook (FleettoolWeb src/app/api/webhooks/stripe/route.ts) was
-- writing to subscriptions and companies as two separate, unchecked
-- .upsert()/.update() calls: neither error was inspected, and a failure
-- partway through could leave the two tables disagreeing with no signal
-- anywhere. Move both writes into one SECURITY DEFINER function so they
-- commit or fail together, and so the webhook can check a single call's
-- result and fail loudly (causing Stripe to retry) instead of silently
-- returning 200 on a lost write.

create or replace function public.sync_stripe_subscription(
  p_company_id uuid,
  p_plan public.plan_slug,
  p_status public.subscription_state,
  p_seats_included integer,
  p_seat_price_sek integer,
  p_stripe_customer_id text,
  p_stripe_subscription_id text,
  p_current_period_ends_at timestamptz default null,
  p_cancel_at_period_end boolean default false
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.subscriptions (
    company_id,
    plan,
    status,
    seats_included,
    seat_price_sek,
    stripe_customer_id,
    stripe_subscription_id,
    current_period_ends_at,
    cancel_at_period_end
  )
  values (
    p_company_id,
    p_plan,
    p_status,
    p_seats_included,
    p_seat_price_sek,
    p_stripe_customer_id,
    p_stripe_subscription_id,
    p_current_period_ends_at,
    p_cancel_at_period_end
  )
  on conflict (company_id) do update set
    plan = excluded.plan,
    status = excluded.status,
    seats_included = excluded.seats_included,
    seat_price_sek = excluded.seat_price_sek,
    stripe_customer_id = excluded.stripe_customer_id,
    stripe_subscription_id = excluded.stripe_subscription_id,
    current_period_ends_at = excluded.current_period_ends_at,
    cancel_at_period_end = excluded.cancel_at_period_end;

  update public.companies
  set active_plan = p_plan,
      subscription_status = p_status,
      stripe_customer_id = p_stripe_customer_id,
      stripe_subscription_id = p_stripe_subscription_id
  where id = p_company_id;
end;
$function$;

grant execute on function public.sync_stripe_subscription(
  uuid, public.plan_slug, public.subscription_state, integer, integer, text, text, timestamptz, boolean
) to service_role;
