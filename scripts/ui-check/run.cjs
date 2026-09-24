// UI check: builds the app against a mocked Supabase, then renders every
// screen at 360px and 1280px in light and dark mode and fails on horizontal
// overflow, touch targets under 48px on phones, pure-black text or JS errors.
//   npm run ui:check                 all scenes, screenshots to scripts/ui-check/out
//   SCENES=routes,users npm run ui:check
// Uses PLAYWRIGHT_CHROMIUM_PATH when set, otherwise Playwright's own browser.
const { chromium } = require('playwright')
const { execSync } = require('child_process')
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os')
const ROOT = path.resolve(__dirname, '..', '..')
const OUT = path.join(__dirname, 'out')
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'hm-ui-'))

function build(outDir, env) {
  execSync(`npx vite build --outDir ${JSON.stringify(outDir)} --emptyOutDir`, {
    cwd: ROOT, stdio: 'ignore', env: { ...process.env, ...env },
  })
}

function serve(dir, port) {
  return new Promise((res) => {
    const srv = http.createServer((req, rsp) => {
      let p = path.join(dir, decodeURIComponent(req.url.split('?')[0]))
      if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(dir, 'index.html')
      const ext = path.extname(p)
      rsp.setHeader('content-type', { '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.html': 'text/html' }[ext] || 'application/octet-stream')
      fs.createReadStream(p).pipe(rsp)
    })
    srv.listen(port, () => res(srv))
  })
}

