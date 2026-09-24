import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { AccessNotEnabledPage } from '@/features/auth/AccessNotEnabledPage'
import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage'
import { RequireAuth, RequireRole } from '@/features/auth/Guards'
import { LoginPage } from '@/features/auth/LoginPage'
import { ResetPasswordPage } from '@/features/auth/ResetPasswordPage'
import { CustomerDetailPage } from '@/features/customers/CustomerDetailPage'
import { CustomerFormPage } from '@/features/customers/CustomerFormPage'
import { CustomerListPage } from '@/features/customers/CustomerListPage'
import { DieselPage } from '@/features/diesel/DieselPage'
import { DriverFormPage } from '@/features/drivers/DriverFormPage'
import { DriverListPage } from '@/features/drivers/DriverListPage'
import { HomePage } from '@/features/home/HomePage'
import { NotFoundPage } from '@/features/home/NotFoundPage'
import { RouteDetailPage } from '@/features/routes/RouteDetailPage'
import { RouteFormPage } from '@/features/routes/RouteFormPage'
import { RouteListPage } from '@/features/routes/RouteListPage'
import { SourceListPage } from '@/features/sources/SourceListPage'
import { TruckDetailPage } from '@/features/trucks/TruckDetailPage'
import { TruckFormPage } from '@/features/trucks/TruckFormPage'
import { TruckListPage } from '@/features/trucks/TruckListPage'
import { UsersPage } from '@/features/users/UsersPage'

const STAFF = ['admin', 'dispatcher', 'finance'] as const
const ADMIN = ['admin'] as const

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  { path: '/access-not-enabled', element: <AccessNotEnabledPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <HomePage /> },
          {
            element: <RequireRole roles={[...STAFF]} />,
            children: [
              { path: 'customers', element: <CustomerListPage /> },
              { path: 'customers/:id', element: <CustomerDetailPage /> },
              { path: 'sources', element: <SourceListPage /> },
              { path: 'routes', element: <RouteListPage /> },
              { path: 'routes/:id', element: <RouteDetailPage /> },
              { path: 'diesel', element: <DieselPage /> },
              { path: 'trucks', element: <TruckListPage /> },
              { path: 'trucks/:id', element: <TruckDetailPage /> },
              { path: 'drivers', element: <DriverListPage /> },
            ],
          },
          {
            element: <RequireRole roles={[...ADMIN]} />,
            children: [
              { path: 'customers/new', element: <CustomerFormPage /> },
              { path: 'customers/:id/edit', element: <CustomerFormPage /> },
              { path: 'routes/new', element: <RouteFormPage /> },
              { path: 'routes/:id/edit', element: <RouteFormPage /> },
              { path: 'trucks/new', element: <TruckFormPage /> },
              { path: 'trucks/:id/edit', element: <TruckFormPage /> },
              { path: 'drivers/new', element: <DriverFormPage /> },
              { path: 'drivers/:id/edit', element: <DriverFormPage /> },
              { path: 'users', element: <UsersPage /> },
            ],
          },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])

export function App() {
  return <RouterProvider router={router} />
}
