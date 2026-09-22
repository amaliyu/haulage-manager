-- =============================================================================
-- Haulage Manager — Step 1 schema, roles, RLS and storage
--
-- DO NOT apply automatically. A human runs this once, in the Supabase SQL
-- editor (or `supabase db push`), before running supabase/seed.sql.
--
-- Conventions
--   * Money is integer naira (int). Never floats.
--   * Every timestamp is timestamptz, stored in UTC; the app displays it in
--     Africa/Lagos time.
--   * Every table has RLS enabled and explicit policies. A signed-in user with
--     no profile row, or with is_active = false, has access to nothing
--     (current_user_role() returns null for them).
--   * References to profiles use ON DELETE SET NULL so that removing an auth
--     user never fails on history rows. The app deactivates users instead of
--     deleting them.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------
-- Document numbers: ORD-YYYY-NNNN and TRP-YYYY-NNNNNN
-- Backed by one Postgres sequence per prefix per year (created on first use),
-- so numbering restarts at 1 every calendar year (Africa/Lagos) and nextval()
-- stays atomic under concurrency. Sequences are non-transactional, so a rolled
-- back insert can leave a gap in the numbering; numbers are never reused.
-- -----------------------------------------------------------------------------

create or replace function public.next_doc_number(p_prefix text, p_width int)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_year text := to_char(now() at time zone 'Africa/Lagos', 'YYYY');
  v_seq  text;
  v_n    text;
begin
  if p_prefix not in ('ORD', 'TRP') then
    raise exception 'Unknown document prefix %', p_prefix;
  end if;
  v_seq := lower(p_prefix) || '_number_' || v_year || '_seq';
  begin
    execute format('create sequence if not exists public.%I as bigint start 1', v_seq);
  exception when duplicate_table or unique_violation then
    null; -- another transaction created it concurrently
  end;
  execute format('select nextval(%L)::text', 'public.' || v_seq) into v_n;
  if length(v_n) < p_width then
    v_n := lpad(v_n, p_width, '0');
  end if;
  return p_prefix || '-' || v_year || '-' || v_n;
end;
$$;

create or replace function public.next_order_number()
returns text language sql volatile security definer set search_path = ''
as $$ select public.next_doc_number('ORD', 4) $$;

create or replace function public.next_trip_number()
returns text language sql volatile security definer set search_path = ''
as $$ select public.next_doc_number('TRP', 6) $$;

revoke all on function public.next_doc_number(text, int) from public, anon, authenticated;
revoke all on function public.next_order_number() from public, anon;
revoke all on function public.next_trip_number() from public, anon;
grant execute on function public.next_order_number() to authenticated;
grant execute on function public.next_trip_number() to authenticated;

-- =============================================================================
-- TABLES (in dependency order)
-- =============================================================================

create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  phone       text,
  role        text not null check (role in ('admin','dispatcher','finance','driver')),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz,
  created_by  uuid references public.profiles(id) on delete set null
);

create table public.customers (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  phone            text not null,
  alt_phone        text,
  customer_type    text not null default 'company' check (customer_type in ('company','individual')),
  payment_terms    text not null default 'prepaid' check (payment_terms in ('prepaid','credit')),
  credit_load_cap  int not null default 0 check (credit_load_cap >= 0),
  credit_days      int not null default 0 check (credit_days >= 0),
  is_active        boolean not null default true,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz,
  created_by       uuid references public.profiles(id) on delete set null,
  constraint customers_prepaid_has_no_credit
    check (payment_terms = 'credit' or (credit_load_cap = 0 and credit_days = 0))
);

create table public.customer_sites (
  id                 uuid primary key default gen_random_uuid(),
  customer_id        uuid not null references public.customers(id) on delete cascade,
  name               text not null,
  area               text not null,
  latitude           numeric(9,6) check (latitude between -90 and 90),
  longitude          numeric(9,6) check (longitude between -180 and 180),
  geofence_radius_m  int not null default 300 check (geofence_radius_m > 0),
  directions         text,
  is_active          boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz,
  created_by         uuid references public.profiles(id) on delete set null
);

create table public.material_sources (
  id                     uuid primary key default gen_random_uuid(),
  name                   text not null,
  material               text not null check (material in ('sharp_sand','filling_sand','granite','laterite','other')),
  area                   text,
  latitude               numeric(9,6) check (latitude between -90 and 90),
  longitude              numeric(9,6) check (longitude between -180 and 180),
  default_material_cost  int not null default 0 check (default_material_cost >= 0),
  is_active              boolean not null default true,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz,
  created_by             uuid references public.profiles(id) on delete set null
);

