import type { Config } from 'tailwindcss'

// Every colour is a CSS variable defined in src/index.css. Never add a literal
// colour here or in a component. See DESIGN.md.
const token = (name: string) => `var(--${name})`

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  // StatusPill builds `pill-${tone}` dynamically.
  safelist: ['pill-ok', 'pill-warn', 'pill-danger', 'pill-info', 'pill-accent', 'pill-neutral'],
  theme: {
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      white: token('on-brand'),
      'on-danger': token('on-danger'),
      ink: { DEFAULT: token('ink'), 2: token('ink-2'), 3: token('ink-3') },
      line: token('line'),
      surface: { DEFAULT: token('surface'), 2: token('surface-2') },
      panel: token('panel'),
      brand: { DEFAULT: token('brand'), ink: token('brand-ink') },
      accent: token('accent'),
      ok: token('ok'),
      warn: token('warn'),
      danger: token('danger'),
      info: token('info'),
    },
    // Spacing scale: 4, 8, 12, 16, 24, 32, 48 only, plus fixed control sizes.
    spacing: {
      0: '0',
      px: '1px',
      1: '4px',
      2: '8px',
      3: '12px',
      4: '16px',
      6: '24px',
      8: '32px',
      12: '48px',
      row: '40px',
      input: '44px',
      touch: '48px',
      cta: '52px',
      sidebar: '240px',
      header: '56px',
      nav: '64px',
    },
    borderRadius: {
      none: '0',
      DEFAULT: '4px',
      panel: '8px',
    },
    boxShadow: {
      none: 'none',
      overlay: token('shadow-overlay'),
    },
    fontFamily: {
      display: ['Archivo', 'system-ui', 'sans-serif'],
      sans: ['"Inter Tight"', 'system-ui', 'sans-serif'],
    },
    fontSize: {
      micro: ['0.6875rem', { lineHeight: '1.2', letterSpacing: '0.08em' }],
      small: ['0.8125rem', { lineHeight: '1.45' }],
      body: ['0.9375rem', { lineHeight: '1.45' }],
      section: ['1.125rem', { lineHeight: '1.15' }],
      title: ['1.375rem', { lineHeight: '1.15' }],
      metric: ['1.75rem', { lineHeight: '1.15' }],
    },
    extend: {
      maxWidth: { content: '1200px' },
      minHeight: { touch: '48px' },
      minWidth: { touch: '48px' },
      zIndex: { nav: '30', overlay: '40', toast: '50' },
    },
  },
  plugins: [],
} satisfies Config
