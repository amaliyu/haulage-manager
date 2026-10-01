-- =============================================================================
-- Haulage Manager — Step 4: trip progress (run after the Step 3 files)
--
--   * Drivers record Loaded → In transit → Delivered through record_trip_step.
--     The office (admin/dispatcher) can record a step for the driver, with a
--     reason. Direct status updates by drivers are no longer allowed, so steps
--     cannot be skipped and the delivery location check cannot be bypassed.
--   * Delivery is never blocked by location. The trip is flagged instead:
--     inside / outside (with distance) / no_site_pin / no_location.
--   * report_breakdown cancels a loaded or moving trip whose truck broke down,
--     puts the truck in maintenance, and adds a replacement trip to the same
--     order so another truck can be dispatched straight away.
-- =============================================================================

alter table public.trips
  add column in_transit_at       timestamptz,
  add column delivery_check      text check (delivery_check in ('inside','outside','no_site_pin','no_location')),
  add column delivery_distance_m int check (delivery_distance_m >= 0),
  add column office_recorded     boolean not null default false,
  add column breakdown_load      text check (breakdown_load in ('moved','lost')),
  add column replaces_trip_id    uuid references public.trips(id);

create index trips_replaces_trip_idx on public.trips (replaces_trip_id);

-- -----------------------------------------------------------------------------
-- Trips: snapshot on insert (replaces the Step 3 version; resets the new
-- Step 4 columns so a direct insert cannot pre-fill them)
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
  new.in_transit_at := null;
  new.delivered_at  := null;
  new.settled_at    := null;
  new.cancel_reason := null;
  new.loader_receipt_no    := null;
  new.delivery_check       := null;
  new.delivery_distance_m  := null;
  new.office_recorded      := false;
  new.breakdown_load       := null;
  new.replaces_trip_id     := null;
  new.diesel_litres_issued := 0;
  new.diesel_cost   := 0;
  new.repayment_allocation := 0;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Trips: column guard (replaces the Step 3 version)
-- Drivers no longer update trips directly: steps go through record_trip_step.
-- Internal updates (the RPCs below) pass with hm.internal.
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
  if auth.uid() is null or public.hm_internal() then
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
    raise exception 'Use the buttons on your trip to record loading and delivery'
      using errcode = '42501';
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
-- Trip events: only notes may be added directly. Step, dispatch and
-- cancellation events are written by the RPCs and triggers.
-- -----------------------------------------------------------------------------
drop policy trip_events_insert on public.trip_events;
create policy trip_events_insert on public.trip_events
  for insert to authenticated
  with check (
    event_type = 'note'
    and actor_id = (select auth.uid())
    and (
      (select public.current_user_role()) in ('admin','dispatcher')
      or (
        (select public.current_user_role()) = 'driver'
        and public.is_assigned_driver(trip_id)
      )
    )
  );

-- -----------------------------------------------------------------------------
-- Distance in metres between two points (haversine).
-- -----------------------------------------------------------------------------
create or replace function public.distance_m(p_lat1 numeric, p_lng1 numeric, p_lat2 numeric, p_lng2 numeric)
returns int
language sql
immutable
set search_path = ''
as $$
  select round(2 * 6371000 * asin(sqrt(
           power(sin(radians((p_lat2 - p_lat1)::float8) / 2), 2)
           + cos(radians(p_lat1::float8)) * cos(radians(p_lat2::float8))
             * power(sin(radians((p_lng2 - p_lng1)::float8) / 2), 2))))::int
$$;

-- -----------------------------------------------------------------------------
-- RPC: record a trip step
-- -----------------------------------------------------------------------------
create or replace function public.record_trip_step(
  p_trip_id           uuid,
  p_step              text,
  p_lat               numeric default null,
  p_lng               numeric default null,
  p_accuracy_m        numeric default null,
  p_loader_receipt_no text    default null,
  p_reason            text    default null
)
returns public.trips
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role    text := public.current_user_role();
  v_trip    public.trips;
  v_site    public.customer_sites;
  v_office  boolean;
  v_lat     numeric;
  v_lng     numeric;
  v_check   text;
  v_dist    int;
  v_receipt text := nullif(btrim(coalesce(p_loader_receipt_no, '')), '');
  v_note    text;