create table public.routes (
  id                      uuid primary key default gen_random_uuid(),
  name                    text not null,
  source_id               uuid not null references public.material_sources(id),
  destination_area        text not null,
  distance_km             numeric(6,2) check (distance_km >= 0),
  diesel_allowance_litres numeric(6,2) not null check (diesel_allowance_litres >= 0),
  is_active               boolean not null default true,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz,
  created_by              uuid references public.profiles(id) on delete set null,
  unique (source_id, destination_area)
);

-- Price history: never update a price, always insert a new row. The only
-- permitted update is closing the open row (effective_to null -> timestamp).
create table public.route_prices (
  id                      uuid primary key default gen_random_uuid(),
  route_id                uuid not null references public.routes(id) on delete cascade,
  customer_price          int not null check (customer_price > 0),
  material_cost           int not null check (material_cost >= 0),
  diesel_price_per_litre  int not null check (diesel_price_per_litre > 0),
  crew_cost               int not null default 15000 check (crew_cost >= 0),
  effective_from          timestamptz not null default now(),
  effective_to            timestamptz,
  set_by                  uuid references public.profiles(id) on delete set null,
  note                    text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz,
  created_by              uuid references public.profiles(id) on delete set null,
  constraint route_prices_period_valid check (effective_to is null or effective_to >= effective_from)
);

-- Only one open (current) price per route.
create unique index route_prices_one_open_per_route
  on public.route_prices (route_id) where effective_to is null;

create table public.trucks (
  id                       uuid primary key default gen_random_uuid(),
  plate_number             text not null unique,
  make                     text,
  model                    text,
  capacity_tons            numeric(5,2) check (capacity_tons > 0),
  owner_type               text not null check (owner_type in ('spv','operator','partner')),
  owner_name               text,
  -- Storage path inside the private trip-photos bucket
  -- (trucks/{truck_id}/reference.jpg); the app resolves it to a signed URL.
  reference_load_photo_url text,
  status                   text not null default 'available' check (status in ('available','on_trip','maintenance','inactive')),
  is_active                boolean not null default true,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz,
  created_by               uuid references public.profiles(id) on delete set null
);

create table public.drivers (
  id                 uuid primary key default gen_random_uuid(),
  profile_id         uuid unique references public.profiles(id) on delete set null,
  full_name          text not null,
  phone              text not null,
  licence_number     text,
  assigned_truck_id  uuid references public.trucks(id) on delete set null,
  is_active          boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz,
  created_by         uuid references public.profiles(id) on delete set null
);

create table public.orders (
  id              uuid primary key default gen_random_uuid(),
  order_number    text not null unique default public.next_order_number(),
  customer_id     uuid not null references public.customers(id),
  site_id         uuid not null references public.customer_sites(id),
  route_id        uuid not null references public.routes(id),
  material        text not null,
  trips_ordered   int not null check (trips_ordered > 0),
  price_per_trip  int not null check (price_per_trip >= 0),
  route_price_id  uuid references public.route_prices(id),
  status          text not null default 'draft' check (status in ('draft','awaiting_payment','ready','in_progress','completed','cancelled')),
  payment_terms   text not null check (payment_terms in ('prepaid','credit')),
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz,
  created_by      uuid references public.profiles(id) on delete set null
);

create table public.trips (
  id                    uuid primary key default gen_random_uuid(),
  trip_number           text not null unique default public.next_trip_number(),
  order_id              uuid not null references public.orders(id),
  truck_id              uuid references public.trucks(id),
  driver_id             uuid references public.drivers(id),
  source_id             uuid references public.material_sources(id),
  status                text not null default 'pending' check (status in ('pending','assigned','loaded','in_transit','delivered','settled','disputed','cancelled')),
  price                 int not null check (price >= 0),
  material_cost         int not null default 0 check (material_cost >= 0),
  crew_cost             int not null default 0 check (crew_cost >= 0),
  diesel_litres_issued  numeric(6,2) default 0 check (diesel_litres_issued >= 0),
  diesel_cost           int not null default 0 check (diesel_cost >= 0),
  repayment_allocation  int not null default 0 check (repayment_allocation >= 0),
  loader_receipt_no     text,
  assigned_at           timestamptz,
  loaded_at             timestamptz,
  delivered_at          timestamptz,
  settled_at            timestamptz,
  cancel_reason         text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz,
  created_by            uuid references public.profiles(id) on delete set null
);

