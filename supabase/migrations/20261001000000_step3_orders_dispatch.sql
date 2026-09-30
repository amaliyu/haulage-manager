-- =============================================================================
-- Haulage Manager — Step 3: orders and dispatch (run after the Step 1 files)
--
-- Business rules live here, not only in the app, because admins and
-- dispatchers can write to orders and trips directly through the API:
--   * An order snapshots its price from the route's current price, and its
--     payment terms from the customer. Later price changes never touch it.
--   * A prepaid order cannot be dispatched until a payment is recorded.
--   * A credit customer cannot have more open loads than credit_load_cap.
--   * A truck or driver can be on only one active trip at a time.
--   * Truck status and order status follow the trips automatically.
--
-- Like the Step 1 guards, the rules apply to signed-in users (auth.uid() set).
-- The SQL editor and service role can still correct data by hand.
--
-- Internal updates (status sync, RPCs) set the transaction-local flag
-- hm.internal = 'on' so the column guards let them through; it is always
-- switched off again straight after. set_config is not exposed by the API.
-- =============================================================================

alter table public.orders
  add column payment_id    uuid references public.payments(id),
  add column cancel_reason text;

alter table public.orders
  add constraint orders_prepaid_needs_payment
    check (payment_terms <> 'prepaid'
           or status in ('draft','awaiting_payment','cancelled')
           or payment_id is not null);

create index orders_payment_idx on public.orders (payment_id);

-- One active trip per truck and per driver.
create unique index trips_one_active_per_truck
  on public.trips (truck_id) where status in ('assigned','loaded','in_transit');
create unique index trips_one_active_per_driver
  on public.trips (driver_id) where status in ('assigned','loaded','in_transit');

create or replace function public.hm_internal()
returns boolean language sql stable set search_path = ''
as $$ select coalesce(current_setting('hm.internal', true), '') = 'on' $$;

-- -----------------------------------------------------------------------------
-- Orders: snapshot on insert
-- -----------------------------------------------------------------------------
create or replace function public.orders_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cust  public.customers;
  v_site  public.customer_sites;
  v_route public.routes;
  v_price public.route_prices;
  v_mat   text;
begin
  if auth.uid() is null then
    return new;
  end if;

  select * into v_cust from public.customers where id = new.customer_id;
  if not found or not v_cust.is_active then
    raise exception 'This customer is not active' using errcode = 'P0001';
  end if;
  select * into v_site from public.customer_sites where id = new.site_id;
  if not found or v_site.customer_id <> new.customer_id then
    raise exception 'That delivery site does not belong to this customer' using errcode = 'P0001';
  end if;
  if not v_site.is_active then
    raise exception 'This delivery site is not active' using errcode = 'P0001';
  end if;
  select * into v_route from public.routes where id = new.route_id;
  if not found or not v_route.is_active then
    raise exception 'This route is not active' using errcode = 'P0001';
  end if;
  select * into v_price from public.route_prices
   where route_id = new.route_id and effective_to is null;
  if not found then
    raise exception 'This route has no current price. Set one on the route first' using errcode = 'P0001';
  end if;
  select material into v_mat from public.material_sources where id = v_route.source_id;

  new.price_per_trip := v_price.customer_price;
  new.route_price_id := v_price.id;
  new.payment_terms  := v_cust.payment_terms;
  new.material       := v_mat;
  new.status         := case when v_cust.payment_terms = 'prepaid' then 'awaiting_payment' else 'ready' end;
  new.payment_id     := null;
  new.cancel_reason  := null;
  return new;
end;
$$;

create trigger b_orders_before_insert before insert on public.orders
  for each row execute function public.orders_before_insert();

-- -----------------------------------------------------------------------------
-- Orders: column guard (replaces the Step 1 version)
-- Status, payment and cancellation change only through the RPCs below and the
-- status sync. Staff may edit notes; finance may confirm payment status.
-- -----------------------------------------------------------------------------
create or replace function public.guard_orders_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := public.current_user_role();
begin
  if auth.uid() is null or public.hm_internal() then
    return new;
  end if;

  if v_role = 'finance' then
    if not public.only_columns_changed(to_jsonb(old), to_jsonb(new), array['status']) then
      raise exception 'Finance may only change payment status on an order'
        using errcode = '42501';
    end if;
    if new.status is distinct from old.status
       and new.status not in ('awaiting_payment','ready') then
      raise exception 'Finance may only move an order to awaiting_payment or ready'
        using errcode = '42501';
    end if;
  elsif v_role in ('admin','dispatcher') then
    if not public.only_columns_changed(to_jsonb(old), to_jsonb(new), array['notes']) then
      raise exception 'Only the notes on an order can be edited. Use Cancel order or Record payment for the rest'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Trips: snapshot on insert
