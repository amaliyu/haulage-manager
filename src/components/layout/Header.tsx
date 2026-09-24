import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LogOut, Monitor, Moon, Sun } from 'lucide-react'
import { useAuth, useProfile } from '@/hooks/useAuth'
import { ROLE_LABEL } from '@/hooks/useRole'
import { useTheme } from '@/hooks/useTheme'
import { ConfirmDialog } from '@/components/ui'

export function Header() {
  const profile = useProfile()
  const { signOut } = useAuth()
  const { choice, cycle } = useTheme()
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)

  const ThemeIcon = choice === 'dark' ? Moon : choice === 'light' ? Sun : Monitor
  const themeLabel = choice === 'dark' ? 'Dark' : choice === 'light' ? 'Light' : 'Auto'

  return (
    <header className="sticky top-0 z-nav h-header border-b border-line bg-panel">
      <div className="mx-auto flex h-full max-w-content items-center gap-2 pl-4 pr-1 sm:pl-6 sm:pr-3">
        <Link to="/" className="flex h-touch shrink-0 items-center gap-2 no-underline md:hidden" aria-label="Haulage Manager home">
          <span className="block h-6 w-1 rounded bg-brand" aria-hidden />
          <span className="font-display text-body font-bold">Haulage</span>
        </Link>
        <div className="ml-auto flex min-w-0 items-center gap-2">
          <div className="flex min-w-0 flex-col items-end leading-tight">
            <span className="max-w-[140px] truncate text-small font-semibold sm:max-w-[240px]">{profile.full_name}</span>
            <span className="micro-label">{ROLE_LABEL[profile.role]}</span>
          </div>
          <button
            type="button"
            onClick={cycle}
            className="flex h-touch min-w-touch items-center justify-center gap-1 rounded px-2 text-ink-2 hover:bg-surface-2 hover:text-ink"
            aria-label={`Theme: ${themeLabel}. Change theme`}
            title={`Theme: ${themeLabel}`}
          >
            <ThemeIcon size={20} strokeWidth={1.5} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setConfirm(true)}
            className="flex h-touch min-w-touch items-center justify-center gap-2 rounded px-2 font-display text-small font-semibold text-ink-2 hover:bg-surface-2 hover:text-ink"
          >
            <LogOut size={20} strokeWidth={1.5} aria-hidden />
            <span className="sr-only sm:not-sr-only">Sign out</span>
          </button>
        </div>
      </div>
      <ConfirmDialog
        open={confirm}
        title="Sign out?"
        message={`You will need your email and password to sign back in as ${profile.full_name}.`}
        confirmLabel="Sign out"
        tone="primary"
        loading={busy}
        onClose={() => setConfirm(false)}
        onConfirm={async () => {
          setBusy(true)
          await signOut()
        }}
      />
    </header>
  )
}
