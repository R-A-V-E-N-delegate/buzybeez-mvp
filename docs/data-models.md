# Data Models

All TypeScript interfaces are defined in `server/types.ts`.

## Core Types

### BeeConfig

Configuration for a single bee.

```typescript
interface BeeConfig {
  id: string;          // Unique ID, e.g. "bee-001"
  name: string;        // Display name, e.g. "Worker Bee"
  soul?: string;       // Custom soul.md content (uses default if omitted)
  model?: string;      // Claude model ID (default: claude-haiku-4-5-20251001)
}
```

### BeeState

Runtime state of a bee (config + container status).

```typescript
interface BeeState {
  id: string;
  name: string;
  running: boolean;
  containerId?: string;   // Docker container ID
  startedAt?: string;     // ISO-8601 timestamp
}
```

### SwarmConfig

The top-level swarm configuration stored in `data/swarm.json`.

```typescript
interface SwarmConfig {
  id: string;              // Swarm ID
  name: string;            // Swarm display name
  bees: BeeConfig[];       // All bees in the swarm
  connections: Connection[];  // Mail routing connections
}
```

### Connection

A directional mail route between two nodes.

```typescript
interface Connection {
  from: string;            // Source node (bee ID or "human")
  to: string;              // Target node (bee ID or "human")
  bidirectional?: boolean; // If true, represents both directions
}
```

### Mail

A mail message passed between nodes.

```typescript
interface Mail {
  id: string;              // UUID
  from: string;            // Sender (bee ID or "human")
  to: string;              // Recipient (bee ID or "human")
  subject: string;
  body: string;
  timestamp: string;       // ISO-8601
  metadata: {
    type: 'human' | 'agent' | 'system';
    priority?: 'low' | 'normal' | 'high';
    inReplyTo?: string;    // Mail ID this is replying to
  };
  status: 'queued' | 'processing' | 'delivered' | 'failed';
  attachments?: FileAttachment[];
}
```

### FileAttachment

A file attached to a mail message.

```typescript
interface FileAttachment {
  id: string;              // UUID
  filename: string;        // Original filename
  mimeType: string;
  size: number;            // Bytes
  path: string;            // Relative path in data/files/
}
```

## Canvas Types

### CanvasNode

A node on the React Flow canvas.

```typescript
interface CanvasNode {
  id: string;
  type: 'bee' | 'human';
  position: { x: number; y: number };
  data: {
    label: string;
    beeId?: string;
    running?: boolean;
  };
}
```

### CanvasEdge

An edge on the React Flow canvas.

```typescript
interface CanvasEdge {
  id: string;
  source: string;
  target: string;
  bidirectional?: boolean;
}
```

## Skills Types

### SkillManifest

Definition of a skill pack.

```typescript
interface SkillManifest {
  id: string;                    // Lowercase, hyphens only
  name: string;
  version: string;               // Semver (X.Y.Z)
  description: string;
  owner: 'built-in' | string;   // 'built-in' or bee ID
  context?: string[];            // Paths to context files
  scripts?: string[];            // Paths to executable scripts
  envVars?: string[];            // Required env var names
  mcpServers?: McpServerConfig[];
  dependencies?: string[];       // Other skill IDs
  nodeVersion?: string;
  systemPackages?: string[];     // apt packages
}
```

### SkillRegistryEntry

A registered skill in the registry index.

```typescript
interface SkillRegistryEntry {
  id: string;
  versions: string[];
  latestVersion: string;
  owner: 'built-in' | string;
  usedBy: string[];            // Bee IDs using this skill
  registeredAt: string;
  updatedAt: string;
}
```

## File Formats

### Mail JSON

Written to inbox/outbox directories. Example:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "from": "human",
  "to": "bee-001",
  "subject": "Create a file",
  "body": "Please create hello.txt with 'Hello World'",
  "timestamp": "2025-06-01T12:00:00.000Z",
  "metadata": {
    "type": "human",
    "priority": "normal"
  },
  "status": "queued"
}
```

Filename pattern: `{timestamp_ms}-{uuid}.json`

### Transcript JSONL

One JSON object per line in `data/bees/<id>/logs/transcript.jsonl`. Each entry has:

```json
{
  "id": "uuid",
  "timestamp": "ISO-8601",
  "beeId": "bee-001",
  "type": "tool_call",
  ...type-specific fields
}
```

See [bee-runner.md](bee-runner.md#entry-types) for the full list of entry types.

### Swarm Config (data/swarm.json)

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

### Canvas Layout (data/canvas-layout.json)

```json
{
  "nodes": [
    {
      "id": "human",
      "type": "human",
      "position": { "x": 100, "y": 200 },
      "data": { "label": "Human Mailbox" }
    },
    {
      "id": "bee-001",
      "type": "bee",
      "position": { "x": 400, "y": 200 },
      "data": { "label": "Worker Bee", "beeId": "bee-001", "running": false }
    }
  ]
}
```

### Hierarchy (data/bees/<id>/state/hierarchy.json)

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

### Session ID (data/bees/<id>/state/session-id.txt)

Plain text file containing the Agent SDK session ID for conversation continuity.
