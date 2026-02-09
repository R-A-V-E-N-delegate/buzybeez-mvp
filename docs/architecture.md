# Architecture

BuzyBeez is a three-layer system: a React frontend, an Express API server, and Docker containers running Claude-powered agents.

## System Overview

```
Browser (React + React Flow)
    |
    | HTTP REST + WebSocket
    v
Express API Server (server/index.ts)
    |
    | Docker API (dockerode) + Filesystem (chokidar)
    v
Docker Containers (one per bee)
    |
    | Claude Agent SDK + MCP
    v
Anthropic API
```

## Layers

### Frontend (web-vite/)

- **React Flow canvas**: Visual node-graph editor where bees and the human mailbox are nodes, and connections are edges
- **Mail composer**: Send mail from the human mailbox to any connected bee
- **Log viewer**: Real-time transcript viewer showing tool calls, mail events, and Claude responses per bee
- **WebSocket client**: Receives live events (mail delivery, bee status, swarm config changes)

### API Server (server/)

- **Express REST API**: ~25 endpoints for swarm management, mail operations, file uploads, canvas layout, and skills
- **SwarmManager** (`swarm.ts`): Manages Docker container lifecycle (create, start, stop, remove) via dockerode
- **Mail routing**: Watches each bee's `/outbox` directory with chokidar; routes mail to the correct bee's `/inbox` or to the human inbox
- **WebSocket broadcasting**: Pushes real-time events to all connected frontend clients
- **SkillsRegistry** (`skills.ts`): Manages composable capability packs for bees

### Bee Containers (docker/)

- **runner.js**: Polls `/inbox` for mail, processes each message through the Claude Agent SDK's `query()` function, streams back results
- **mcp-mail-server.js**: MCP server subprocess providing the `send_mail` tool so Claude can send mail to other bees or humans
- **Built-in tools**: The Agent SDK provides Read, Write, Edit, Bash, Glob, Grep out of the box
- **Session persistence**: SDK sessions are stored at `/root/.claude` (volume-mounted to `data/bees/<id>/claude-data/`)

## Data Flow: Processing a Mail

1. Human composes mail in the UI and sends it via `POST /api/mail/send`
2. API server writes the mail JSON to `data/bees/<target-bee>/inbox/<timestamp>-<id>.json`
3. The bee's runner.js polls `/inbox`, finds the new file, reads and deletes it
4. Runner calls `query()` with the mail content as the prompt, soul file as system prompt
5. Claude uses tools (Read, Write, Bash, etc.) and `send_mail` to complete the task
6. When `send_mail` is called, the MCP server writes a JSON file to `/outbox`
7. API server's chokidar watcher detects the outbox file, reads and deletes it
8. If addressed to `human`: added to human inbox, broadcast via WebSocket
9. If addressed to another bee: written to that bee's `/inbox` directory

## Volume Mounts

Each bee container has these volume mounts:

| Container Path | Host Path | Purpose |
|---|---|---|
| `/inbox` | `data/bees/<id>/inbox` | Incoming mail |
| `/outbox` | `data/bees/<id>/outbox` | Outgoing mail |
| `/state` | `data/bees/<id>/state` | Session ID, hierarchy |
| `/logs` | `data/bees/<id>/logs` | Transcript JSONL |
| `/workspace` | `data/bees/<id>/workspace` | Bee's working directory |
| `/soul.md` | `data/bees/<id>/soul.md` | Personality/instructions (read-only) |
| `/root/.claude` | `data/bees/<id>/claude-data` | Agent SDK session data |

## Connection Model

Connections between nodes (bees and human) are directional. A connection from A to B means A can send mail to B. Bidirectional connections are stored as two separate directional connections internally but displayed as a single edge with arrows on both ends in the canvas UI.

The `swarm.json` config file stores all bees and connections. The canvas layout (node positions) is stored separately in `canvas-layout.json`.
