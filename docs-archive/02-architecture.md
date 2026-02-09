# Architecture

BuzyBeez is a four-layer system: Canvas UI, Orchestrator, Bee Runtime, and Docker Containers.

---

## System Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CANVAS UI                                       │
│                                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ Node Canvas  │  │  Log Viewer  │  │ Mail Manager │  │  Terminal    │    │
│  │              │  │              │  │              │  │              │    │
│  │ Design swarmz│  │ Transcripts  │  │ View/edit/   │  │ SSH into     │    │
│  │ topology     │  │ + mail       │  │ approve mail │  │ containers   │    │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘    │
│                                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                      │
│  │ Skill        │  │ File         │  │ Cron         │                      │
│  │ Registry     │  │ Explorer     │  │ Manager      │                      │
│  │              │  │              │  │              │                      │
│  │ Browse/      │  │ Browse bee   │  │ View/edit    │                      │
│  │ assign skills│  │ filesystems  │  │ schedules    │                      │
│  └──────────────┘  └──────────────┘  └──────────────┘                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ WebSocket + REST
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                             ORCHESTRATOR                                     │
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │ Swarmz Manager  │  │ Mail Router     │  │ Cron Scheduler  │             │
│  │                 │  │                 │  │                 │             │
│  │ - Parse config  │  │ - Validate      │  │ - Timer-based   │             │
│  │ - Validate      │  │   topology      │  │   (no polling)  │             │
│  │   topology      │  │ - Route mail    │  │ - Generate mail │             │
│  │ - Track state   │  │ - Handle bounce │  │   at exact time │             │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘             │
│                                                                             │
│  ┌─────────────────┐                                                        │
│  │ System Logger   │                                                        │
│  │                 │                                                        │
│  │ - Container     │                                                        │
│  │   events        │                                                        │
│  │ - Startups      │                                                        │
│  │ - Failures      │                                                        │
│  └─────────────────┘                                                        │
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │ Lifecycle Mgr   │  │ Skill Registry  │  │ API Server      │             │
│  │                 │  │                 │  │                 │             │
│  │ - Start/stop    │  │ - CRUD skills   │  │ - REST routes   │             │
│  │ - Pause/resume  │  │ - Track usage   │  │ - WebSocket     │             │
│  │ - Health checks │  │ - Versioning    │  │ - Auth (future) │             │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Docker API + File Mounts
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            BEE RUNTIME                                       │
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │ Docker Manager  │  │ Agent Runner    │  │ Mail Handler    │             │
│  │                 │  │                 │  │                 │             │
│  │ - Create/remove │  │ - claude-agent  │  │ - Inbox queue   │             │
│  │ - Start/stop    │  │   -sdk wrapper  │  │ - Outbox queue  │             │
│  │ - Mount volumes │  │ - State persist │  │ - Wake on mail  │             │
│  │ - Inject env    │  │ - Save/resume   │  │ - Send mail     │             │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘             │
│                                                                             │
│  ┌─────────────────┐                                                        │
│  │ Skill Loader    │                                                        │
│  │                 │                                                        │
│  │ - Mount context │                                                        │
│  │ - Mount scripts │                                                        │
│  │ - Start MCPs    │                                                        │
│  └─────────────────┘                                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Container Runtime
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          DOCKER CONTAINERS                                   │
│                                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Bee A     │  │   Bee B     │  │   Bee C     │  │   Bee D     │        │
│  │ (keepAlive) │  │             │  │             │  │             │        │
│  │             │  │             │  │             │  │             │        │
│  │ /skills/    │  │ /skills/    │  │ /skills/    │  │ /skills/    │        │
│  │ /inbox/     │  │ /inbox/     │  │ /inbox/     │  │ /inbox/     │        │
│  │ /outbox/    │  │ /outbox/    │  │ /outbox/    │  │ /outbox/    │        │
│  │ /state/     │  │ /state/     │  │ /state/     │  │ /state/     │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                                             │
│  Base Image: debian:bookworm-slim + Node.js 20 + claude-agent-sdk          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Layer Details

### Canvas UI

**Purpose**: Human interface for designing swarms and observing runtime.

**Components**:

| Component | Responsibility |
|-----------|----------------|
| Node Canvas | Drag-and-drop swarmz design using react-flow |
| Log Viewer | View agent transcripts, mail history, and system log with timeline |
| Mail Manager | View queued mail, edit content, approve human-in-the-loop |
| Terminal | xterm.js shell into any bee container |
| Skill Registry | Browse available skills, assign to beez |
| File Explorer | Browse and edit files in bee containers (including soul.md) |
| Cron Manager | View, create, edit, enable/disable scheduled events |

**Communication**: WebSocket for real-time updates, REST for actions.

---

### Orchestrator

**Purpose**: Central coordinator that manages swarm state and routes mail.

**Components**:

| Component | Responsibility |
|-----------|----------------|
| Swarmz Manager | Parse swarmz JSON config, validate topology, track runtime state |
| Mail Router | Validate mail against topology, deliver or bounce |
| Cron Scheduler | Timer-based scheduling, fires mail at exact times (no polling) |
| Lifecycle Manager | Start/stop/pause/resume individual beez or entire swarmz |
| Skill Registry | CRUD for skills, track ownership and usage |
| System Logger | Central log for container events, startups, failures (separate from bee logs) |
| API Server | HTTP REST endpoints + WebSocket event stream |

**State Management**:
- Swarmz config stored as JSON file
- Runtime state (bee status, mail queues) kept in memory with persistence to disk
- Skill registry stored as JSON file
- System log stored as append-only JSONL file

