-- Proves no TEST- fixture data remains. Scans every text/jsonb column of every
-- public table, plus test auth users/identities and trip-photos objects.
-- Expected result after a full cleanup: a single TOTAL row with 0.
with col_hits as (
  select c.table_name || '.' || c.column_name as location,
         (xpath('/row/n/text()', query_to_xml(format(
            'select count(*) as n from public.%I where %I::text like %L',
            c.table_name, c.column_name, '%TEST-%'), false, true, '')))[1]::text::int as hits
  from information_schema.columns c
  join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
  where c.table_schema = 'public' and c.data_type in ('text', 'jsonb')
),
extra as (
  select 'auth.users (test-%@example.com)', count(*)::int from auth.users where email like 'test-%@example.com'
  union all select 'auth.identities (test users)', count(*)::int from auth.identities i join auth.users u on u.id = i.user_id where u.email like 'test-%@example.com'
  union all select 'storage.objects (trip-photos)', count(*)::int from storage.objects where bucket_id = 'trip-photos'
)
select location, hits from col_hits where hits > 0
union all select * from extra where count > 0
union all select 'TOTAL columns scanned: ' || (select count(*) from col_hits), (select coalesce(sum(hits),0)::int from col_hits) + (select coalesce(sum(count),0)::int from extra);
