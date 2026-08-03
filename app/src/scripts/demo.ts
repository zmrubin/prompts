/**
 * Seeds a demo project with a fully-populated launch plan so every screen has
 * something to render.
 *
 * IMPORTANT: the plan text below is hand-written fixture copy, NOT model
 * output. It exists so the plan page can be reviewed without spending an API
 * call. Delete this project before using the dashboard for real:
 *
 *   npm run demo -- --reset
 */
import { oneShotDb } from '@/db'
import {
  channels,
  launchPlans,
  postDrafts,
  projects,
  scheduledPosts,
  updates,
} from '@/db/schema'
import { idempotencyKey, planSchedule } from '@/lib/schedule'
import { eq, inArray, like } from 'drizzle-orm'

const DRAFTS: Record<
  string,
  { title?: string; body: string; placement: 'body' | 'first_comment' | 'none'; offset: number; priority: 'must' | 'should' | 'optional'; rationale: string }
> = {
  hackernews: {
    title: 'Show HN: Coldbrew - a local-first RSS reader that syncs over CRDTs',
    body: "I wanted an RSS reader that worked on a plane and still had my read state correct when I landed. Existing sync either needs a server or loses writes on conflict.\n\nColdbrew keeps everything in SQLite locally and syncs read/unread state between devices as a CRDT, so offline edits merge without a central authority. Sync is peer-to-peer over a relay that never sees plaintext.\n\nWhat's genuinely hard: read state is a set that only grows, which is easy, but folder reordering is a sequence CRDT and I got that wrong twice. Writeup of the second attempt is in the repo.\n\nWhat doesn't work yet: no mobile client, and the relay is a single box I pay $5/mo for. If a few hundred people use this I'll need to think harder about that.",
    placement: 'body',
    offset: 0,
    priority: 'must',
    rationale: 'Technically substantial and the audience is exactly senior engineers who care about CRDTs.',
  },
  'reddit:sideproject': {
    title: 'Built a local-first RSS reader over 6 weekends - here is the stack and what it costs to run',
    body: "Spent about six weekends on this. Sharing the boring details because that's what I always want to read in these posts.\n\nStack: Tauri + React on the client, SQLite for local storage, a tiny Rust relay on a $5 VPS. Total running cost is $5/mo plus a domain.\n\nThe interesting problem was sync. I wanted read state to survive going offline on two devices at once, which rules out last-write-wins. Ended up with CRDTs — grow-only sets for read state, which was easy, and a sequence CRDT for folder ordering, which I rewrote twice.\n\nWhat I'd do differently: I built the UI first and retrofitted sync. That was backwards. Sync semantics should have driven the data model from day one.\n\nHappy to answer anything about the CRDT side.",
    placement: 'body',
    offset: 2,
    priority: 'must',
    rationale: 'The most permissive large sub for project shares, and the lessons framing fits its norms.',
  },
  bluesky: {
    body: "spent six weekends making an RSS reader that actually works offline\n\nread state syncs between devices as a CRDT so two devices offline at once merge cleanly instead of clobbering each other\n\n$5/mo to run. rewrote the folder-ordering CRDT twice, it was worth it",
    placement: 'body',
    offset: 0,
    priority: 'must',
    rationale: 'Understated register fits the platform, and links are not penalised here.',
  },
  mastodon: {
    body: "Coldbrew — a local-first RSS reader.\n\nEverything lives in SQLite on your machine. Read state syncs between devices as a CRDT, so going offline on two devices at once merges cleanly rather than losing writes. The relay is dumb and never sees plaintext.\n\nNo account, no tracking, no cloud dependency. Runs on $5/mo of VPS.\n\n#rss #localfirst #foss",
    placement: 'body',
    offset: 1,
    priority: 'should',
    rationale: 'Privacy and self-hosting angle lands hard with this audience.',
  },
  devto: {
    title: 'Why my offline-first sync lost data twice before I understood CRDTs',
    body: "## The problem\n\nI wanted an RSS reader where marking an article read on my laptop, offline, and on my phone, also offline, produced a correct result when both reconnected.\n\nMy first attempt was last-write-wins on a timestamp. This is wrong in a way that's easy to miss...\n\n*(full article continues — this is fixture text)*",
    placement: 'body',
    offset: 24,
    priority: 'should',
    rationale: 'The CRDT rewrite is a genuine teaching article, which is what ranks here.',
  },
  x: {
    body: "spent six weekends building an RSS reader that works offline properly\n\nread state syncs as a CRDT, so two devices offline at once merge instead of overwriting each other\n\nrewrote the folder-ordering logic twice before it was right\n\n$5/mo to run. link below",
    placement: 'first_comment',
    offset: 0,
    priority: 'should',
    rationale: 'Link goes in a reply to avoid the reach penalty on link posts.',
  },
  producthunt: {
    title: 'Coldbrew',
    body: 'A local-first RSS reader that syncs over CRDTs. Everything stays in SQLite on your machine; read state merges cleanly across devices even when both are offline. No account, no cloud, no tracking.',
    placement: 'body',
    offset: 48,
    priority: 'optional',
    rationale: 'Worth a slot, but the audience is less technical than this project rewards.',
  },
}

