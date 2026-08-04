# PR Agent

A local tool for launching side projects. Tell Claude what you shipped; get a strategy memo plus finished post copy for every venue worth posting to, then work through a checklist — copy, paste, mark done, track how it went.

Runs on your machine. One SQLite file, no accounts, no login, nothing hosted.

## Setup

Node 22+. Two commands, once, ever.

```bash
git clone https://github.com/zmrubin/prompts
cd prompts/app
npm install
npm run setup
```

`setup` does four things: creates the database, seeds the 29-venue catalog, installs the skill to `~/.claude/skills/`, and registers the MCP server with Claude Code at user scope — so both halves work in every session, from any directory. **After this you never run anything again.** Claude Code launches the server itself.

Open Claude and try:

> *"I just shipped Coldbrew, a local-first RSS reader — help me launch it."*
> *"What should I post today?"*
> *"I posted the Show HN — here's the link."*
> *"How did that launch go?"*

Verify with `claude mcp list` — you should see `pr-agent … Connected` — and `ls ~/.claude/skills/launch-plan`.

### Optional: keep the dashboard always up

```bash
npm run install-service     # launchd on macOS, systemd --user on Linux
```

Two units: the dashboard on login, and a daily metrics refresh. Undo with `npm run uninstall-service`. Without it, Claude starts the dashboard on demand the first time it needs one.

## How it works

**The skill** (`.claude/skills/launch-plan`) carries the writing judgement — what lands on Hacker News versus LinkedIn, why "here's what I learned building this" beats "here's my product" on Reddit.

**The MCP server** carries the data and the actions — the venue catalog, your history, cooldowns, and everything that writes.

**The dashboard** (`http://localhost:4321`) is where you actually work: copy a post, open the venue's submit form prefilled, tick it off.

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
| `npm run setup` | Database + register the MCP server. Run once. |
| `npm run install-service` | Dashboard on login + daily stats refresh |
| `npm test` | The MCP contract suite, over real stdio |
| `npm run dev` | Serve the dashboard directly (port 4321) |
| `npm run channels` | Print the venue catalog and its rules |
| `npm run import -- plan.json` | Load a plan file by hand |
| `npm run refresh` | Pull fresh public stats now |

Set `PRAGENT_PORT` to move the dashboard, `PRAGENT_DB` to move the database.

## Without Claude

Set `ANTHROPIC_API_KEY` (or `GEMINI_API_KEY`, `MOONSHOT_API_KEY`, `DASHSCOPE_API_KEY`, `OPENAI_API_KEY`) and a **New project** form appears in the dashboard. Or write a plan file yourself — the shape is in `src/lib/plan-file.ts` — and `npm run import` it.

## Data

Everything is in `data/pragent.db`. Copy it, back it up, delete it — it's one file.

## A caveat the tool can't fix

Getting the post written is the easy half. On Reddit and Hacker News, showing up to answer comments in the first few hours is most of what decides whether it lands. The copy leans on "here's what I learned building this" partly because that's what those communities reward, and partly because it gives you something real to say when people reply.