const now = Date.now()
const iso = (daysAgo) => new Date(now - daysAgo * 86400000).toISOString()
const U = { admin: 'aaaaaaaa-0000-4000-8000-000000000001', disp: 'aaaaaaaa-0000-4000-8000-000000000002', drv: 'aaaaaaaa-0000-4000-8000-000000000003' }
const profiles = [
  { id: U.admin, full_name: 'Muktar Aliyu', phone: '08031234567', role: 'admin', is_active: true, created_at: iso(30), updated_at: null, created_by: null },
  { id: U.disp, full_name: 'Chinedu Okafor', phone: '08051234567', role: 'dispatcher', is_active: true, created_at: iso(20), updated_at: null, created_by: U.admin },
  { id: U.drv, full_name: 'Ibrahim Danjuma', phone: '07031234567', role: 'driver', is_active: true, created_at: iso(10), updated_at: null, created_by: U.admin },
  { id: 'aaaaaaaa-0000-4000-8000-000000000004', full_name: 'Aisha Bello', phone: null, role: 'finance', is_active: false, created_at: iso(5), updated_at: null, created_by: U.admin },
]
const src = [
  { id: 's1', name: 'Koita sand site', material: 'sharp_sand', area: 'Koita', latitude: null, longitude: null, default_material_cost: 65000, is_active: true, created_at: iso(30), updated_at: null, created_by: null },
  { id: 's2', name: 'Kwali sand site', material: 'sharp_sand', area: 'Kwali', latitude: 8.8765, longitude: 7.0123, default_material_cost: 65000, is_active: true, created_at: iso(30), updated_at: null, created_by: null },
]
const price = (id, route, cp, from, to, note) => ({ id, route_id: route, customer_price: cp, material_cost: 65000, diesel_price_per_litre: 1730, crew_cost: 15000, effective_from: from, effective_to: to, set_by: U.admin, note, created_at: from, updated_at: null, created_by: U.admin, setter: { full_name: 'Muktar Aliyu' } })
const r1prices = [price('p1', 'r1', 310000, iso(3), null, 'Diesel up'), price('p0', 'r1', 295000, iso(40), iso(3), 'Seed price')]
const route = (id, s, dest, l, prices) => ({ id, name: `${s.area} → ${dest}`, source_id: s.id, destination_area: dest, distance_km: 48.5, diesel_allowance_litres: l, is_active: true, created_at: iso(30), updated_at: null, created_by: null, source: { id: s.id, name: s.name, material: s.material }, prices })
const routes = [
  route('r1', src[0], 'Gwarinpa', 70, r1prices),
  route('r2', src[0], 'Apo/Wuye', 95, [price('p2', 'r2', 350000, iso(30), null, 'Seed price')]),
  route('r3', src[1], 'Gwarinpa', 70, [price('p3', 'r3', 310000, iso(30), null, 'Seed price')]),
  route('r4', src[1], 'Apo/Wuye', 95, []),
]
const customers = [
  { id: 'c1', name: 'Julius Berger Nigeria Plc', phone: '08091234567', alt_phone: '09012345678', customer_type: 'company', payment_terms: 'credit', credit_load_cap: 12, credit_days: 30, is_active: true, notes: 'Site office opens 7am. Call before arrival.', created_at: iso(12), updated_at: iso(2), created_by: U.admin },
  { id: 'c2', name: 'Hajiya Zainab Mohammed', phone: '08121234567', alt_phone: null, customer_type: 'individual', payment_terms: 'prepaid', credit_load_cap: 0, credit_days: 0, is_active: true, notes: null, created_at: iso(8), updated_at: null, created_by: U.admin },
  { id: 'c3', name: 'Cosgrove Estates Ltd', phone: '07061234567', alt_phone: null, customer_type: 'company', payment_terms: 'prepaid', credit_load_cap: 0, credit_days: 0, is_active: true, notes: null, created_at: iso(4), updated_at: null, created_by: U.admin },
]
const sites = [
  { id: 'cs1', customer_id: 'c1', name: 'Gwarinpa Estate Phase 2, Block C', area: 'Gwarinpa', latitude: 9.1076, longitude: 7.4051, geofence_radius_m: 300, directions: 'Enter by 3rd Avenue gate, ask for Engr. Musa.', is_active: true, created_at: iso(12), updated_at: null, created_by: U.admin },
  { id: 'cs2', customer_id: 'c1', name: 'Wuye district yard', area: 'Apo/Wuye', latitude: null, longitude: null, geofence_radius_m: 500, directions: null, is_active: false, created_at: iso(12), updated_at: null, created_by: U.admin },
]
const trucks = [
  { id: 't1', plate_number: 'ABJ-482-KW', make: 'Sinotruk', model: 'Howo 371', capacity_tons: 30, owner_type: 'spv', owner_name: null, reference_load_photo_url: 'trucks/t1/reference.jpg', status: 'available', is_active: true, created_at: iso(20), updated_at: iso(1), created_by: U.admin },
  { id: 't2', plate_number: 'KUJ-119-AB', make: 'MAN', model: 'TGS 33.400', capacity_tons: 25, owner_type: 'operator', owner_name: 'Danjuma Haulage', reference_load_photo_url: null, status: 'maintenance', is_active: true, created_at: iso(20), updated_at: null, created_by: U.admin },
  { id: 't3', plate_number: 'GWA-771-XY', make: 'Mack', model: null, capacity_tons: null, owner_type: 'partner', owner_name: 'Salisu & Sons', reference_load_photo_url: null, status: 'on_trip', is_active: true, created_at: iso(20), updated_at: null, created_by: U.admin },
]
const drivers = [
  { id: 'd1', profile_id: U.drv, full_name: 'Ibrahim Danjuma', phone: '07031234567', licence_number: 'FCT-ABC-2211', assigned_truck_id: 't1', is_active: true, created_at: iso(10), updated_at: null, created_by: U.admin, truck: { id: 't1', plate_number: 'ABJ-482-KW', status: 'available' } },
  { id: 'd2', profile_id: null, full_name: 'Emeka Nwosu', phone: '08061234567', licence_number: null, assigned_truck_id: null, is_active: true, created_at: iso(10), updated_at: null, created_by: U.admin, truck: null },
]
const diesel = [
  { id: 'dp2', price_per_litre: 1730, effective_from: iso(3), effective_to: null, set_by: U.admin, created_at: iso(3), updated_at: null, created_by: U.admin, setter: { full_name: 'Muktar Aliyu' } },
  { id: 'dp1', price_per_litre: 1650, effective_from: iso(45), effective_to: iso(3), set_by: U.admin, created_at: iso(45), updated_at: null, created_by: U.admin, setter: { full_name: 'Muktar Aliyu' } },
]
const tables = { profiles, material_sources: src, routes, route_prices: r1prices, customers, customer_sites: sites, trucks, drivers, diesel_prices: diesel }

// a tiny 1x1 jpeg
const JPEG = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64')

