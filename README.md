# Haulage Manager

Dispatch and settlement for sand and granite tipper haulage in Abuja. One **trip** is one full tipper load from a quarry or sand site to a customer's site. The price per trip covers material plus haulage. There is no weighbridge: the quantity standard is "one full tipper", proved by photographs against each truck's reference full-load photo.

**Step 1** covers:

- the full database schema, with RLS on every table;
- authentication and roles (admin, dispatcher, finance, driver);
- the master-data screens: customers and their delivery sites, material sources, routes and price history, diesel pump price, trucks with reference photos, drivers and users.

**Step 3** (orders and dispatch) adds:

- **Orders.** An admin or dispatcher picks the customer, delivery site, route and number of trips. The order keeps the route's price from that moment; later price changes never touch it. One pending trip is created per load.
- **Payment gate.** A prepaid order waits in *Awaiting payment* until finance or an admin records the full payment (Record payment writes a payment and a ledger entry). Only then can its trips be dispatched.
- **Credit cap.** A credit customer cannot have more loads dispatched but not yet settled than their credit cap. A cap of 0 blocks dispatch.
- **Dispatch.** The Dispatch board lists trips to dispatch, trips on the road and orders waiting for payment. Picking a driver fills in their usual truck; the dispatcher can pick another free truck. A truck or driver can be on only one active trip. Trucks go *On trip* and back to *Available* automatically.
- **Drivers** see their current trips on Home: where to deliver, customer phone, directions and a Maps link.

All of these rules are enforced in the database (triggers and functions in `supabase/migrations/20261001000000_step3_orders_dispatch.sql`), not only in the app.

The driver trip actions (loaded, delivered, photos), settlement and reports come in later steps.

UI rules are in [DESIGN.md](DESIGN.md). Every screen follows them.

## Stack

- React 18 + TypeScript + Vite
- Tailwind CSS (tokens as CSS variables, see `src/index.css`)
- Supabase: Postgres, Auth, Storage, Row Level Security
- @tanstack/react-query, react-hook-form + zod, lucide-react
- Deployed on Vercel. Package manager: npm.

Money is stored as integer naira and shown as `₦310,000`. Timestamps are stored as `timestamptz` (UTC) and shown in Africa/Lagos time.

## Environment variables

| Variable | Where to find it |
|---|---|
| `VITE_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → `anon` public key |

Copy `.env.example` to `.env` and fill both in. `.env` is git-ignored. **Never** put the `service_role` key in any `VITE_` variable: those are bundled into the browser. If either variable is missing, the app shows an "App not configured" screen naming it.

## Run locally

```bash
npm install
cp .env.example .env   # then fill in the two values
npm run dev            # http://localhost:5173
```

Other scripts:

- `npm run build` runs the type-check and production build into `dist/`.
- `npm run lint` runs ESLint. It also blocks importing Supabase outside `src/services` and `src/lib`.
- `npm run preview` serves the production build.
- `npm run ui:check` builds the app against a mocked Supabase and renders every screen at 360px and 1280px, in light and dark mode. It fails on horizontal overflow, phone tap targets under 48px, pure-black text or JavaScript errors. Screenshots go to `scripts/ui-check/out/`. Set `PLAYWRIGHT_CHROMIUM_PATH` to use an installed Chromium; otherwise run `npx playwright install chromium` once.
- `npm run db:test` runs every migration, the seed (twice) and the role-by-role RLS tests on a throwaway **local** Postgres (`PGHOST`/`PGPORT`). It never touches Supabase.

CI (`.github/workflows/ci.yml`) runs `npm ci`, lint, typecheck and build on every pull request.

## Database setup (run by a human, in this order)

Nothing in this repository applies migrations automatically. In the Supabase dashboard, open **SQL Editor**, paste each file and click **Run**, in this order:

1. `supabase/migrations/20260922000000_step1_schema.sql` creates the tables, constraints, triggers, audit log, numbering functions, role helpers, price-change functions, RLS policies, and the private `trip-photos` storage bucket with its policies.
2. `supabase/migrations/20260923000000_advisor_fixes.sql` applies the Supabase advisor fixes. Trigger functions can no longer be called as RPCs, `anon` can execute nothing, and it adds covering indexes for the business foreign keys.
3. `supabase/migrations/20261001000000_step3_orders_dispatch.sql` adds the order and dispatch rules and the `create_order`, `assign_trip`, `cancel_trip`, `cancel_order` and `record_order_payment` functions.
4. `supabase/migrations/20261001000100_driver_my_trips.sql` adds `my_trips()`, which gives a driver the delivery details of their own active trips.
5. `supabase/seed.sql` adds the sample data: Koita and Kwali sand sites, four routes to Gwarinpa and Apo/Wuye with current prices, and a diesel price of ₦1,730/L. It is safe to run twice. It adds no customers, trucks or drivers. Delete the sample rows from the app once real data exists.

If you use the Supabase CLI instead: `supabase link --project-ref <ref>`, then `supabase db push`, then run `seed.sql` in the SQL editor.

### Auth settings

In Supabase → Authentication → URL Configuration, set **Site URL** to the deployed app URL. Add `https://<your-domain>/reset-password` (and `http://localhost:5173/reset-password` for local work) to **Redirect URLs** so password-reset emails land on the reset screen.

