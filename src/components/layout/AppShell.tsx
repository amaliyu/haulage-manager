import { Outlet } from 'react-router-dom'
import { useProfile } from '@/hooks/useAuth'
import { cn } from '@/components/ui'
import { BottomNav } from './BottomNav'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { navFor } from './nav'

export function AppShell() {
  const profile = useProfile()
  const items = navFor(profile.role)
  const hasNav = items.length > 1

  return (
    <div className="flex min-h-dvh">
      {hasNav && <Sidebar items={items} />}
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main
          id="main"
          className={cn(
            'mx-auto w-full max-w-content flex-1 px-4 pt-4 sm:px-6 sm:pt-6',
            hasNav ? 'pb-[calc(env(safe-area-inset-bottom)+96px)] md:pb-12' : 'pb-12',
          )}
        >
          <Outlet />
        </main>
      </div>
      {hasNav && <BottomNav items={items} />}
    </div>
  )
}