async function setup(page, { user = 'admin', mode = 'ok', theme = 'light' } = {}) {
  await page.addInitScript(({ uid, theme, profile }) => {
    const session = { access_token: 'x.y.z', refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 86400, user: { id: uid, email: 'user@example.ng', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() } }
    if (uid) localStorage.setItem('sb-test-auth-token', JSON.stringify(session))
    if (theme !== 'system') localStorage.setItem('hm-theme', theme)
  }, { uid: user ? U[user] : null, theme })
  await page.route('https://test.supabase.co/**', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const single = (req.headers()['accept'] || '').includes('vnd.pgrst.object')
    if (url.pathname.startsWith('/storage/v1/object/sign/')) return route.fulfill({ json: { signedURL: '/object/sign/img.jpg?token=t' } })
    if (url.pathname.startsWith('/storage/v1/object/')) return route.fulfill({ body: JPEG, contentType: 'image/jpeg' })
    if (url.pathname.startsWith('/auth/')) return route.fulfill({ json: {} })
    const table = url.pathname.replace('/rest/v1/', '')
    if (req.method() !== 'GET' && req.method() !== 'HEAD') return route.fulfill({ status: 201, json: single ? {} : [] })
    if (table === 'profiles' && url.searchParams.get('id')) {
      const id = url.searchParams.get('id').replace('eq.', '')
      const p = profiles.find((x) => x.id === id)
      return route.fulfill({ json: single ? p ?? null : p ? [p] : [] })
    }
    if (mode === 'slow') return new Promise(() => {})
    if (mode === 'error') return route.fulfill({ status: 500, json: { message: 'upstream connect error', code: 'XX000' } })
    let rows = tables[table] ?? []
    if (user === 'driver' && table === 'drivers') rows = rows.filter((d) => d.profile_id === U.drv)
    for (const [k, v] of url.searchParams) {
      if (['select', 'order', 'limit', 'or', 'offset'].includes(k)) continue
      if (v.startsWith('eq.')) {
        const val = v.slice(3)
        rows = rows.filter((r) => String(r[k]) === val)
      }
    }
    if (mode === 'empty' && !['profiles'].includes(table)) rows = []
    if (single) return rows[0] ? route.fulfill({ json: rows[0] }) : route.fulfill({ status: 406, json: { code: 'PGRST116', message: 'no rows' } })
    return route.fulfill({ json: rows })
  })
}

async function audit(page, name, vw) {
  const r = await page.evaluate((vw) => {
    const overflow = document.documentElement.scrollWidth - window.innerWidth
    const small = []
    if (vw < 768) {
      for (const el of document.querySelectorAll('button, a[href], input:not([type=checkbox]):not([type=file]), select, textarea')) {
        const b = el.getBoundingClientRect()
        const st = getComputedStyle(el)
        if (!b.width || st.visibility === 'hidden' || el.closest('.sr-only') || el.classList.contains('sr-only')) continue
        if (b.height < 44 || (el.tagName !== 'INPUT' && el.tagName !== 'SELECT' && el.tagName !== 'TEXTAREA' && b.height < 48)) small.push(`${el.tagName} "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 30)}" ${Math.round(b.width)}x${Math.round(b.height)}`)
      }
    }
    const bad = [document.documentElement, ...document.body.querySelectorAll('*')].filter((e) => { const c = getComputedStyle(e).color; return c === 'rgb(0, 0, 0)' }).length
    return { overflow, small: small.slice(0, 8), black: bad, text: document.body.innerText.slice(0, 0) }
  }, vw)
  const issues = []
  if (r.overflow > 0) issues.push(`OVERFLOW ${r.overflow}px`)
  if (r.small.length) issues.push(`SMALL TARGETS: ${r.small.join('; ')}`)
  if (r.black) issues.push(`pure black text on ${r.black} elements`)
  console.log(`${issues.length ? 'FAIL' : 'ok  '} ${name}${issues.length ? '  ' + issues.join(' | ') : ''}`)
  return issues.length === 0
}

