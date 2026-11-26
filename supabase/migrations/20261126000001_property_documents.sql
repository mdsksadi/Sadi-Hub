-- Phase 7: private property records, ownership shares, valuations, configurable
-- land-unit conversions, and the document registry backing private storage.
-- Every private table is owner-scoped; valuations and documents are append-only
-- business records except for the document metadata itself.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete restrict,
  name text not null check (length(btrim(name)) between 1 and 200),
  country_code char(2),
  division text,
  district text,
  upazila text,
  union_name text,
  village text,
  mouza text,
  khatian_number text,
  dag_number text,
  land_classification text,
  total_area numeric(18, 4) check (total_area > 0),
  -- The original regional unit is always preserved; conversions are advisory.
  area_unit text,
  purchase_date date,
  purchase_price numeric(18, 4) check (purchase_price >= 0),
  currency_code char(3) references public.currencies (code),
  current_estimated_value numeric(18, 4) check (current_estimated_value >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint properties_area_unit_present check (
    total_area is null or nullif(btrim(coalesce(area_unit, '')), '') is not null
  )
);

create index properties_owner_location_idx
  on public.properties (owner_id, country_code, district);
create index properties_owner_name_idx
  on public.properties (owner_id, lower(name));

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete restrict,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  category text not null check (category in (
    'deed', 'khatian', 'mutation', 'tax_receipt', 'agreement', 'map',
    'resume', 'certification', 'loan', 'donation', 'other'
  )),
  description text,
  uploaded_at timestamptz not null default now(),
  related_contact_id uuid references public.contacts (id) on delete set null,
  related_transaction_id uuid references public.financial_transactions (id) on delete restrict,
  related_property_id uuid references public.properties (id) on delete set null,
  related_loan_given_id uuid references public.loans_given (id) on delete set null,
  related_loan_taken_id uuid references public.loans_taken (id) on delete set null,
  related_donation_id uuid references public.donations (id) on delete restrict,
  tags text[] not null default '{}'
);

create index documents_owner_uploaded_idx
  on public.documents (owner_id, uploaded_at desc);
create index documents_contact_idx on public.documents (owner_id, related_contact_id);
create index documents_transaction_idx on public.documents (owner_id, related_transaction_id);
create index documents_property_idx on public.documents (owner_id, related_property_id);
create index documents_loan_given_idx on public.documents (owner_id, related_loan_given_id);
create index documents_loan_taken_idx on public.documents (owner_id, related_loan_taken_id);
create index documents_donation_idx on public.documents (owner_id, related_donation_id);

-- The portfolio migration deliberately deferred this foreign key to Phase 7.
alter table public.certifications
  add constraint certifications_document_fk
  foreign key (document_id) references public.documents (id) on delete set null;

create table public.property_ownerships (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete restrict,
  property_id uuid not null references public.properties (id) on delete cascade,
  owner_name text not null check (length(btrim(owner_name)) between 1 and 200),
  ownership_percentage numeric(5, 2) not null
    check (ownership_percentage > 0 and ownership_percentage <= 100),
  acquisition_date date,
  ownership_type text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint property_ownerships_property_owner_unique
    unique (property_id, lower(btrim(owner_name)))
);

create index property_ownerships_owner_idx
  on public.property_ownerships (owner_id, property_id);
create index property_ownerships_property_idx
  on public.property_ownerships (property_id);

-- Valuations are history: the current value on properties is only a cache that
-- record_property_valuation() updates from the latest append-only row.
-- Direct documents.related_property_id links are enough for most records;
-- this join table carries property-specific metadata (type/issue date) when a
-- deed, khatian or map is formally attached to a property.
create table public.property_documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete restrict,
  property_id uuid not null references public.properties (id) on delete cascade,
  document_id uuid not null references public.documents (id) on delete cascade,
  document_type text not null check (document_type in (
    'deed', 'khatian', 'mutation', 'tax_receipt', 'agreement', 'map', 'other'
  )),
  issued_on date,
  notes text,
  created_at timestamptz not null default now(),
  constraint property_documents_unique
    unique (property_id, document_id, document_type)
);

create index property_documents_owner_idx
  on public.property_documents (owner_id, property_id);
create index property_documents_document_idx
  on public.property_documents (owner_id, document_id);