-- Append-only: never updated or deleted.
create table public.trip_events (
  id           uuid primary key default gen_random_uuid(),
  trip_id      uuid not null references public.trips(id) on delete cascade,
  event_type   text not null check (event_type in ('created','assigned','loaded','in_transit','delivered','settled','disputed','cancelled','note')),
  actor_id     uuid references public.profiles(id) on delete set null,
  occurred_at  timestamptz not null default now(),
  latitude     numeric(9,6) check (latitude between -90 and 90),
  longitude    numeric(9,6) check (longitude between -180 and 180),
  note         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz,
  created_by   uuid references public.profiles(id) on delete set null
);

create table public.trip_photos (
  id            uuid primary key default gen_random_uuid(),
  trip_id       uuid not null references public.trips(id) on delete cascade,
  photo_type    text not null check (photo_type in ('loading','delivery','other')),
  storage_path  text not null,
  latitude      numeric(9,6) check (latitude between -90 and 90),
  longitude     numeric(9,6) check (longitude between -180 and 180),
  taken_at      timestamptz,
  uploaded_by   uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz,
  created_by    uuid references public.profiles(id) on delete set null
);

create table public.payments (
  id              uuid primary key default gen_random_uuid(),
  customer_id     uuid not null references public.customers(id),
  amount          int not null check (amount > 0),
  method          text not null check (method in ('bank_transfer','cash','pos','other')),
  bank_reference  text,
  received_at     timestamptz not null,
  confirmed_by    uuid references public.profiles(id) on delete set null,
  note            text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz,
  created_by      uuid references public.profiles(id) on delete set null
);

-- Append-only: corrections by reversal rows only.
create table public.ledger_entries (
  id                 uuid primary key default gen_random_uuid(),
  customer_id        uuid not null references public.customers(id),
  entry_type         text not null check (entry_type in ('payment','trip_charge','refund','reversal','adjustment')),
  amount             int not null,
  payment_id         uuid references public.payments(id),
  trip_id            uuid references public.trips(id),
  reverses_entry_id  uuid references public.ledger_entries(id),
  description        text not null,
  occurred_at        timestamptz not null default now(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz,
  created_by         uuid references public.profiles(id) on delete set null,
  constraint ledger_reversal_points_back
    check (entry_type <> 'reversal' or reverses_entry_id is not null)
);

create table public.diesel_issues (
  id               uuid primary key default gen_random_uuid(),
  trip_id          uuid references public.trips(id),
  truck_id         uuid not null references public.trucks(id),
  driver_id        uuid references public.drivers(id),
  litres           numeric(6,2) not null check (litres > 0),
  price_per_litre  int not null check (price_per_litre > 0),
  total_cost       int not null check (total_cost >= 0),
  issued_at        timestamptz not null default now(),
  issued_by        uuid references public.profiles(id) on delete set null,
  note             text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz,
  created_by       uuid references public.profiles(id) on delete set null
);

create table public.crew_settlements (
  id            uuid primary key default gen_random_uuid(),
  driver_id     uuid not null references public.drivers(id),
  period_start  date not null,
  period_end    date not null,
  trips_count   int not null default 0 check (trips_count >= 0),
  gross_amount  int not null default 0,
  deductions    int not null default 0,
  net_amount    int not null default 0,
  status        text not null default 'draft' check (status in ('draft','approved','paid')),
  approved_by   uuid references public.profiles(id) on delete set null,
  paid_at       timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz,
  created_by    uuid references public.profiles(id) on delete set null,
  constraint crew_settlements_period_valid check (period_end >= period_start)
);

create table public.diesel_prices (
  id               uuid primary key default gen_random_uuid(),
  price_per_litre  int not null check (price_per_litre > 0),
  effective_from   timestamptz not null default now(),
  effective_to     timestamptz,
  set_by           uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz,
  created_by       uuid references public.profiles(id) on delete set null,
  constraint diesel_prices_period_valid check (effective_to is null or effective_to >= effective_from)
);

-- Only one open (current) pump price.
create unique index diesel_prices_one_open
  on public.diesel_prices ((true)) where effective_to is null;

create table public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  table_name  text not null,
  record_id   uuid,
  action      text not null check (action in ('insert','update','delete')),
  actor_id    uuid references public.profiles(id) on delete set null,
  old_values  jsonb,
  new_values  jsonb,
  occurred_at timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz,
  created_by  uuid references public.profiles(id) on delete set null
);