begin
  if v_role in ('admin','dispatcher') then
    v_office := true;
    if nullif(btrim(coalesce(p_reason, '')), '') is null then
      raise exception 'Give a reason for recording this for the driver' using errcode = 'P0001';
    end if;
  elsif v_role = 'driver' then
    v_office := false;
  else
    raise exception 'Only the driver or the office can record trip steps' using errcode = '42501';
  end if;

  if p_step is null or p_step not in ('loaded','in_transit','delivered') then
    raise exception 'Unknown trip step' using errcode = 'P0001';
  end if;

  select * into v_trip from public.trips where id = p_trip_id for update;
  if not found or (not v_office and v_trip.driver_id is distinct from public.current_driver_id()) then
    raise exception 'This trip is not assigned to you' using errcode = '42501';
  end if;

  -- A repeated tap (for example after a lost network reply) is not an error.
  if v_trip.status = p_step then
    return v_trip;
  end if;

  if not (   (p_step = 'loaded'     and v_trip.status = 'assigned')
          or (p_step = 'in_transit' and v_trip.status = 'loaded')
          or (p_step = 'delivered'  and v_trip.status in ('loaded','in_transit'))) then
    raise exception 'Trip % is %; it can''t be marked %', v_trip.trip_number,
      replace(v_trip.status, '_', ' '), replace(p_step, '_', ' ')
      using errcode = 'P0001';
  end if;

  -- Location only counts when the driver records the step on site.
  if not v_office and p_lat is not null and p_lng is not null then
    if p_lat not between -90 and 90 or p_lng not between -180 and 180 then
      raise exception 'Location is not valid' using errcode = 'P0001';
    end if;
    v_lat := round(p_lat, 6);
    v_lng := round(p_lng, 6);
  end if;

  perform set_config('hm.internal', 'on', true);
  if p_step = 'loaded' then
    update public.trips
       set status = 'loaded', loaded_at = now(),
           loader_receipt_no = coalesce(v_receipt, loader_receipt_no),
           office_recorded = office_recorded or v_office
     where id = p_trip_id
    returning * into v_trip;
  elsif p_step = 'in_transit' then
    update public.trips
       set status = 'in_transit', in_transit_at = now(),
           office_recorded = office_recorded or v_office
     where id = p_trip_id
    returning * into v_trip;
  else
    if not v_office then
      select s.* into v_site
        from public.orders o join public.customer_sites s on s.id = o.site_id
       where o.id = v_trip.order_id;
      if v_lat is null then
        v_check := 'no_location';
      elsif v_site.latitude is null or v_site.longitude is null then
        v_check := 'no_site_pin';
      else
        v_dist := public.distance_m(v_lat, v_lng, v_site.latitude, v_site.longitude);
        v_check := case
          when v_dist <= v_site.geofence_radius_m + least(greatest(coalesce(p_accuracy_m, 0), 0), 200)
          then 'inside' else 'outside' end;
      end if;
    end if;
    update public.trips
       set status = 'delivered', delivered_at = now(),
           delivery_check = v_check, delivery_distance_m = v_dist,
           office_recorded = office_recorded or v_office
     where id = p_trip_id
    returning * into v_trip;
  end if;
  perform set_config('hm.internal', 'off', true);

  if v_office then
    v_note := 'Recorded by office: ' || btrim(p_reason);
    if v_receipt is not null then
      v_note := v_note || ' · Receipt ' || v_receipt;
    end if;
  else
    v_note := concat_ws(' · ',
      case v_check
        when 'inside'      then 'Inside site'
        when 'outside'     then v_dist || 'm from site'
        when 'no_site_pin' then 'Site has no pin'
        when 'no_location' then 'No location'
      end,
      case when v_lat is not null and p_accuracy_m is not null then 'GPS ±' || round(p_accuracy_m) || 'm' end,
      case when v_receipt is not null then 'Receipt ' || v_receipt end);
  end if;

  insert into public.trip_events (trip_id, event_type, actor_id, latitude, longitude, note)
  values (p_trip_id, p_step, auth.uid(), v_lat, v_lng, nullif(v_note, ''));

  return v_trip;
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC: a truck broke down on a loaded or moving trip
-- -----------------------------------------------------------------------------
create or replace function public.report_breakdown(p_trip_id uuid, p_reason text, p_load text)
returns public.trips
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trip public.trips;
  v_new  public.trips;
