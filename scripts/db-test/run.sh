#!/usr/bin/env bash
# Runs every migration, the seed (twice), and the role-by-role RLS tests on a
# throwaway LOCAL Postgres. Usage: PGHOST=/tmp PGPORT=5433 scripts/db-test/run.sh
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"; root="$here/../.."
P="psql -U ${PGUSER:-postgres} -q -v ON_ERROR_STOP=1"
$P -c 'drop database if exists hm_test' -c 'create database hm_test'
$P -d hm_test -f "$here/stub.sql"
for f in "$root"/supabase/migrations/*.sql; do $P -d hm_test -1 -f "$f"; done
$P -d hm_test -f "$root/supabase/seed.sql"
$P -d hm_test -f "$root/supabase/seed.sql"
$P -d hm_test -f "$here/rls_test.sql" 2>&1 | grep -v -e '^ act' -e '^-----' -e '^ *$' -e '(1 row)' -e NOTICE
