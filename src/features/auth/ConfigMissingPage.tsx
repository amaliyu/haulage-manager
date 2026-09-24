import { AuthLayout } from './AuthLayout'

export function ConfigMissingPage({ missing }: { missing: string[] }) {
  return (
    <AuthLayout title="App not configured" intro="This build cannot reach its database. An administrator needs to set:">
      <ul className="flex flex-col gap-2">
        {missing.map((m) => (
          <li key={m} className="num rounded border border-line bg-surface-2 px-3 py-2 font-semibold">
            {m}
          </li>
        ))}
      </ul>
      <p className="mt-4 text-small text-ink-2">
        Locally: copy .env.example to .env and fill it in. On Vercel: Project → Settings → Environment Variables, then redeploy.
      </p>
    </AuthLayout>
  )
}
