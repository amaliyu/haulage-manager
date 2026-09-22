import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react'
import { cn } from './cn'
import { toAppError } from '@/lib/errors'

type ToastKind = 'success' | 'error' | 'info'
type ToastItem = { id: number; kind: ToastKind; message: string }

type ToastApi = {
  success: (message: string) => void
  error: (messageOrError: unknown, fallback?: string) => void
  info: (message: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((t) => t.id !== id)), [])

  const push = useCallback(
    (kind: ToastKind, message: string) => {
      const id = nextId.current++
      setItems((xs) => [...xs.slice(-2), { id, kind, message }])
      window.setTimeout(() => dismiss(id), kind === 'error' ? 7000 : 4000)
    },
    [dismiss],
  )

  const api = useMemo<ToastApi>(
    () => ({
      success: (m) => push('success', m),
      info: (m) => push('info', m),
      error: (e, fallback) => push('error', typeof e === 'string' ? e : toAppError(e, fallback).message),
    }),
    [push],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-toast flex flex-col items-center gap-2 px-4 pb-[calc(env(safe-area-inset-bottom)+80px)] md:items-end md:pb-6 md:pr-6"
        aria-live="polite"
      >
        {items.map((t) => (
          <div
            key={t.id}
            role={t.kind === 'error' ? 'alert' : 'status'}
            className={cn(
              'pointer-events-auto flex w-full max-w-[420px] items-start gap-2 rounded border border-line border-l-2 bg-panel py-2 pl-3 pr-1 shadow-overlay',
              t.kind === 'success' && 'border-l-ok',
              t.kind === 'error' && 'border-l-danger',
              t.kind === 'info' && 'border-l-info',
            )}
          >
            {t.kind === 'success' && <CheckCircle2 size={20} strokeWidth={1.5} className="mt-1 shrink-0 text-ok" aria-hidden />}
            {t.kind === 'error' && <AlertTriangle size={20} strokeWidth={1.5} className="mt-1 shrink-0 text-danger" aria-hidden />}
            {t.kind === 'info' && <Info size={20} strokeWidth={1.5} className="mt-1 shrink-0 text-info" aria-hidden />}
            <p className="flex-1 py-1 text-body text-ink">
              <span className="sr-only">{t.kind === 'error' ? 'Error: ' : t.kind === 'success' ? 'Done: ' : ''}</span>
              {t.message}
            </p>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="flex h-touch w-touch shrink-0 items-center justify-center rounded text-ink-3 hover:text-ink"
              aria-label="Dismiss"
            >
              <X size={20} strokeWidth={1.5} aria-hidden />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}
