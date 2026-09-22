import { NavLink } from 'react-router-dom'
import { cn } from '@/components/ui'
import type { NavItem } from './nav'

export function Sidebar({ items }: { items: NavItem[] }) {
  return (
    <aside className="sticky top-0 hidden h-dvh w-sidebar shrink-0 flex-col border-r border-line bg-panel md:flex">
      <div className="flex h-header items-center gap-2 border-b border-line px-4">
        <span className="block h-6 w-1 rounded bg-brand" aria-hidden />
        <span className="font-display text-body font-bold">Haulage Manager</span>
      </div>
      <nav aria-label="Main" className="flex flex-col gap-1 p-2">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              cn(
                'flex min-h-touch items-center gap-3 rounded border-l-2 px-3 font-display text-body font-semibold no-underline',
                isActive ? 'border-l-brand bg-surface-2 text-ink' : 'border-l-transparent text-ink-2 hover:bg-surface-2 hover:text-ink',
              )
            }
          >
            <item.icon size={20} strokeWidth={1.5} aria-hidden />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
