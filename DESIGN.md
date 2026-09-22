# Haulage Manager — house UI rules

Source: the `apcl-app-ui` house style shared across Muktar's business apps, merged with the Haulage Manager Step 1 brief. Every screen follows this file. If a request conflicts with it, follow the request and record what changed in the PR.

## Feel

An industrial control panel for Nigerian construction and haulage. It is dense, high-contrast and confident. It is used outdoors in sunlight on cheap Android phones by dispatchers, drivers, finance officers and the MD. It is an operations tool, not a marketing site.

## Banned — never ship

- Indigo, violet or purple primaries, and gradients of any kind.
- Untouched shadcn/ui or Material defaults. This codebase uses neither; all primitives live in `src/components/ui`.
- Emoji used as icons.
- Glassmorphism, blurred or translucent panels, neon glows, animated blobs.
- Cards nested inside cards, or a card wrapped around every element.
- `rounded-2xl` + `shadow-lg` on everything. Elevation comes from borders and background steps.
- Centred marketing hero sections.
- Pure black text or pure white page backgrounds.
- Lorem ipsum, fake logos, placeholder avatars.

## Colour tokens

These are defined once as CSS variables on `:root` in `src/index.css` and exposed through `tailwind.config.ts`. A literal colour value never appears in a component.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--ink` | #14110F | #F5F0E8 | primary text |
| `--ink-2` | #453F3A | #CFC6BB | secondary text |
| `--ink-3` | #7A716A | #9C9288 | muted text, labels |
| `--line` | #DCD5CC | #3A342F | borders, dividers |
| `--surface` | #FAF7F2 | #14120F | page background |
| `--surface-2` | #F2EDE5 | #24201C | table headers, raised rows |
| `--panel` | #FFFFFF | #1C1917 | content panels only |
| `--brand` | #B4531A | #B4531A | laterite orange, primary actions (fills and borders, not text on dark) |
| `--brand-ink` | #8A3E12 | #9A4515 | hover and pressed |
| `--accent` | #1F4D3D | #5FA88C | deep green, secondary emphasis |
| `--ok` | #2F6B3A | #6DB27A | status only |
| `--warn` | #A8720C | #D9A23A | status only |
| `--danger` | #9B2C21 | #E0685B | status only, destructive |
| `--info` | #2C5670 | #6FA3C4 | status only |

Dark mode redefines the same variables in two places:

- under `@media (prefers-color-scheme: dark)`, guarded by `:root:not([data-theme="light"])`;
- again under `:root[data-theme="dark"]`.

The header theme switch sets `data-theme`. Status colours carry status only, and always alongside a word.

The brand hue is unchanged in dark mode so white button text keeps at least 5:1 contrast. Brand orange is never used as text on the dark surface. Links use `--ink` with an underline. Status-pill text is the status colour mixed 70/30 with `--ink`, which darkens it on light and lifts it on dark, so pill text clears 4.5:1 in both themes.

## Type

- **Archivo** 600/700 for headings, labels, buttons and micro-labels.
- **Inter Tight** 400/500/600 for body and data.
- Every number (money, quantities, litres, dates) uses `font-variant-numeric: tabular-nums`. This is set globally on `body`.
- Scale (rem), via Tailwind classes:

  | Size | Class | Use |
  |---|---|---|
  | 0.6875 | `text-micro` | micro-label |
  | 0.8125 | `text-small` | small |
  | 0.9375 | `text-body` | body |
  | 1.125 | `text-section` | section |
  | 1.375 | `text-title` | screen title |
  | 1.75 | `text-metric` | page metric |

- Micro-labels and table headers are uppercase with 0.08em letter-spacing, in `--ink-3`.
- Line height is 1.45 for body and 1.15 for headings. No text is smaller than 0.75rem except micro-labels.

## Shape, space, depth

- Radius is 4px (`rounded`) on inputs, buttons and pills, and 8px (`rounded-panel`) on panels. Nothing larger.
- Borders are 1px `--line`. Emphasis is a 2px left border in `--brand` (`border-l-2 border-l-brand`), never a shadow.
- Exactly one shadow exists, `shadow-overlay`: `0 8px 24px rgba(20,17,15,.14)`. It is used only for Modal, Toast and the More sheet.
- The spacing scale is 4, 8, 12, 16, 24, 32, 48 only. The Tailwind spacing scale is replaced so other steps don't exist: `1`=4, `2`=8, `3`=12, `4`=16, `6`=24, `8`=32, `12`=48. The fixed control heights 44, 48 and 52 are named `h-input`, `h-touch` and `h-cta`.
- The page gutter is 16px on phones and 24px from `sm` up. Content max-width is 1200px.

## Touch and field conditions

- The minimum touch target is 48×48. Primary buttons are 52px tall on phones and 48px from `md` up.
- Driver-facing actions are full-width, one per row, with a 12px gap.
- Body text contrast is at least 7:1 against its background.
- Every destructive action has a confirm step that names the record, e.g. "Deactivate customer Julius Berger?".
- Forms are single-column on phones with labels above fields. Numeric fields use `inputMode="numeric"`, or `"decimal"` for litres and coordinates.

## Components

- **Buttons.**
  - Primary: solid `--brand`, white text, 600 weight, `--brand-ink` on hover and press.
  - Secondary: `--panel` background with a 1px `--line` border.
  - Ghost: text only, in `--ink-2`.
  - Danger: solid `--danger`.
  - Disabled: `--surface-2` background with `--ink-3` text. No opacity tricks.
- **Inputs.** 44px tall, 1px `--line` border, `--panel` background. Focus is a 2px `--brand` outline with a 2px offset. An error shows a `--danger` border *and* a message line underneath.
- **Tables.** Tables are the core of the app.
  - Rows are 40px, with 1px row dividers and no zebra striping.
  - The header is sticky, on `--surface-2`, with uppercase micro-labels.
  - Money and quantities are right-aligned with tabular numerals.
  - Below `md`, a table renders as a stacked list of bordered blocks: identity on the left, the key figure large on the right. It never scrolls horizontally.
- **Status pills.** 4px radius, 1px border in the status colour, background at 12% of it (`color-mix`), uppercase 0.6875rem text, and always the status word.
- **Metric tiles.** A micro-label above, the figure at 1.75rem in tabular numerals, context underneath in `--ink-3`. Flat and bordered.
- **List states.** Every list has all three:
  - Empty: one line of text plus the primary action.
  - Loading: skeleton rows at the real row height.
  - Error: what failed plus a Retry button. Never a full-page spinner.
- **Icons.** lucide-react only, with a 1.5 stroke. 20px in body, 16px in dense tables.

## Screen patterns

- The title row has the screen title on the left and the primary action on the right. No breadcrumb chains on phones; a single "back" link is fine.
- Filters sit directly above the list as pill toggles.
- Detail screens run in this order: identity block (name, status pill), a label/value facts grid (one column on phones, two from `sm`), then history with Africa/Lagos timestamps.
- Money displays as `₦310,000`: naira sign, thousands separators, no decimals. It is stored as integer naira.
- Dates display as "22 Sep, 4:30pm" in Africa/Lagos time, never as ISO strings. They are stored as `timestamptz` in UTC.

## Before finishing any screen

1. Render at 360px wide: no horizontal scroll, no clipped text, nothing tappable under 48px.
2. Check dark mode.
3. Confirm that no banned pattern appears.
4. Confirm every number uses tabular numerals and naira formatting.
5. Confirm every status has a word.