-- -----------------------------------------------------------------------------
create or replace function public.trips_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_price public.route_prices;
begin
  if auth.uid() is null then
    return new;
  end if;

  select * into v_order from public.orders where id = new.order_id;
  if not found then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;
  if v_order.status in ('cancelled','completed') then
    raise exception 'Trips cannot be added to a % order', v_order.status using errcode = 'P0001';
  end if;
  select * into v_price from public.route_prices where id = v_order.route_price_id;

  new.price         := v_order.price_per_trip;
  new.material_cost := coalesce(v_price.material_cost, 0);
  new.crew_cost     := coalesce(v_price.crew_cost, 0);
  new.source_id     := (select source_id from public.routes where id = v_order.route_id);
  new.status        := 'pending';
  new.truck_id      := null;
  new.driver_id     := null;
  new.assigned_at   := null;
  new.loaded_at     := null;
  new.delivered_at  := null;
  new.settled_at    := null;
  new.cancel_reason := null;
  new.diesel_litres_issued := 0;
  new.diesel_cost   := 0;
  new.repayment_allocation := 0;
  return new;
end;
$$;

create trigger b_trips_before_insert before insert on public.trips
  for each row execute function public.trips_before_insert();

-- -----------------------------------------------------------------------------
-- Trips: column guard (replaces the Step 1 version)
-- -----------------------------------------------------------------------------
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
  elsif v_role in ('admin','dispatcher') then
    if old.status not in ('pending','assigned') then
      raise exception 'Trip % is % and can no longer be changed here', old.trip_number, old.status
        using errcode = '42501';
    end if;
    if not public.only_columns_changed(to_jsonb(old), to_jsonb(new),
         array['status','driver_id','truck_id','assigned_at','cancel_reason']) then
      raise exception 'Only the dispatch fields of a trip can be changed'
        using errcode = '42501';
    end if;
    if new.status not in ('pending','assigned','cancelled') then
      raise exception 'Dispatch can only assign, unassign or cancel a trip'
        using errcode = '42501';
    end if;
    if new.status = 'cancelled' and nullif(btrim(coalesce(new.cancel_reason, '')), '') is null then
      raise exception 'Give a reason for cancelling the trip' using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Trips: dispatch rules (run after the column guard)
-- -----------------------------------------------------------------------------
create or replace function public.trips_dispatch_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order  public.orders;
  v_cust   public.customers;
  v_truck  public.trucks;
  v_driver public.drivers;
  v_busy   text;
  v_open   int;
