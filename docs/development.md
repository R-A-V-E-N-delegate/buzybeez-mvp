# Development Guide

## Prerequisites

- **Node.js 20+** (for the API server and frontend build)
- **Docker** (running, for bee containers)
- **Anthropic API key** (`ANTHROPIC_API_KEY` environment variable)

## Initial Setup

```bash
# Install server + frontend dependencies
npm install

# Build the bee Docker image
npm run docker:build

# Set your API key
export ANTHROPIC_API_KEY=sk-ant-...
```

## Running in Development

```bash
# Start the API server with auto-reload
npm run dev
```

This starts the Express server on `http://localhost:3000`. The server serves the Vite-built frontend from `web-vite/dist/` if it exists, otherwise falls back to `web/`.

To develop the frontend with hot reload:

```bash
cd web-vite
npm run dev
```

This starts the Vite dev server (typically on port 5173) with HMR. Configure it to proxy API requests to port 3000.

## Building

```bash
# Build the frontend
cd web-vite && npm run build

# Build the Docker image for bees
npm run docker:build
```

## Project Layout

```
server/
  index.ts       - Express app, REST routes, WebSocket, mail routing
  swarm.ts       - SwarmManager: Docker lifecycle, connections, hierarchy
  types.ts       - All TypeScript interfaces
  skills.ts      - SkillsRegistry: skill registration and loading

web-vite/
  src/
    components/  - React components (Canvas, MailComposer, LogViewer, etc.)
    hooks/       - Custom hooks (useWebSocket, useSwarm, etc.)

docker/
  runner.js         - Agent SDK runner (polls inbox, calls query())
  mcp-mail-server.js - MCP server for send_mail tool
  Dockerfile        - Bee container image
  package.json      - Runner dependencies
```

## Adding a New Bee

### Via the UI

1. Open the canvas
2. Use the "Add Bee" button
3. Configure name and model
4. Draw connections from/to the bee
5. Click "Start" on the bee node

### Via the API

```bash
# Add the bee
curl -X POST http://localhost:3000/api/bees \
  -H 'Content-Type: application/json' \
  -d '{"id": "bee-003", "name": "Coder Bee"}'

# Add connections
curl -X POST http://localhost:3000/api/connections \
  -H 'Content-Type: application/json' \
  -d '{"from": "human", "to": "bee-003", "bidirectional": true}'

# Start the bee
curl -X POST http://localhost:3000/api/bees/bee-003/start
```

## Modifying Soul Files

Each bee's soul file is at `data/bees/<id>/soul.md`. It's created from the default template (or custom `soul` field in `BeeConfig`) when the bee is first started.

To customize:

1. Edit `data/bees/<id>/soul.md` directly
2. Restart the bee (stop + start) to pick up changes

The soul file is mounted read-only at `/soul.md` inside the container.

Note: If you delete the bee's data directory and restart, the soul file will be regenerated from the default template.

## Modifying the Runner

The bee runner is baked into the Docker image. After editing `docker/runner.js` or `docker/mcp-mail-server.js`:

```bash
# Rebuild the image
npm run docker:build

# Stop and remove existing containers (they use the old image)
# Then restart bees from the UI or API
```

## Environment Variables

### Server

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | API server port |
| `ANTHROPIC_API_KEY` | - | Required for starting bees |

### Bee Container (set by SwarmManager)

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Passed from server environment |
| `BEE_ID` | Unique bee identifier |
| `BEE_NAME` | Display name |
| `MODEL` | Claude model to use |
| `CLAUDE_CODE_CWD` | Set to `/workspace` |

## Testing

```bash
# Run Playwright tests (API + UI)
npm test
```

### Manual Smoke Test

1. Start the server: `npm run dev`
2. Open `http://localhost:3000`
3. Start `bee-001` from the canvas
4. Send a mail: "Create a file called hello.txt with 'Hello, World!'"
5. Verify:
   - Response mail appears in human inbox
   - `data/bees/bee-001/workspace/hello.txt` exists
   - LogViewer shows tool_call and mail_sent entries

### Multi-Bee Test

1. Add `bee-002` via the UI
2. Connect `bee-001 -> bee-002` and `bee-002 -> bee-001`
3. Start both bees
4. Send a task to `bee-001` that requires delegation
5. Verify mail flows between bees and back to human

## Debugging

### View Bee Logs

```bash
# Real-time container logs
docker logs -f buzybeez-bee-001

# Transcript file
cat data/bees/bee-001/logs/transcript.jsonl | jq .
```

### Inspect Bee State

```bash
# Session ID
cat data/bees/bee-001/state/session-id.txt

# Hierarchy
cat data/bees/bee-001/state/hierarchy.json | jq .

# Workspace files
ls data/bees/bee-001/workspace/
```

### Common Issues

- **"ANTHROPIC_API_KEY environment variable is required"**: Set the env var before starting the server
- **Container won't start**: Run `docker images` to verify `buzybeez-bee:latest` exists; rebuild if needed
- **Mail not routing**: Check that connections exist in both directions for bidirectional communication
- **Session not persisting**: Verify `data/bees/<id>/claude-data/` directory exists and is volume-mounted
