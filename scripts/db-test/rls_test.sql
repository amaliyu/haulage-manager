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
 update orders set status='ready' where id='50000000-0000-0000-0000-000000000001'; assert found;
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
 update trips set status='loaded', loaded_at=now(), loader_receipt_no='R1' where id='60000000-0000-0000-0000-000000000001'; assert found;
 update trips set status='loaded' where id='60000000-0000-0000-0000-000000000002'; assert not found, 'other driver trip';
 begin update trips set price=1 where id='60000000-0000-0000-0000-000000000001'; raise exception 'driver price';
 exception when insufficient_privilege then null; end;
 begin update trips set status='settled' where id='60000000-0000-0000-0000-000000000001'; raise exception 'driver settled';
 exception when insufficient_privilege then null; end;
 insert into trip_events(trip_id,event_type,actor_id) values ('60000000-0000-0000-0000-000000000001','loaded','00000000-0000-0000-0000-0000000000a1');
 begin insert into trip_events(trip_id,event_type,actor_id) values ('60000000-0000-0000-0000-000000000002','loaded','00000000-0000-0000-0000-0000000000a1'); raise exception 'event other trip';
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
\echo ALL_RLS_TESTS_PASSED
