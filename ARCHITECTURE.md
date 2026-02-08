# BuzyBeez MVP - Single Bee Architecture

## Goal
Build one perfect bee as the atomic unit for the entire system.

## Components

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
│                                                              │
│  POST /bee/start     - Start the bee container              │
│  POST /bee/stop      - Stop the bee (preserves state)       │
│  GET  /bee/status    - Get bee status                       │
│  POST /mail/send     - Send mail from human to bee          │
│  GET  /mail/inbox    - Get human's received mail            │
│  GET  /transcript    - Get bee's activity log               │
│  WS   /ws            - Real-time updates                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ Docker API + File Watching
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Docker Container (Bee)                    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                    runner.ts                         │    │
│  │  - Watches /inbox for mail                          │    │
│  │  - Calls Claude API with mail content               │    │
│  │  - Has filesystem tools (read, write, list)         │    │
│  │  - Writes responses to /outbox                      │    │
│  │  - Logs everything to /logs/transcript.jsonl        │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  Mounted Volumes (persistent across stop/start):            │
│    /inbox     - Incoming mail queue                         │
│    /outbox    - Outgoing mail                               │
│    /state     - Agent conversation state                    │
│    /logs      - Transcript logs                             │
│    /workspace - Bee's working directory (files it creates)  │
│    /soul.md   - Bee's personality/instructions              │
└─────────────────────────────────────────────────────────────┘
```

## File Structure

```
buzybeez-mvp/
├── package.json
├── docker/
│   ├── Dockerfile
│   └── runner.ts          # The agent code that runs inside container
├── server/
│   ├── index.ts           # Express API server
│   ├── docker.ts          # Docker management
│   ├── mailbox.ts         # Mail queue management
│   └── watcher.ts         # File watchers for outbox
├── web/
│   ├── index.html
│   ├── app.tsx            # React app
│   └── styles.css
├── data/
│   └── bee/               # Mounted into container
│       ├── inbox/
│       ├── outbox/
│       ├── state/
│       ├── logs/
│       ├── workspace/
│       └── soul.md
└── .env                   # ANTHROPIC_API_KEY
```

## Mail Flow

1. Human types message in web UI
2. UI calls POST /mail/send
3. Server writes mail JSON to data/bee/inbox/
4. Container runner.ts detects new file
5. Runner reads mail, calls Claude API
6. Claude can use tools: read_file, write_file, list_files
7. Claude responds, runner writes to /outbox/
8. Server's file watcher detects outbox file
9. Server broadcasts via WebSocket to UI
10. UI shows response in human mailbox

## State Persistence

- **Conversation history**: Stored in /state/conversation.json
- **Files created by bee**: Stored in /workspace/
- **Transcript**: Append-only /logs/transcript.jsonl

On stop: Container stops, volumes remain
On start: Container starts, loads conversation from /state/

## Acceptance Test

Send mail: "Create a file called hello.txt with 'Hello from BuzyBeez'. Then read it back."

Expected:
1. Bee receives mail
2. Bee creates /workspace/hello.txt
3. Bee reads file back
4. Bee responds confirming contents
5. Stop bee, start bee
6. File still exists
7. Send "What's in hello.txt?" - bee remembers/can read it