begin
  if auth.uid() is null then
    return new;
  end if;

  if new.status = 'pending' then
    new.driver_id   := null;
    new.truck_id    := null;
    new.assigned_at := null;
    return new;
  end if;

  if new.status <> 'assigned'
     or (old.status = 'assigned'
         and new.driver_id is not distinct from old.driver_id
         and new.truck_id is not distinct from old.truck_id) then
    return new;
  end if;

  if new.driver_id is null or new.truck_id is null then
    raise exception 'Choose a driver and a truck' using errcode = 'P0001';
  end if;

  select * into v_order from public.orders where id = new.order_id;
  if v_order.status = 'awaiting_payment' then
    raise exception 'Order % is awaiting payment. Record the payment before dispatching', v_order.order_number
      using errcode = 'P0001';
  end if;
  if v_order.status not in ('ready','in_progress') then
    raise exception 'Order % is % and cannot be dispatched', v_order.order_number, v_order.status
      using errcode = 'P0001';
  end if;

  select * into v_driver from public.drivers where id = new.driver_id;
  if not found or not v_driver.is_active then
    raise exception 'This driver is not active' using errcode = 'P0001';
  end if;
  select trip_number into v_busy from public.trips
   where driver_id = new.driver_id and id <> new.id
     and status in ('assigned','loaded','in_transit') limit 1;
  if v_busy is not null then
    raise exception '% is already on trip %', v_driver.full_name, v_busy using errcode = 'P0001';
  end if;

  select * into v_truck from public.trucks where id = new.truck_id;
  if not found or not v_truck.is_active or v_truck.status = 'inactive' then
    raise exception 'This truck is not active' using errcode = 'P0001';
  end if;
  if v_truck.status = 'maintenance' then
    raise exception 'Truck % is in maintenance', v_truck.plate_number using errcode = 'P0001';
  end if;
  select trip_number into v_busy from public.trips
   where truck_id = new.truck_id and id <> new.id
     and status in ('assigned','loaded','in_transit') limit 1;
  if v_busy is not null then
    raise exception 'Truck % is already on trip %', v_truck.plate_number, v_busy using errcode = 'P0001';
  end if;

  -- Credit cap: loads dispatched but not yet settled, other than this one.
  if v_order.payment_terms = 'credit' then
    select * into v_cust from public.customers where id = v_order.customer_id;
    if v_cust.credit_load_cap = 0 then
      raise exception 'Set a credit cap on % first', v_cust.name using errcode = 'P0001';
    end if;
    select count(*) into v_open
      from public.trips t join public.orders o on o.id = t.order_id
     where o.customer_id = v_order.customer_id
       and t.id <> new.id
       and t.status in ('assigned','loaded','in_transit','delivered');
    if v_open >= v_cust.credit_load_cap then
      raise exception 'Over credit cap (% of % loads open). Record a payment or raise the cap', v_open, v_cust.credit_load_cap
        using errcode = 'P0001';
    end if;
  end if;

  new.assigned_at := now();
  return new;
end;
$$;

create trigger c_trips_dispatch_rules before update on public.trips
  for each row execute function public.trips_dispatch_rules();

