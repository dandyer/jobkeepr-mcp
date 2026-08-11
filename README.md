# Jobkeepr MCP server

Connect [Jobkeepr](https://jobkeepr.com) to Claude, ChatGPT, or any other MCP client, so an AI assistant can read and manage your field service business: jobs, customers, scheduling, estimates, invoices and payments.

Jobkeepr is field service management software for small contractor crews — handymen, TV installers, plumbers, electricians, HVAC techs — running one to ten people.

```
"What's on my schedule tomorrow?"
"Which service made me the most money last month?"
"Book Sarah Chen for a TV mount Thursday at 2pm."
"Mark today's jobs complete."
```

## Two ways to connect

**Remote (recommended).** If your client supports remote MCP servers, point it straight at the hosted endpoint and skip this package entirely:

```
https://jobkeepr.com/mcp
```

It supports OAuth, so you sign in with your normal Jobkeepr login and approve access in the browser. Nothing to install.

**stdio (this package).** For clients that only speak stdio, this bridges to the same server using an API key.

> **This package is not on npm.** Install it straight from GitHub using the
> `github:dandyer/jobkeepr-mcp` specifier shown below. Plain `npx jobkeepr-mcp` will not
> resolve. npm compiles the TypeScript for you on install, so there is nothing extra to run.

## Setup

Create an API key in Jobkeepr under **Settings → API Keys**. It's shown once, so copy it then.

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "jobkeepr": {
      "command": "npx",
      "args": ["-y", "github:dandyer/jobkeepr-mcp"],
      "env": {
        "JOBKEEPR_API_KEY": "jk_live_your_key_here"
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add jobkeepr --env JOBKEEPR_API_KEY=jk_live_your_key_here -- npx -y github:dandyer/jobkeepr-mcp
```

Or connect to the remote endpoint directly:

```bash
claude mcp add --transport http jobkeepr https://jobkeepr.com/mcp
```

## Tools

### Reading

| Tool | What it does |
|---|---|
| `get_business_context` | Business name, timezone, working hours, and today's date with resolved ranges for "this week", "last month" and so on |
| `get_jobs` | Jobs filtered by date, status, customer, type or source |
| `get_customers` | Search customers, optionally with job counts and totals |
| `get_schedule` | Scheduled jobs and open time slots |
| `get_estimates` | Estimates and their status |
| `get_invoices` | Invoices and unpaid balances |
| `get_payments` | Payments received |
| `get_line_items` | Line items across jobs, for margin and mix analysis |
| `get_reference_data` | Job types, job sources, and the price catalog |

### Writing

| Tool | What it does |
|---|---|
| `create_job` | Book a job for a customer |
| `create_customer` | Add a customer |
| `create_estimate` | Create an estimate |
| `create_catalog_item` | Add a service or product to the price catalog |
| `add_line_items` | Add billable line items to a job |
| `set_job_source` | Record where a job came from |
| `reschedule_job` | Move a job to a new date or time |
| `cancel_job` | Cancel a scheduled job |
| `close_jobs` | Mark jobs complete |

The financial tools require the `VIEW_FINANCIALS` permission, and each write tool requires its matching permission. Tools you cannot use are not listed to you.

## What it will not do

**No tool here can text your customers.** Sending SMS is deliberately excluded: it is the one action that reaches a real person and cannot be undone. Ask your assistant to draft a message and send it yourself from Jobkeepr.

Writes take effect immediately. There is no staging step and no undo, which is why `cancel_job` and `close_jobs` are marked destructive so your client prompts before running them. `close_jobs` can act on many jobs at once, so check the set before approving it.

## Configuration

| Variable | Required | Default | Notes |
|---|---|---|---|
| `JOBKEEPR_API_KEY` | yes | — | From Settings → API Keys. Starts with `jk_live_`. |
| `JOBKEEPR_URL` | no | `https://jobkeepr.com` | Override only for self-hosted or staging. |

An API key acts on one account and carries owner-level access. Revoke it any time in Settings → API Keys. To give an assistant narrower, per-user access instead, use the remote endpoint with OAuth.

## How it works

This package is a proxy, not a reimplementation. The tools live on the hosted server; this bridges stdio to it. That means the tool set here is always current and this package rarely needs a release.

## Development

```bash
npm install
npm run build
JOBKEEPR_API_KEY=jk_live_... node dist/index.js
```

Test interactively with the MCP Inspector:

```bash
JOBKEEPR_API_KEY=jk_live_... npx @modelcontextprotocol/inspector node dist/index.js
```

## Links

- [Jobkeepr](https://jobkeepr.com)
- [Model Context Protocol](https://modelcontextprotocol.io)

MIT licensed.
