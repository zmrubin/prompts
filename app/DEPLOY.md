# Deploying to Railway

Start to finish, this is about ten minutes. You'll create three services in one Railway project: a Postgres database, the web dashboard, and a cron worker that publishes scheduled posts.

Everything lives in the `app/` subdirectory of this repo, so **every service needs its Root Directory set to `app`**. That's the single most common thing to get wrong.

---

## Step 0 — Generate your secrets

Run this locally, once. It prints all three secrets ready to paste:

```bash
cd app
npm install
npm run hash-password -- 'pick-a-strong-password'
```

Output looks like:

```
ADMIN_PASSWORD_HASH=scrypt$Lm9...$Qp2...
SESSION_SECRET=k3Jd...
ENCRYPTION_KEY=Yk5m...
```

The password you typed is what you'll log into the dashboard with — it is never stored, only its scrypt hash.

> **`ENCRYPTION_KEY` decrypts every stored credential.** Save it somewhere safe. Losing it means reconnecting every social account; changing it invalidates them all at once.

---

## Step 1 — Create the project and database

1. In Railway, **New Project**.
2. **Add a service → Database → PostgreSQL.**

That's it. Railway exposes it to your other services as `${{Postgres.DATABASE_URL}}`.

---

## Step 2 — The web service

**Add a service → GitHub Repo → `zmrubin/prompts`.**

Then in that service's **Settings**:

| Setting | Value |
| --- | --- |
| Root Directory | `app` |
| Branch | `main` (or `claude/pr-agent-dashboard-nrhzaw` if you haven't merged yet) |

It picks up `app/railway.json` automatically, which runs database migrations and reseeds the channel catalog before every deploy.

In **Variables**:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `ADMIN_PASSWORD_HASH` | from Step 0 |
| `SESSION_SECRET` | from Step 0 |
| `ENCRYPTION_KEY` | from Step 0 |
| `DRY_RUN` | `true` |

Under **Settings → Networking**, click **Generate Domain** to get a public URL.

Leave `DRY_RUN=true` for now. It is a hard override — while it's set to anything other than `false`, nothing can post for real no matter what the dashboard says.

---

## Step 3 — The scheduler service

Add a **second** service from the same GitHub repo. In its **Settings**:

| Setting | Value |
| --- | --- |
| Root Directory | `app` |
| Config-as-code path | `railway.scheduler.json` |
| Cron Schedule | `*/5 * * * *` |

The config path matters. Without it this service reads the same `railway.json` as the web service, boots a second web server, and re-runs migrations every five minutes.

Give it **the same five variables** as the web service.

Notes on the cron:
- Five minutes is Railway's minimum granularity, and schedules are evaluated in **UTC**.
- The worker claims what's due, publishes it, and exits. A clean exit is success — that's why its restart policy is `NEVER`.
- Posts scheduled between ticks simply go out on the next one. Nothing is lost.

---

## Step 4 — First login

Open your generated domain. Sign in with the password from Step 0.

Go to **Settings → Language model**, pick a provider, and paste an API key:

| Provider | Getting started |
| --- | --- |
| **Google Gemini** | Free tier — ~15 requests/min, 1,500/day. The zero-commitment way to test the whole loop. Key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey). |
| **Anthropic** | Paid, best copy quality. Key at [console.anthropic.com](https://console.anthropic.com/settings/keys). |
| **Kimi / Qwen** | Cheap, both have free quotas. |

Then try the whole thing with dry run still on: add a project, add an update, generate a plan. Read what it writes before trusting it with a real account.

---

## Step 5 — Connect accounts

**Settings → Connected accounts.** Each credential is verified against the real API before it's stored, so a bad key fails immediately rather than silently at 3am.

Start with these five — free, no approval, working today:

| Channel | What you need |
| --- | --- |
| **Bluesky** | Handle + an **app password** (Settings → Privacy and Security → App Passwords). Not your login password. |
| **Mastodon** | Instance URL + access token with `write:statuses` (Preferences → Development → New application). |
| **DEV.to** | API key (Settings → Extensions). Set `publish` to `false` so articles land as unpublished drafts you review first. |
| **Discord** | Webhook URL (Channel Settings → Integrations → Webhooks). |
| **Telegram** | Bot token from @BotFather, plus your channel ID. Add the bot as a channel admin. |

The other four need work outside this app, and the lead times are real:

- **X** — attach billing to an X developer account. Posting costs ~$0.015, or ~$0.20 with a link. You need all four OAuth 1.0a keys with the app set to Read and Write.
- **Reddit** — create a **script**-type app at reddit.com/prefs/apps. Self-service registration is closed; approval takes roughly 2–4 weeks.
- **LinkedIn** — request the "Share on LinkedIn" product, then generate a `w_member_social` token. It expires about every 60 days and must be regenerated by hand.
- **Instagram** — Business account (Creator accounts can't publish via API), a linked Facebook Page, and Meta app review per permission with a screencast. 2–4 weeks.

**Start the Reddit and Instagram applications now if you want them.** Nothing about this codebase shortens those queues.

Until a channel is connected, it degrades to the manual path rather than failing — the post still reaches your "Needs you" queue with copy ready and the submit form prefilled.

---

## Step 6 — Going live

Once you've watched a full cycle work in dry run:

1. Remove `DRY_RUN` from **both** services' variables, or set it to `false`.
2. Redeploy both.
3. Confirm **Settings → Posting safety** now shows live posting.

Do a single real post first — schedule one Bluesky or Discord post a few minutes out and watch the scheduler's deploy logs pick it up.

---

## Verifying the scheduler

Open the scheduler service's logs after a tick. Healthy output is one of:

```
Nothing due.
Scheduler run complete.
```

```
Claimed 2 post(s).
  Bluesky: https://bsky.app/profile/you/post/3k...
  Hacker News (Show HN): needs a manual click
Scheduler run complete.
```

With dry run on you'll see `DRY RUN — no real posts will be made.` and each connector reporting what it *would* have sent.

---

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| Build fails immediately | Root Directory isn't set to `app`. |
| Scheduler boots a web server / re-runs migrations every 5 min | Config-as-code path isn't set to `railway.scheduler.json`. |
| `Invalid environment: ENCRYPTION_KEY must be 32 bytes` | The key was truncated on paste. Regenerate with Step 0 and copy the whole line. |
| Login always rejects the password | `ADMIN_PASSWORD_HASH` is malformed. It must look like `scrypt:<salt>:<hash>` — three colon-separated parts. If yours contains `$` it came from an older version and will be silently truncated when loaded from `.env`; regenerate it with `npm run hash-password`. |
| Every connection shows "needs reauth" after a redeploy | `ENCRYPTION_KEY` changed. Old credentials can't be decrypted; reconnect each account. |
| Plan generation fails with "No API key stored" | The provider selected in Settings isn't the one you saved a key for. |
| Posts sit in `scheduled` forever | The scheduler service has no cron schedule set, or is missing `DATABASE_URL`. |
| Nothing posts even though dry run is off in the dashboard | `DRY_RUN` is still set in Railway variables — the env var overrides the toggle by design. |

---

## Running costs

- **Railway** — Postgres plus two small services. The cron worker only bills for the seconds it runs.
- **LLM** — free on Gemini's tier at this volume; cents per plan on Anthropic.
- **X** — the only channel that charges per post: ~$0.015, or ~$0.20 when the post contains a link. Everything else in the automatic tier is free.
