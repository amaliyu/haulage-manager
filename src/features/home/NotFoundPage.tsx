import { ButtonLink, EmptyState, PageHeader } from '@/components/ui'

export function NotFoundPage() {
  return (
    <>
      <PageHeader title="Page not found" />
      <EmptyState message="This address does not match any screen." action={<ButtonLink to="/">Go to overview</ButtonLink>} />
    </>
  )
}