-- Foreign-key and lookup indexes
create index customer_sites_customer_idx on public.customer_sites (customer_id);
create index routes_source_idx           on public.routes (source_id);
create index route_prices_route_idx      on public.route_prices (route_id, effective_from desc);
create index drivers_truck_idx           on public.drivers (assigned_truck_id);
create index orders_customer_idx         on public.orders (customer_id);
create index orders_status_idx           on public.orders (status);
create index trips_order_idx             on public.trips (order_id);
create index trips_driver_idx            on public.trips (driver_id);
create index trips_status_idx            on public.trips (status);
create index trip_events_trip_idx        on public.trip_events (trip_id, occurred_at);
create index trip_photos_trip_idx        on public.trip_photos (trip_id);
create index payments_customer_idx       on public.payments (customer_id);
create index ledger_customer_idx         on public.ledger_entries (customer_id, occurred_at);
create index diesel_issues_truck_idx     on public.diesel_issues (truck_id);
create index crew_settlements_driver_idx on public.crew_settlements (driver_id);
create index audit_log_record_idx        on public.audit_log (table_name, record_id);
create index audit_log_time_idx          on public.audit_log (occurred_at desc);

-- =============================================================================
-- ROLE HELPERS
-- =============================================================================

-- Role of the signed-in user. Null when there is no profile row or the
-- profile is inactive, so every role-based policy denies them.
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid()
    and p.is_active
$$;

-- drivers.id of the signed-in driver (active driver profile, active driver row).
create or replace function public.current_driver_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select d.id
  from public.drivers d
  join public.profiles p on p.id = d.profile_id
  where d.profile_id = auth.uid()
    and d.is_active
    and p.is_active
    and p.role = 'driver'
  limit 1
$$;