begin
  if coalesce(public.current_user_role(), '') not in ('admin','dispatcher') then
    raise exception 'Only an admin or dispatcher can report a breakdown' using errcode = '42501';
  end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'Say what happened to the truck' using errcode = 'P0001';
  end if;
  if p_load is null or p_load not in ('moved','lost') then
    raise exception 'Say whether the load was moved to another truck or lost' using errcode = 'P0001';
  end if;

  select * into v_trip from public.trips where id = p_trip_id for update;
  if not found then
    raise exception 'Trip not found' using errcode = 'P0002';
  end if;
  if v_trip.status not in ('loaded','in_transit') then
    raise exception 'Trip % is %. Only a loaded or moving trip can be reported broken down',
      v_trip.trip_number, replace(v_trip.status, '_', ' ')
      using errcode = 'P0001';
  end if;

  -- Replacement first, so the order never looks finished in between.
  insert into public.trips (order_id, price) values (v_trip.order_id, 0)
  returning * into v_new;

  perform set_config('hm.internal', 'on', true);
  update public.trips
     set replaces_trip_id = v_trip.id,
         -- The material was already bought for the broken-down trip.
         material_cost = case when p_load = 'moved' then 0 else material_cost end
   where id = v_new.id
  returning * into v_new;

  update public.trips
     set status = 'cancelled', breakdown_load = p_load,
         cancel_reason = 'Breakdown: ' || btrim(p_reason)
                         || case when p_load = 'moved' then ' · Load moved to the new truck' else ' · Load lost' end
   where id = v_trip.id;

  update public.trucks set status = 'maintenance'
   where id = v_trip.truck_id and status in ('available','on_trip');
  perform set_config('hm.internal', 'off', true);

  insert into public.trip_events (trip_id, event_type, actor_id, note)
  values (v_new.id, 'note', auth.uid(), 'Replaces ' || v_trip.trip_number || ' (breakdown)');

  return v_new;
end;
$$;

-- -----------------------------------------------------------------------------
-- my_trips: now also returns progress, photos and today's deliveries
-- -----------------------------------------------------------------------------
drop function public.my_trips();
create function public.my_trips()
returns table (
  trip_id               uuid,
  trip_number           text,
  status                text,
  assigned_at           timestamptz,
  loaded_at             timestamptz,
  in_transit_at         timestamptz,
  delivered_at          timestamptz,
  loader_receipt_no     text,
  delivery_check        text,
  delivery_distance_m   int,
  order_number          text,
  material              text,
  customer_name         text,
  customer_phone        text,
  site_name             text,
  site_area             text,
  site_directions       text,
  site_latitude         numeric,
  site_longitude        numeric,
  site_geofence_m       int,
  route_name            text,
  source_name           text,
  truck_plate           text,
  truck_reference_photo text,
  loading_photos        int,
  delivery_photos       int
)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.trip_number, t.status, t.assigned_at, t.loaded_at, t.in_transit_at, t.delivered_at,
         t.loader_receipt_no, t.delivery_check, t.delivery_distance_m,
         o.order_number, o.material,
         c.name, c.phone,
         s.name, s.area, s.directions, s.latitude, s.longitude, s.geofence_radius_m,
         r.name, ms.name,
         tk.plate_number, tk.reference_load_photo_url,
         (select count(*)::int from public.trip_photos p where p.trip_id = t.id and p.photo_type = 'loading'),
         (select count(*)::int from public.trip_photos p where p.trip_id = t.id and p.photo_type = 'delivery')
    from public.trips t
    join public.orders o            on o.id = t.order_id
    join public.customers c         on c.id = o.customer_id
    join public.customer_sites s    on s.id = o.site_id
    join public.routes r            on r.id = o.route_id
    left join public.material_sources ms on ms.id = t.source_id
    left join public.trucks tk      on tk.id = t.truck_id
   where public.current_user_role() = 'driver'
     and t.driver_id = public.current_driver_id()
     and (t.status in ('assigned','loaded','in_transit')
          or (t.status in ('delivered','settled','disputed')
              and (t.delivered_at at time zone 'Africa/Lagos')::date = (now() at time zone 'Africa/Lagos')::date))
   order by t.delivered_at desc nulls first, t.assigned_at
$$;

-- -----------------------------------------------------------------------------
-- Grants
-- -----------------------------------------------------------------------------
revoke all on function public.trips_before_insert()  from public, anon, authenticated;
revoke all on function public.guard_trips_update()   from public, anon, authenticated;
revoke all on function public.distance_m(numeric, numeric, numeric, numeric) from public, anon, authenticated;

revoke all on function public.record_trip_step(uuid, text, numeric, numeric, numeric, text, text) from public, anon;
revoke all on function public.report_breakdown(uuid, text, text)                                  from public, anon;
revoke all on function public.my_trips()                                                          from public, anon;
grant execute on function public.record_trip_step(uuid, text, numeric, numeric, numeric, text, text) to authenticated;
grant execute on function public.report_breakdown(uuid, text, text)                                  to authenticated;
grant execute on function public.my_trips()                                                          to authenticated;
