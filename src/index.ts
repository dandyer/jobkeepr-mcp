#!/usr/bin/env node

/**
 * Jobkeepr MCP server.
 *
 * This is a thin proxy, not a second implementation. The tools live on the
 * hosted server at https://jobkeepr.com/mcp; this package bridges stdio to it
 * so clients that only speak stdio (Claude Desktop, older configs, local
 * agents) can reach the same surface. One source of truth for the tools, which
 * means this package never needs a release when a tool changes.
 *
 * If your client speaks HTTP directly, skip this and point it at
 * https://jobkeepr.com/mcp instead.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const VERSION = '1.0.0';

const API_KEY = process.env.JOBKEEPR_API_KEY;
const BASE_URL = (process.env.JOBKEEPR_URL || 'https://jobkeepr.com').replace(/\/+$/, '');

const SETUP_HELP =
  'Jobkeepr is not connected. Set JOBKEEPR_API_KEY in your MCP client config to a key ' +
  'from Jobkeepr under Settings > API Keys, then restart. If the key is set but this ' +
  'persists, it may have been revoked.';

async function main() {
  // Connect upstream first: the remote reports its own instructions, and we
  // want to hand those to our client rather than inventing a second copy.
  //
  // A missing or dead key must NOT kill the process. A server that exits looks
  // to a client like a crash loop, tells the user nothing, and cannot be
  // introspected by registries that inspect servers without credentials. Start
  // regardless and report the problem through the protocol, where the user
  // will actually see it.
  let upstream: Client | null = null;

  if (API_KEY) {
    const client = new Client({ name: 'jobkeepr-mcp', version: VERSION }, { capabilities: {} });
    const transport = new StreamableHTTPClientTransport(new URL(`${BASE_URL}/mcp`), {
      requestInit: { headers: { Authorization: `Bearer ${API_KEY}` } },
    });

    try {
      await client.connect(transport);
      upstream = client;
      // If the far end drops, exit so the client can cleanly restart us.
      transport.onclose = () => process.exit(0);
    } catch (error) {
      console.error(
        `Could not connect to Jobkeepr at ${BASE_URL}/mcp: ` +
          (error instanceof Error ? error.message : String(error)),
      );
    }
  } else {
    console.error('JOBKEEPR_API_KEY is not set; starting without a connection.');
  }

  const server = new Server(
    { name: 'jobkeepr', version: VERSION, title: 'Jobkeepr' },
    {
      capabilities: { tools: {} },
      instructions: upstream?.getInstructions() ?? SETUP_HELP,
    },
  );

  // Pass tool definitions through untouched so titles, annotations and schemas
  // stay exactly as the server declares them. With no connection, list the
  // public catalog so registries that inspect without credentials still see
  // the real tools; calling one returns the setup help. If the catalog is
  // unreachable too, report an empty set rather than failing.
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    if (!upstream) {
      try {
        const res = await fetch(`${BASE_URL}/mcp/tools.json`);
        if (res.ok) return { tools: (await res.json()).tools };
      } catch {}
      return { tools: [] };
    }
    const { tools } = await upstream.listTools();
    return { tools };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (!upstream) {
      return { content: [{ type: 'text' as const, text: SETUP_HELP }], isError: true };
    }
    const result = await upstream.callTool({
      name: request.params.name,
      arguments: request.params.arguments,
    });
    return result as Awaited<ReturnType<typeof upstream.callTool>>;
  });

  await server.connect(new StdioServerTransport());
}

main().catch((error) => {
  console.error('jobkeepr-mcp failed to start:', error);
  process.exit(1);
});