**Required:** only an admin creates users. The app has no sign-up screen, but Supabase accepts sign-ups through its API unless you turn them off:

- Authentication → Sign In / Providers → turn **off** "Allow new users to sign up".
- Authentication → Sign In / Providers → Email → turn **on** "Prevent use of leaked passwords" (Pro plan and above).

## Create the first admin

1. In Supabase → **Authentication → Users → Add user**, create your account with an email and password. Tick "Auto confirm user".
2. In **SQL Editor**, run (with your email and name):

   ```sql
   insert into public.profiles (id, full_name, role)
   select id, 'Your Full Name', 'admin'
   from auth.users
   where email = 'you@example.com';
   ```

3. Sign in to the app. You land on Home with full navigation.

To add everyone else:

1. Create their account in Supabase → Authentication → Users → Add user.
2. Copy their **UID**.
3. In the app, open **Users → Enable access**, paste the UID, and choose their name and role.

A signed-in account with no profile row, or with `is_active = false`, sees "Access not enabled" and is signed out. The database also gives it no rows.

For a driver, after enabling access with the Driver role, open **Drivers**. Edit their driver record, and set **App login** to link it.

## Roles

| | Admin | Dispatcher | Finance | Driver |
|---|---|---|---|---|
| Master data (customers, sites, sources, routes, prices, diesel, trucks, drivers) | read + write | read | read | trucks + own driver row |
| Orders | create, cancel | create, cancel | read | — |
| Record payment | yes | — | yes | — |
| Dispatch (assign, reassign, cancel trips) | yes | yes | — | — |
| Users | manage | — | — | — |
| Home | overview | overview | overview | own current trips and usual truck |

The database enforces these rules with RLS and guard triggers. The UI only hides what a role can't do. The full matrix for orders, trips, payments and ledger, used in later steps, is in the migration file.

## Deploy to Vercel

1. Push this repository to GitHub.
2. In Vercel, click **Add New → Project** and import the repository. `vercel.json` pins the build (framework Vite, `npm ci`, `npm run build`, output `dist`), so the dashboard's build settings don't matter.
3. Under **Environment Variables**, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for Production and Preview.
4. Deploy. `vercel.json` rewrites every path to `index.html` so deep links work.
5. Put the deployed URL into Supabase's Site URL and Redirect URLs, as described in "Auth settings" above.

## Database types

`src/types/database.ts` is generated from the live project. Regenerate it after every schema change:

```bash
npx supabase gen types typescript --project-id iqbhqddilwpeobbiscba --schema public > src/types/database.ts
```

## Project structure

```
src/components/ui       reusable primitives (Button, Input, Select, Modal, Toast, DataTable, Card, EmptyState, StatusPill, MetricTile)
src/components/layout   AppShell, BottomNav, Sidebar, Header
src/features/<entity>   screens, forms and react-query hooks per entity
src/services            all Supabase calls, one file per entity
src/hooks               useAuth, useRole, useTheme, useGeolocation, useDebounced
src/lib                 supabase client, formatters (naira, Africa/Lagos dates), zod helpers, errors, image compression
src/types               database types
supabase/migrations     SQL files only, never applied automatically
supabase/seed.sql       sample master data
scripts/db-test         local-Postgres RLS test suite and the zero-TEST-rows proof query
scripts/ui-check        Playwright screen audit (npm run ui:check)
```