-- -----------------------------------------------------------------------------
-- Trips: keep trucks, orders and the trip timeline in step
-- -----------------------------------------------------------------------------
create or replace function public.sync_truck_status(p_truck_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_truck_id is null then
    return;
  end if;
  if exists (select 1 from public.trips
              where truck_id = p_truck_id and status in ('assigned','loaded','in_transit')) then
    update public.trucks set status = 'on_trip' where id = p_truck_id and status = 'available';
  else
    update public.trucks set status = 'available' where id = p_truck_id and status = 'on_trip';
  end if;
end;
$$;

create or replace function public.sync_order_status(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_live   int;
  v_done   int;
  v_moving int;
  v_next   text;
begin
  select status into v_status from public.orders where id = p_order_id;
  if v_status is null or v_status = 'cancelled' then
    return;
  end if;
  select count(*) filter (where status <> 'cancelled'),
         count(*) filter (where status in ('delivered','settled')),
         count(*) filter (where status in ('assigned','loaded','in_transit','delivered','settled','disputed'))
    into v_live, v_done, v_moving
    from public.trips where order_id = p_order_id;

  if v_live = 0 then
    v_next := 'cancelled';
  elsif v_status in ('draft','awaiting_payment') then
    return;
  elsif v_done = v_live then
    v_next := 'completed';
  elsif v_moving > 0 then
    v_next := 'in_progress';
  else
    v_next := 'ready';
  end if;

  if v_next is distinct from v_status then
    perform set_config('hm.internal', 'on', true);
    update public.orders set status = v_next where id = p_order_id;
    perform set_config('hm.internal', 'off', true);
  end if;
end;
$$;

create or replace function public.trips_after_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_desc text;
begin
  if tg_op = 'INSERT' then
    insert into public.trip_events (trip_id, event_type, actor_id)
    values (new.id, 'created', auth.uid());
    perform public.sync_order_status(new.order_id);
    return null;
  end if;

  if new.truck_id is distinct from old.truck_id or new.status is distinct from old.status then
    perform public.sync_truck_status(old.truck_id);
    if new.truck_id is distinct from old.truck_id then
      perform public.sync_truck_status(new.truck_id);
    end if;
  end if;

  if new.status = 'assigned'
     and (old.status <> 'assigned' or new.driver_id is distinct from old.driver_id
          or new.truck_id is distinct from old.truck_id) then
    select d.full_name || ', truck ' || t.plate_number into v_desc
      from public.drivers d, public.trucks t
     where d.id = new.driver_id and t.id = new.truck_id;
    insert into public.trip_events (trip_id, event_type, actor_id, note)
    values (new.id,
            case when old.status = 'assigned' then 'note' else 'assigned' end,
            auth.uid(),
            case when old.status = 'assigned' then 'Reassigned to ' || v_desc else 'Assigned to ' || v_desc end);
  elsif new.status = 'pending' and old.status = 'assigned' then
    insert into public.trip_events (trip_id, event_type, actor_id, note)
    values (new.id, 'note', auth.uid(), 'Unassigned');
  elsif new.status = 'cancelled' and old.status <> 'cancelled' then
    insert into public.trip_events (trip_id, event_type, actor_id, note)
    values (new.id, 'cancelled', auth.uid(), new.cancel_reason);
  end if;

  if new.status is distinct from old.status then
    perform public.sync_order_status(new.order_id);
  end if;
  return null;
end;
$$;

create trigger y_trips_after_change after insert or update on public.trips
  for each row execute function public.trips_after_change();

-- -----------------------------------------------------------------------------
-- RPCs
-- -----------------------------------------------------------------------------
create or replace function public.create_order(
  p_customer_id uuid,
  p_site_id     uuid,
  p_route_id    uuid,
  p_trips       int,
  p_notes       text default null
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  if coalesce(public.current_user_role(), '') not in ('admin','dispatcher') then
    raise exception 'Only an admin or dispatcher can create orders' using errcode = '42501';
  end if;
  if p_trips is null or p_trips < 1 or p_trips > 100 then
    raise exception 'Number of trips must be between 1 and 100' using errcode = 'P0001';
  end if;

  insert into public.orders (customer_id, site_id, route_id, material, trips_ordered,
                             price_per_trip, payment_terms, notes)
  values (p_customer_id, p_site_id, p_route_id, '', p_trips, 0, 'prepaid',
          nullif(btrim(p_notes), ''))
  returning * into v_order;

  insert into public.trips (order_id, price)
  select v_order.id, 0 from generate_series(1, p_trips);

  select * into v_order from public.orders where id = v_order.id;
  return v_order;
end;
$$;

create or replace function public.assign_trip(p_trip_id uuid, p_driver_id uuid, p_truck_id uuid)
returns public.trips
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trip public.trips;
begin
  if coalesce(public.current_user_role(), '') not in ('admin','dispatcher') then
    raise exception 'Only an admin or dispatcher can dispatch trips' using errcode = '42501';
  end if;
  update public.trips
     set status = 'assigned', driver_id = p_driver_id, truck_id = p_truck_id
   where id = p_trip_id
  returning * into v_trip;
  if not found then
    raise exception 'Trip not found' using errcode = 'P0002';
  end if;
  return v_trip;
end;
$$;

create or replace function public.cancel_trip(p_trip_id uuid, p_reason text)
returns public.trips
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trip public.trips;
begin
  if coalesce(public.current_user_role(), '') not in ('admin','dispatcher') then
    raise exception 'Only an admin or dispatcher can cancel trips' using errcode = '42501';
  end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'Give a reason for cancelling the trip' using errcode = 'P0001';
  end if;
  select * into v_trip from public.trips where id = p_trip_id for update;
  if not found then
    raise exception 'Trip not found' using errcode = 'P0002';
  end if;
  if v_trip.status not in ('pending','assigned') then
    raise exception 'Trip % is % and can no longer be cancelled', v_trip.trip_number, v_trip.status
      using errcode = 'P0001';
  end if;
  update public.trips set status = 'cancelled', cancel_reason = btrim(p_reason)
   where id = p_trip_id
  returning * into v_trip;
  return v_trip;
end;
$$;

create or replace function public.cancel_order(p_order_id uuid, p_reason text)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_moving text;
begin
  if coalesce(public.current_user_role(), '') not in ('admin','dispatcher') then
    raise exception 'Only an admin or dispatcher can cancel orders' using errcode = '42501';
  end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'Give a reason for cancelling the order' using errcode = 'P0001';
  end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;
  if v_order.status in ('cancelled','completed') then
    raise exception 'Order % is already %', v_order.order_number, v_order.status using errcode = 'P0001';
  end if;
  select trip_number into v_moving from public.trips
   where order_id = p_order_id
     and status in ('loaded','in_transit','delivered','settled','disputed') limit 1;
  if v_moving is not null then
    raise exception 'Trip % is already loaded or delivered. Cancel the remaining trips one by one instead', v_moving
      using errcode = 'P0001';
  end if;

  update public.trips set status = 'cancelled', cancel_reason = btrim(p_reason)
   where order_id = p_order_id and status in ('pending','assigned');

  perform set_config('hm.internal', 'on', true);
  update public.orders set status = 'cancelled', cancel_reason = btrim(p_reason)
   where id = p_order_id
  returning * into v_order;
  perform set_config('hm.internal', 'off', true);
  return v_order;
end;
$$;

create or replace function public.record_order_payment(
  p_order_id       uuid,
  p_amount         int,
  p_method         text,
  p_bank_reference text,
  p_received_at    timestamptz,
  p_note           text default null
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order   public.orders;
  v_total   int;
  v_payment public.payments;
begin
  if coalesce(public.current_user_role(), '') not in ('admin','finance') then
    raise exception 'Only admin or finance can record payments' using errcode = '42501';
  end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;
  if v_order.status <> 'awaiting_payment' then
    raise exception 'Order % is not awaiting payment', v_order.order_number using errcode = 'P0001';
  end if;
  select v_order.price_per_trip * count(*) into v_total
    from public.trips where order_id = p_order_id and status <> 'cancelled';
  if p_amount is null or p_amount < v_total then
    raise exception 'Prepaid orders are paid in full: the total is ₦%', to_char(v_total, 'FM999,999,999,999')
      using errcode = 'P0001';
  end if;
  if p_received_at is null or p_received_at > now() + interval '5 minutes' then
    raise exception 'Enter when the payment was received (not in the future)' using errcode = 'P0001';
  end if;

  insert into public.payments (customer_id, amount, method, bank_reference, received_at, confirmed_by, note)
  values (v_order.customer_id, p_amount, p_method, nullif(btrim(p_bank_reference), ''), p_received_at,
          auth.uid(), nullif(btrim(p_note), ''))
  returning * into v_payment;

  insert into public.ledger_entries (customer_id, entry_type, amount, payment_id, description, occurred_at)
  values (v_order.customer_id, 'payment', p_amount, v_payment.id,
          'Payment for ' || v_order.order_number, p_received_at);

  perform set_config('hm.internal', 'on', true);
  update public.orders set payment_id = v_payment.id, status = 'ready'
   where id = p_order_id
  returning * into v_order;
  perform set_config('hm.internal', 'off', true);
  return v_order;
end;
$$;

-- -----------------------------------------------------------------------------
-- Grants: trigger and helper functions are never callable as RPCs; the five
-- RPCs are callable by signed-in users only (each checks the role itself).
-- -----------------------------------------------------------------------------
revoke all on function public.hm_internal()                from public, anon, authenticated;
revoke all on function public.orders_before_insert()       from public, anon, authenticated;
revoke all on function public.trips_before_insert()        from public, anon, authenticated;
revoke all on function public.trips_dispatch_rules()       from public, anon, authenticated;
revoke all on function public.trips_after_change()         from public, anon, authenticated;
revoke all on function public.sync_truck_status(uuid)      from public, anon, authenticated;
revoke all on function public.sync_order_status(uuid)      from public, anon, authenticated;
revoke all on function public.guard_orders_update()        from public, anon, authenticated;
revoke all on function public.guard_trips_update()         from public, anon, authenticated;

revoke all on function public.create_order(uuid, uuid, uuid, int, text)                      from public, anon;
revoke all on function public.assign_trip(uuid, uuid, uuid)                                  from public, anon;
revoke all on function public.cancel_trip(uuid, text)                                        from public, anon;
revoke all on function public.cancel_order(uuid, text)                                       from public, anon;
revoke all on function public.record_order_payment(uuid, int, text, text, timestamptz, text) from public, anon;
grant execute on function public.create_order(uuid, uuid, uuid, int, text)                      to authenticated;
grant execute on function public.assign_trip(uuid, uuid, uuid)                                  to authenticated;
grant execute on function public.cancel_trip(uuid, text)                                        to authenticated;
grant execute on function public.cancel_order(uuid, text)                                       to authenticated;
grant execute on function public.record_order_payment(uuid, int, text, text, timestamptz, text) to authenticated;
