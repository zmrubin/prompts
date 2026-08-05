import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import assert from 'node:assert/strict'
import { after, before, describe, test } from 'node:test'

/**
 * Exercises the MCP server the way Claude Code does: as a subprocess speaking
 * JSON-RPC over stdio, against a throwaway database.
 *
 * This is the primary interface of the tool, so it gets a real suite rather
 * than a script that is rewritten each time something changes.
 */

const ROOT = resolve(import.meta.dirname, '../..')

class Client {
  private proc: ChildProcessWithoutNullStreams
  private buf = ''
  private pending = new Map<number, (v: unknown) => void>()
  private id = 0

  constructor(dbPath: string) {
    // Spawned exactly the way Claude Code does: absolute paths, an absolute
    // tsconfig so the `@/` alias resolves, and a working directory that has
    // nothing to do with this repo. Running it from ROOT would hide the whole
    // class of cwd-dependent bugs.
    this.proc = spawn(
      resolve(ROOT, 'node_modules/.bin/tsx'),
      ['--tsconfig', resolve(ROOT, 'tsconfig.json'), resolve(ROOT, 'src/mcp/server.ts')],
      {
        cwd: tmpdir(),
        env: { ...process.env, PRAGENT_DB: dbPath },
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    ) as ChildProcessWithoutNullStreams

    this.proc.stdout.on('data', (d: Buffer) => {
      this.buf += d.toString()
      let i: number
      while ((i = this.buf.indexOf('\n')) >= 0) {
        const line = this.buf.slice(0, i).trim()
        this.buf = this.buf.slice(i + 1)
        if (!line) continue
        try {
          const msg = JSON.parse(line) as { id?: number }
          if (msg.id && this.pending.has(msg.id)) {
            this.pending.get(msg.id)!(msg)
            this.pending.delete(msg.id)
          }
        } catch {
          // Not JSON-RPC; the server keeps diagnostics on stderr.
        }
      }
    })
  }

  rpc<T = any>(method: string, params?: unknown): Promise<T> {
    const id = ++this.id
    return new Promise((res, rej) => {
      const timer = setTimeout(() => rej(new Error(`timeout: ${method}`)), 60_000)
      this.pending.set(id, (v) => {
        clearTimeout(timer)
        res(v as T)
      })
      this.proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n')
    })
  }

  notify(method: string) {
    this.proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', method }) + '\n')
  }

  /** Calls a tool and returns its text payload. */
  async callText(name: string, args: Record<string, unknown> = {}): Promise<string> {
    const r = await this.rpc<{ result: { content: { text: string }[] } }>('tools/call', {
      name,
      arguments: args,
    })
    return r.result.content[0].text
  }

  /** Calls a tool whose payload is JSON. */
  async call<T = any>(name: string, args: Record<string, unknown> = {}): Promise<T> {
    return JSON.parse(await this.callText(name, args)) as T
  }

  kill() {
    this.proc.kill()
  }
}

function planFor(slug: string, name: string, channelIds: string[], extra: string[] = []) {
  return {
    project: {
      name,
      slug,
      tagline: `${name} tagline`,
      description: `${name} description`,
      url: `https://${slug}.example.com`,
      status: 'launched',
      tags: ['devtool'],
      techStack: ['SQLite'],
      isOpenSource: true,
    },
    update: { kind: 'launch', title: `${name} 1.0`, body: `${name} shipped.` },
    plan: {
      source: 'test',
      strategyMemo: `Memo for ${name}.`,
      positioning: { oneLiner: `${name} one-liner`, audience: 'devs', differentiator: 'it is different' },
      openSource: { recommendation: 'partial', reasoning: 'because', confidence: 'medium' },
      assetChecklist: ['a screenshot'],
    },
    posts: [...channelIds, ...extra].map((channelId) => ({
      channelId,
      priority: 'must',
      rationale: 'fits',
      dayOffset: 0,
      title: `${name} on ${channelId}`,
      body: `Copy for ${name} at ${channelId}.`,
      linkPlacement: 'body',
      imagePrompt: null,
    })),
  }
}

describe('pr-agent MCP server', () => {
  let dir: string
  let c: Client

  before(async () => {
    dir = mkdtempSync(join(tmpdir(), 'pragent-test-'))
    c = new Client(join(dir, 'test.db'))
    await c.rpc('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test', version: '1' },
    })
    c.notify('notifications/initialized')
  })

  after(() => {
    c?.kill()
    rmSync(dir, { recursive: true, force: true })
  })

  test('handshake exposes the full tool surface', async () => {
    const r = await c.rpc<{ result: { tools: { name: string }[] } }>('tools/list')
    const names = r.result.tools.map((t) => t.name)
    for (const expected of [
      'list_venues',
      'get_status',
      'get_project_history',
      'get_performance',
      'create_plan',
      'set_post_status',
      'update_post_copy',
      'get_post_copy',
      'refresh_stats',
      'get_writing_guide',
    ]) {
      assert.ok(names.includes(expected), `missing tool: ${expected}`)
    }
  })

