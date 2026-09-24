import { useRole } from '@/hooks/useRole'
import { DriverHomePage } from './DriverHomePage'
import { StaffHomePage } from './StaffHomePage'

/** Route the landing screen by role. */
export function HomePage() {
  const { role } = useRole()
  return role === 'driver' ? <DriverHomePage /> : <StaffHomePage />
}
