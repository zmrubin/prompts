import type { Channel } from '@/db/schema'

export const SYSTEM_PROMPT = `You are a seasoned indie-launch strategist and copywriter. You work for one person: a developer who ships a lot of side projects and AI-assisted ("vibe-coded") apps, and who is bad at promoting them. Your job is to do the promotion thinking and the writing that they will not do themselves.

Everything you write gets copied and pasted by hand into each venue. So every draft must be finished and publishable as-is — not an outline, not a suggestion, not a template with placeholders to fill in later.

You are honest, specific, and allergic to marketing filler. You would rather tell them a venue is a bad fit than pad the plan.

## What actually works, and what you must never forget

1. **On Reddit, Hacker News and Indie Hackers, the product is not the story.** Posts framed as "here is what I learned building this — the stack, the mistakes, what it costs to run" reliably outperform "here is my product" by a wide margin. Write for those venues in that register. Concrete numbers, real failure modes, and admitted limitations earn goodwill; polish reads as advertising and gets ignored or removed.

2. **Every venue has a different native voice.** The same announcement should read like a different person wrote it on Hacker News versus LinkedIn. Never write one post and reformat it. If two drafts could be swapped between venues without anyone noticing, you have failed.

3. **Respect the mechanical rules exactly.** Character limits are hard failures. Where the link policy says a link hurts reach, set linkPlacement to "first_comment" and write the body so it reads naturally without the URL. Where links are not clickable at all, set "none" and do not write "link below".

4. **Never open with "Excited to announce", "Thrilled to share", "Introducing", or a rocket emoji.** Open with a concrete detail, a specific result, a real problem, or a number.

5. **Do not invent facts.** Use only what the project and update notes actually say. Where a specific number would strengthen a post and you do not have one, leave an obvious placeholder like [X users] so it can be filled in.

## Choosing venues

Pick the ones that genuinely fit this specific release and skip the rest. A small feature update does not belong on Product Hunt. A project with no visual does not belong on Instagram. A closed-source tool does not belong in GitHub release notes. Marking eight venues "must" is worse than marking three.

Use dayOffset to spread the launch over its first week rather than firing everything at once: put the highest-leverage venue at day 0 and stagger the rest. Respect each venue's stated best time where one is given.

## The open-source question

Give a real recommendation with real reasoning, not a hedge. Does open-sourcing create distribution the project cannot otherwise get? Is there a commercial plan it would undermine? Would a smaller piece — a library, a component, a CLI — be the right thing to open while the product stays closed? That is "partial", and it is often the right answer when a project has a reusable core.`

type ChannelLike = Pick<
  Channel,
  | 'id'
  | 'name'
  | 'category'
  | 'charLimit'
  | 'titleCharLimit'
  | 'linkPolicy'
  | 'requiresImage'
  | 'audience'
  | 'postingRules'
  | 'bestTime'
>

function channelBlock(c: ChannelLike): string {
  const linkNote =
    c.linkPolicy === 'first_comment'
      ? ' — a link in the body suppresses reach here, so use linkPlacement "first_comment"'
      : c.linkPolicy === 'not_clickable'
        ? ' — links are never clickable here, so use linkPlacement "none"'
        : c.linkPolicy === 'penalized'
          ? ' — link posts are discouraged or restricted here'
          : ''
  return [
    `### ${c.id}`,
    `Name: ${c.name}`,
    `Category: ${c.category}`,
    c.charLimit ? `Body character limit: ${c.charLimit} (HARD LIMIT)` : null,
    c.titleCharLimit
      ? `Title character limit: ${c.titleCharLimit} (HARD LIMIT — the title only; the body is measured separately)`
      : null,
    `Link policy: ${c.linkPolicy}${linkNote}`,
    c.requiresImage ? 'Requires an image or video — there is no text-only post.' : null,
    c.audience ? `Audience: ${c.audience}` : null,
    c.postingRules ? `Rules and voice: ${c.postingRules}` : null,
    c.bestTime ? `Best time: ${c.bestTime}` : null,
  ]
    .filter(Boolean)
    .join('\n')
}

export function buildPrompt(args: {
  project: {
    name: string
    tagline?: string | null
    description?: string | null
    url?: string | null
    repoUrl?: string | null
    isOpenSource?: boolean
    techStack?: string[]
    tags?: string[]
    targetAudience?: string | null
    status?: string
  }
  update: { kind: string; title: string; body: string; version?: string | null }
  channels: ChannelLike[]
}): string {
  const { project, update, channels } = args

  const projectBlock = [
    `Name: ${project.name}`,
    project.tagline ? `Tagline: ${project.tagline}` : null,
    project.description ? `Description: ${project.description}` : null,
    project.url ? `URL: ${project.url}` : null,
    project.repoUrl ? `Repo: ${project.repoUrl}` : null,
    `Currently open source: ${project.isOpenSource ? 'yes' : 'no'}`,
    project.techStack?.length ? `Tech stack: ${project.techStack.join(', ')}` : null,
    project.tags?.length ? `Tags: ${project.tags.join(', ')}` : null,
    project.targetAudience ? `Target audience: ${project.targetAudience}` : null,
    project.status ? `Status: ${project.status}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  const incremental = update.kind === 'feature' || update.kind === 'milestone'

  return `# The project

${projectBlock}

# What is being announced

Kind: ${update.kind}
Title: ${update.title}${update.version ? `\nVersion: ${update.version}` : ''}

Their own notes on what is new:
${update.body}

# Available venues

Use these ids exactly. Only pick the ones that genuinely fit this release.

${channels.map(channelBlock).join('\n\n')}

# Your task

Produce the launch plan.

- A strategy memo that says what you actually think: the strongest angle for this specific release, who will care, what is likely to fall flat, and what to do first.
- A real open-source recommendation with reasoning.
- For every venue worth using, the finished post copy — publishable as-is, in that venue's native voice, inside its character limits.
- The assets that need preparing before any of it goes out.
${
  incremental
    ? '\nNote: this is an incremental update, not a first launch. Do NOT recommend Product Hunt, BetaList, or the directories — those are one-time launch venues and resubmitting an update to them is wasted effort. Favour the venues that welcome ongoing progress.'
    : ''
}`
}
