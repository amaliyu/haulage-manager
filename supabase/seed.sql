-- =============================================================================
-- Haulage Manager — sample master data
-- Run AFTER supabase/migrations/20260922000000_step1_schema.sql.
-- Safe to run more than once. Delete these rows from the app (or SQL) once
-- real data exists. No customers, trucks or drivers are seeded.
-- =============================================================================

begin;

-- Material sources
insert into public.material_sources (name, material, area)
select v.name, 'sharp_sand', v.area
from (values ('Koita sand site', 'Koita'), ('Kwali sand site', 'Kwali')) as v(name, area)
where not exists (select 1 from public.material_sources s where s.name = v.name);

-- Routes: each source to Gwarinpa (70 L) and Apo/Wuye (95 L)
insert into public.routes (name, source_id, destination_area, diesel_allowance_litres)
select s.area || ' → ' || d.area, s.id, d.area, d.litres
from public.material_sources s
cross join (values ('Gwarinpa', 70.00), ('Apo/Wuye', 95.00)) as d(area, litres)
where s.name in ('Koita sand site', 'Kwali sand site')
on conflict (source_id, destination_area) do nothing;

-- Current route prices (only where the route has no open price yet)
insert into public.route_prices
  (route_id, customer_price, material_cost, crew_cost, diesel_price_per_litre, note)
select r.id, p.customer_price, 65000, 15000, 1730, 'Seed price'
from public.routes r
join public.material_sources s on s.id = r.source_id
join (values ('Gwarinpa', 310000), ('Apo/Wuye', 350000)) as p(area, customer_price)
  on p.area = r.destination_area
where s.name in ('Koita sand site', 'Kwali sand site')
  and not exists (
    select 1 from public.route_prices rp
    where rp.route_id = r.id and rp.effective_to is null
  );

-- Current diesel pump price
insert into public.diesel_prices (price_per_litre)
select 1730
where not exists (select 1 from public.diesel_prices where effective_to is null);

commit;
