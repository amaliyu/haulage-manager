import { Building2, Fuel, Gauge, Mountain, Route, Truck, UserRound, Users, type LucideIcon } from 'lucide-react'
import type { Role } from '@/services/profiles'

export type NavItem = {
  to: string
  label: string
  icon: LucideIcon
  roles: Role[]
  /** Shown in the phone bottom bar; the rest go under "More". */
  primary?: boolean
}

const staff: Role[] = ['admin', 'dispatcher', 'finance']

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Home', icon: Gauge, roles: staff, primary: true },
  { to: '/customers', label: 'Customers', icon: Building2, roles: staff, primary: true },
  { to: '/routes', label: 'Routes', icon: Route, roles: staff, primary: true },
  { to: '/trucks', label: 'Trucks', icon: Truck, roles: staff, primary: true },
  { to: '/drivers', label: 'Drivers', icon: UserRound, roles: staff },
  { to: '/sources', label: 'Sources', icon: Mountain, roles: staff },
  { to: '/diesel', label: 'Diesel price', icon: Fuel, roles: staff },
  { to: '/users', label: 'Users', icon: Users, roles: ['admin'] },
]

export function navFor(role: Role): NavItem[] {
  return NAV_ITEMS.filter((i) => i.roles.includes(role))
}
