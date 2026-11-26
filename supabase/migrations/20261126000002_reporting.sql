-- Phase 8: consolidated dashboard aggregates and net-worth reporting.
-- Translation always uses a historical rate snapshotted on or before the
-- reporting date. A missing rate is disclosed instead of being replaced by a
-- live FX lookup or a naive EUR/BDT sum.

-- Reporting views may be read even when one currency lacks a rate: the rate is
-- reported as null for that component and the currency is disclosed in the
-- result. Mutations still use resolve_reporting_rate(), which fails closed.
create or replace function public.safe_reporting_rate(
  p_currency_code char(3),
  p_reporting_currency char(3),
  p_as_of date
)
returns numeric(18, 8)
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
begin
  return public.resolve_reporting_rate(p_currency_code, p_reporting_currency, p_as_of);
exception when others then
  return null;
end;
$$;

revoke all on function public.safe_reporting_rate(character, character, date)
  from public, anon;
grant execute on function public.safe_reporting_rate(character, character, date)
  to authenticated;

-- Net worth is a pure calculation over existing tables, never stored state:
-- cash + latest property estimates + receivables - payables, each translated
-- independently with a snapshotted rate.
create or replace function public.net_worth_at(
  p_owner_id uuid,
  p_as_of date,
  p_reporting_currency char(3)
)
returns table (
  owner_id uuid,
  as_of date,
  reporting_currency char(3),
  cash_amount_reporting numeric,
  property_amount_reporting numeric,
  receivables_amount_reporting numeric,
  payables_amount_reporting numeric,
  net_amount_reporting numeric,
  missing_rate_currencies text[]
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with cash_rows as (
    select ab.owner_id, ab.currency_code::text as currency_code, ab.balance as amount
    from public.account_balances_v ab
    where ab.owner_id = p_owner_id
  ),
  property_rows as (
    select
      p.owner_id,
      coalesce(lv.currency_code, p.currency_code, p_reporting_currency)::text as currency_code,
      coalesce(lv.estimated_value, p.current_estimated_value, 0) as amount
    from public.properties p
    left join lateral (
      select v.currency_code, v.estimated_value
      from public.property_valuations v
      where v.property_id = p.id
      order by v.valued_on desc, v.created_at desc
      limit 1
    ) lv on true
    where p.owner_id = p_owner_id
  ),
  receivable_rows as (
    select l.owner_id, l.currency_code::text as currency_code, sum(l.outstanding) as amount
    from public.loans_given_status_v l
    where l.owner_id = p_owner_id and l.cancelled_at is null and l.outstanding > 0
    group by l.owner_id, l.currency_code
  ),
  payable_rows as (
    select l.owner_id, l.currency_code::text as currency_code, sum(l.outstanding) as amount
    from public.loans_taken_status_v l
    where l.owner_id = p_owner_id and l.cancelled_at is null and l.outstanding > 0
    group by l.owner_id, l.currency_code
  ),
  translated as (
    select
      c.owner_id, 'cash'::text as component, c.currency_code, c.amount,
      public.safe_reporting_rate(c.currency_code::char(3), p_reporting_currency, p_as_of) as rate
    from cash_rows c
    union all
    select
      p.owner_id, 'property'::text, p.currency_code, p.amount,
      public.safe_reporting_rate(p.currency_code::char(3), p_reporting_currency, p_as_of)
    from property_rows p
    union all
    select
      r.owner_id, 'receivable'::text, r.currency_code, r.amount,
      public.safe_reporting_rate(r.currency_code::char(3), p_reporting_currency, p_as_of)
    from receivable_rows r
    union all
    select
      q.owner_id, 'payable'::text, q.currency_code, q.amount,
      public.safe_reporting_rate(q.currency_code::char(3), p_reporting_currency, p_as_of)
    from payable_rows q
  )
  select
    p_owner_id,
    p_as_of,
    p_reporting_currency,
    coalesce(sum(case when t.component = 'cash' and t.rate is not null
      then round(t.amount * t.rate, 4) else 0 end), 0),
    coalesce(sum(case when t.component = 'property' and t.rate is not null
      then round(t.amount * t.rate, 4) else 0 end), 0),
    coalesce(sum(case when t.component = 'receivable' and t.rate is not null
      then round(t.amount * t.rate, 4) else 0 end), 0),
    coalesce(sum(case when t.component = 'payable' and t.rate is not null
      then round(t.amount * t.rate, 4) else 0 end), 0),
    coalesce(sum(case when t.rate is not null
      then round(t.amount * t.rate * case when t.component = 'payable' then -1 else 1 end, 4)
      else 0 end), 0),
    coalesce((
      select array_agg(distinct u.currency_code)
      from translated u
      where u.rate is null and u.amount <> 0
    ), '{}'::text[])
  from translated t
  where t.owner_id = p_owner_id;
$$;

revoke all on function public.net_worth_at(uuid, date, character)
  from public, anon;
grant execute on function public.net_worth_at(uuid, date, character) to authenticated;

create view public.net_worth_v
with (security_invoker = true) as
select n.*
from public.user_settings s
cross join lateral public.net_worth_at(
  s.user_id, current_date, s.reporting_currency
) n;

revoke all on public.net_worth_v from public, anon;
grant select on public.net_worth_v to authenticated;

create or replace function public.get_net_worth(
  p_as_of date default null,
  p_reporting_currency char(3) default null
)
returns table (
  owner_id uuid,
  as_of date,
  reporting_currency char(3),
  cash_amount_reporting numeric,
  property_amount_reporting numeric,
  receivables_amount_reporting numeric,
  payables_amount_reporting numeric,
  net_amount_reporting numeric,
  missing_rate_currencies text[]
)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_currency char(3);
begin
  perform public.require_owner();

  select s.reporting_currency into v_currency
  from public.user_settings s
  where s.user_id = (select auth.uid());

  if p_reporting_currency is not null then
    if not exists (
      select 1 from public.currencies c
      where c.code = p_reporting_currency and c.is_active
    ) then
      raise exception 'Reporting currency is not configured' using errcode = '22023';
    end if;
    v_currency := p_reporting_currency;
  end if;
  if v_currency is null then
    v_currency := 'EUR'::char(3);
  end if;

  return query
  select * from public.net_worth_at(
    (select auth.uid()), coalesce(p_as_of, current_date), v_currency
  );
end;
$$;

revoke all on function public.get_net_worth(date, character) from public, anon;
grant execute on function public.get_net_worth(date, character) to authenticated;

-- Dashboard filters are optional text inputs so PostgREST callers cannot pass
-- a malformed date into a typed argument and receive a raw SQL error.
create or replace function public.get_dashboard_summary(
  p_from_date text default null,
  p_to_date text default null,
  p_country_code text default null,
  p_currency_code text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_owner_id uuid := (select auth.uid());
  v_from date;
  v_to date;
  v_currency char(3);
  v_country text;
  v_reporting_currency char(3);
  v_result jsonb;
begin
  perform public.require_owner();

  if nullif(btrim(coalesce(p_from_date, '')), '') is not null then
    if btrim(p_from_date) !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      raise exception 'Use a valid start date' using errcode = '22023';
    end if;
    v_from := btrim(p_from_date)::date;
  end if;
  if nullif(btrim(coalesce(p_to_date, '')), '') is not null then
    if btrim(p_to_date) !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      raise exception 'Use a valid end date' using errcode = '22023';
    end if;
    v_to := btrim(p_to_date)::date;
  end if;
  if v_from is not null and v_to is not null and v_from > v_to then
    raise exception 'Start date must be before end date' using errcode = '22023';
  end if;

  v_currency := nullif(upper(btrim(coalesce(p_currency_code, ''))), '')::char(3);
  if v_currency is not null and not exists (
    select 1 from public.currencies c where c.code = v_currency
  ) then
    raise exception 'Currency is not configured' using errcode = '22023';
  end if;
  v_country := nullif(upper(btrim(coalesce(p_country_code, ''))), '');
  if v_country is not null and v_country !~ '^[A-Z]{2}$' then
    raise exception 'Country code must be two letters' using errcode = '22023';
  end if;

  select s.reporting_currency into v_reporting_currency
  from public.user_settings s
  where s.user_id = v_owner_id;
  if v_reporting_currency is null then
    v_reporting_currency := 'EUR'::char(3);
  end if;

  with filtered_ledger as (
    select t.*
    from public.financial_transactions t
    where t.owner_id = v_owner_id
      and (v_from is null or t.business_date >= v_from)
      and (v_to is null or t.business_date <= v_to)
      and (v_currency is null or t.currency_code = v_currency)
      and (
        v_country is null or exists (
          select 1 from public.accounts a
          where a.id = t.account_id
            and a.owner_id = v_owner_id
            and a.country_code = v_country
        )
      )
  ),
  cashflow as (
    select
      coalesce(sum(case when direction = 1 and transaction_type in ('income', 'reversal')
        then amount else 0 end), 0) as income_amount,
      coalesce(sum(case when direction = -1 and transaction_type in ('expense', 'donation', 'correction')
        then amount else 0 end), 0) as expense_amount,
      coalesce(sum(case when direction = 1 and transaction_type in ('income', 'reversal')
        then amount_reporting else 0 end), 0) as income_reporting,
      coalesce(sum(case when direction = -1 and transaction_type in ('expense', 'donation', 'correction')
        then amount_reporting else 0 end), 0) as expense_reporting
    from filtered_ledger
  ),
  cash_by_currency as (
    select ab.currency_code::text as code, ab.balance
    from public.account_balances_v ab
    where ab.owner_id = v_owner_id
      and (v_currency is null or ab.currency_code = v_currency)
      and (
        v_country is null or exists (
          select 1 from public.accounts a
          where a.id = ab.account_id
            and a.owner_id = v_owner_id
            and a.country_code = v_country
        )
      )
  ),
  donations_by_currency as (
    select d.currency_code::text as code, sum(d.amount) as amount
    from public.donations d
    where d.owner_id = v_owner_id
      and (v_from is null or d.donation_date >= v_from)
      and (v_to is null or d.donation_date <= v_to)
      and (v_currency is null or d.currency_code = v_currency)
      and (v_country is null or d.country_code = v_country)
    group by d.currency_code
  )
  select jsonb_build_object(
    'filters', jsonb_build_object(
      'from', v_from,
      'to', v_to,
      'countryCode', v_country,
      'currencyCode', v_currency,
      'reportingCurrency', v_reporting_currency
    ),
    'counts', jsonb_build_object(
      'accounts', (select count(*) from public.accounts a where a.owner_id = v_owner_id),
      'contacts', (select count(*) from public.contacts c where c.owner_id = v_owner_id),
      'properties', (select count(*) from public.properties p where p.owner_id = v_owner_id),
      'documents', (select count(*) from public.documents d where d.owner_id = v_owner_id),
      'publishedPosts', (select count(*) from public.posts p
        where p.owner_id = v_owner_id and p.status = 'published' and p.deleted_at is null)
    ),
    'cashByCurrency', coalesce(
      (select jsonb_object_agg(code, balance) from cash_by_currency), '{}'::jsonb
    ),
    'cashflow', jsonb_build_object(
      'incomeAmount', (select income_amount from cashflow),
      'expenseAmount', (select expense_amount from cashflow),
      'incomeReporting', (select income_reporting from cashflow),
      'expenseReporting', (select expense_reporting from cashflow)
    ),
    'donationsByCurrency', coalesce(
      (select jsonb_object_agg(code, amount) from donations_by_currency), '{}'::jsonb
    ),
    'outstanding', jsonb_build_object(
      'receivable', coalesce((
        select jsonb_object_agg(l.currency_code::text, l.outstanding)
        from (
          select currency_code, sum(outstanding) as outstanding
          from public.loans_given_status_v
          where owner_id = v_owner_id and cancelled_at is null and outstanding > 0
          group by currency_code
        ) l
      ), '{}'::jsonb),
      'payable', coalesce((
        select jsonb_object_agg(l.currency_code::text, l.outstanding)
        from (
          select currency_code, sum(outstanding) as outstanding
          from public.loans_taken_status_v
          where owner_id = v_owner_id and cancelled_at is null and outstanding > 0
          group by currency_code
        ) l
      ), '{}'::jsonb)
    ),
    'netWorth', (
      select to_jsonb(n)
      from public.net_worth_at(v_owner_id, coalesce(v_to, current_date), v_reporting_currency) n
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_dashboard_summary(text, text, text, text)
  from public, anon;
grant execute on function public.get_dashboard_summary(text, text, text, text)
  to authenticated;

-- Scheduled publishing runs outside the Worker as a trusted CI cron. The
-- service-role key stays in GitHub Secrets; it is never shipped in the app.
-- The role claim is re-checked inside the function so a stolen publishable key
-- cannot invoke this path.
create or replace function public.publish_due_posts_for_cron()
returns table (id uuid, slug text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  return query
  update public.posts p
     set status = 'published',
         published_at = coalesce(p.published_at, now()),
         updated_at = now()
   where p.status = 'scheduled'
     and p.deleted_at is null
     and p.scheduled_for <= now()
  returning p.id, p.slug;
end;
$$;

revoke all on function public.publish_due_posts_for_cron() from public, anon, authenticated;
grant execute on function public.publish_due_posts_for_cron() to service_role;
