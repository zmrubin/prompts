import { requireAuth } from '@/lib/session'
import { GenerateRunner } from './runner'

export default async function GeneratePage({
  params,
}: {
  params: Promise<{ updateId: string }>
}) {
  await requireAuth()
  const { updateId } = await params
  return <GenerateRunner updateId={updateId} />
}
