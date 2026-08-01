# PR Agent Dashboard

A private, single-user dashboard for launching side projects: add a project or a feature update, get a strategy memo plus post copy tailored to every channel worth posting to, then schedule it and let it go out.

## What it actually does

1. **Catalogue a project** — name, description, stack, tags, links.
2. **Add an update** — a launch, a feature, a milestone, a write-up. Write rough notes.
3. **Generate a plan** — an LLM produces a strategy memo, an open-source recommendation, a ranked channel list, and finished post copy for each one, written in that venue's native voice and inside its character limit.
4. **Edit and schedule** — every draft is editable; "Schedule all" staggers them across the following days, respecting each channel's minimum spacing.
5. **It posts** — automatically where the platform allows, and into a "Needs you" queue with copy plus a prefilled submit link where it doesn't.

## What can and cannot be automated

This is the honest breakdown, and it drives the whole design.

**Posts automatically — free, no approval:** Bluesky, Mastodon, DEV.to, Discord, Telegram.

**Posts automatically once you clear a gate:**

| Channel | Gate |
| --- | --- |
| X / Twitter | Pay-per-use since Feb 2026 — about $0.015 a post, $0.20 with a link. Needs a developer account with billing. |
| Reddit | Self-service OAuth registration is closed; app approval takes roughly 2–4 weeks. |
| LinkedIn | Needs the "Share on LinkedIn" product and a `w_member_social` token that expires every ~60 days. |
| Instagram | Business account, linked Facebook Page, and Meta app review per permission — roughly 2–4 weeks. |

**Never automated, by design:** Hacker News, Product Hunt, and every directory (BetaList, Uneed, Peerlist, StartupBase, Fazier, SaaSHub, AlternativeTo, There's An AI For That, Futurepedia). None has a usable write API, and automating a Show HN or a Product Hunt launch violates their rules and risks a ban. These always land in the "Needs you" queue with the copy ready and the submit form one click away.

Until a gated channel is connected, it degrades gracefully to the manual path rather than failing — the post still reaches you, it just needs a click.

## Local development

Requires Node 22+ and a Postgres database.

```bash
cd app
npm install
npm run hash-password -- 'your-password'   # prints the three secrets you need
cp .env.example .env                        # then paste the secrets in
npm run db:migrate
npm run db:seed                             # loads the 29-channel catalog
npm run dev
```

`DRY_RUN=true` is set in `.env.example` and is a **hard override**: while it is anything other than `false`, no connector can post for real regardless of the dashboard toggle. Leave it on until you've watched a full cycle work.

### Verifying the pipeline without touching a real account

```bash
npm run smoke        # creates a project, update, plan, drafts, and queues two posts
npm run scheduler    # drains the queue
```

With `DRY_RUN` on, connectors log the exact request they would send and report success. The smoke test deliberately covers both paths: Discord (an auto channel) and Hacker News (a manual one).

For a real end-to-end test with actual API calls, the safest three are a Discord webhook pointed at a private server, a throwaway Bluesky account, and DEV.to with `publish` set to `false` — that last one creates a genuine unpublished draft, so you verify the real API path with zero exposure.

## Deploying to Railway

**Full step-by-step guide with troubleshooting: [DEPLOY.md](./DEPLOY.md).** Short version below.

Three services from this repo:

**1. Postgres** — add the Railway Postgres plugin. It provides `DATABASE_URL`.

**2. Web** — root directory `app`. Railway picks up `railway.json`, which runs migrations and reseeds the channel catalog before each deploy. Set:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `ADMIN_PASSWORD_HASH` | from `npm run hash-password` |
| `SESSION_SECRET` | from `npm run hash-password` |
| `ENCRYPTION_KEY` | from `npm run hash-password` |
| `DRY_RUN` | `true` until you're ready |

**3. Scheduler** — same repo, root directory `app`. In its settings:

- **Config-as-code path:** `railway.scheduler.json` — this is what stops the scheduler from inheriting the web service's start command and re-running migrations on every tick.
- **Cron schedule:** `*/5 * * * *` (5 minutes is Railway's minimum; schedules are UTC).

It claims due posts, publishes them, and exits — Railway requires a cron service to exit cleanly, which is why it uses a one-shot connection rather than the pooled one, and why its restart policy is `NEVER` (a clean exit is success, not a crash to retry).

Give it the same environment variables as the web service.

> `ENCRYPTION_KEY` decrypts every stored credential. Losing it means reconnecting every account; rotating it invalidates them all.

## Architecture notes

- **`src/db/channels.ts`** is the product. 29 venues with their real posting rules, character limits, link policies, and self-promotion constraints. These are fed verbatim into the LLM prompt, so improving a rule here improves the copy everywhere.
- **`src/connectors/`** — one `Connector` interface covers both automated and manual channels. Manual venues return `{kind:'manual', submitUrl}` instead of posting, so the scheduler and UI never branch on "can this be automated".
- **`src/llm/`** — a native Anthropic adapter (structured output via a forced tool call) and one OpenAI-compatible adapter that covers Gemini, Kimi, Qwen and OpenAI by base URL alone. A Zod validation failure triggers one repair round with the errors fed back.
- **`src/scheduler/run.ts`** — claims a batch with `FOR UPDATE SKIP LOCKED`, so overlapping cron runs never double-post. Idempotency keys are `hash(draftId + scheduledFor)` with a unique constraint. Stale locks older than 10 minutes are reclaimed; retryable failures back off exponentially for up to 5 attempts.

## A caveat worth keeping in mind

Scheduling the post is the easy half. On Reddit, Hacker News and Indie Hackers, showing up to answer comments in the first few hours is what determines whether a post works — and no amount of automation does that part. The generated copy leans into "here's what I learned building this" for exactly that reason: it's the framing those communities reward, and it gives you something real to talk about when people reply.
