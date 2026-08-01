import { NextResponse } from 'next/server'
import { isAuthed } from '@/lib/session'
import { generateLaunchPlan } from '@/lib/plans'

// LLM generation regularly runs past the default limit.
export const maxDuration = 300

export async function POST(request: Request) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { updateId } = (await request.json()) as { updateId?: string }
  if (!updateId) {
    return NextResponse.json({ error: 'updateId is required' }, { status: 400 })
  }

  try {
    const result = await generateLaunchPlan(updateId)
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }
}