  test('seeds the venue catalog on a fresh database', async () => {
    const { venues } = await c.call('list_venues')
    assert.equal(venues.length, 29)
    const hn = venues.find((v: any) => v.id === 'hackernews')
    assert.equal(hn.titleCharLimit, 80, 'HN caps titles at 80')
    assert.equal(hn.charLimit, null, 'HN body is not capped')
    assert.equal(hn.cooldownDays, 21)
  })

  test('empty database reports zero rather than erroring', async () => {
    const s = await c.call('get_status')
    assert.equal(s.totals.projects, 0)
    assert.equal(s.totals.outstanding, 0)
  })

  test('create_plan imports and drops venues that do not exist', async () => {
    const msg = await c.callText('create_plan', {
      plan: planFor('alpha', 'Alpha', ['hackernews', 'bluesky', 'reddit:sideproject'], [
        'not-a-real-venue',
      ]),
    })
    assert.match(msg, /Created project "alpha"/)
    assert.match(msg, /Wrote 3 posts/)
    assert.match(msg, /not-a-real-venue/, 'should name the venue it dropped')
  })

  /**
   * The venue's policy outranks the plan. A plan that puts a link in an X body
   * loses reach, and nothing downstream would have caught it.
   */
  test('import corrects link placement that fights the venue policy', async () => {
    const msg = await c.callText('create_plan', {
      plan: planFor('gamma', 'Gamma', ['x', 'instagram']),
    })
    assert.match(msg, /Corrected — x: link moved to the first comment/)
    assert.match(msg, /Corrected — instagram: links are not clickable/)

    const s = await c.call('get_status')
    const gx = s.outstanding.find(
      (o: any) => o.projectSlug === 'gamma' && o.channelId === 'x',
    )
    const copy = await c.call('get_post_copy', { postId: gx.postId })
    assert.equal(copy.linkPlacement, 'first_comment')
    assert.ok(
      !copy.clipboard.includes('https://gamma.example.com'),
      'the link must not be in the body for a first_comment venue',
    )
  })

  test('reusing a slug adds an update instead of duplicating the project', async () => {
    const msg = await c.callText('create_plan', {
      plan: planFor('alpha', 'Alpha', ['hashnode']),
    })
    assert.match(msg, /Updated project "alpha"/)
    const s = await c.call('get_status')
    assert.equal(
      s.projects.filter((p: any) => p.slug === 'alpha').length,
      1,
      'alpha must not be duplicated',
    )
  })

  /**
   * Re-running the skill for a project used to leave the previous plan's
   * un-posted items outstanding forever, so the checklist filled up with
   * stale copy that looked identical to the fresh copy beside it.
   */
  test('a newer plan supersedes the older plan\'s un-posted copy', async () => {
    await c.callText('create_plan', { plan: planFor('delta', 'Delta', ['mastodon', 'devto']) })
    const first = await c.call('get_status')
    const deltaTodo = first.outstanding.filter((o: any) => o.projectSlug === 'delta')
    assert.equal(deltaTodo.length, 2)

    const msg = await c.callText('create_plan', {
      plan: planFor('delta', 'Delta v2', ['mastodon']),
    })
    assert.match(msg, /Superseded older un-posted copy for: Mastodon/)

    const after = await c.call('get_status')
    const stillTodo = after.outstanding.filter((o: any) => o.projectSlug === 'delta')
    const mastodon = stillTodo.filter((o: any) => o.channelId === 'mastodon')
    assert.equal(mastodon.length, 1, 'exactly one Mastodon post should remain outstanding')

    // devto was not in the newer plan, so it is untouched.
    assert.equal(stillTodo.filter((o: any) => o.channelId === 'devto').length, 1)
  })

  test('superseding never rewrites something already posted', async () => {
    const s = await c.call('get_status')
    const m = s.outstanding.find(
      (o: any) => o.projectSlug === 'delta' && o.channelId === 'mastodon',
    )
    await c.callText('set_post_status', { postId: m.postId, status: 'posted' })

    await c.callText('create_plan', { plan: planFor('delta', 'Delta v3', ['mastodon']) })

    const history = await c.call('get_project_history', { slug: 'delta' })
    assert.equal(
      history.previouslyPosted.filter((p: any) => p.channelId === 'mastodon').length,
      1,
      'the posted Mastodon entry must survive a later plan',
    )
  })

  test('outstanding items name the update they belong to', async () => {
    const s = await c.call('get_status')
    for (const o of s.outstanding) {
      assert.ok(o.update, `outstanding item for ${o.venue} has no update title`)
    }
    for (const p of s.projects) {
      for (const n of p.nextUp) assert.ok(n.update, 'nextUp entry has no update title')
    }
  })