create table public.property_valuations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete restrict,
  property_id uuid not null references public.properties (id) on delete cascade,
  estimated_value numeric(18, 4) not null check (estimated_value >= 0),
  currency_code char(3) not null references public.currencies (code),
  valued_on date not null,
  source text,
  -- Estimates are never presented as verified market prices by the UI.
  is_verified boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);

create index property_valuations_owner_idx
  on public.property_valuations (owner_id, property_id, valued_on desc);
create index property_valuations_property_idx
  on public.property_valuations (property_id, valued_on desc, created_at desc);

-- Global reference data, like currencies. No universal Katha/Bigha factor is
-- assumed; an owner can add or correct a conversion with a dated source note.
create table public.unit_conversions (
  id uuid primary key default gen_random_uuid(),
  from_unit text not null check (length(btrim(from_unit)) between 1 and 40),
  to_unit text not null check (length(btrim(to_unit)) between 1 and 40),
  factor numeric(18, 8) not null check (factor > 0),
  source_note text,
  valid_from date not null default current_date,
  created_at timestamptz not null default now(),
  constraint unit_conversions_no_self check (lower(btrim(from_unit)) <> lower(btrim(to_unit))),
  constraint unit_conversions_unique unique (from_unit, to_unit, valid_from)
);

create index unit_conversions_lookup_idx
  on public.unit_conversions (lower(from_unit), lower(to_unit), valid_from desc);

-- ---------------------------------------------------------------------------
-- Invariants
-- ---------------------------------------------------------------------------

-- Deferred constraint trigger: multi-row ownership edits can temporarily
-- disagree while a transaction is in progress, but at commit every property
-- with owners must total exactly 100.00 and every owner row must belong to the
-- property's owner.
create or replace function public.enforce_property_ownership()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_property_id uuid;
  v_expected_owner uuid;
  v_actual_owner uuid;
  v_total numeric(18, 4);
begin
  if tg_op = 'DELETE' then
    v_property_id := old.property_id;
    v_actual_owner := old.owner_id;
  else
    v_property_id := new.property_id;
    v_actual_owner := new.owner_id;
  end if;

  select p.owner_id into v_expected_owner
  from public.properties p
  where p.id = v_property_id;
  if not found then
    raise exception 'Property not found' using errcode = '22023';
  end if;
  if v_actual_owner is distinct from v_expected_owner then
    raise exception 'Ownership record owner does not match the property'
      using errcode = '42501';
  end if;

  select coalesce(sum(o.ownership_percentage), 0) into v_total
  from public.property_ownerships o
  where o.property_id = v_property_id;
  if round(v_total, 2) <> 100.00 then
    raise exception 'Ownership shares for a property must total 100.00'
      using errcode = '23514';
  end if;
  return null;
end;
$$;

revoke all on function public.enforce_property_ownership()
  from public, anon, authenticated;

create constraint trigger property_ownership_total_check
  after insert or update or delete on public.property_ownerships
  deferrable initially deferred
  for each row execute function public.enforce_property_ownership();

-- A document's object must live in that owner's private storage folder. This
-- holds even if a caller bypasses the application's upload service.
create or replace function public.validate_document_owner_path()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if (storage.foldername(new.storage_path))[1] <> new.owner_id::text then
    raise exception 'Document storage path does not match its owner'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.validate_document_owner_path()
  from public, anon, authenticated;

create trigger documents_validate_path
  before insert or update on public.documents
  for each row execute function public.validate_document_owner_path();

-- A property-document link must not cross owner boundaries or point at rows
-- belonging to a different owner.
create or replace function public.validate_property_document_link()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.properties p
    where p.id = new.property_id and p.owner_id = new.owner_id
  ) then
    raise exception 'Property does not belong to the document owner'
      using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.documents d
    where d.id = new.document_id and d.owner_id = new.owner_id
  ) then
    raise exception 'Document does not belong to the property owner'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.validate_property_document_link()
  from public, anon, authenticated;

create trigger property_documents_validate_link
  before insert or update on public.property_documents
  for each row execute function public.validate_property_document_link();

create trigger properties_set_updated_at
  before update on public.properties
  for each row execute function public.set_updated_at();
create trigger property_ownerships_set_updated_at
  before update on public.property_ownerships
  for each row execute function public.set_updated_at();

create trigger properties_audit
  after insert or update or delete on public.properties
  for each row execute function public.audit_mutation();