-- True when the signed-in user is the driver assigned to the trip.
create or replace function public.is_assigned_driver(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_trip_id is not null and exists (
    select 1 from public.trips t
    where t.id = p_trip_id
      and t.driver_id is not null
      and t.driver_id = public.current_driver_id()
  )
$$;

-- Safe text -> uuid cast for storage paths.
create or replace function public.try_uuid(p text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return p::uuid;
exception when others then
  return null;
end;
$$;

revoke all on function public.current_user_role() from public, anon;
revoke all on function public.current_driver_id() from public, anon;
revoke all on function public.is_assigned_driver(uuid) from public, anon;
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.current_driver_id() to authenticated;
grant execute on function public.is_assigned_driver(uuid) to authenticated;
grant execute on function public.try_uuid(text) to authenticated;

-- =============================================================================
-- ROW STAMPS: created_by on insert, updated_at on update
-- created_at / created_by cannot be rewritten by an update.
-- =============================================================================

create or replace function public.set_row_stamps()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.created_by := auth.uid();
    end if;
    new.created_at := coalesce(new.created_at, now());
    new.updated_at := null;
  elsif tg_op = 'UPDATE' then
    new.created_at := old.created_at;
    new.created_by := old.created_by;
    new.updated_at := now();
  end if;
  return new;
end;
$$;

-- =============================================================================
-- AUDIT LOG (every table except audit_log and trip_events)
-- =============================================================================

create or replace function public.audit_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_old   jsonb;
  v_new   jsonb;
begin
  select p.id into v_actor from public.profiles p where p.id = auth.uid();

  if tg_op in ('UPDATE', 'DELETE') then v_old := to_jsonb(old); end if;
  if tg_op in ('INSERT', 'UPDATE') then v_new := to_jsonb(new); end if;

  insert into public.audit_log (table_name, record_id, action, actor_id, old_values, new_values, created_by)
  values (
    tg_table_name,
    coalesce((v_new ->> 'id')::uuid, (v_old ->> 'id')::uuid),
    lower(tg_op),
    v_actor,
    v_old,
    v_new,
    v_actor
  );

  return null;
end;
$$;

revoke all on function public.audit_row() from public, anon, authenticated;

-- Attach stamps + audit triggers.
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles','customers','customer_sites','material_sources','routes',
    'route_prices','trucks','drivers','orders','trips','trip_events',
    'trip_photos','payments','ledger_entries','diesel_issues',
    'crew_settlements','diesel_prices'
  ] loop
    execute format(
      'create trigger a_set_row_stamps before insert or update on public.%I
         for each row execute function public.set_row_stamps()', t);
  end loop;

  foreach t in array array[
    'profiles','customers','customer_sites','material_sources','routes',
    'route_prices','trucks','drivers','orders','trips',
    'trip_photos','payments','ledger_entries','diesel_issues',
    'crew_settlements','diesel_prices'
  ] loop
    execute format(
      'create trigger z_audit_row after insert or update or delete on public.%I
         for each row execute function public.audit_row()', t);
  end loop;
end;
$$;

-- =============================================================================
-- COLUMN-LEVEL GUARDS
-- RLS decides which rows a role may update; these triggers decide which
-- columns. Changing any other column raises an error.
-- =============================================================================

-- True when old and new are identical apart from p_allowed (and updated_at).
create or replace function public.only_columns_changed(p_old jsonb, p_new jsonb, p_allowed text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select (p_old - p_allowed - 'updated_at'::text) = (p_new - p_allowed - 'updated_at'::text)
$$;

-- profiles: non-admins may edit their own name and phone only, and the last
-- active admin cannot be demoted or deactivated.
create or replace function public.guard_profiles_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null
     and coalesce(public.current_user_role(), '') <> 'admin'
     and not public.only_columns_changed(to_jsonb(old), to_jsonb(new), array['full_name','phone']) then
    raise exception 'You may only change your own name and phone number'
      using errcode = '42501';
  end if;

  if old.role = 'admin' and old.is_active
     and (new.role <> 'admin' or not new.is_active)
     and not exists (
       select 1 from public.profiles p
       where p.role = 'admin' and p.is_active and p.id <> old.id
     ) then
    raise exception 'At least one active admin must remain'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger b_guard_profiles_update before update on public.profiles
  for each row execute function public.guard_profiles_update();

-- route_prices / diesel_prices: history rows are immutable. The only change
-- allowed is closing an open row by setting effective_to.
create or replace function public.guard_price_history_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.effective_to is not null then
    raise exception 'This price is closed and can no longer change'
      using errcode = '42501';
  end if;
  if not public.only_columns_changed(to_jsonb(old), to_jsonb(new), array['effective_to']) then
    raise exception 'Prices are never edited. Record a new price instead.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger b_guard_route_prices_update before update on public.route_prices
  for each row execute function public.guard_price_history_update();
create trigger b_guard_diesel_prices_update before update on public.diesel_prices
  for each row execute function public.guard_price_history_update();

-- orders: finance may change payment-related fields only.
create or replace function public.guard_orders_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and public.current_user_role() = 'finance' then
    if not public.only_columns_changed(to_jsonb(old), to_jsonb(new), array['status','payment_terms']) then
      raise exception 'Finance may only change payment status and payment terms on an order'
        using errcode = '42501';
    end if;
    if new.status is distinct from old.status
       and new.status not in ('awaiting_payment','ready') then
      raise exception 'Finance may only move an order to awaiting_payment or ready'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger b_guard_orders_update before update on public.orders
  for each row execute function public.guard_orders_update();

-- trips: finance may change settlement fields; the assigned driver may change
-- status, loaded_at, delivered_at and loader_receipt_no only.
create or replace function public.guard_trips_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := public.current_user_role();
begin
  if auth.uid() is null then
    return new;
  end if;

  if v_role = 'finance' then
    if not public.only_columns_changed(to_jsonb(old), to_jsonb(new),
         array['status','settled_at','repayment_allocation']) then
      raise exception 'Finance may only change settlement fields on a trip'
        using errcode = '42501';
    end if;
    if new.status is distinct from old.status
       and new.status not in ('settled','disputed') then
      raise exception 'Finance may only mark a trip settled or disputed'
        using errcode = '42501';
    end if;
  elsif v_role = 'driver' then
    if not public.only_columns_changed(to_jsonb(old), to_jsonb(new),
         array['status','loaded_at','delivered_at','loader_receipt_no']) then
      raise exception 'Drivers may only update trip status, load and delivery times and the loader receipt'
        using errcode = '42501';
    end if;
    if new.status is distinct from old.status
       and new.status not in ('loaded','in_transit','delivered') then
      raise exception 'Drivers may only mark a trip loaded, in transit or delivered'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

create trigger b_guard_trips_update before update on public.trips
  for each row execute function public.guard_trips_update();

-- =============================================================================
-- TRANSACTIONAL PRICE CHANGES
-- Close the current row (effective_to = now()) and insert the new one in one
-- transaction. The new row's effective_from equals the closed row's
-- effective_to, so history has no gaps or overlaps.
-- =============================================================================

create or replace function public.change_route_price(
  p_route_id               uuid,
  p_customer_price         int,
  p_material_cost          int,
  p_diesel_price_per_litre int,
  p_crew_cost              int,
  p_note                   text default null
)
returns public.route_prices
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_row public.route_prices;
begin
  if coalesce(public.current_user_role(), '') <> 'admin' then
    raise exception 'Only an admin can change route prices' using errcode = '42501';
  end if;

  -- Serialise concurrent price changes on the same route.
  perform 1 from public.routes r where r.id = p_route_id for update;
  if not found then
    raise exception 'Route not found' using errcode = 'P0002';
  end if;

  update public.route_prices
     set effective_to = v_now
   where route_id = p_route_id
     and effective_to is null;

  insert into public.route_prices
    (route_id, customer_price, material_cost, diesel_price_per_litre, crew_cost,
     effective_from, set_by, note)
  values
    (p_route_id, p_customer_price, p_material_cost, p_diesel_price_per_litre, p_crew_cost,
     v_now, auth.uid(), nullif(btrim(p_note), ''))
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.set_diesel_price(p_price_per_litre int)
returns public.diesel_prices
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_row public.diesel_prices;
begin
  if coalesce(public.current_user_role(), '') <> 'admin' then
    raise exception 'Only an admin can set the diesel price' using errcode = '42501';
  end if;

  -- Serialise concurrent changes.
  perform pg_advisory_xact_lock(hashtext('public.diesel_prices'));

  update public.diesel_prices
     set effective_to = v_now
   where effective_to is null;

  insert into public.diesel_prices (price_per_litre, effective_from, set_by)
  values (p_price_per_litre, v_now, auth.uid())
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.change_route_price(uuid, int, int, int, int, text) from public, anon;
revoke all on function public.set_diesel_price(int) from public, anon;
grant execute on function public.change_route_price(uuid, int, int, int, int, text) to authenticated;
grant execute on function public.set_diesel_price(int) to authenticated;

-- =============================================================================
-- ROW LEVEL SECURITY
-- All policies are for the `authenticated` role. `anon` gets no policy and
-- no table privileges.
-- =============================================================================

alter table public.profiles         enable row level security;
alter table public.customers        enable row level security;
alter table public.customer_sites   enable row level security;
alter table public.material_sources enable row level security;
alter table public.routes           enable row level security;
alter table public.route_prices     enable row level security;
alter table public.trucks           enable row level security;
alter table public.drivers          enable row level security;
alter table public.orders           enable row level security;
alter table public.trips            enable row level security;
alter table public.trip_events      enable row level security;
alter table public.trip_photos      enable row level security;
alter table public.payments         enable row level security;
alter table public.ledger_entries   enable row level security;
alter table public.diesel_issues    enable row level security;
alter table public.crew_settlements enable row level security;
alter table public.diesel_prices    enable row level security;
alter table public.audit_log        enable row level security;

revoke all on
  public.profiles, public.customers, public.customer_sites, public.material_sources,
  public.routes, public.route_prices, public.trucks, public.drivers, public.orders,
  public.trips, public.trip_events, public.trip_photos, public.payments,
  public.ledger_entries, public.diesel_issues, public.crew_settlements,
  public.diesel_prices, public.audit_log
from anon;

-- Append-only tables: remove the privilege as well as having no policy.
revoke update, delete, truncate on public.trip_events, public.trip_photos, public.ledger_entries from authenticated;
revoke insert, update, delete, truncate on public.audit_log from authenticated;

-- ---- profiles ---------------------------------------------------------------
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy profiles_admin_select on public.profiles
  for select to authenticated
  using ((select public.current_user_role()) = 'admin');

create policy profiles_admin_insert on public.profiles
  for insert to authenticated
  with check ((select public.current_user_role()) = 'admin');

create policy profiles_admin_update on public.profiles
  for update to authenticated
  using ((select public.current_user_role()) = 'admin')
  with check ((select public.current_user_role()) = 'admin');

create policy profiles_admin_delete on public.profiles
  for delete to authenticated
  using ((select public.current_user_role()) = 'admin');

-- ---- master data: admin full; dispatcher + finance read ---------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'customers','customer_sites','material_sources','routes','route_prices','diesel_prices'
  ] loop
    execute format($f$
      create policy %1$s_staff_select on public.%1$I
        for select to authenticated
        using ((select public.current_user_role()) in ('admin','dispatcher','finance'))
    $f$, t);
    execute format($f$
      create policy %1$s_admin_insert on public.%1$I
        for insert to authenticated
        with check ((select public.current_user_role()) = 'admin')
    $f$, t);
    execute format($f$
      create policy %1$s_admin_update on public.%1$I
        for update to authenticated
        using ((select public.current_user_role()) = 'admin')
        with check ((select public.current_user_role()) = 'admin')
    $f$, t);
    execute format($f$
      create policy %1$s_admin_delete on public.%1$I
        for delete to authenticated
        using ((select public.current_user_role()) = 'admin')
    $f$, t);
  end loop;
end;
$$;

-- trucks: drivers may read trucks too.
create policy trucks_select on public.trucks
  for select to authenticated
  using ((select public.current_user_role()) in ('admin','dispatcher','finance','driver'));
create policy trucks_admin_insert on public.trucks
  for insert to authenticated
  with check ((select public.current_user_role()) = 'admin');
create policy trucks_admin_update on public.trucks
  for update to authenticated
  using ((select public.current_user_role()) = 'admin')
  with check ((select public.current_user_role()) = 'admin');
create policy trucks_admin_delete on public.trucks
  for delete to authenticated
  using ((select public.current_user_role()) = 'admin');

-- drivers: a driver reads only their own driver row.
create policy drivers_staff_select on public.drivers
  for select to authenticated
  using ((select public.current_user_role()) in ('admin','dispatcher','finance'));
create policy drivers_own_select on public.drivers
  for select to authenticated
  using (
    (select public.current_user_role()) = 'driver'
    and id = (select public.current_driver_id())
  );
create policy drivers_admin_insert on public.drivers
  for insert to authenticated
  with check ((select public.current_user_role()) = 'admin');
create policy drivers_admin_update on public.drivers
  for update to authenticated
  using ((select public.current_user_role()) = 'admin')
  with check ((select public.current_user_role()) = 'admin');
create policy drivers_admin_delete on public.drivers
  for delete to authenticated
  using ((select public.current_user_role()) = 'admin');

-- ---- orders -----------------------------------------------------------------
-- admin + dispatcher insert/update; finance read + payment fields (column
-- guard trigger); driver nothing.
create policy orders_select on public.orders
  for select to authenticated
  using ((select public.current_user_role()) in ('admin','dispatcher','finance'));
create policy orders_insert on public.orders
  for insert to authenticated
  with check ((select public.current_user_role()) in ('admin','dispatcher'));
create policy orders_update on public.orders
  for update to authenticated
  using ((select public.current_user_role()) in ('admin','dispatcher','finance'))
  with check ((select public.current_user_role()) in ('admin','dispatcher','finance'));

-- ---- trips ------------------------------------------------------------------
create policy trips_staff_select on public.trips
  for select to authenticated
  using ((select public.current_user_role()) in ('admin','dispatcher','finance'));
create policy trips_driver_select on public.trips
  for select to authenticated
  using (
    (select public.current_user_role()) = 'driver'
    and driver_id = (select public.current_driver_id())
  );
create policy trips_insert on public.trips
  for insert to authenticated
  with check ((select public.current_user_role()) in ('admin','dispatcher'));
create policy trips_staff_update on public.trips
  for update to authenticated
  using ((select public.current_user_role()) in ('admin','dispatcher','finance'))
  with check ((select public.current_user_role()) in ('admin','dispatcher','finance'));
create policy trips_driver_update on public.trips
  for update to authenticated
  using (
    (select public.current_user_role()) = 'driver'
    and driver_id = (select public.current_driver_id())
  )
  with check (
    (select public.current_user_role()) = 'driver'
    and driver_id = (select public.current_driver_id())
  );

-- ---- trip_events (append-only) ---------------------------------------------
create policy trip_events_select on public.trip_events
  for select to authenticated
  using (
    (select public.current_user_role()) in ('admin','dispatcher','finance')
    or ((select public.current_user_role()) = 'driver' and public.is_assigned_driver(trip_id))
  );
create policy trip_events_insert on public.trip_events
  for insert to authenticated
  with check (
    (select public.current_user_role()) in ('admin','dispatcher')
    or (
      (select public.current_user_role()) = 'driver'
      and public.is_assigned_driver(trip_id)
      and actor_id = (select auth.uid())
    )
  );
-- No update or delete policy for anyone.

-- ---- trip_photos (append-only) ---------------------------------------------
create policy trip_photos_select on public.trip_photos
  for select to authenticated
  using (
    (select public.current_user_role()) in ('admin','dispatcher','finance')
    or ((select public.current_user_role()) = 'driver' and public.is_assigned_driver(trip_id))
  );
create policy trip_photos_insert on public.trip_photos
  for insert to authenticated
  with check (
    (
      (select public.current_user_role()) in ('admin','dispatcher')
      or (
        (select public.current_user_role()) = 'driver'
        and public.is_assigned_driver(trip_id)
        and uploaded_by = (select auth.uid())
      )
    )
    and storage_path like 'trips/' || trip_id::text || '/%'
  );
-- No update or delete policy for anyone.

-- ---- finance tables: admin + finance only ----------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['payments','crew_settlements','diesel_issues'] loop
    execute format($f$
      create policy %1$s_select on public.%1$I
        for select to authenticated
        using ((select public.current_user_role()) in ('admin','finance'))
    $f$, t);
    execute format($f$
      create policy %1$s_insert on public.%1$I
        for insert to authenticated
        with check ((select public.current_user_role()) in ('admin','finance'))
    $f$, t);
    execute format($f$
      create policy %1$s_update on public.%1$I
        for update to authenticated
        using ((select public.current_user_role()) in ('admin','finance'))
        with check ((select public.current_user_role()) in ('admin','finance'))
    $f$, t);
    execute format($f$
      create policy %1$s_delete on public.%1$I
        for delete to authenticated
        using ((select public.current_user_role()) in ('admin','finance'))
    $f$, t);
  end loop;
end;
$$;

-- ---- ledger_entries (append-only) ------------------------------------------
create policy ledger_entries_select on public.ledger_entries
  for select to authenticated
  using ((select public.current_user_role()) in ('admin','finance'));
create policy ledger_entries_insert on public.ledger_entries
  for insert to authenticated
  with check ((select public.current_user_role()) in ('admin','finance'));
-- No update or delete policy for anyone. Corrections are reversal rows.

-- ---- audit_log --------------------------------------------------------------
create policy audit_log_admin_select on public.audit_log
  for select to authenticated
  using ((select public.current_user_role()) = 'admin');
-- No insert/update/delete policy: rows are written by audit_row() (definer).

-- =============================================================================
-- STORAGE: private bucket `trip-photos`
--   trips/{trip_id}/{photo_type}-{timestamp}.jpg  — follows trip_photos rules
--   trucks/{truck_id}/reference.jpg               — admin writes, staff + drivers read
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('trip-photos', 'trip-photos', false, 10485760, array['image/jpeg'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy trip_photos_objects_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'trip-photos'
    and (
      (
        split_part(name, '/', 1) = 'trips'
        and (
          (select public.current_user_role()) in ('admin','dispatcher','finance')
          or (
            (select public.current_user_role()) = 'driver'
            and public.is_assigned_driver(public.try_uuid(split_part(name, '/', 2)))
          )
        )
      )
      or (
        split_part(name, '/', 1) = 'trucks'
        and (select public.current_user_role()) in ('admin','dispatcher','finance','driver')
      )
    )
  );

create policy trip_photos_objects_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'trip-photos'
    and (
      (
        name ~ '^trips/[0-9a-f-]{36}/(loading|delivery|other)-[0-9]+\.jpg$'
        and (
          (select public.current_user_role()) in ('admin','dispatcher')
          or (
            (select public.current_user_role()) = 'driver'
            and public.is_assigned_driver(public.try_uuid(split_part(name, '/', 2)))
          )
        )
      )
      or (
        name ~ '^trucks/[0-9a-f-]{36}/reference\.jpg$'
        and (select public.current_user_role()) = 'admin'
      )
    )
  );

-- Replacing a truck reference photo (upsert) needs update. Trip photos are
-- never replaced or deleted.
create policy trip_photos_objects_update_truck_ref on storage.objects
  for update to authenticated
  using (
    bucket_id = 'trip-photos'
    and name ~ '^trucks/[0-9a-f-]{36}/reference\.jpg$'
    and (select public.current_user_role()) = 'admin'
  )
  with check (
    bucket_id = 'trip-photos'
    and name ~ '^trucks/[0-9a-f-]{36}/reference\.jpg$'
    and (select public.current_user_role()) = 'admin'
  );
