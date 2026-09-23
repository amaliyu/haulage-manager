-- =============================================================================
-- Haulage Manager — Supabase advisor fixes (run after 20260922000000_step1_schema.sql)
-- =============================================================================

-- Trigger functions must never be callable as RPCs (/rest/v1/rpc/...).
-- Triggers still fire: Postgres checks EXECUTE on a trigger function only when
-- the trigger is created, not when it fires.
revoke execute on function public.guard_orders_update()        from public, anon, authenticated;
revoke execute on function public.guard_profiles_update()      from public, anon, authenticated;
revoke execute on function public.guard_trips_update()         from public, anon, authenticated;
revoke execute on function public.guard_price_history_update() from public, anon, authenticated;
revoke execute on function public.set_row_stamps()             from public, anon, authenticated;

-- Nothing is callable by anon. (Signed-out users have no policies anyway.)
revoke execute on function public.only_columns_changed(jsonb, jsonb, text[]) from public, anon;
revoke execute on function public.try_uuid(text)                             from public, anon;
grant  execute on function public.only_columns_changed(jsonb, jsonb, text[]) to authenticated;

-- Covering indexes for the business foreign keys (joins, filters and FK checks).
-- created_by / set_by / audit actor columns are deliberately not indexed: they
-- are only scanned when a profile row is deleted, which the app never does.
create index if not exists orders_site_idx            on public.orders (site_id);
create index if not exists orders_route_idx           on public.orders (route_id);
create index if not exists orders_route_price_idx     on public.orders (route_price_id);
create index if not exists trips_truck_idx            on public.trips (truck_id);
create index if not exists trips_source_idx           on public.trips (source_id);
create index if not exists ledger_payment_idx         on public.ledger_entries (payment_id);
create index if not exists ledger_trip_idx            on public.ledger_entries (trip_id);
create index if not exists ledger_reverses_idx        on public.ledger_entries (reverses_entry_id);
create index if not exists diesel_issues_trip_idx     on public.diesel_issues (trip_id);
create index if not exists diesel_issues_driver_idx   on public.diesel_issues (driver_id);
create index if not exists trip_events_actor_idx      on public.trip_events (actor_id);
create index if not exists trip_photos_uploader_idx   on public.trip_photos (uploaded_by);
