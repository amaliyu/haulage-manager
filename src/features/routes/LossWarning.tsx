import { AlertTriangle } from 'lucide-react'
import { formatNaira } from '@/lib/format'

/** Shown after a save attempt at a loss; the next save confirms it. */
export function LossWarning({ margin }: { margin: number }) {
  return (
    <div role="alert" className="flex items-start gap-2 rounded-panel border border-line border-l-2 border-l-danger bg-panel p-4">
      <AlertTriangle size={20} strokeWidth={1.5} className="mt-px shrink-0 text-danger" aria-hidden />
      <div>
        <p className="font-semibold text-ink">This price makes a loss of {formatNaira(-margin)} per trip.</p>
        <p className="text-small text-ink-2">Costs are more than the customer price. Check the figures, or tap “Save at a loss” to keep them.</p>
      </div>
    </div>
  )
}