const NOENV_SCENES = [['config-missing', '/', { user: null }]]
const SCENES = [
    ['login', '/login', { user: null }],
    ['forgot', '/forgot-password', { user: null }],
    ['login-errors', '/login', { user: null }, async (p) => { await p.getByRole('button', { name: 'Sign in' }).click() }],
    ['home', '/', {}],
    ['home-loading', '/', { mode: 'slow' }],
    ['customers', '/customers', {}],
    ['customers-empty', '/customers', { mode: 'empty' }],
    ['customers-error', '/customers', { mode: 'error' }],
    ['customers-loading', '/customers', { mode: 'slow' }],
    ['customer-detail', '/customers/c1', {}],
    ['customer-new-errors', '/customers/new', {}, async (p) => { await p.getByRole('button', { name: 'Create customer' }).click() }],
    ['customer-credit-errors', '/customers/new', {}, async (p) => { await p.getByLabel('Payment terms').selectOption('credit'); await p.getByRole('textbox', { name: /^Phone/ }).fill('123'); await p.getByRole('button', { name: 'Create customer' }).click() }],
    ['site-modal', '/customers/c1', {}, async (p) => { await p.getByRole('button', { name: 'Add site' }).click(); await p.getByRole('button', { name: 'Add site' }).last().click() }],
    ['sources', '/sources', {}],
    ['source-modal', '/sources', {}, async (p) => { await p.getByRole('button', { name: 'New source' }).click() }],
    ['routes', '/routes', {}],
    ['route-detail', '/routes/r1', {}],
    ['change-price', '/routes/r1', {}, async (p) => { await p.getByRole('button', { name: 'Change price' }).click(); await p.getByLabel('Customer price per trip').fill('325000') }],
    ['route-new', '/routes/new', {}, async (p) => { await p.getByRole('button', { name: 'Create route' }).click() }],
    ['diesel', '/diesel', {}],
    ['diesel-modal', '/diesel', {}, async (p) => { await p.getByRole('button', { name: 'Record price' }).click(); await p.getByLabel('Pump price per litre').fill('1800') }],
    ['trucks', '/trucks', {}],
    ['truck-detail', '/trucks/t1', {}],
    ['truck-new-errors', '/trucks/new', {}, async (p) => { await p.getByLabel('Owner type').selectOption('partner'); await p.getByRole('button', { name: 'Add truck' }).click() }],
    ['drivers', '/drivers', {}],
    ['driver-edit', '/drivers/d1/edit', {}],
    ['users', '/users', {}],
    ['users-enable', '/users', {}, async (p) => { await p.getByRole('button', { name: 'Enable access' }).first().click(); await p.getByRole('button', { name: 'Enable access' }).last().click() }],
    ['more-sheet', '/', {}, async (p) => { const m = p.getByRole('button', { name: 'More' }); if (await m.isVisible()) await m.click() }],
    ['dispatcher-customers', '/customers', { user: 'disp' }],
    ['dispatcher-users-blocked', '/users', { user: 'disp' }],
    ['driver-home', '/', { user: 'drv' }],
]

;(async () => {
  fs.rmSync(OUT, { recursive: true, force: true })
  fs.mkdirSync(OUT, { recursive: true })
  console.log('building test bundles...')
  build(path.join(TMP, 'dist-test'), { VITE_SUPABASE_URL: 'https://test.supabase.co', VITE_SUPABASE_ANON_KEY: 'test-anon' })
  build(path.join(TMP, 'dist-noenv'), { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' })
  const launch = process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {}
  const browser = await chromium.launch(launch)
  const only = (process.env.SCENES || '').split(',').filter(Boolean)
  let failed = 0
  for (const dist of ['dist-noenv', 'dist-test']) {
    const srv = await serve(path.join(TMP, dist), 4173)
    const scenes = (dist === 'dist-noenv' ? NOENV_SCENES : SCENES).filter(([n]) => !only.length || only.includes(n))
    for (const [name, url, opts, act] of scenes) {
      for (const vw of [360, 1280]) for (const theme of ['light', 'dark']) {
        const ctx = await browser.newContext({ viewport: { width: vw, height: 800 }, deviceScaleFactor: vw === 360 ? 2 : 1, colorScheme: theme })
        const page = await ctx.newPage()
        const errs = []
        page.on('pageerror', (e) => errs.push(e.message))
        await setup(page, { ...opts, theme: 'system' })
        await page.goto('http://localhost:4173' + url)
        await page.waitForTimeout(600)
        if (act) { try { await act(page) } catch (e) { errs.push('action: ' + e.message.split('\n')[0]) } await page.waitForTimeout(400) }
        const ok = await audit(page, `${name} @${vw} ${theme}`, vw)
        if (errs.length) console.log('   JS ERRORS:', errs.join(' / '))
        if (!ok || errs.length) failed++
        await page.screenshot({ path: path.join(OUT, `${name}-${vw}-${theme}.png`), fullPage: true })
        await ctx.close()
      }
    }
    await new Promise((r) => srv.close(r))
  }
  await browser.close()
  fs.rmSync(TMP, { recursive: true, force: true })
  console.log(failed ? `\n${failed} FAILURES` : '\nALL SCENES PASSED')
  process.exit(failed ? 1 : 0)
})()
