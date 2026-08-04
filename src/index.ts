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

if (!API_KEY) {
  console.error(
    'JOBKEEPR_API_KEY is required.\n' +
      'Create one in Jobkeepr under Settings > API Keys, then set it in your MCP client config.',
  );
  process.exit(1);
}

async function main() {
  // Connect upstream first: the remote reports its own instructions, and we
  // want to hand those to our client rather than inventing a second copy.
  const upstream = new Client(
    { name: 'jobkeepr-mcp', version: VERSION },
    { capabilities: {} },
  );

  const transport = new StreamableHTTPClientTransport(new URL(`${BASE_URL}/mcp`), {
    requestInit: {
      headers: { Authorization: `Bearer ${API_KEY}` },
    },
  });

  try {
    await upstream.connect(transport);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `Could not connect to Jobkeepr at ${BASE_URL}/mcp\n` +
        `${message}\n` +
        'Check that JOBKEEPR_API_KEY is a current key and has not been revoked in Settings > API Keys.',
    );
    process.exit(1);
  }

  const server = new Server(
    { name: 'jobkeepr', version: VERSION, title: 'Jobkeepr' },
    {
      capabilities: { tools: {} },
      instructions: upstream.getInstructions(),
    },
  );

  // Pass tool definitions through untouched so titles, annotations and schemas
  // stay exactly as the server declares them.
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const { tools } = await upstream.listTools();
    return { tools };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const result = await upstream.callTool({
      name: request.params.name,
      arguments: request.params.arguments,
    });
    return result as Awaited<ReturnType<typeof upstream.callTool>>;
  });

  // If the far end drops, exit rather than sit here answering with a dead
  // upstream — the client will show a clean disconnect and can restart us.
  transport.onclose = () => process.exit(0);

  await server.connect(new StdioServerTransport());
}

main().catch((error) => {
  console.error('jobkeepr-mcp failed to start:', error);
  process.exit(1);
});
