import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { createServer, ensureReady } from '@/mcp/tools'
import { mcpRequestIsAuthorized, mcpToken } from '@/lib/auth'

/**
 * The same MCP server the local subprocess speaks, exposed over HTTP so it can
 * be added once as a claude.ai custom connector and reached from every Claude
 * session — any repo, any surface — instead of only from the machine it was
 * installed on.
 *
 * Anthropic's cloud calls this endpoint, not your browser, so it has to be
 * publicly reachable and it has to authenticate on the request itself.
 */

// better-sqlite3 is a native module: this cannot run on the edge runtime.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function unauthorized(): Response {
  // No body — a 401 that explains itself is a 401 that helps someone probing.
  return new Response(null, {
    status: 401,
    headers: { 'WWW-Authenticate': 'Bearer realm="pr-agent"' },
  })
}

export async function POST(req: Request): Promise<Response> {
  if (!mcpToken()) {
    // Closed rather than open: an unauthenticated MCP server on a public URL
    // hands anyone who finds it every launch plan and the ability to rewrite
    // them. Log loudly so a missing variable is obvious in the deploy logs.
    console.error('MCP_TOKEN is not set — refusing every request to /api/mcp.')
    return unauthorized()
  }
  if (!mcpRequestIsAuthorized(req)) return unauthorized()

  ensureReady()

  /**
   * Stateless, with a fresh server per request and JSON rather than SSE
   * responses. These tools are short reads and writes against a local file,
   * so there is no long-lived stream worth resuming — and a complete JSON body
   * means the request is genuinely finished when handleRequest resolves, which
   * is what makes it safe to tear the server down straight afterwards. Left on
   * SSE, that teardown would truncate the response mid-stream.
   */
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  })
  const server = createServer()
  await server.connect(transport)

  try {
    return await transport.handleRequest(req)
  } finally {
    // Without this, every request leaks a server and its listeners.
    await server.close().catch(() => {})
  }
}

/**
 * The standalone SSE stream and session deletion only mean something in
 * stateful mode. 405 is the spec's answer for a server that doesn't offer
 * them, and it keeps clients from waiting on a stream that will never speak.
 */
export async function GET(): Promise<Response> {
  return new Response(null, { status: 405, headers: { Allow: 'POST' } })
}

export async function DELETE(): Promise<Response> {
  return new Response(null, { status: 405, headers: { Allow: 'POST' } })
}
