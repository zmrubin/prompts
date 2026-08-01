import { requireAuth } from '@/lib/session'
import { getLlmKeys, getSettings } from '@/lib/settings'
import { listConnections } from '@/lib/connections'
import { connectableConnectors } from '@/connectors/registry'
import { PROVIDERS } from '@/llm/providers'
import { env } from '@/env'
import { Card, PageHeader } from '@/components/ui'
import { LlmSettings } from './llm-settings'
import { ConnectionCard } from './connection-card'
import { DryRunToggle } from './dry-run'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  await requireAuth()

  const settings = await getSettings()
  const keys = await getLlmKeys()
  const conns = await listConnections()
  const byKey = new Map(conns.map((c) => [c.connectorKey, c]))
  const envLocked = env().DRY_RUN

  return (
    <>
      <PageHeader title="Settings" />

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          Posting safety
        </h2>
        <Card>
          <DryRunToggle dryRun={settings.dryRun} envLocked={envLocked} />
        </Card>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          Language model
        </h2>
        <LlmSettings
          provider={settings.llmProvider}
          model={settings.llmModel}
          providers={Object.values(PROVIDERS)}
          storedKeys={Object.fromEntries(
            Object.keys(PROVIDERS).map((p) => [p, Boolean(keys[p])]),
          )}
        />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          Connected accounts
        </h2>
        <Card className="mb-4 text-sm text-muted">
          <p className="prose-copy">
            Credentials are encrypted with AES-256-GCM before they touch the database and are
            never sent back to the browser. Each one is verified against the real API before it
            is saved.
          </p>
        </Card>
        <div className="space-y-3">
          {connectableConnectors().map((c) => (
            <ConnectionCard
              key={c.key}
              connectorKey={c.key}
              name={c.name}
              setupNote={c.setupNote}
              fields={[...c.credentialFields]}
              connected={byKey.get(c.key)?.status === 'connected'}
              handle={byKey.get(c.key)?.displayName ?? undefined}
            />
          ))}
        </div>
      </section>
    </>
  )
}
