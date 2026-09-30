-- =============================================================================
-- Haulage Manager — Step 3: the signed-in driver's own trips, with where to
-- deliver. Drivers have no read access to orders, customers, sites or routes,
-- so this definer function returns only the delivery details they need, and
-- only for trips assigned to them.
-- =============================================================================

create or replace function public.my_trips()
returns table (
  trip_id           uuid,
  trip_number       text,
  status            text,
  assigned_at       timestamptz,
  order_number      text,
  material          text,
  customer_name     text,
  customer_phone    text,
  site_name         text,
  site_area         text,
  site_directions   text,
  site_latitude     numeric,
  site_longitude    numeric,
  route_name        text,
  source_name       text,
  truck_plate       text
)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.trip_number, t.status, t.assigned_at,
         o.order_number, o.material,
         c.name, c.phone,
         s.name, s.area, s.directions, s.latitude, s.longitude,
         r.name, ms.name,
         tk.plate_number
    from public.trips t
    join public.orders o            on o.id = t.order_id
    join public.customers c         on c.id = o.customer_id
    join public.customer_sites s    on s.id = o.site_id
    join public.routes r            on r.id = o.route_id
    left join public.material_sources ms on ms.id = t.source_id
    left join public.trucks tk      on tk.id = t.truck_id
   where public.current_user_role() = 'driver'
     and t.driver_id = public.current_driver_id()
     and t.status in ('assigned','loaded','in_transit')
   order by t.assigned_at
$$;

revoke all on function public.my_trips() from public, anon;
grant execute on function public.my_trips() to authenticated;
