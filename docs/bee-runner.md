# Bee Runner

The bee runner (`docker/runner.js`) is the main process inside each bee's Docker container. It polls for incoming mail and processes each message using the Claude Agent SDK.

## How It Works

1. On startup, the runner ensures all directories exist (`/inbox`, `/outbox`, `/state`, `/logs`, `/workspace`)
2. It processes any existing mail in `/inbox`
3. It enters a polling loop, checking `/inbox` every 500ms for new `.json` files
4. For each mail file: read, parse, delete from inbox, then call `processMail()`

## Agent SDK Integration

The runner uses `query()` from `@anthropic-ai/claude-agent-sdk` instead of manually calling the Anthropic API and implementing a tool loop.

```javascript
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: mailContent,
  options: {
    model: MODEL,
    systemPrompt: soulContent + hierarchyContext,
    allowedTools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep",
                   "mcp__buzybeez-mail__send_mail"],
    permissionMode: "bypassPermissions",
    cwd: "/workspace",
    maxTurns: 50,
    sessionId,
    mcpServers: {
      "buzybeez-mail": {
        command: "node",
        args: ["/app/mcp-mail-server.js"]
      }
    }
  }
})) {
  // Process streamed messages...
}
```

### Tool Mapping (Old vs New)

| Old Tool (manual) | New Tool (Agent SDK) |
|---|---|
| `read_file` | `Read` |
| `write_file` | `Write` |
| `list_files` | `Glob` |
| `delete_file` | `Bash` (`rm`) |
| `execute_command` | `Bash` |
| `kill_process` | `Bash` (`kill`) |
| `send_mail` | `mcp__buzybeez-mail__send_mail` |

### Key Differences from Manual Implementation

- **No manual tool loop**: The SDK handles the agentic loop internally (call Claude, execute tools, feed results back, repeat)
- **Built-in tools**: Read, Write, Edit, Bash, Glob, Grep are provided by the SDK with no custom implementation needed
- **Session management**: The SDK manages conversation history; we just persist the session ID between mail processing calls
- **MCP integration**: The `send_mail` tool is provided via an MCP server subprocess rather than being hard-coded

## MCP Mail Server

`docker/mcp-mail-server.js` is a small MCP (Model Context Protocol) server that provides the `send_mail` tool to Claude.

- Uses `@modelcontextprotocol/sdk` with `StdioServerTransport`
- Runs as a subprocess spawned by the Agent SDK
- Reads `BEE_ID` from environment (inherited from runner)
- Writes mail JSON to `/outbox/{timestamp}-{uuid}.json`
- Mail format matches what the API server expects for routing

### send_mail Parameters

| Parameter | Type | Description |
|---|---|---|
| `to` | string | Recipient ID (`"bee-002"`, `"human"`) |
| `subject` | string | Mail subject line |
| `body` | string | Mail body text |

## Session Persistence

The runner persists the Agent SDK session ID to `/state/session-id.txt`. On subsequent mail processing:

1. Load existing session ID from file (if any)
2. Pass it to `query()` via `options.sessionId`
3. Capture the returned session ID from `init` messages
4. Save it for the next invocation

This gives bees conversation continuity across multiple mail messages. When a bee container is restarted, the session data in `/root/.claude` (volume-mounted) allows it to resume context.

## Transcript Logging

The runner logs structured JSONL entries to `/logs/transcript.jsonl` for the LogViewer UI. Each entry has:

```json
{
  "id": "uuid",
  "timestamp": "ISO-8601",
  "beeId": "bee-001",
  "type": "...",
  ...
}
```

### Entry Types

| Type | When Logged | Key Fields |
|---|---|---|
| `bee_started` | On startup | `name` |
| `mail_received` | Mail read from inbox | `mailId`, `from`, `subject` |
| `claude_request` | Before calling `query()` | `messageCount` |
| `tool_call` | SDK emits tool_use message | `tool`, `input` |
| `tool_result` | SDK emits tool_result message | `tool`, `result` |
| `mail_sent` | send_mail tool is called | `mailId`, `to`, `subject` |
| `claude_response` | After `query()` completes | `stopReason`, `responseText` |
| `mail_processed` | After full processing | `mailId`, `from`, `responseText` |
| `error` | On any error | `error`, `mailId` or `file` |

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | - | Anthropic API key |
| `BEE_ID` | No | `bee-001` | Unique bee identifier |
| `BEE_NAME` | No | `Worker Bee` | Display name |
| `MODEL` | No | `claude-haiku-4-5-20251001` | Claude model to use |
| `CLAUDE_CODE_CWD` | No | - | Working directory for Claude Code CLI |
