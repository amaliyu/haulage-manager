import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import { App } from './App'
import { ToastProvider } from '@/components/ui'
import { AuthProvider } from '@/hooks/useAuth'
import { initTheme } from '@/hooks/useTheme'
import { missingEnv } from '@/lib/env'
import { ConfigMissingPage } from '@/features/auth/ConfigMissingPage'
import type { AppError } from '@/lib/errors'

initTheme()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: true,
      retry: (count, err) => {
        const code = (err as AppError | undefined)?.code
        // Permission and not-found errors will not fix themselves.
        if (code === '42501' || code === 'PGRST116') return false
        return count < 2
      },
    },
    mutations: { retry: false },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {missingEnv.length ? (
      <ConfigMissingPage missing={missingEnv} />
    ) : (
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ToastProvider>
      </QueryClientProvider>
    )}
  </StrictMode>,
)
