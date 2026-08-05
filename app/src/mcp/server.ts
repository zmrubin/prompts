#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createServer, ensureReady } from './tools'

/**
 * The stdio entry point, for running the server as a local subprocess.
 *
 * The hosted deployment speaks the same tools over HTTP from
 * src/app/api/mcp/route.ts — both build their server with createServer(), so
 * there is one implementation and no chance of the two drifting.
 */
async function main() {
  ensureReady()
  await createServer().connect(new StdioServerTransport())
}

// Wrapped rather than top-level await: this package is CommonJS, and tsx
// refuses top-level await outside an ES module.
main().catch((e) => {
  // stdout is the JSON-RPC channel, so diagnostics must go to stderr.
  console.error('pr-agent MCP server failed to start:', e)
  process.exit(1)
})
