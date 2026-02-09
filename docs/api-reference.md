# API Reference

The BuzyBeez API server runs on port 3000 (configurable via `PORT` env var) and provides REST endpoints plus WebSocket events.

## Base URL

```
http://localhost:3000
```

## Swarm Management

### GET /api/swarm

Get the current swarm configuration.

**Response:**
```json
{
  "id": "default-swarm",
  "name": "Default Swarm",
  "bees": [
    { "id": "bee-001", "name": "Worker Bee" }
  ],
  "connections": [
    { "from": "human", "to": "bee-001" },
    { "from": "bee-001", "to": "human" }
  ]
}
```

### PUT /api/swarm

Replace the entire swarm configuration.

**Body:** Full `SwarmConfig` object.

## Bee Management

### GET /api/bees

List all bees with their current status.

**Response:**
```json
[
  {
    "id": "bee-001",
    "name": "Worker Bee",
    "running": true,
    "containerId": "abc123...",
    "startedAt": "2025-01-01T00:00:00Z"
  }
]
```

### POST /api/bees

Add a new bee to the swarm.

**Body:**
```json
{
  "id": "bee-002",
  "name": "Research Bee",
  "model": "claude-sonnet-4-20250514"
}
```

### DELETE /api/bees/:id

Remove a bee (stops container, removes config entry and data).

### POST /api/bees/:id/start

Start a bee's Docker container. Creates the container if it doesn't exist. Sets up outbox watching for mail routing.

**Response:**
```json
{
  "success": true,
  "state": { "id": "bee-001", "name": "Worker Bee", "running": true }
}
```

### POST /api/bees/:id/stop

Stop a bee's Docker container.

### GET /api/bees/:id/status

Get a single bee's current status.

### GET /api/bees/:id/hierarchy

Get a bee's position in the hierarchy (who it receives tasks from, who it can delegate to).

**Response:**
```json
{
  "beeId": "bee-001",
  "receivesTasksFrom": [
    { "id": "human", "name": "Human", "type": "human" }
  ],
  "canDelegateTo": [
    { "id": "bee-002", "name": "Research Bee", "type": "bee" }
  ]
}
```

### GET /api/bees/:id/transcript

Get the bee's transcript log entries.

**Response:** Array of JSONL entries (see [bee-runner.md](bee-runner.md) for entry types).

### GET /api/bees/:id/files

List files in a bee's workspace.

**Response:**
```json
[
  { "name": "hello.txt", "type": "file", "size": 12 },
  { "name": "src", "type": "directory", "size": 4096 }
]
```

### GET /api/bees/:id/inbox

Get all mail currently in a bee's inbox.

### GET /api/bees/:id/outbox

Get all mail currently in a bee's outbox.

## Connection Management

### POST /api/connections

Add a connection between two nodes.

**Body:**
```json
{
  "from": "human",
  "to": "bee-001",
  "bidirectional": true
}
```

When `bidirectional` is true, both directions (from->to and to->from) are created.

### DELETE /api/connections

Remove a connection.

**Body:**
```json
{
  "from": "human",
  "to": "bee-001",
  "bidirectional": false
}
```

### PATCH /api/connections

Update the bidirectional flag on an existing connection.

**Body:**
```json
{
  "from": "human",
  "to": "bee-001",
  "bidirectional": true
}
```

## Mail

### GET /api/mail/inbox

Get the human inbox (all mail received by the human).

### GET /api/mail/outbox

Get the human outbox (all mail sent by the human).

### POST /api/mail/send

Send mail from the human to a bee.

**Body:**
```json
{
  "to": "bee-001",
  "subject": "Create a hello world file",
  "body": "Please create a file called hello.txt with the content 'Hello, World!'",
  "attachments": ["file-uuid-1"]
}
```

`attachments` is optional; it's an array of file IDs from previously uploaded files.

**Response:**
```json
{
  "success": true,
  "mail": { "id": "...", "from": "human", "to": "bee-001", ... }
}
```

### GET /api/mail/counts

Get inbox/outbox counts and processing status for all nodes.

**Response:**
```json
{
  "human": { "inbox": 2, "outbox": 1, "processing": false },
  "bee-001": { "inbox": 0, "outbox": 0, "processing": false }
}
```

## File Management

### POST /api/files

Upload a file (multipart form data, field name: `file`). Max size: 50MB.

**Response:**
```json
{
  "success": true,
  "file": {
    "id": "uuid",
    "filename": "document.pdf",
    "mimeType": "application/pdf",
    "size": 12345,
    "path": "uuid.pdf"
  }
}
```

### GET /api/files/:id

Download a file by its ID.

### GET /api/files/:id/metadata

Get file metadata without downloading.

## Canvas Layout

### GET /api/canvas

Get the canvas layout (node positions and edges). Falls back to auto-generated layout from swarm config if no saved layout exists.

### PUT /api/canvas

Save the canvas layout.

**Body:**
```json
{
  "nodes": [
    { "id": "human", "type": "human", "position": { "x": 100, "y": 200 }, "data": { "label": "Human Mailbox" } }
  ]
}
```

## Skills

### GET /api/skills

List all registered skills.

### GET /api/skills/:id

Get a skill by ID, including manifest and available versions. Supports `?version=X.Y.Z` query parameter.

### POST /api/skills

Register a new skill (body is a `SkillManifest` JSON).

### DELETE /api/skills/:id

Delete a skill. Supports `?version=X.Y.Z` to delete a specific version.

## Legacy Endpoints

These are single-bee compatibility endpoints that operate on the first bee in the config:

- `GET /api/bee/status` - Get first bee's status
- `POST /api/bee/start` - Start first bee
- `POST /api/bee/stop` - Stop first bee

## WebSocket Events

Connect to `ws://localhost:3000` to receive real-time events. Messages are JSON with `{ event, data }` structure.

| Event | Data | When |
|---|---|---|
| `mail:received` | `Mail` object | Mail delivered to human inbox |
| `mail:sent` | `Mail` object | Human sends mail |
| `mail:routed` | `Mail` object | Mail routed between bees |
| `mail:failed` | `{ mail, error }` | Mail routing failed |
| `mail:counts` | Count map | Inbox/outbox counts change |
| `bee:status` | `BeeState` object | Bee starts or stops |
| `swarm:updated` | `SwarmConfig` object | Swarm config changes |
