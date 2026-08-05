# Deploying PR Agent

The point of hosting this is that a **remote MCP server can be added to Claude
once, at the account level, and is then present in every session** — any repo,
any surface. A local stdio server only exists on the machine it was installed
on, which is why the skill kept vanishing from other conversations.

Anthropic's cloud calls the MCP endpoint on your behalf, so it has to be
reachable over the public internet. That is the whole reason for a deploy.

---

## 1. Generate the secrets

```bash
cd app
npm install
npm run hash-password -- "a long password you'll remember"
```

It prints three values. Keep them somewhere safe — `MCP_TOKEN` is the bearer
token you'll hand to Claude, so treat it like a password.

## 2. Create the Railway service

1. New Project → Deploy from GitHub repo → this repository.
2. Set **Root Directory** to `app`. Railway reads `app/railway.json` from
   there and builds with Nixpacks.
3. Add a **Volume** mounted at `/data`. Without it the database is wiped on
   every deploy, which defeats the point.

## 3. Set the variables

| Variable | Value |
| --- | --- |
| `PRAGENT_DB` | `/data/pragent.db` |
| `ADMIN_PASSWORD_HASH` | from step 1 |
| `SESSION_SECRET` | from step 1 |
| `MCP_TOKEN` | from step 1 |
| `APP_URL` | your public URL, e.g. `https://pragent.up.railway.app` |

`APP_URL` is not cosmetic. It gets written into every plan record and handed
to Claude as the link to open — leave it unset and you get plans full of
`localhost` links that only work on a machine which isn't running the app.
Railway's own `RAILWAY_PUBLIC_DOMAIN` is used as a fallback if you forget.

Two variables fail closed rather than open, on purpose:

- No `ADMIN_PASSWORD_HASH` in production → the dashboard returns 503 rather
  than serving your launch plans to anyone who finds the URL.
- No `MCP_TOKEN` → `/api/mcp` returns 401 to everyone, including you.

## 4. Keep it to one instance

`numReplicas` is pinned to 1 in `railway.json`. SQLite has a single writer, and
a second replica would quietly corrupt writes. For one user this costs nothing;
if you ever need more, that's the point to move to Postgres.

## 5. Register it with Claude — once

**claude.ai** (covers Claude on the web, Desktop, mobile, and Claude Code web
sessions):

Settings → Connectors → Add custom connector

- URL: `https://<your-app>/api/mcp`
- Under **Request headers**: `Authorization` = `Bearer <MCP_TOKEN>`

**Claude Code CLI** on your own machine:

```bash
claude mcp add --transport http --scope user pr-agent \
  https://<your-app>/api/mcp \
  --header "Authorization: Bearer <MCP_TOKEN>"
```

`--scope user` writes to `~/.claude.json`, so it applies in every project on
that machine rather than only the directory you ran it from.

## 6. Check it

```bash
curl -s -X POST https://<your-app>/api/mcp \
  -H "Authorization: Bearer $MCP_TOKEN" \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Ten tools come back. Then open a Claude session **on an unrelated repo** and
ask "what should I post today?" — that is the real acceptance test.

---

## Notes

- **Migrations** run automatically on the first request after a deploy
  (`ensureReady()` in `src/mcp/tools.ts`), so there is no pre-deploy hook to
  configure and no way for the app to serve traffic against an un-migrated
  database.
- **Backups**: the entire dataset is one file at `/data/pragent.db`. Railway
  volume snapshots cover it; `sqlite3 /data/pragent.db .dump` if you want a
  copy you can read.
- **The writing guidance ships inside the server.** `src/mcp/instructions.ts`
  is sent as MCP `instructions` on every connection, so connecting the
  connector is the entire install — there is no skill file to copy around.