---

### Bee Runtime

**Purpose**: Manages the execution environment for each bee.

**Components**:

| Component | Responsibility |
|-----------|----------------|
| Docker Manager | Container lifecycle via dockerode (create, start, stop, remove) |
| Agent Runner | Wraps claude-agent-sdk, handles session save/resume |
| Mail Handler | Manages inbox/outbox queues, triggers agent wake |
| Skill Loader | Mounts skill files to container, injects env vars, starts local MCPs |

**Key Behaviors**:
- Inbox is a directory of JSON files (one per mail)
- Agent watches inbox, wakes when new mail appears
- Agent state persisted via claude-agent-sdk's session save
- Pause freezes container, resume thaws it

---

### Docker Containers

**Purpose**: Sandboxed execution environment for each bee.

**Base Image Contents**:
- debian:bookworm-slim (minimal, stable)
- Node.js 20 LTS
- claude-agent-sdk
- Bee agent runner script (watches inbox, runs agent)

**Mounted Volumes**:
| Path | Contents |
|------|----------|
| `/skills/` | Context files, scripts from assigned skills |
| `/inbox/` | Incoming mail queue (JSON files) |
| `/outbox/` | Outgoing mail (auto-sent, kept for history) |
| `/state/` | Agent session state for save/resume |
| `/soul.md` | Bee's soul file (personality, base instructions) |

**Environment Variables**:
- API keys from skills injected as env vars
- Bee metadata (ID, name, keepAlive, timeout)
- Orchestrator callback URL (for internal communication)

---

## Data Flow

### Mail Delivery Flow

```
1. Sender (Bee, Mailbox, or System) creates mail
2. For beez: Agent writes mail to /outbox/, which is watched by orchestrator
   For mailboxez: Mail arrives via API
3. Orchestrator automatically picks up outbox mail and validates:
   - Does sender → recipient connection exist in topology?
   - Is mail properly formatted?
4. If connection requires approval:
   - Mail queued with status "pending_approval"
   - Human notified via WebSocket
   - Wait for approval
5. Orchestrator writes mail JSON to recipient's /inbox/ (or mailbox queue)
6. For beez: Agent runner detects new file
7. If agent is idle: wake and process
   If agent is busy: mail stays in queue
8. Agent processes mail, generates response
9. Agent writes response to /outbox/ (automatically picked up - no API call needed)
10. Orchestrator routes response mail (back to step 3)
```

**Key point**: Beez don't call an API to send mail. They write to `/outbox/` and the orchestrator watches for changes and routes automatically.

### Cron Event Flow

```
1. Cron scheduler sets timers for each scheduled event (no polling)
2. When timer fires at the exact scheduled time:
   - Generate mail from template
   - Set from: "system", type: "cron"
3. Deliver mail via normal mail flow
```

**Key point**: Cron events fire at the exact scheduled time using timers, not polling. This is more precise and efficient.

### State Persistence Flow

```
1. Agent completes processing mail item
2. claude-agent-sdk session saved to /state/
3. Agent returns to idle (watching inbox)
4. If pause requested:
   - Container paused (docker pause)
   - All state already on disk
5. On resume:
   - Container unpaused
   - Agent resumes watching inbox
   - If mid-task, session restored from /state/
```

---

## Modularity Points

The architecture is designed for future extensibility:

### Compute Layer Abstraction

Currently: Local Docker containers

Future: The Bee Runtime layer abstracts container management. To support remote machines (Mac Mini, cloud VMs):
1. Implement alternative to Docker Manager (SSH-based, cloud API)
2. Implement alternative Skill Loader (rsync, cloud storage)
3. Mail Handler uses HTTP callbacks (already works remotely)

### Agent Runtime Abstraction

Currently: claude-agent-sdk

Future: Agent Runner could support multiple backends:
- Different Claude models
- Other AI providers
- Custom agent implementations

### Storage Abstraction

Currently: File-based (JSON files, mounted volumes)

Future: Could swap in:
- Redis for mail queues
- PostgreSQL for state
- S3 for skill storage

---

## Concurrency Model

### Orchestrator
- Single Node.js process
- Async I/O for API requests
- In-memory state with periodic disk persistence
- WebSocket connections managed via event loop

### Bee Containers
- One container per bee
- One agent process per container
- Sequential mail processing (one at a time)
- Sub-agents (via claude-agent-sdk) run within same process

### Mail Processing
- Each bee processes mail sequentially (no parallel processing within a bee)
- Multiple beez process mail in parallel (each bee independent)
- Mail queue is FIFO per bee

---

## Security Boundaries

| Boundary | Protection |
|----------|------------|
| Bee ↔ Bee | Can only communicate via mail through defined connections |
| Bee ↔ Host | Container sandboxing, mounted volumes are explicit |
| Bee ↔ Internet | Network access controlled by Docker networking |
| API ↔ World | Authentication (future), rate limiting |
| Skills ↔ Bee | Skills are read-only mounts (except agent-created skills) |

---

## Failure Modes

| Failure | Detection | Recovery |
|---------|-----------|----------|
| Bee container crashes | Docker event listener | Restart container, resume from /state/ |
| Orchestrator crashes | Process monitor | Restart, reload state from disk |
| Mail delivery fails | Timeout or error | Generate bounce mail to sender |
| Agent hangs | Timeout on mail processing | Kill agent, mark mail as failed, restart |
| Disk full | Health check | Alert human, pause swarmz |

All failures are logged to the central system log (separate from individual bee transcripts).
