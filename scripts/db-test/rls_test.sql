\set ON_ERROR_STOP 1
-- Role-by-role behaviour tests. Every block raises an exception on failure.
-- LOCAL throwaway database only (see run.sh).

insert into auth.users(id) values
 ('00000000-0000-0000-0000-00000000000a'),('00000000-0000-0000-0000-00000000000d'),
 ('00000000-0000-0000-0000-00000000000f'),('00000000-0000-0000-0000-0000000000a1'),
 ('00000000-0000-0000-0000-0000000000a2'),('00000000-0000-0000-0000-0000000000ee'),
 ('00000000-0000-0000-0000-0000000000ff');
insert into profiles(id, full_name, role) values
 ('00000000-0000-0000-0000-00000000000a','Admin','admin'),
 ('00000000-0000-0000-0000-00000000000d','Disp','dispatcher'),
 ('00000000-0000-0000-0000-00000000000f','Fin','finance'),
 ('00000000-0000-0000-0000-0000000000a1','Drv1','driver'),
 ('00000000-0000-0000-0000-0000000000a2','Drv2','driver');
insert into profiles(id, full_name, role, is_active) values ('00000000-0000-0000-0000-0000000000ee','Gone','dispatcher', false);
insert into trucks(id, plate_number, owner_type) values ('10000000-0000-0000-0000-000000000001','ABJ-123-XY','spv');
insert into drivers(id, profile_id, full_name, phone) values
 ('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a1','Drv1','0803'),
 ('20000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000a2','Drv2','0805');
insert into customers(id,name,phone) values ('30000000-0000-0000-0000-000000000001','Cust','0801');
insert into customer_sites(id,customer_id,name,area) values ('40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','Site','Gwarinpa');
insert into orders(id,customer_id,site_id,route_id,material,trips_ordered,price_per_trip,payment_terms)
 select '50000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001', id,'sharp_sand',2,310000,'prepaid' from routes limit 1;
insert into trips(id,order_id,driver_id,price) values
 ('60000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',310000),
 ('60000000-0000-0000-0000-000000000002','50000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002',310000);
do $$ begin
  assert (select order_number from orders) ~ '^ORD-\d{4}-0001$';
  assert (select min(trip_number) from trips) ~ '^TRP-\d{4}-000001$';
end $$;

