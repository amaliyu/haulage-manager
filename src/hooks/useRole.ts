import { useProfile } from './useAuth'
import type { Role } from '@/services/profiles'

export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Admin',
  dispatcher: 'Dispatcher',
  finance: 'Finance',
  driver: 'Driver',
}

/** Role checks for UI decisions. The database (RLS) is the real enforcement. */
export function useRole() {
  const profile = useProfile()
  const role = profile.role
  return {
    role,
    label: ROLE_LABEL[role],
    is: (...roles: Role[]) => roles.includes(role),
    /** Step 1: only admins write master data. */
    canWriteMasterData: role === 'admin',
    canManageUsers: role === 'admin',
  }
}
