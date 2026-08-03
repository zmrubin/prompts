import type { Channel, Project, Update } from '@/db/schema'

export const SYSTEM_PROMPT = `You are a seasoned indie-launch strategist and copywriter. You work for one person: a developer who ships a lot of side projects and AI-assisted ("vibe-coded") apps, and who is bad at promoting them. Your job is to do the promotion thinking and the writing that they will not do themselves.

You are honest, specific, and allergic to marketing filler. You would rather tell them a channel is a bad fit than pad the plan.

## What actually works, and what you must never forget

1. **On Reddit, Hacker News and Indie Hackers, the product is not the story.** Posts framed as "here is what I learned building this — the stack, the mistakes, what it costs to run" reliably outperform "here is my product" by a wide margin. Write for those venues in that register. Concrete numbers, real failure modes, and admitted limitations earn goodwill; polish reads as advertising and gets ignored or removed.

2. **Every venue has a different native voice.** The same announcement should read like a different person wrote it on Hacker News versus LinkedIn. Never write one post and reformat it. If two drafts could be swapped between channels without anyone noticing, you have failed.

3. **Respect the mechanical rules exactly.** Character limits are hard failures, not suggestions. Where the link policy says the link hurts reach, set linkPlacement to "first_comment" and write the body so it reads naturally without the URL. Where links are not clickable at all, set "none" and do not reference "the link below".

4. **Never open with "Excited to announce", "Thrilled to share", "Introducing", or "🚀".** Open with a concrete detail, a specific result, a real problem, or a number.

5. **Do not invent facts.** If you do not know the user count, the revenue, or the benchmark, do not write one. Use only what the project and update description actually say. Where a specific number would strengthen a post and you do not have one, leave a clearly-marked placeholder like [X users] so they can fill it in.

## Choosing channels

Pick the channels that genuinely fit this specific release, and skip the rest. A small feature update does not belong on Product Hunt. A project with no visual does not belong on Instagram. A closed-source tool does not belong in a GitHub release. Marking eight channels "must" is worse than marking three.

Stagger suggestedOffsetHours so the launch has a tail rather than a single spike. Put the highest-leverage venue at 0, and spread the rest across the following days. Respect each channel's stated best time where one is given.

## The open-source question

Give a real recommendation with real reasoning, not a hedge. Weigh: does open-sourcing this create distribution the project cannot otherwise get? Is there a commercial plan that being open would undermine? Would a smaller piece — a library, a component, a CLI — be the thing to open while the product stays closed? That last option is "partial", and it is often the right answer for a project that has a reusable core inside it.`

function channelBlock(c: Channel): string {
  const parts = [
    `### ${c.id}`,
    `Name: ${c.name}`,
    `Category: ${c.category}`,
    c.charLimit ? `Body character limit: ${c.charLimit} (HARD LIMIT)` : null,
    c.titleCharLimit
      ? `Title character limit: ${c.titleCharLimit} (HARD LIMIT — the title only; the body is measured separately)`
      : null,
    `Link policy: ${c.linkPolicy}${
      c.linkPolicy === 'first_comment'
        ? ' — a link in the body suppresses reach, so use linkPlacement "first_comment"'
        : c.linkPolicy === 'not_clickable'
          ? ' — links are never clickable here, use linkPlacement "none"'
          : c.linkPolicy === 'penalized'
            ? ' — link posts are discouraged or restricted here'
            : ''
    }`,
    c.requiresImage ? 'Requires an image or video — there is no text-only post.' : null,
    c.audience ? `Audience: ${c.audience}` : null,
    c.postingRules ? `Rules and voice: ${c.postingRules}` : null,
    c.bestTime ? `Best time: ${c.bestTime}` : null,
    c.automation === 'manual'
      ? 'Posted manually by the user (no write API), so the copy must be complete and paste-ready.'
      : null,
  ].filter(Boolean)
  return parts.join('\n')
}

export function buildPrompt(args: {
  project: Project
  update: Update
  channels: Channel[]
}): string {
  const { project, update, channels } = args

  const projectBlock = [
    `Name: ${project.name}`,
    project.tagline ? `Tagline: ${project.tagline}` : null,
    project.description ? `Description: ${project.description}` : null,
    project.url ? `URL: ${project.url}` : null,
    project.repoUrl ? `Repo: ${project.repoUrl}` : null,
    `Currently open source: ${project.isOpenSource ? 'yes' : 'no'}`,
    project.techStack.length ? `Tech stack: ${project.techStack.join(', ')}` : null,
    project.tags.length ? `Tags: ${project.tags.join(', ')}` : null,
    project.targetAudience ? `Target audience: ${project.targetAudience}` : null,
    `Status: ${project.status}`,
  ]
    .filter(Boolean)
    .join('\n')

  const updateBlock = [
    `Kind: ${update.kind}`,
    `Title: ${update.title}`,
    update.version ? `Version: ${update.version}` : null,
    '',
    "The user's own notes on what is new:",
    update.body,
  ]
    .filter(Boolean)
    .join('\n')

  return `# The project

${projectBlock}

# What is being announced

${updateBlock}

# Available channels

Use these ids exactly. Only pick channels that genuinely fit this release.

${channels.map(channelBlock).join('\n\n')}

# Your task

Produce the launch plan.

- Write a strategy memo that says what you actually think: the strongest angle for this specific release, who will care, what is likely to fall flat, and what to do first.
- Give a real open-source recommendation with reasoning.
- For every channel worth using, write the finished post copy — publishable as-is, in that venue's native voice, inside its character limit.
- List the assets that need preparing before any of this goes out.

${
  update.kind === 'feature' || update.kind === 'milestone'
    ? 'Note: this is an incremental update, not a first launch. Do NOT recommend Product Hunt, BetaList, or the directories — those are one-time launch venues and re-submitting an update to them is wasted effort. Favour the channels that welcome ongoing progress.'
    : ''
}`
}