create trigger property_ownerships_audit
  after insert or update or delete on public.property_ownerships
  for each row execute function public.audit_mutation();
create trigger property_valuations_audit
  after insert on public.property_valuations
  for each row execute function public.audit_mutation();
create trigger documents_audit
  after insert on public.documents
  for each row execute function public.audit_mutation();
create trigger property_documents_audit
  after insert or update or delete on public.property_documents
  for each row execute function public.audit_mutation();

-- ---------------------------------------------------------------------------
-- RLS and grants
-- ---------------------------------------------------------------------------

alter table public.properties enable row level security;
alter table public.documents enable row level security;
alter table public.property_ownerships enable row level security;
alter table public.property_documents enable row level security;
alter table public.property_valuations enable row level security;
alter table public.unit_conversions enable row level security;

create policy properties_owner_all on public.properties
  for all to authenticated
  using (owner_id = (select auth.uid()) and public.is_owner())
  with check (owner_id = (select auth.uid()) and public.is_owner());

create policy documents_owner_all on public.documents
  for all to authenticated
  using (owner_id = (select auth.uid()) and public.is_owner())
  with check (owner_id = (select auth.uid()) and public.is_owner());

create policy property_ownerships_owner_all on public.property_ownerships
  for all to authenticated
  using (owner_id = (select auth.uid()) and public.is_owner())
  with check (owner_id = (select auth.uid()) and public.is_owner());

create policy property_documents_owner_all on public.property_documents
  for all to authenticated
  using (owner_id = (select auth.uid()) and public.is_owner())
  with check (owner_id = (select auth.uid()) and public.is_owner());

create policy property_valuations_owner_read on public.property_valuations
  for select to authenticated
  using (owner_id = (select auth.uid()) and public.is_owner());
create policy property_valuations_owner_insert on public.property_valuations
  for insert to authenticated
  with check (owner_id = (select auth.uid()) and public.is_owner());

create policy unit_conversions_owner_read on public.unit_conversions
  for select to authenticated using (public.is_owner());
create policy unit_conversions_owner_write on public.unit_conversions
  for all to authenticated
  using (public.is_owner())
  with check (public.is_owner());

revoke all on public.properties, public.documents, public.property_ownerships,
  public.property_documents, public.property_valuations, public.unit_conversions
  from public, anon;
revoke update, delete on public.property_valuations from authenticated;

grant select, insert, update, delete on public.properties, public.documents,
  public.property_ownerships, public.property_documents to authenticated;
grant select, insert on public.property_valuations to authenticated;
grant select, insert, update, delete on public.unit_conversions to authenticated;

-- ---------------------------------------------------------------------------
-- Property RPCs. All are SECURITY INVOKER and lock the property row before
-- changing its ownership roster or cached estimated value.
-- ---------------------------------------------------------------------------

