# PR Agent

A local planning tool for launching side projects. Describe what you shipped, get a strategy memo plus finished post copy for every venue worth posting to, then work through a checklist: copy, paste, mark done, track how it went.

Runs on your machine. SQLite file, no server, no accounts, no login.

## What it does

1. **A plan comes in** — either from the Claude skill (no API key needed) or from the built-in planner (your own API key).
2. **You get finished copy per venue** — written in that venue's native voice, inside its real character limits, with the link placed where that platform doesn't punish it.
3. **You post it by hand** — one click copies the post, another opens the submit form. Mark it done.
4. **You track what happened** — paste the URL back and it pulls public stats for Hacker News, Reddit and Bluesky. Everything else you log yourself.

There is no auto-posting. That was deliberate: Hacker News and Product Hunt have no write API and ban automated submissions, X charges per post, and Reddit, LinkedIn and Instagram all sit behind multi-week approvals. A tool that pretends otherwise is a tool that silently fails. This one makes the manual path fast instead.

## Setup

Node 22+. No database server, no configuration.

```bash
git clone https://github.com/zmrubin/prompts
cd prompts/app
npm install
npm run dev          # http://localhost:3000
```

That's it. The first run creates `data/pragent.db` and seeds the 29-venue catalog.

## Getting a plan in

### Option A — the Claude skill (no API key)

Uses your Claude subscription instead of API credits.

```bash
cp -r .claude/skills/launch-plan ~/.claude/skills/
```

Then tell Claude about a project: *"I just shipped Coldbrew, a local-first RSS reader — help me launch it."* It reads the real venue rules out of your database, asks for whatever it's missing, writes the plan, and imports it. You get a URL to open.

Mention an existing project and it adds an update rather than starting over.

### Option B — your own API key

```bash
export ANTHROPIC_API_KEY=sk-ant-...   # or GEMINI_API_KEY, MOONSHOT_API_KEY, DASHSCOPE_API_KEY, OPENAI_API_KEY
npm run dev
```

The **New project** button appears once a key is present.

### Option C — a file

```bash
npm run --silent import -- plan.json
```

The shape is in `src/lib/plan-file.ts`, and the importer names the exact field when something is wrong.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Migrate, seed, and serve on :3000 |
| `npm run import -- plan.json` | Load a plan file |
| `npm run channels` | Print the venue catalog with its rules |
| `npm run channels -- --json` | Same, machine-readable (what the skill reads) |
| `npm run db:setup` | Migrate and seed without starting the server |

## The venue catalog

`src/db/channels.ts` is the substance of this tool: 29 venues with their real character limits, link policies, audiences and self-promotion rules — Hacker News's 80-character title cap and `Show HN:` format, Product Hunt's 60-character tagline, r/SaaS confining promotion to the weekly thread, X's reach penalty on links.

Those rules are fed verbatim to whatever writes your plan, so **editing one line there changes the copy everywhere that venue appears.** That is usually the right place to fix copy you don't like, rather than re-prompting.

Toggle venues off in the Channels tab and nothing will suggest them again.

## Tracking

Mark a post done, paste its URL, and:

- **Hacker News, Reddit, Bluesky** — pulls score and comment count from public, auth-free APIs. No account, no credentials.
- **Everywhere else** — a two-field manual entry. No scraping.

Readings are stored as a series rather than a single number, so you can tell a post that's still climbing from one that stalled.

## Data

Everything lives in `data/pragent.db`. Copy it, back it up, delete it — it's one file. `PRAGENT_DB=/some/other/path.db` moves it.

## A caveat the tool can't fix

Getting the post written is the easy half. On Reddit and Hacker News, showing up to answer comments in the first few hours is most of what decides whether it lands. The copy leans on "here's what I learned building this" partly because that's what those communities reward, and partly because it gives you something real to say when people reply.
