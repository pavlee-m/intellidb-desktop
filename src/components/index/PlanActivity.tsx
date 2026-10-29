import { Check, Circle, ListChecks } from 'lucide-react'
import type ChatActivity, { PlanStep } from '@/interfaces/ChatActivity'
import { Spinner } from '@/components/ui/spinner'

function PlanStepMark({ status }: { status: PlanStep['status'] }) {
  switch (status) {
    case 'pending':
      return (
        <span className="mt-0.5 inline-flex shrink-0" aria-label="Pending">
          <Circle className="size-3.5" aria-hidden />
        </span>
      )
    case 'in_progress':
      return (
        <span className="mt-0.5 inline-flex shrink-0" aria-label="In progress">
          <Spinner className="size-3.5" aria-hidden />
        </span>
      )
    case 'completed':
      return (
        <span className="mt-0.5 inline-flex shrink-0" aria-label="Completed">
          <Check className="size-3.5" aria-hidden />
        </span>
      )
    default: {
      const _exhaustive: never = status
      return _exhaustive
    }
  }
}

export default function PlanActivity({
  entry,
}: {
  entry: Extract<ChatActivity, { kind: 'plan' }>
}) {
  return (
    <section className="w-full max-w-lg self-start rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-sm">
      <header className="mb-2 flex items-center gap-2 font-medium">
        <ListChecks className="size-4 shrink-0" aria-hidden />
        Plan
      </header>
      <ol className="space-y-1.5">
        {entry.steps.map((step, index) => (
          <li key={index} className="flex items-start gap-2">
            <PlanStepMark status={step.status} />
            <p className="whitespace-pre-wrap">{step.content}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}
