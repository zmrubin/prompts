# PR Agent

A tool for launching side projects. Tell Claude what you shipped; get a strategy memo plus finished post copy for every venue worth posting to, then work through a checklist — copy, paste, mark done, track how it went.

Deploy it once and it is present in **every Claude session, from any repo** — web, Desktop, mobile and Claude Code alike.

## Setup

Deploy it, then register the URL once. The full runbook is in [DEPLOY.md](./DEPLOY.md); the short version:

```bash
cd app && npm install
npm run hash-password -- "a long password you'll remember"   # prints your secrets
```

Push to Railway with root directory `app` and a volume at `/data`, set the variables it printed, then add the connector:

**claude.ai** → Settings → Connectors → Add custom connector → `https://<your-app>/api/mcp`, with `Authorization: Bearer <MCP_TOKEN>` under Request headers.

**Claude Code CLI:**

```bash
claude mcp add --transport http --scope user pr-agent \
  https://<your-app>/api/mcp --header "Authorization: Bearer <MCP_TOKEN>"
```

Then open Claude — any conversation, any repository — and try:

> *"I just shipped Coldbrew, a local-first RSS reader — help me launch it."*
> *"What should I post today?"*
> *"I posted the Show HN — here's the link."*
> *"How did that launch go?"*

### Why hosted

A local stdio MCP server only exists on the machine it was installed on. `~/.claude/skills/` and `~/.claude.json` don't travel — and in Claude Code on the web they're discarded with the container at the end of every session. A remote MCP server registered as a connector is account-level, so it is simply there. That is the whole reason for the deploy step.

You can still run it entirely locally — `npm run setup` prints the stdio registration command, and `npm run install-service` keeps the dashboard up on login.

## How it works

**The MCP server** carries the data, the actions, *and* the writing judgement. The venue catalog, your history, cooldowns, everything that writes — plus `src/mcp/instructions.ts`, which is sent as MCP `instructions` on every connection so the house style arrives with the tools. `get_writing_guide` returns the long form.

**The skill** (`.claude/skills/launch-plan`) is the same guidance in Claude Code's native format, for sessions on this repo. It is a convenience, not a requirement.

**The dashboard** is where you actually work: copy a post, open the venue's submit form prefilled, tick it off.

## What it will not do

It does not post for you. Hacker News and Product Hunt have no write API and ban automated submissions, X charges per post, and Reddit, LinkedIn and Instagram each sit behind multi-week approvals. A tool that pretends otherwise is one that fails silently. This one makes the manual path fast instead.

## The venue catalog

`src/db/channels.ts` is the substance: 29 venues with their real character limits, link policies, audiences, self-promotion rules and **cooldowns**.

Those rules are fed verbatim to whatever writes your plan, so **editing one line there changes the copy everywhere that venue appears.** That's usually the right place to fix copy you don't like, rather than re-prompting.

### Cooldowns

r/SideProject expects about 30 days between promotional posts. Hacker News about 21. Post again too soon and you get downvoted or removed — the fastest way to burn a venue when you ship weekly.

Cooldowns are tracked **across all your projects**, because a subreddit doesn't care that your last post there was for something else; it sees the same account promoting again. The planner is told to skip venues that are still cooling, and the dashboard warns you with the name of the project that used it last.

## Tracking

Mark a post done, paste its URL, and:

- **Hacker News, Reddit, Bluesky** — pulls score and comment count from public, auth-free APIs. No account, no credentials, no scraping.
- **Everywhere else** — two manual fields.

`/performance` ranks venues by median score across every launch, flagging **thin data** under three scored posts rather than implying rigour it doesn't have. It gets genuinely useful around your tenth launch.

## Commands

| Command | What it does |
| --- | --- |
| `npm run hash-password -- "…"` | Generate `ADMIN_PASSWORD_HASH`, `SESSION_SECRET`, `MCP_TOKEN` |
| `npm run setup` | Database + print the registration commands |
| `npm run install-service` | Local only: dashboard on login + daily stats refresh |
| `npm test` | The MCP contract suite, over real stdio |
| `npm run dev` | Serve the dashboard directly (port 4321) |
| `npm run channels` | Print the venue catalog and its rules |
| `npm run import -- plan.json` | Load a plan file by hand |
| `npm run refresh` | Pull fresh public stats now |

Set `PRAGENT_PORT` to move the dashboard, `PRAGENT_DB` to move the database, `APP_URL` to tell it its own public address.

## Data

Everything is one SQLite file. Hosted, that's `/data/pragent.db` on the volume; locally, `data/pragent.db`. Copy it, back it up, delete it — it's one file.

## Without Claude

Set `ANTHROPIC_API_KEY` (or `GEMINI_API_KEY`, `MOONSHOT_API_KEY`, `DASHSCOPE_API_KEY`, `OPENAI_API_KEY`) and a **New project** form appears in the dashboard. Or write a plan file yourself — the shape is in `src/lib/plan-file.ts` — and `npm run import` it.

## A caveat the tool can't fix

Getting the post written is the easy half. On Reddit and Hacker News, showing up to answer comments in the first few hours is most of what decides whether it lands. The copy leans on "here's what I learned building this" partly because that's what those communities reward, and partly because it gives you something real to say when people reply.