  test('get_status rolls up progress across projects', async () => {
    const before = await c.call('get_status')
    await c.callText('create_plan', { plan: planFor('beta', 'Beta', ['devto', 'mastodon']) })
    const s = await c.call('get_status')

    assert.equal(s.totals.projects, before.totals.projects + 1)
    assert.equal(s.totals.outstanding, before.totals.outstanding + 2)
    assert.ok(s.projects.every((p: any) => Array.isArray(p.nextUp)))
    // every outstanding item names the project it belongs to
    assert.ok(s.outstanding.every((o: any) => o.project && o.projectSlug))
  })

  test('checking a post off updates status and starts that venue cooling', async () => {
    const before = await c.call('get_status')
    const hn = before.outstanding.find((o: any) => o.channelId === 'hackernews')
    assert.ok(hn, 'expected an outstanding Hacker News post')

    await c.callText('set_post_status', {
      postId: hn.postId,
      status: 'posted',
      postedUrl: 'https://news.ycombinator.com/item?id=1',
    })

    const after = await c.call('get_status')
    assert.equal(after.totals.outstanding, before.totals.outstanding - 1)

    const { venues } = await c.call('list_venues')
    const v = venues.find((x: any) => x.id === 'hackernews')
    assert.equal(v.cooling, true, 'HN should now be cooling')
    assert.equal(v.daysUntilClear, 21)
  })

  /**
   * The regression that matters: history used to select every posted row in
   * the database, so one project's copy leaked into another's context.
   */
  test('get_project_history returns only the requested project', async () => {
    const betaStatus = await c.call('get_status')
    const betaPost = betaStatus.outstanding.find(
      (o: any) => o.projectSlug === 'beta' && o.channelId === 'devto',
    )
    await c.callText('set_post_status', { postId: betaPost.postId, status: 'posted' })

    const alpha = await c.call('get_project_history', { slug: 'alpha' })
    const beta = await c.call('get_project_history', { slug: 'beta' })

    assert.ok(alpha.previouslyPosted.length > 0, 'alpha has posted history')
    assert.ok(beta.previouslyPosted.length > 0, 'beta has posted history')

    for (const p of alpha.previouslyPosted) {
      assert.match(p.body, /Alpha/, `alpha history leaked: ${p.body}`)
    }
    for (const p of beta.previouslyPosted) {
      assert.match(p.body, /Beta/, `beta history leaked: ${p.body}`)
    }

    assert.ok(
      alpha.previousUpdates.length >= 2,
      'alpha had two updates and both should appear',
    )
    assert.equal(beta.previousUpdates.length, 1)
  })

  test('unknown slug lists the ones that exist', async () => {
    const msg = await c.callText('get_project_history', { slug: 'nope' })
    assert.match(msg, /No project with slug "nope"/)
    assert.match(msg, /alpha/)
  })

  test('get_post_copy returns paste-ready text and a prefilled form URL', async () => {
    const s = await c.call('get_status')
    const beta = s.outstanding.find(
      (o: any) => o.projectSlug === 'beta' && o.channelId === 'mastodon',
    )
    const copy = await c.call('get_post_copy', { postId: beta.postId })
    assert.match(copy.submitUrl, /mastodon\.social\/share/)
    assert.ok(copy.clipboard.includes('Copy for Beta'))
    assert.ok(
      copy.clipboard.includes('https://beta.example.com'),
      'Mastodon does not penalise links, so it belongs in the body',
    )
    assert.equal(copy.reminder, undefined, 'no warning needed where links are fine')
  })

  test('update_post_copy refuses copy that breaks the venue limit', async () => {
    const s = await c.call('get_status')
    const bsky = s.outstanding.find((o: any) => o.channelId === 'bluesky')
    const msg = await c.callText('update_post_copy', {
      postId: bsky.postId,
      body: 'x'.repeat(400),
    })
    assert.match(msg, /Rejected/)
    assert.match(msg, /300/, 'should name the actual limit')
  })

  test('update_post_copy accepts copy inside the limit', async () => {
    const s = await c.call('get_status')
    const bsky = s.outstanding.find((o: any) => o.channelId === 'bluesky')
    const msg = await c.callText('update_post_copy', {
      postId: bsky.postId,
      body: 'a much shorter rewrite',
    })
    assert.match(msg, /Updated/)
    const copy = await c.call('get_post_copy', { postId: bsky.postId })
    assert.ok(copy.clipboard.includes('a much shorter rewrite'))
  })

  test('performance reports thin data honestly', async () => {
    const perf = await c.call('get_performance')
    assert.ok(Array.isArray(perf.venues))
    for (const v of perf.venues) {
      if (v.posts < 3) assert.equal(v.enoughData, false)
    }
  })
})