create or replace function public.add_property_owner(
  p_property_id uuid,
  p_owners jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_owner_id uuid := (select auth.uid());
  v_property public.properties%rowtype;
  v_owner jsonb;
  v_name text;
  v_percentage numeric(18, 4);
  v_total numeric(18, 4) := 0;
  v_count integer;
begin
  perform public.require_owner();

  select * into v_property
  from public.properties p
  where p.id = p_property_id and p.owner_id = v_owner_id
  for update;
  if not found then
    raise exception 'Property not found' using errcode = '22023';
  end if;

  if jsonb_typeof(p_owners) is distinct from 'array' then
    raise exception 'Owners must be a list' using errcode = '22023';
  end if;
  select jsonb_array_length(p_owners) into v_count;
  if v_count < 1 or v_count > 20 then
    raise exception 'Provide between 1 and 20 owners' using errcode = '22023';
  end if;

  for v_owner in select value from jsonb_array_elements(p_owners)
  loop
    v_name := nullif(btrim(coalesce(v_owner->>'owner_name', '')), '');
    if v_name is null or length(v_name) > 200 then
      raise exception 'Each owner needs a name' using errcode = '22023';
    end if;
    begin
      v_percentage := (v_owner->>'ownership_percentage')::numeric;
    exception when others then
      raise exception 'Ownership percentages must be numbers' using errcode = '22023';
    end;
    if v_percentage <= 0 or v_percentage > 100 or v_percentage <> round(v_percentage, 2) then
      raise exception 'Ownership percentages must be between 0 and 100 with two decimals'
        using errcode = '22023';
    end if;
    if nullif(btrim(coalesce(v_owner->>'acquisition_date', '')), '') is not null
      and btrim(v_owner->>'acquisition_date') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      raise exception 'Use a valid acquisition date' using errcode = '22023';
    end if;
    v_total := v_total + v_percentage;
  end loop;

  if round(v_total, 2) <> 100.00 then
    raise exception 'Ownership shares must total 100.00' using errcode = '23514';
  end if;

  delete from public.property_ownerships o
   where o.property_id = p_property_id and o.owner_id = v_owner_id;

  insert into public.property_ownerships (
    owner_id, property_id, owner_name, ownership_percentage,
    acquisition_date, ownership_type, notes
  )
  select
    v_owner_id,
    p_property_id,
    btrim(o->>'owner_name'),
    (o->>'ownership_percentage')::numeric,
    case
      when nullif(btrim(coalesce(o->>'acquisition_date', '')), '') is null then null
      else btrim(o->>'acquisition_date')::date
    end,
    nullif(btrim(coalesce(o->>'ownership_type', '')), ''),
    nullif(btrim(coalesce(o->>'notes', '')), '')
  from jsonb_array_elements(p_owners) as o;

  return p_property_id;
end;
$$;

create or replace function public.create_property(
  p_name text,
  p_area_unit text,
  p_country_code text default null,
  p_division text default null,
  p_district text default null,
  p_upazila text default null,
  p_union_name text default null,
  p_village text default null,
  p_mouza text default null,
  p_khatian_number text default null,
  p_dag_number text default null,
  p_land_classification text default null,
  p_total_area text default null,
  p_purchase_date text default null,
  p_purchase_price text default null,
  p_currency_code text default null,
  p_current_estimated_value text default null,
  p_notes text default null,
  p_owners jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_owner_id uuid := (select auth.uid());
  v_id uuid := gen_random_uuid();
  v_area numeric;
  v_price numeric;
  v_value numeric;
  v_currency char(3);
begin
  perform public.require_owner();

  if nullif(btrim(coalesce(p_name, '')), '') is null then
    raise exception 'Property name is required' using errcode = '22023';
  end if;
  if nullif(btrim(coalesce(p_area_unit, '')), '') is null then
    raise exception 'Original area unit is required' using errcode = '22023';
  end if;

  if nullif(btrim(coalesce(p_total_area, '')), '') is not null then
    begin
      v_area := btrim(p_total_area)::numeric;
    exception when others then
      raise exception 'Enter a valid total area' using errcode = '22023';
    end;
    if v_area <= 0 then
      raise exception 'Total area must be greater than zero' using errcode = '22023';
    end if;
  end if;

  if nullif(btrim(coalesce(p_purchase_price, '')), '') is not null then
    begin
      v_price := btrim(p_purchase_price)::numeric;
    exception when others then
      raise exception 'Enter a valid purchase price' using errcode = '22023';
    end;
    if v_price < 0 then
      raise exception 'Purchase price cannot be negative' using errcode = '22023';
    end if;
  end if;

  if nullif(btrim(coalesce(p_current_estimated_value, '')), '') is not null then
    begin
      v_value := btrim(p_current_estimated_value)::numeric;
    exception when others then
      raise exception 'Enter a valid estimated value' using errcode = '22023';
    end;
    if v_value < 0 then
      raise exception 'Estimated value cannot be negative' using errcode = '22023';
    end if;
  end if;

  v_currency := nullif(upper(btrim(coalesce(p_currency_code, ''))), '')::char(3);
  if v_currency is not null and not exists (
    select 1 from public.currencies c
    where c.code = v_currency and c.is_active
  ) then
    raise exception 'Currency is not configured' using errcode = '22023';
  end if;
  if nullif(btrim(coalesce(p_purchase_date, '')), '') is not null
    and btrim(p_purchase_date) !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    raise exception 'Use a valid purchase date' using errcode = '22023';
  end if;

  insert into public.properties (
    id, owner_id, name, country_code, division, district, upazila, union_name,
    village, mouza, khatian_number, dag_number, land_classification,
    total_area, area_unit, purchase_date, purchase_price, currency_code,
    current_estimated_value, notes
  ) values (
    v_id,
    v_owner_id,
    btrim(p_name),
    nullif(upper(btrim(coalesce(p_country_code, ''))), '')::char(2),
    nullif(btrim(coalesce(p_division, '')), ''),
    nullif(btrim(coalesce(p_district, '')), ''),
    nullif(btrim(coalesce(p_upazila, '')), ''),
    nullif(btrim(coalesce(p_union_name, '')), ''),
    nullif(btrim(coalesce(p_village, '')), ''),
    nullif(btrim(coalesce(p_mouza, '')), ''),
    nullif(btrim(coalesce(p_khatian_number, '')), ''),
    nullif(btrim(coalesce(p_dag_number, '')), ''),
    nullif(btrim(coalesce(p_land_classification, '')), ''),
    v_area,
    btrim(p_area_unit),
    case
      when nullif(btrim(coalesce(p_purchase_date, '')), '') is null then null
      else btrim(p_purchase_date)::date
    end,
    v_price,
    v_currency,
    v_value,
    nullif(btrim(coalesce(p_notes, '')), '')
  );

  perform public.add_property_owner(v_id, p_owners);
  return v_id;
end;
$$;

create or replace function public.record_property_valuation(
  p_property_id uuid,
  p_estimated_value text,
  p_currency_code text,
  p_valued_on text,
  p_source text default null,
  p_is_verified boolean default false,
  p_notes text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_owner_id uuid := (select auth.uid());
  v_property public.properties%rowtype;
  v_amount numeric;
  v_currency char(3);
  v_value_date date;
  v_id uuid := gen_random_uuid();
begin
  perform public.require_owner();

  select * into v_property
  from public.properties p
  where p.id = p_property_id and p.owner_id = v_owner_id
  for update;
  if not found then
    raise exception 'Property not found' using errcode = '22023';
  end if;

  begin
    v_amount := btrim(coalesce(p_estimated_value, ''))::numeric;
  exception when others then
    raise exception 'Enter a valid estimated value' using errcode = '22023';
  end;
  if v_amount < 0 then
    raise exception 'Estimated value cannot be negative' using errcode = '22023';
  end if;

  if coalesce(btrim(coalesce(p_valued_on, '')), '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    raise exception 'Use a valid valuation date' using errcode = '22023';
  end if;
  v_value_date := p_valued_on::date;

  v_currency := upper(btrim(coalesce(p_currency_code, '')))::char(3);
  if not exists (
    select 1 from public.currencies c
    where c.code = v_currency and c.is_active
  ) then
    raise exception 'Currency is not configured' using errcode = '22023';
  end if;

  insert into public.property_valuations (
    id, owner_id, property_id, estimated_value, currency_code,
    valued_on, source, is_verified, notes
  ) values (
    v_id, v_owner_id, p_property_id, v_amount, v_currency, v_value_date,
    nullif(btrim(coalesce(p_source, '')), ''),
    coalesce(p_is_verified, false),
    nullif(btrim(coalesce(p_notes, '')), '')
  );

  -- Only the latest valuation decides the displayed current estimate.
  if (
    select v2.id
    from public.property_valuations v2
    where v2.property_id = p_property_id
    order by v2.valued_on desc, v2.created_at desc
    limit 1
  ) = v_id then
    update public.properties p
       set current_estimated_value = v_amount,
           currency_code = v_currency
     where p.id = p_property_id and p.owner_id = v_owner_id;
  end if;

  return v_id;
end;
$$;

revoke all on function public.enforce_property_ownership() from public, anon, authenticated;
revoke all on function public.validate_document_owner_path() from public, anon, authenticated;
revoke all on function public.add_property_owner(uuid, jsonb) from public, anon;
grant execute on function public.add_property_owner(uuid, jsonb) to authenticated;
revoke all on function public.create_property(
  text, text, text, text, text, text, text, text, text, text, text, text,
  text, text, text, text, text, text, jsonb
) from public, anon;
grant execute on function public.create_property(
  text, text, text, text, text, text, text, text, text, text, text, text,
  text, text, text, text, text, text, jsonb
) to authenticated;
revoke all on function public.record_property_valuation(uuid, text, text, text, text, boolean, text)
  from public, anon;
grant execute on function public.record_property_valuation(uuid, text, text, text, text, boolean, text)
  to authenticated;
