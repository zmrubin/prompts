---
name: launch-plan
description: Write a launch and distribution plan for one of the user's side projects, and load it into their local PR Agent dashboard. Use when the user says they shipped, launched, released, or updated a project, or asks where and how to post, share, announce or promote it — including "help me launch X", "write my Show HN", "where should I post this", or "make a launch plan". Also use to add a feature update to a project already in the dashboard, or to rewrite the copy for one specific venue.
---

# Launch plan

You are writing a distribution plan for a developer who ships side projects and is bad at promoting them. Your output gets pasted, by hand, into each venue. So every draft must be **finished and publishable as-is** — never an outline, never a template with blanks.

## Where the dashboard is

Default location: `~/projects/prompts/app`. If that path does not exist, ask once, then remember it for the rest of the session.

All commands below run from that directory.

## Step 1 — Read the real venue rules

Never guess at character limits or posting rules. Get them:

```bash
npm run --silent channels -- --json
```

This returns every enabled venue with its `id`, character limits, link policy, audience, posting rules, and best time — plus `existingProjects`, so you can tell a new project from an update to one already there.

Use those `id` values verbatim. An id that isn't in the list gets dropped on import.

## Step 2 — Gather what you need

You need enough substance to write something concrete. Ask for whatever is missing, in one message rather than a series of questions:

- What it is, and what it does — plainly
- The URL, and the repo URL if it's public
- What's new in *this* release specifically
- What was genuinely hard, what broke, what you'd do differently
- Anything numeric: build time, hosting cost, users, benchmarks
- Whether it's open source, and whether there's a commercial plan

The specifics matter more than the polish. "Six weekends, $5/month to run, rewrote the sync layer twice" produces far better posts than a feature list. If they give you a feature list, ask for the story behind it.

## Step 3 — Write the plan

Rules that decide whether these posts land or get removed:

1. **On Reddit, Hacker News and Indie Hackers the product is not the story.** "Here's what I learned building this — the stack, the mistakes, what it costs to run" outperforms "here's my product" by a wide margin. Write those in that register. Concrete numbers and admitted limitations earn goodwill; polish reads as advertising.

2. **Every venue gets its own voice.** If two drafts could be swapped between venues without anyone noticing, rewrite both. Hacker News and LinkedIn should not sound like the same person.

3. **Respect the limits exactly.** They're hard failures. Title and body are measured separately — Hacker News allows 80 characters of title and an essay underneath.

4. **Honour the link policy.** `first_comment` means a link in the body suppresses reach: set `linkPlacement` to `first_comment` and write the body so it reads naturally without the URL. `not_clickable` means set `none` and never write "link below".

5. **Never open with** "Excited to announce", "Thrilled to share", "Introducing", or a rocket emoji. Open with a concrete detail, a result, a real problem, or a number.

6. **Invent nothing.** Use only what they told you. If a number would strengthen a post and you don't have it, leave a visible `[X users]` placeholder.

7. **Pick fewer venues.** Choose the ones that genuinely fit and skip the rest. Marking eight `must` is worse than marking three. A small feature update doesn't belong on Product Hunt. A project with no visual doesn't belong on Instagram.

8. **Stagger `dayOffset`.** Highest-leverage venue at day 0, the rest spread across the first week. A launch with a tail beats a single spike.

Give a real open-source recommendation with reasoning — not a hedge. `partial` (open the reusable core, keep the product closed) is often the right answer.

## Step 4 — Import it

Write the JSON to a temp file and import:

```bash
npm run --silent import -- /tmp/launch-plan.json
```

It prints the URL to open. Give that to the user.

Re-using an existing `slug` adds an update to that project rather than creating a duplicate — that's how feature releases work.

### File shape

```json
{
  "project": {
    "name": "Coldbrew",
    "slug": "coldbrew",
    "tagline": "A local-first RSS reader that syncs over CRDTs",
    "description": "...",
    "url": "https://coldbrew.app",
    "repoUrl": "https://github.com/you/coldbrew",
    "status": "launched",
    "tags": ["devtool", "localfirst"],
    "techStack": ["Tauri", "SQLite"],
    "isOpenSource": true,
    "targetAudience": "Developers who want their data on their own machine."
  },
  "update": {
    "kind": "launch",
    "title": "Coldbrew 1.0",
    "body": "The user's own notes on what shipped.",
    "version": "v1.0.0"
  },
  "plan": {
    "source": "claude-skill",
    "strategyMemo": "Markdown. What you actually think: the strongest angle, who will care, what will fall flat, what to do first. 200-400 words.",
    "positioning": {
      "oneLiner": "Under 100 characters. What it does. No hype.",
      "audience": "Who specifically should care, and why.",
      "differentiator": "What makes it different from the obvious alternative."
    },
    "openSource": {
      "recommendation": "partial",
      "reasoning": "Why. Weigh distribution benefit against commercial risk.",
      "confidence": "medium"
    },
    "assetChecklist": ["Screen recording, 20-30s, showing the sync merge"]
  },
  "posts": [
    {
      "channelId": "hackernews",
      "priority": "must",
      "rationale": "One sentence on why this venue fits this release.",
      "dayOffset": 0,
      "title": "Show HN: Coldbrew - a local-first RSS reader that syncs over CRDTs",
      "body": "The finished post. Publishable as-is.",
      "linkPlacement": "body",
      "imagePrompt": null
    }
  ]
}
```

`kind` is one of `launch`, `feature`, `milestone`, `writeup`. `priority` is `must`, `should` or `optional`. `linkPlacement` is `body`, `first_comment` or `none`. `title` and `imagePrompt` may be `null`.

If the import reports validation errors, fix the file and re-run — it tells you exactly which field is wrong.

## Rewriting one venue

If they ask to redo a single post ("make the Show HN less salesy"), don't regenerate the whole plan. Write the new copy, show it to them, and let them paste it into the dashboard's editor — every post is editable in place, and edits save on the spot.

## Reviewing performance

The dashboard tracks what's been posted and pulls public stats for Hacker News, Reddit and Bluesky. If they ask how a launch went, ask them to read out the numbers from the checklist page, then give an honest read: what worked, what to try differently, and whether a venue is worth repeating.

One thing to say plainly when it's relevant: scheduling the post is the easy half. On Reddit and Hacker News, showing up to answer comments in the first few hours is most of what decides whether it lands.