create or replace function pg_temp.act(u text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', u, true); execute 'set local role authenticated'; end $$;

\echo '--- no profile sees nothing'
begin; select pg_temp.act('00000000-0000-0000-0000-0000000000ff');
do $$ begin
 assert (select count(*) from customers)=0; assert (select count(*) from routes)=0;
 assert (select count(*) from trucks)=0; assert (select count(*) from profiles)=0;
 assert (select count(*) from trips)=0; assert public.current_user_role() is null;
end $$; rollback;

\echo '--- inactive profile sees own profile only'
begin; select pg_temp.act('00000000-0000-0000-0000-0000000000ee');
do $$ begin
 assert (select count(*) from profiles)=1; assert (select count(*) from routes)=0;
 assert public.current_user_role() is null;
end $$; rollback;

\echo '--- anon has no table privileges'
begin; set local role anon;
do $$ begin
 begin perform 1 from customers; raise exception 'anon read customers';
 exception when insufficient_privilege then null; end;
end $$; rollback;

\echo '--- trigger functions are not callable as RPCs'
begin; select pg_temp.act('00000000-0000-0000-0000-00000000000a');
do $$ begin
 assert not has_function_privilege('authenticated', 'public.guard_trips_update()', 'execute');
 assert not has_function_privilege('anon', 'public.guard_orders_update()', 'execute');
 assert not has_function_privilege('authenticated', 'public.guard_profiles_update()', 'execute');
 assert not has_function_privilege('anon', 'public.try_uuid(text)', 'execute');
end $$; rollback;

\echo '--- dispatcher reads master data, cannot write'
begin; select pg_temp.act('00000000-0000-0000-0000-00000000000d');
do $$ begin
 assert (select count(*) from routes)=4; assert (select count(*) from customers)=1;
 assert (select count(*) from profiles)=1;
 begin insert into customers(name,phone) values ('x','1'); raise exception 'dispatcher wrote';
 exception when insufficient_privilege then null; end;
 update routes set name='hack'; assert not found;
 begin perform public.change_route_price((select id from routes limit 1),1,1,1,1); raise exception 'dispatcher price';
 exception when insufficient_privilege then null; end;
 insert into orders(customer_id,site_id,route_id,material,trips_ordered,price_per_trip,payment_terms)
  select '30000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001',id,'sharp_sand',1,310000,'credit' from routes limit 1;
 assert (select count(*) from audit_log)=0;
end $$; rollback;

\echo '--- finance column guards'
begin; select pg_temp.act('00000000-0000-0000-0000-00000000000f');
do $$ begin
 -- prepaid order: ready needs a recorded payment (Step 3)
 begin update orders set status='ready' where id='50000000-0000-0000-0000-000000000001'; raise exception 'finance readied unpaid prepaid';
 exception when check_violation then null; end;
 begin update orders set price_per_trip=1 where id='50000000-0000-0000-0000-000000000001'; raise exception 'finance price';
 exception when insufficient_privilege then null; end;
 update trips set status='settled', settled_at=now(), repayment_allocation=5000 where id='60000000-0000-0000-0000-000000000001'; assert found;
 begin update trips set price=1 where id='60000000-0000-0000-0000-000000000001'; raise exception 'finance trip price';
 exception when insufficient_privilege then null; end;
 insert into payments(customer_id,amount,method,received_at) values ('30000000-0000-0000-0000-000000000001',310000,'cash',now());
 insert into ledger_entries(customer_id,entry_type,amount,description) values ('30000000-0000-0000-0000-000000000001','payment',310000,'x');
 begin update ledger_entries set amount=1; raise exception 'finance updated ledger';
 exception when insufficient_privilege then null; end;
 begin delete from ledger_entries; raise exception 'finance deleted ledger';
 exception when insufficient_privilege then null; end;
end $$; rollback;

\echo '--- ledger / trip_events update+delete refused for admin'
begin; select pg_temp.act('00000000-0000-0000-0000-00000000000a');
do $$ begin
 begin update ledger_entries set amount = 1; raise exception 'admin updated ledger';
 exception when insufficient_privilege then null; end;
 begin delete from trip_events; raise exception 'admin deleted events';
 exception when insufficient_privilege then null; end;
end $$; rollback;

\echo '--- driver sees own trips, trucks, own driver row only'
begin; select pg_temp.act('00000000-0000-0000-0000-0000000000a1');
do $$ begin
 assert (select count(*) from trips)=1, 'driver trips';
 assert (select count(*) from drivers)=1; assert (select count(*) from trucks)=1;
 assert (select count(*) from customers)=0; assert (select count(*) from orders)=0;
 -- Step 4: steps go through record_trip_step only
 begin update trips set status='loaded', loaded_at=now(), loader_receipt_no='R1' where id='60000000-0000-0000-0000-000000000001'; raise exception 'driver direct status';
 exception when insufficient_privilege then null; end;
 update trips set status='loaded' where id='60000000-0000-0000-0000-000000000002'; assert not found, 'other driver trip';
 begin update trips set price=1 where id='60000000-0000-0000-0000-000000000001'; raise exception 'driver price';
 exception when insufficient_privilege then null; end;
 begin update trips set status='settled' where id='60000000-0000-0000-0000-000000000001'; raise exception 'driver settled';
 exception when insufficient_privilege then null; end;
 insert into trip_events(trip_id,event_type,actor_id,note) values ('60000000-0000-0000-0000-000000000001','note','00000000-0000-0000-0000-0000000000a1','Tyre check');
 begin insert into trip_events(trip_id,event_type,actor_id) values ('60000000-0000-0000-0000-000000000001','delivered','00000000-0000-0000-0000-0000000000a1'); raise exception 'driver faked a step event';
 exception when insufficient_privilege then null; end;
 begin insert into trip_events(trip_id,event_type,actor_id) values ('60000000-0000-0000-0000-000000000002','note','00000000-0000-0000-0000-0000000000a1'); raise exception 'event other trip';
 exception when insufficient_privilege then null; end;
 insert into trip_photos(trip_id,photo_type,storage_path,uploaded_by) values ('60000000-0000-0000-0000-000000000001','loading','trips/60000000-0000-0000-0000-000000000001/loading-1.jpg','00000000-0000-0000-0000-0000000000a1');
 insert into storage.objects(bucket_id,name) values ('trip-photos','trips/60000000-0000-0000-0000-000000000001/loading-1700000000.jpg');
 begin insert into storage.objects(bucket_id,name) values ('trip-photos','trips/60000000-0000-0000-0000-000000000002/loading-1700000000.jpg'); raise exception 'storage other trip';
 exception when insufficient_privilege then null; end;
 begin insert into storage.objects(bucket_id,name) values ('trip-photos','trucks/10000000-0000-0000-0000-000000000001/reference.jpg'); raise exception 'driver truck ref';
 exception when insufficient_privilege then null; end;
 begin update profiles set role='admin' where id='00000000-0000-0000-0000-0000000000a1'; raise exception 'self promote';
 exception when insufficient_privilege then null; end;
 update profiles set phone='0809' where id='00000000-0000-0000-0000-0000000000a1'; assert found;
end $$; rollback;

\echo '--- admin: price change transaction + partial unique index'
begin; select pg_temp.act('00000000-0000-0000-0000-00000000000a');
do $$ declare r uuid; n int; begin
 select id into r from routes where destination_area='Gwarinpa' limit 1;
 perform public.change_route_price(r, 320000, 65000, 1800, 15000, 'diesel up');
 assert (select count(*) from route_prices where route_id=r)=2;
 assert (select count(*) from route_prices where route_id=r and effective_to is null)=1;
 assert (select customer_price from route_prices where route_id=r and effective_to is null)=320000;
 begin insert into route_prices(route_id,customer_price,material_cost,diesel_price_per_litre) values (r,1,1,1); raise exception 'two open prices';
 exception when unique_violation then null; end;
 begin update route_prices set customer_price=1 where route_id=r and effective_to is null; raise exception 'edited price';
 exception when insufficient_privilege then null; end;
 perform public.set_diesel_price(1800);
 assert (select count(*) from diesel_prices where effective_to is null)=1;
 assert (select price_per_litre from diesel_prices where effective_to is null)=1800;
 select count(*) into n from audit_log; assert n > 0, 'audit rows visible to admin';
 assert (select actor_id from audit_log where table_name='diesel_prices' order by occurred_at desc limit 1)='00000000-0000-0000-0000-00000000000a';
 begin update profiles set role='dispatcher' where id='00000000-0000-0000-0000-00000000000a'; raise exception 'last admin demoted';
 exception when raise_exception then null; end;
 begin insert into customers(name,phone,payment_terms,credit_days) values ('p','1','prepaid',5); raise exception 'prepaid credit';
 exception when check_violation then null; end;
 update trucks set reference_load_photo_url='x'; assert found;
 insert into storage.objects(bucket_id,name) values ('trip-photos','trucks/10000000-0000-0000-0000-000000000001/reference.jpg');
end $$; rollback;
-- ============================ Step 3: orders and dispatch ====================
create or replace function pg_temp.expect_err(q text, pat text) returns void language plpgsql as $$
begin
  execute q;
  raise exception 'expected error "%" from: %', pat, q using errcode = 'XX001';
exception when others then
  if sqlstate = 'XX001' then raise; end if;
  if sqlerrm not ilike '%' || pat || '%' then
    raise exception 'wrong error for %: % (wanted %)', q, sqlerrm, pat using errcode = 'XX001';
  end if;
end $$;
create or replace function pg_temp.as_system() returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', '', true); reset role; end $$;

insert into customers(id,name,phone,payment_terms,credit_load_cap,credit_days) values
 ('30000000-0000-0000-0000-000000000002','Credit Co','0802','credit',1,30),
 ('30000000-0000-0000-0000-000000000003','Zero Cap','0804','credit',0,30),
 ('30000000-0000-0000-0000-000000000004','Roomy Co','0808','credit',5,30);
insert into customer_sites(id,customer_id,name,area) values
 ('40000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000002','Site2','Gwarinpa'),
 ('40000000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000003','Site3','Gwarinpa'),
 ('40000000-0000-0000-0000-000000000004','30000000-0000-0000-0000-000000000004','Site4','Gwarinpa');
insert into trucks(id,plate_number,owner_type,status) values
 ('10000000-0000-0000-0000-000000000002','ABJ-222-XY','spv','available'),
 ('10000000-0000-0000-0000-000000000003','ABJ-333-XY','spv','available'),
 ('10000000-0000-0000-0000-000000000004','ABJ-444-XY','spv','maintenance');
insert into drivers(id,full_name,phone,assigned_truck_id) values
 ('20000000-0000-0000-0000-000000000003','Drv3','0806','10000000-0000-0000-0000-000000000002'),
 ('20000000-0000-0000-0000-000000000004','Drv4','0807','10000000-0000-0000-0000-000000000003');

\echo '--- step 3: dispatcher creates orders; snapshot; prepaid gate'
begin; select pg_temp.act('00000000-0000-0000-0000-00000000000d');
do $$ declare o orders; o2 orders; r uuid; t1 uuid; begin
 select id into r from routes where destination_area='Gwarinpa' order by name limit 1;
 o := public.create_order('30000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001', r, 2, 'S3-A');
 assert o.status = 'awaiting_payment', o.status;
 assert o.payment_terms = 'prepaid';
 assert o.price_per_trip = (select customer_price from route_prices where route_id=r and effective_to is null);
 assert (select count(*) from trips where order_id=o.id and status='pending' and price=o.price_per_trip)=2;
 assert (select count(*) from trip_events e join trips t on t.id=e.trip_id where t.order_id=o.id and e.event_type='created')=2;
 -- a direct insert cannot choose its own price, terms or status
 insert into orders(customer_id,site_id,route_id,material,trips_ordered,price_per_trip,payment_terms,status)
  values ('30000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001',r,'granite',1,1,'credit','ready') returning * into o2;
 assert o2.price_per_trip = o.price_per_trip and o2.status='awaiting_payment' and o2.payment_terms='prepaid' and o2.material='sharp_sand';
 perform pg_temp.expect_err(format('insert into orders(customer_id,site_id,route_id,material,trips_ordered,price_per_trip,payment_terms) values (%L,%L,%L,%L,1,1,%L)',
   '30000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000001', r, 'x', 'credit'), 'does not belong');
 select id into t1 from trips where order_id=o.id order by trip_number limit 1;
 perform pg_temp.expect_err(format('select public.assign_trip(%L,%L,%L)', t1,'20000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000002'), 'awaiting payment');
 perform pg_temp.expect_err(format('update trips set status=%L, driver_id=%L, truck_id=%L where id=%L', 'assigned','20000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000002', t1), 'awaiting payment');
 perform pg_temp.expect_err(format('select public.record_order_payment(%L, 1000000, %L, null, now())', o.id, 'cash'), 'Only admin or finance');
 perform pg_temp.expect_err(format('update orders set status=%L where id=%L', 'ready', o.id), 'Only the notes');
 perform pg_temp.expect_err(format('update trips set price=1 where id=%L', t1), 'Only the dispatch fields');
 update orders set notes='S3-A edited' where id=o.id; assert found;
 update orders set notes='S3-A' where id=o.id;
end $$;

\echo '--- step 3: finance records payment (full only), cannot dispatch'
select pg_temp.act('00000000-0000-0000-0000-00000000000f');
do $$ declare o orders; total int; begin
 select * into o from orders where notes='S3-A';
 total := o.price_per_trip * 2;
 perform pg_temp.expect_err(format('select public.record_order_payment(%L, %s, %L, %L, now())', o.id, total-1, 'bank_transfer', 'REF1'), 'paid in full');
 perform pg_temp.expect_err(format('update orders set status=%L where id=%L', 'ready', o.id), 'orders_prepaid_needs_payment');
 o := public.record_order_payment(o.id, total, 'bank_transfer', 'REF1', now() - interval '1 hour');
 assert o.status='ready' and o.payment_id is not null;
 assert (select amount from payments where id=o.payment_id)=total;
 assert (select count(*) from ledger_entries where payment_id=o.payment_id and entry_type='payment' and amount=total)=1;
 perform pg_temp.expect_err(format('select public.record_order_payment(%L, %s, %L, null, now())', o.id, total, 'cash'), 'not awaiting payment');
 perform pg_temp.expect_err(format('select public.assign_trip((select id from trips where order_id=%L limit 1),%L,%L)', o.id,'20000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000002'), 'Only an admin or dispatcher');
end $$;

\echo '--- step 3: dispatch, double-booking, maintenance, cancel, unassign'
select pg_temp.act('00000000-0000-0000-0000-00000000000d');
do $$ declare o orders; t1 uuid; t2 uuid; begin
 select * into o from orders where notes='S3-A';
 select id into t1 from trips where order_id=o.id order by trip_number limit 1;
 select id into t2 from trips where order_id=o.id order by trip_number desc limit 1;
 perform public.assign_trip(t1,'20000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000002');
 assert (select status from trips where id=t1)='assigned' and (select assigned_at from trips where id=t1) is not null;
 assert (select status from trucks where id='10000000-0000-0000-0000-000000000002')='on_trip';
 assert (select status from orders where id=o.id)='in_progress';
 assert (select count(*) from trip_events where trip_id=t1 and event_type='assigned' and note like 'Assigned to Drv3, truck ABJ-222-XY')=1;
 perform pg_temp.expect_err(format('select public.assign_trip(%L,%L,%L)', t2,'20000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000003'), 'Drv3 is already on trip');
 perform pg_temp.expect_err(format('select public.assign_trip(%L,%L,%L)', t2,'20000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000002'), 'ABJ-222-XY is already on trip');
 perform pg_temp.expect_err(format('select public.assign_trip(%L,%L,%L)', t2,'20000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000004'), 'maintenance');
 perform pg_temp.expect_err(format('select public.cancel_trip(%L, %L)', t2, '  '), 'reason');
 perform public.cancel_trip(t2, 'Customer reduced the order');
 assert (select status from trips where id=t2)='cancelled';
 assert (select status from orders where id=o.id)='in_progress';
 perform pg_temp.expect_err(format('select public.cancel_trip(%L, %L)', t2, 'again'), 'can no longer be cancelled');
 -- unassign frees the truck and the order goes back to ready
 update trips set status='pending' where id=t1;
 assert (select driver_id from trips where id=t1) is null;
 assert (select status from trucks where id='10000000-0000-0000-0000-000000000002')='available';
 assert (select status from orders where id=o.id)='ready';
 -- reassign and swap truck
 perform public.assign_trip(t1,'20000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000002');
 perform public.assign_trip(t1,'20000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000003');
 assert (select status from trucks where id='10000000-0000-0000-0000-000000000002')='available';
 assert (select status from trucks where id='10000000-0000-0000-0000-000000000003')='on_trip';
 assert (select count(*) from trip_events where trip_id=t1 and note like 'Reassigned to Drv3, truck ABJ-333-XY')=1;
end $$;

\echo '--- step 3: price stays fixed after a route price change'
select pg_temp.act('00000000-0000-0000-0000-00000000000a');
do $$ declare o orders; before int; begin
 select * into o from orders where notes='S3-A';
 before := o.price_per_trip;
 perform public.change_route_price(o.route_id, before + 50000, 65000, 1800, 15000, 'up');
 assert (select price_per_trip from orders where id=o.id)=before;
 assert (select count(*) from trips where order_id=o.id and price<>before)=0;
end $$;

\echo '--- step 3: cancel order frees trucks'
select pg_temp.act('00000000-0000-0000-0000-00000000000d');
do $$ declare o orders; begin
 select * into o from orders where notes='S3-A';
 perform pg_temp.expect_err(format('select public.cancel_order(%L, null)', o.id), 'reason');
 o := public.cancel_order(o.id, 'Site closed');
 assert o.status='cancelled' and o.cancel_reason='Site closed';
 assert (select count(*) from trips where order_id=o.id and status<>'cancelled')=0;
 assert (select status from trucks where id='10000000-0000-0000-0000-000000000003')='available';
 perform pg_temp.expect_err(format('select public.cancel_order(%L, %L)', o.id, 'x'), 'already cancelled');
end $$;

\echo '--- step 3: credit orders, credit cap, zero cap'
do $$ declare o orders; z orders; r uuid; c1 uuid; c2 uuid; begin
 select id into r from routes where destination_area='Gwarinpa' order by name limit 1;
 o := public.create_order('30000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000002', r, 2, 'S3-C');
 assert o.status='ready' and o.payment_terms='credit' and o.payment_id is null;
 select id into c1 from trips where order_id=o.id order by trip_number limit 1;
 select id into c2 from trips where order_id=o.id order by trip_number desc limit 1;
 perform public.assign_trip(c1,'20000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000003');
 perform pg_temp.expect_err(format('select public.assign_trip(%L,%L,%L)', c2,'20000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000002'), 'Over credit cap (1 of 1');
 z := public.create_order('30000000-0000-0000-0000-000000000003','40000000-0000-0000-0000-000000000003', r, 1, 'S3-Z');
 perform pg_temp.expect_err(format('select public.assign_trip((select id from trips where order_id=%L),%L,%L)', z.id,'20000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000002'), 'Set a credit cap');
end $$;

\echo '--- step 3: delivered trip frees the truck; order completes'
select pg_temp.as_system();
update trips set status='delivered', delivered_at=now()
 where order_id=(select id from orders where notes='S3-C') and status='assigned';
select pg_temp.act('00000000-0000-0000-0000-00000000000d');
do $$ declare o orders; begin
 select * into o from orders where notes='S3-C';
 assert (select status from trucks where id='10000000-0000-0000-0000-000000000003')='available';
 assert o.status='in_progress', o.status;
 perform public.cancel_trip((select id from trips where order_id=o.id and status='pending'), 'Not needed');
 assert (select status from orders where id=o.id)='completed';
 perform pg_temp.expect_err(format('update trips set status=%L where order_id=%L and status=%L', 'pending', o.id, 'delivered'), 'can no longer be changed');
end $$;

\echo '--- step 3: my_trips shows a driver only their own active trips'
select pg_temp.act('00000000-0000-0000-0000-00000000000d');
do $$ declare o orders; begin
 o := public.create_order('30000000-0000-0000-0000-000000000004','40000000-0000-0000-0000-000000000004',
        (select id from routes where destination_area='Gwarinpa' order by name limit 1), 1, 'S3-D');
 perform public.assign_trip((select id from trips where order_id=o.id),'20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001');
 assert (select count(*) from public.my_trips())=0, 'dispatcher sees driver trips';
end $$;
select pg_temp.act('00000000-0000-0000-0000-0000000000a1');
do $$ begin
 assert (select count(*) from public.my_trips())=1;
 assert (select site_name from public.my_trips())='Site4';
 assert (select truck_plate from public.my_trips())='ABJ-123-XY';
end $$;
select pg_temp.act('00000000-0000-0000-0000-0000000000a2');
do $$ begin assert (select count(*) from public.my_trips())=0, 'other driver sees trip'; end $$;

\echo '--- step 3: drivers cannot create or dispatch; functions not callable by anon'
select pg_temp.act('00000000-0000-0000-0000-0000000000a1');
do $$ begin
 perform pg_temp.expect_err(format('select public.create_order(%L,%L,(select id from routes limit 1),1)', '30000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001'), 'Only an admin or dispatcher');
 assert not has_function_privilege('anon', 'public.create_order(uuid,uuid,uuid,int,text)', 'execute');
 assert not has_function_privilege('authenticated', 'public.trips_dispatch_rules()', 'execute');
 assert not has_function_privilege('authenticated', 'public.sync_order_status(uuid)', 'execute');
end $$;

-- ============================ Step 4: trip progress and breakdowns ===========
select pg_temp.as_system();
update customer_sites set latitude=9.100000, longitude=7.400000, geofence_radius_m=300
 where id='40000000-0000-0000-0000-000000000004';

\echo '--- step 4: who may record a step'
select pg_temp.act('00000000-0000-0000-0000-0000000000a2');
do $$ declare t uuid := (select id from trips where order_id=(select id from orders where notes='S3-D')); begin
 perform pg_temp.expect_err(format('select public.record_trip_step(%L,%L)', t, 'loaded'), 'not assigned to you');
end $$;
select pg_temp.act('00000000-0000-0000-0000-00000000000f');
do $$ declare t uuid := (select id from trips where order_id=(select id from orders where notes='S3-D')); begin
 perform pg_temp.expect_err(format('select public.record_trip_step(%L,%L)', t, 'loaded'), 'Only the driver or the office');
 perform pg_temp.expect_err(format('select public.report_breakdown(%L,%L,%L)', t, 'x', 'lost'), 'Only an admin or dispatcher');
end $$;

\echo '--- step 4: driver steps in order; skipping in transit is allowed; inside site'
select pg_temp.act('00000000-0000-0000-0000-0000000000a1');
do $$ declare t uuid := (select trip_id from public.my_trips() where status='assigned'); r trips; begin
 assert t is not null, 'my_trips assigned';
 perform pg_temp.expect_err(format('update trips set status=%L where id=%L', 'loaded', t), 'Use the buttons');
 perform pg_temp.expect_err(format('select public.record_trip_step(%L,%L)', t, 'delivered'), 'is assigned; it can''t be marked delivered');
 perform pg_temp.expect_err(format('select public.record_trip_step(%L,%L)', t, 'settled'), 'Unknown trip step');
 r := public.record_trip_step(t, 'loaded', 9.05, 7.45, 15, ' R-77 ');
 assert r.status='loaded' and r.loaded_at is not null and r.loader_receipt_no='R-77' and not r.office_recorded;
 r := public.record_trip_step(t, 'loaded');  -- repeated tap
 assert r.status='loaded';
 assert (select count(*) from trip_events where trip_id=t and event_type='loaded')=1;
 assert (select note from trip_events where trip_id=t and event_type='loaded') = 'GPS ±15m · Receipt R-77';
 assert (select status from public.my_trips() where trip_id=t)='loaded';
 r := public.record_trip_step(t, 'delivered', 9.101, 7.4, 20);
 assert r.status='delivered' and r.delivered_at is not null and r.in_transit_at is null;
 assert r.delivery_check='inside', r.delivery_check;
 assert r.delivery_distance_m between 105 and 118, r.delivery_distance_m;
 assert (select note from trip_events where trip_id=t and event_type='delivered') like 'Inside site · GPS ±20m';
 assert (select latitude from trip_events where trip_id=t and event_type='delivered')=9.101;
 perform pg_temp.expect_err(format('select public.record_trip_step(%L,%L)', t, 'in_transit'), 'is delivered');
end $$;
select pg_temp.as_system();
do $$ begin
 assert (select status from trucks where id='10000000-0000-0000-0000-000000000001')='available', 'truck freed';
 assert (select status from orders where notes='S3-D')='completed', 'order completed';
end $$;

\echo '--- step 4: outside, no location, no site pin'
select pg_temp.act('00000000-0000-0000-0000-00000000000d');
do $$ declare o orders; begin
 o := public.create_order('30000000-0000-0000-0000-000000000004','40000000-0000-0000-0000-000000000004',
        (select id from routes where destination_area='Gwarinpa' order by name limit 1), 4, 'S4-A');
 perform public.assign_trip((select id from trips where order_id=o.id order by trip_number limit 1),
        '20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001');
end $$;
select pg_temp.act('00000000-0000-0000-0000-0000000000a1');
do $$ declare t uuid := (select trip_id from public.my_trips() where status='assigned'); r trips; begin
 perform public.record_trip_step(t, 'loaded');
 r := public.record_trip_step(t, 'in_transit');
 assert r.status='in_transit' and r.in_transit_at is not null;
 r := public.record_trip_step(t, 'delivered', 9.11, 7.4, 500);
 assert r.delivery_check='outside' and r.delivery_distance_m between 1100 and 1125, r.delivery_distance_m;
 assert (select note from trip_events where trip_id=t and event_type='delivered') like '1___m from site · GPS ±500m';
 r := public.record_trip_step(t, 'delivered', 9.1, 7.4, 5);  -- repeated tap changes nothing
 assert r.delivery_check='outside' and (select count(*) from trip_events where trip_id=t and event_type='delivered')=1;
end $$;
select pg_temp.act('00000000-0000-0000-0000-00000000000d');
do $$ begin perform public.assign_trip((select id from trips where order_id=(select id from orders where notes='S4-A') and status='pending' order by trip_number limit 1),
        '20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001'); end $$;
select pg_temp.act('00000000-0000-0000-0000-0000000000a1');
do $$ declare t uuid := (select trip_id from public.my_trips() where status='assigned'); r trips; begin
 perform public.record_trip_step(t, 'loaded');
 perform pg_temp.expect_err(format('select public.record_trip_step(%L,%L,%s,%s)', t, 'delivered', 91, 7), 'Location is not valid');
 r := public.record_trip_step(t, 'delivered');
 assert r.delivery_check='no_location' and r.delivery_distance_m is null;
end $$;
select pg_temp.act('00000000-0000-0000-0000-00000000000d');
do $$ begin perform public.assign_trip((select id from trips where order_id=(select id from orders where notes='S4-A') and status='pending' order by trip_number limit 1),
        '20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001'); end $$;
select pg_temp.as_system();
update customer_sites set latitude=null, longitude=null where id='40000000-0000-0000-0000-000000000004';
select pg_temp.act('00000000-0000-0000-0000-0000000000a1');
do $$ declare t uuid := (select trip_id from public.my_trips() where status='assigned'); r trips; begin
 perform public.record_trip_step(t, 'loaded');
 r := public.record_trip_step(t, 'delivered', 9.1, 7.4, 10);
 assert r.delivery_check='no_site_pin';
 assert (select count(*) from public.my_trips() where status='delivered')=4, 'done today';
 assert (select count(*) from public.my_trips() where status in ('assigned','loaded','in_transit'))=0;
end $$;
select pg_temp.as_system();
update trips set delivered_at = now() - interval '2 days' where id=(select id from trips where order_id=(select id from orders where notes='S3-D'));
select pg_temp.act('00000000-0000-0000-0000-0000000000a1');
do $$ begin assert (select count(*) from public.my_trips())=3, 'yesterday hidden'; end $$;
select pg_temp.act('00000000-0000-0000-0000-0000000000a2');
do $$ begin assert (select count(*) from public.my_trips())=0, 'other driver sees done trips'; end $$;

\echo '--- step 4: office records a step with a reason'
select pg_temp.act('00000000-0000-0000-0000-00000000000d');
do $$ declare t uuid; r trips; begin
 select id into t from trips where order_id=(select id from orders where notes='S4-A') and status='pending';
 perform public.assign_trip(t, '20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001');
 perform pg_temp.expect_err(format('select public.report_breakdown(%L,%L,%L)', t, 'x', 'lost'), 'Only a loaded or moving trip');
 perform pg_temp.expect_err(format('select public.record_trip_step(%L,%L)', t, 'loaded'), 'Give a reason');
 r := public.record_trip_step(t, 'loaded', 9.0, 7.0, 5, 'R-9', 'Driver phone is dead');
 assert r.status='loaded' and r.office_recorded and r.loader_receipt_no='R-9';
 assert (select note from trip_events where trip_id=t and event_type='loaded')='Recorded by office: Driver phone is dead · Receipt R-9';
 assert (select latitude from trip_events where trip_id=t and event_type='loaded') is null, 'office GPS ignored';
 perform pg_temp.expect_err(format('update trips set status=%L where id=%L', 'delivered', t), 'can no longer be changed');
 perform pg_temp.expect_err(format('select public.cancel_trip(%L,%L)', t, 'x'), 'can no longer be cancelled');
end $$;

\echo '--- step 4: breakdown (load moved) adds a replacement trip'
do $$ declare o orders; t uuid; n trips; begin
 select * into o from orders where notes='S4-A';
 select id into t from trips where order_id=o.id and status='loaded';
 perform pg_temp.expect_err(format('select public.report_breakdown(%L,%L,%L)', t, ' ', 'moved'), 'Say what happened');
 perform pg_temp.expect_err(format('select public.report_breakdown(%L,%L,%L)', t, 'Gearbox', 'x'), 'moved to another truck or lost');
 n := public.report_breakdown(t, 'Gearbox failed at Zuba', 'moved');
 assert n.status='pending' and n.replaces_trip_id=t and n.price=o.price_per_trip and n.material_cost=0;
 assert (select status from trips where id=t)='cancelled';
 assert (select breakdown_load from trips where id=t)='moved';
 assert (select cancel_reason from trips where id=t)='Breakdown: Gearbox failed at Zuba · Load moved to the new truck';
 assert (select material_cost from trips where id=t) > 0, 'original keeps material cost';
 assert (select status from trucks where id='10000000-0000-0000-0000-000000000001')='maintenance';
 assert (select status from orders where id=o.id)='in_progress';
 assert (select count(*) from trips where order_id=o.id and status<>'cancelled')=o.trips_ordered;
 assert (select count(*) from trip_events where trip_id=n.id and note like 'Replaces TRP-%(breakdown)')=1;
 perform pg_temp.expect_err(format('select public.assign_trip(%L,%L,%L)', n.id,'20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001'), 'maintenance');
 perform public.assign_trip(n.id,'20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002');
end $$;
select pg_temp.act('00000000-0000-0000-0000-0000000000a1');
do $$ declare t uuid := (select trip_id from public.my_trips() where status='assigned'); begin
 assert (select truck_plate from public.my_trips() where trip_id=t)='ABJ-222-XY';
 perform public.record_trip_step(t, 'loaded');
 perform public.record_trip_step(t, 'delivered');
end $$;
select pg_temp.as_system();
do $$ begin assert (select status from orders where notes='S4-A')='completed'; end $$;

\echo '--- step 4: breakdown on a paid prepaid order (load lost) stays paid'
select pg_temp.act('00000000-0000-0000-0000-00000000000d');
do $$ declare o orders; begin
 o := public.create_order('30000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001',
        (select id from routes where destination_area='Gwarinpa' order by name limit 1), 1, 'S4-P');
 assert o.status='awaiting_payment';
end $$;
select pg_temp.act('00000000-0000-0000-0000-00000000000f');
do $$ begin perform public.record_order_payment((select id from orders where notes='S4-P'),
        (select price_per_trip from orders where notes='S4-P'), 'cash', null, now()); end $$;
select pg_temp.act('00000000-0000-0000-0000-00000000000d');
do $$ declare o orders; t uuid; n trips; begin
 select * into o from orders where notes='S4-P';
 select id into t from trips where order_id=o.id;
 perform public.assign_trip(t,'20000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000003');
 perform public.record_trip_step(t, 'loaded', null, null, null, null, 'Driver has no data');
 perform public.record_trip_step(t, 'in_transit', null, null, null, null, 'Driver has no data');
 n := public.report_breakdown(t, 'Accident at Kubwa', 'lost');
 assert n.material_cost = (select material_cost from trips where id=t) and n.material_cost > 0, 'lost load is bought again';
 assert (select payment_id from orders where id=o.id)=o.payment_id;
 assert (select status from orders where id=o.id)='ready', 'nothing moving: ready to dispatch again';
 assert (select status from trucks where id='10000000-0000-0000-0000-000000000003')='maintenance';
 assert (select count(*) from trips where order_id=o.id and status='pending')=1;
end $$;

\echo '--- step 4: grants'
do $$ begin
 assert not has_function_privilege('anon', 'public.record_trip_step(uuid,text,numeric,numeric,numeric,text,text)', 'execute');
 assert not has_function_privilege('anon', 'public.report_breakdown(uuid,text,text)', 'execute');
 assert not has_function_privilege('authenticated', 'public.distance_m(numeric,numeric,numeric,numeric)', 'execute');
 assert has_function_privilege('authenticated', 'public.record_trip_step(uuid,text,numeric,numeric,numeric,text,text)', 'execute');
end $$;
rollback;
\echo ALL_RLS_TESTS_PASSED
