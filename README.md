# BuzyBeez MVP

A single, perfect bee - the atomic unit for the BuzyBeez agent orchestration system.

## What This Does

- **One bee** running in a Docker container, powered by Claude
- **Mail queue** - send mail to the bee, get responses back
- **File system** - bee can read/write files in its workspace
- **State persistence** - stop/start the bee without losing files or conversation history
- **Full observability** - see every tool call, every response in the transcript

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Build the Docker image
npm run docker:build

# 3. Create .env file with your API key
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env

# 4. Start the server
npm run dev

# 5. Open http://localhost:3000
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Web UI (React)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ Bee Controls │  │Human Mailbox │  │   Transcript     │   │
│  │ Start/Stop   │  │ Send/Receive │  │    Viewer        │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP/WebSocket
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     API Server (Express)                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ Docker API + File Watching
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Docker Container (Bee)                    │
│                                                              │
│  - Watches /inbox for mail                                  │
│  - Calls Claude API with mail content                       │
│  - Has tools: read_file, write_file, list_files             │
│  - Writes responses to /outbox                              │
│  - Logs to /logs/transcript.jsonl                           │
│                                                              │
│  Mounted Volumes (persistent):                              │
│    /inbox, /outbox, /state, /logs, /workspace, /soul.md    │
└─────────────────────────────────────────────────────────────┘
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/bee/status` | Get bee status (running/stopped) |
| POST | `/api/bee/start` | Start the bee container |
| POST | `/api/bee/stop` | Stop the bee (preserves state) |
| POST | `/api/mail/send` | Send mail to bee |
| GET | `/api/mail/inbox` | Get received mail (from bee) |
| GET | `/api/mail/outbox` | Get sent mail (to bee) |
| GET | `/api/transcript` | Get activity transcript |
| GET | `/api/files` | List workspace files |
| WS | `/` | Real-time updates |

## Running the Acceptance Test

```bash
# With server running in another terminal:
npm test
```

The test verifies:
1. Bee starts and stops correctly
2. Bee processes mail and responds
3. Bee can create files using tools
4. Files persist across stop/start
5. Bee can read files it created
6. Transcript captures all activity

## File Structure

```
buzybeez-mvp/
├── docker/
│   ├── Dockerfile      # Bee container definition
│   ├── package.json    # Container dependencies
│   └── runner.js       # The agent code
├── server/
│   ├── index.ts        # Express API server
│   ├── docker.ts       # Docker management
│   ├── mailbox.ts      # Mail queue
│   └── watcher.ts      # Transcript watcher
├── web/
│   ├── index.html
│   ├── app.jsx         # React UI
│   └── styles.css
├── data/bee/           # Mounted into container
│   ├── inbox/          # Mail to bee
│   ├── outbox/         # Mail from bee
│   ├── state/          # Conversation history
│   ├── logs/           # Transcript
│   ├── workspace/      # Bee's files
│   └── soul.md         # Bee personality
└── test/
    └── acceptance.ts   # E2E test
```

## Next Steps

This MVP proves the core bee concept. Next:
- Multiple beez with routing
- Skill system
- Canvas UI for designing swarmz