async function main() {
  const { db, close } = oneShotDb()

  if (process.argv.includes('--reset')) {
    const demo = await db.select().from(projects).where(like(projects.slug, 'coldbrew%'))
    for (const p of demo) await db.delete(projects).where(eq(projects.id, p.id))
    const smoke = await db.select().from(projects).where(like(projects.slug, 'smoke-%'))
    for (const p of smoke) await db.delete(projects).where(eq(projects.id, p.id))
    console.log(`Removed ${demo.length + smoke.length} demo/smoke project(s).`)
    await close()
    return
  }

  // Clear any previous run so this stays idempotent.
  const existing = await db.select().from(projects).where(like(projects.slug, 'coldbrew%'))
  for (const p of existing) await db.delete(projects).where(eq(projects.id, p.id))
  const smoke = await db.select().from(projects).where(like(projects.slug, 'smoke-%'))
  for (const p of smoke) await db.delete(projects).where(eq(projects.id, p.id))

  const [project] = await db
    .insert(projects)
    .values({
      name: 'Coldbrew',
      slug: 'coldbrew',
      tagline: 'A local-first RSS reader that syncs over CRDTs',
      description:
        'An RSS reader where everything lives in SQLite on your own machine. Read state and folder ordering sync between devices as CRDTs, so edits made offline on two devices at once merge cleanly instead of overwriting each other. The relay never sees plaintext.',
      url: 'https://coldbrew.example.com',
      repoUrl: 'https://github.com/zmrubin/coldbrew',
      status: 'launched',
      tags: ['devtool', 'localfirst', 'rss'],
      techStack: ['Tauri', 'React', 'SQLite', 'Rust'],
      isOpenSource: true,
      targetAudience: 'Developers and power users who want their data on their own machine.',
    })
    .returning()

  const [update] = await db
    .insert(updates)
    .values({
      projectId: project.id,
      kind: 'launch',
      title: 'Coldbrew 1.0',
      version: 'v1.0.0',
      body: 'First public release. Local-first RSS reader, SQLite storage, CRDT sync for read state and folder ordering. Runs on $5/mo. No mobile client yet. Rewrote the sequence CRDT twice before folder reordering was correct.',
    })
    .returning()

  const [plan] = await db
    .insert(launchPlans)
    .values({
      updateId: update.id,
      provider: 'fixture',
      model: 'hand-written-demo',
      status: 'ready',
      strategyMemo:
        "The strongest angle here is not the reader, it's the sync. \"RSS reader\" is a crowded, unexciting category and leading with it will get you ignored. Leading with \"offline edits on two devices merge correctly, here's the CRDT that does it\" gets you the Hacker News and r/SideProject audience, who will then discover it's also a good reader.\n\nThe fact that you rewrote the sequence CRDT twice is an asset, not an embarrassment. Say it plainly. On HN and Indie Hackers, admitted failure modes buy more credibility than any feature list, and it gives commenters something concrete to engage with.\n\nBiggest risk: no mobile client. Someone will ask in the first ten minutes. Answer it before they do — put it in the Show HN post itself.\n\nStart with Show HN on a Tuesday morning Eastern, then r/SideProject two hours later once you know the HN post is stable. Hold the DEV.to article until the next day; it works better as a follow-up to interest than as the opening move.\n\nProduct Hunt is optional here. The audience skews less technical than this project rewards, and a mediocre PH day costs you a launch slot you could spend better later.",
      positioning: {
        oneLiner: 'An RSS reader whose read state survives two devices being offline at once.',
        audience:
          'Developers and power users who already distrust cloud sync and would rather own their data.',
        differentiator:
          'Local-first with real CRDT merge semantics, not last-write-wins dressed up as sync.',
      },
      openSourceRec: {
        recommendation: 'partial',
        reasoning:
          "The sync layer is the reusable, interesting part and the thing people will want to read. Open-sourcing that as a standalone crate gets you the distribution and credibility that the reader alone won't, and it costs you nothing commercially because nobody pays for a CRDT library.\n\nKeep the polished client closed if you ever want to charge for it. If you have no commercial plan at all, open the whole thing — the goodwill is worth more than optionality you won't use.",
        confidence: 'medium',
      },
      assetChecklist: [
        'Screen recording, 20-30s, showing two devices offline then merging on reconnect',
        'Product Hunt gallery: 3 images at 1270x760',
        'Product Hunt tagline, 60 characters maximum',
        'README with the CRDT writeup linked from the Show HN comment',
      ],
    })
    .returning()

  const ids = Object.keys(DRAFTS)
  const chans = await db.select().from(channels).where(inArray(channels.id, ids))

  const drafts = await db
    .insert(postDrafts)
    .values(
      chans.map((c) => {
        const d = DRAFTS[c.id]
        return {
          launchPlanId: plan.id,
          channelId: c.id,
          priority: d.priority,
          title: d.title ?? null,
          body: d.body,
          linkUrl: project.url,
          linkPlacement: d.placement,
          rationale: d.rationale,
          suggestedOffsetHours: d.offset,
        }
      }),
    )
    .returning()

  // Schedule them so the queue has content, starting an hour out.
  const spacing = new Map(chans.map((c) => [c.id, c.minSpacingMinutes]))
  const draftMeta = new Map(drafts.map((d) => [d.id, d]))
  const slots = planSchedule(
    drafts.map((d) => ({
      draftId: d.id,
      channelId: d.channelId,
      offsetHours: draftMeta.get(d.id)!.suggestedOffsetHours,
      minSpacingMinutes: spacing.get(d.channelId) ?? 60,
    })),
    new Date(Date.now() + 3600_000),
  )

  await db
    .insert(scheduledPosts)
    .values(
      slots.map((s) => ({
        postDraftId: s.draftId,
        channelId: s.channelId,
        scheduledFor: s.scheduledFor,
        idempotencyKey: idempotencyKey(s.draftId, s.scheduledFor),
      })),
    )
    .onConflictDoNothing()

  console.log(`Demo project "${project.name}" created with ${drafts.length} drafts scheduled.`)
  console.log('Plan text is hand-written fixture copy, not model output.')
  console.log('Remove it with: npm run demo -- --reset')

  await close()
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err)
    process.exit(1)
  },
)
