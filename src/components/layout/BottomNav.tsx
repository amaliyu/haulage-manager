import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { cn } from '@/components/ui'
import type { NavItem } from './nav'

const tab =
  'flex h-nav min-w-0 flex-1 flex-col items-center justify-center gap-1 border-t-2 font-display text-micro font-semibold no-underline'

export function BottomNav({ items }: { items: NavItem[] }) {
  const primary = items.filter((i) => i.primary)
  const more = items.filter((i) => !i.primary)
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const moreActive = more.some((i) => pathname.startsWith(i.to))

  useEffect(() => setOpen(false), [pathname])

  if (items.length <= 1) return null

  return (
    <>
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-nav border-t border-line bg-panel pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <div className="flex">
          {primary.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(tab, isActive ? 'border-t-brand text-ink' : 'border-t-transparent text-ink-3')
              }
            >
              <item.icon size={20} strokeWidth={1.5} aria-hidden />
              <span className="truncate">{item.label}</span>
            </NavLink>
          ))}
          {more.length > 0 && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-expanded={open}
              className={cn(tab, moreActive ? 'border-t-brand text-ink' : 'border-t-transparent text-ink-3')}
            >
              <Menu size={20} strokeWidth={1.5} aria-hidden />
              <span>More</span>
            </button>
          )}
        </div>
      </nav>
      {open &&
        createPortal(
          <div className="fixed inset-0 z-overlay md:hidden">
            <div className="scrim absolute inset-0" onClick={() => setOpen(false)} aria-hidden />
            <div
              role="dialog"
              aria-modal="true"
              aria-label="More"
              className="absolute inset-x-0 bottom-0 rounded-panel rounded-b-none border border-line bg-panel pb-[env(safe-area-inset-bottom)] shadow-overlay"
            >
              <div className="flex items-center justify-between border-b border-line py-1 pl-4 pr-1">
                <h2 className="text-section">More</h2>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="flex h-touch w-touch items-center justify-center rounded text-ink-2"
                >
                  <X size={20} strokeWidth={1.5} aria-hidden />
                </button>
              </div>
              <ul className="p-2">
                {more.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      className={({ isActive }) =>
                        cn(
                          'flex min-h-touch items-center gap-3 rounded border-l-2 px-3 font-display text-body font-semibold no-underline',
                          isActive ? 'border-l-brand bg-surface-2' : 'border-l-transparent',
                        )
                      }
                    >
                      <item.icon size={20} strokeWidth={1.5} aria-hidden />
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
