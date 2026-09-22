import type { ReactNode } from 'react'

/** Plain working layout for signed-out screens: brand bar, then the form. */
export function AuthLayout({ title, intro, children }: { title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-surface">
      <div className="border-b border-line bg-panel">
        <div className="mx-auto flex h-header max-w-content items-center gap-2 px-4 sm:px-6">
          <span className="block h-6 w-1 rounded bg-brand" aria-hidden />
          <span className="font-display text-body font-bold">Haulage Manager</span>
          <span className="micro-label ml-auto hidden sm:inline">Tipper dispatch · Abuja</span>
        </div>
      </div>
      <main className="mx-auto max-w-content px-4 py-6 sm:px-6 sm:py-12">
        <div className="max-w-[420px]">
          <h1 className="text-title">{title}</h1>
          {intro && <div className="mt-2 text-body text-ink-2">{intro}</div>}
          <div className="mt-6 rounded-panel border border-line bg-panel p-4 sm:p-6">{children}</div>
        </div>
      </main>
    </div>
  )
}
