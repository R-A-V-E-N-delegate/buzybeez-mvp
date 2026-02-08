# API Specification

Complete REST API and WebSocket event specification for the BuzyBeez orchestrator.

---

## Base URL

```
http://localhost:3001/api
```

WebSocket endpoint:
```
ws://localhost:3001/ws
```

---

## Authentication

**MVP**: No authentication. Single-user local deployment.

**Future**: Bearer token authentication, API keys for external integrations.

---

## REST API

### Swarmz Endpoints

#### Get Swarmz Configuration

```
GET /swarmz
```

Returns the current swarmz configuration and runtime state.

**Response 200:**
```json
{
  "config": { /* SwarmzConfig */ },
  "state": { /* SwarmzState */ }
}
```

---

#### Update Swarmz Configuration

```
PUT /swarmz
```

Updates the swarmz configuration. Running beez may need restart for changes to take effect.

**Request Body:** `SwarmzConfig`

**Response 200:**
```json
{
  "config": { /* Updated SwarmzConfig */ },
  "restartRequired": ["bee-id-1", "bee-id-2"]
}
```

**Response 400:** Validation error (invalid topology, missing required fields)

---

#### Start Swarmz

```
POST /swarmz/start
```

Starts all beez in the swarmz.

**Response 200:**
```json
{
  "status": "starting",
  "bees": {
    "bee-1": "starting",
    "bee-2": "starting"
  }
}
```

---

#### Stop Swarmz

```
POST /swarmz/stop
```

Gracefully stops all beez. Waits for current mail processing to complete.

**Query Parameters:**
- `force` (boolean): If true, immediately stop without waiting. Default: false.

**Response 200:**
```json
{
  "status": "stopped",
  "bees": {
    "bee-1": "stopped",
    "bee-2": "stopped"
  }
}
```

---

#### Pause Swarmz

```
POST /swarmz/pause
```

Pauses all beez. State is preserved for resume.

**Response 200:**
```json
{
  "status": "paused",
  "bees": {
    "bee-1": "paused",
    "bee-2": "paused"
  }
}
```

---

#### Resume Swarmz

```
POST /swarmz/resume
```

Resumes all paused beez.

**Response 200:**
```json
{
  "status": "running",
  "bees": {
    "bee-1": "idle",
    "bee-2": "processing"
  }
}
```

---

### Bee Endpoints

#### List All Beez

```
GET /bees
```

Returns all beez with their current state.

**Response 200:**
```json
{
  "bees": [
    {
      "config": { /* BeeConfig */ },
      "state": { /* BeeState */ }
    }
  ]
}
```

---

#### Get Single Bee

```
GET /bees/:id
```

Returns a specific bee's configuration and state.

**Response 200:**
```json
{
  "config": { /* BeeConfig */ },
  "state": { /* BeeState */ }
}
```

**Response 404:** Bee not found

---

#### Start Bee

```
POST /bees/:id/start
```

Starts a specific bee.

**Response 200:**
```json
{
  "id": "bee-1",
  "status": "starting"
}
```

---

#### Stop Bee

```
POST /bees/:id/stop
```

Stops a specific bee.

**Query Parameters:**
- `force` (boolean): Immediate stop without waiting. Default: false.

**Response 200:**
```json
{
  "id": "bee-1",
  "status": "stopped"
}
```

---

#### Pause Bee

```
POST /bees/:id/pause
```

Pauses a specific bee mid-task.

**Response 200:**
```json
{
  "id": "bee-1",
  "status": "paused"
}
```

---

#### Resume Bee

```
POST /bees/:id/resume
```

Resumes a paused bee.

**Response 200:**
```json
{
  "id": "bee-1",
  "status": "idle"
}
```

---

### Mail Endpoints

#### Get Bee Inbox

```
GET /bees/:id/inbox
```

Returns all mail in a bee's inbox.

**Query Parameters:**
- `status` (string): Filter by status (queued, processing, delivered)
- `limit` (number): Max items to return. Default: 100.
- `offset` (number): Pagination offset. Default: 0.

**Response 200:**
```json
{
  "mail": [ /* Mail[] */ ],
  "total": 42,
  "limit": 100,
  "offset": 0
}
```

---

#### Get Bee Outbox

```
GET /bees/:id/outbox
```

Returns sent mail history for a bee.

**Query Parameters:** Same as inbox.

**Response 200:** Same structure as inbox.

---

#### Send Mail to Bee

```
POST /bees/:id/mail
```

Sends mail to a bee (as human or system).

**Request Body:**
```json
{
  "subject": "Task description",
  "body": "Detailed instructions...",
  "from": "human",
  "metadata": {
    "priority": "high"
  }
}
```

**Response 201:**
```json
{
  "mail": { /* Created Mail */ }
}
```

**Response 400:** Invalid mail format
**Response 403:** No connection from sender to recipient

---

#### Get Mail by ID

```
GET /mail/:id
```

Returns a specific mail item.

**Response 200:**
```json
{
  "mail": { /* Mail */ }
}
```

**Response 404:** Mail not found

---

#### Edit Mail in Queue

```
PATCH /mail/:id
```

Edits mail that's still queued (not yet processing).

**Request Body:**
```json
{
  "subject": "Updated subject",
  "body": "Updated body"
}
```

**Response 200:**
```json
{
  "mail": { /* Updated Mail */ }
}
```

**Response 400:** Mail already processing or delivered
**Response 404:** Mail not found

---

#### Delete Mail from Queue

```
DELETE /mail/:id
```

Deletes mail from queue (only if not yet processing).

**Response 204:** Deleted

**Response 400:** Mail already processing or delivered
**Response 404:** Mail not found

---

#### Approve Mail

```
POST /mail/:id/approve
```

Approves mail that requires human-in-the-loop approval.

**Request Body:**
```json
{
  "approvedBy": "user@example.com"
}
```

**Response 200:**
```json
{
  "mail": { /* Updated Mail with approved=true */ }
}
```

**Response 400:** Mail doesn't require approval or already approved
**Response 404:** Mail not found

---

#### Reject Mail

```
POST /mail/:id/reject
```

Rejects mail that requires approval. Creates bounce to sender.

**Request Body:**
```json
{
  "reason": "Content policy violation"
}
```

**Response 200:**
```json
{
  "rejectedMail": { /* Mail with status=bounced */ },
  "bounceMail": { /* Bounce mail sent to original sender */ }
}
```

---

### Logs Endpoints

#### Get Bee Transcript

```
GET /bees/:id/transcript
```

Returns full agent transcript (all activity).

**Query Parameters:**
- `since` (string): ISO 8601 timestamp. Only entries after this time.
- `types` (string): Comma-separated entry types to include.
- `limit` (number): Max entries. Default: 1000.

**Response 200:**
```json
{
  "entries": [ /* TranscriptEntry[] */ ],
  "total": 5432
}
```

---

#### Get Bee Logs (Filtered)

```
GET /bees/:id/logs
```

Returns filtered view of bee activity.

**Query Parameters:**
- `view`: "mail" (inbox/outbox only), "errors" (errors only), "tools" (tool calls only)
- `since`: ISO 8601 timestamp
- `limit`: Max entries

**Response 200:**
```json
{
  "entries": [ /* TranscriptEntry[] filtered */ ]
}
```

---

### Skills Endpoints

#### List All Skills

```
GET /skills
```

Returns all registered skills.

**Query Parameters:**
- `owner` (string): Filter by owner ("built-in" or bee ID)

**Response 200:**
```json
{
  "skills": [ /* SkillRegistryEntry[] */ ]
}
```

---

#### Get Skill

```
GET /skills/:id
```

Returns a skill's manifest.

**Query Parameters:**
- `version` (string): Specific version. Default: latest.

**Response 200:**
```json
{
  "manifest": { /* SkillManifest */ },
  "versions": ["2.1.0", "2.0.0", "1.0.0"]
}
```

**Response 404:** Skill not found

---

#### Register New Skill

```
POST /skills
```

Registers a new skill (typically called when agent creates one).

**Request Body:** `SkillManifest`

**Response 201:**
```json
{
  "skill": { /* SkillRegistryEntry */ }
}
```

**Response 400:** Invalid manifest
**Response 409:** Skill ID already exists

---

#### Delete Skill

```
DELETE /skills/:id
```

Removes a skill from registry.

**Query Parameters:**
- `version` (string): Specific version to delete. If omitted, deletes all versions.

**Response 204:** Deleted

**Response 400:** Skill in use by beez
**Response 404:** Skill not found

---

### Filesystem Endpoints

#### List Files

```
GET /bees/:id/files
```

Lists files in a bee's container.

**Query Parameters:**
- `path` (string): Directory path. Default: "/"

**Response 200:**
```json
{
  "path": "/skills",
  "entries": [
    { "name": "social-media-apis", "type": "directory", "size": 0 },
    { "name": "config.json", "type": "file", "size": 1234 }
  ]
}
```

---

#### Read File

```
GET /bees/:id/files/*path
```

Reads a file from bee's container.

**Response 200:**
```
Content-Type: application/octet-stream (or detected mime type)

<file contents>
```

**Response 404:** File not found

---

#### Write File

```
PUT /bees/:id/files/*path
```

Writes a file to bee's container.

**Request Body:** File contents (raw bytes or text)

**Response 200:**
```json
{
  "path": "/skills/custom-skill/context/notes.md",
  "size": 567
}
```

---

#### Delete File

```
DELETE /bees/:id/files/*path
```

Deletes a file from bee's container.

**Response 204:** Deleted

**Response 404:** File not found

---

#### Get Soul File

```
GET /bees/:id/soul
```

Returns the bee's soul.md contents.

**Response 200:**
```json
{
  "content": "# Social Media Coordinator\n\nYou are a social media coordinator...",
  "allowSoulEdit": false
}
```

---

#### Update Soul File

```
PUT /bees/:id/soul
```

Updates the bee's soul.md file.

**Request Body:**
```json
{
  "content": "# Updated Soul\n\nNew personality and instructions..."
}
```

**Response 200:**
```json
{
  "content": "...",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

---

### Mailbox Endpoints

#### List All Mailboxez

```
GET /mailboxez
```

Returns all mailboxez with their current state.

**Response 200:**
```json
{
  "mailboxez": [
    {
      "config": { /* MailboxConfig */ },
      "state": { /* MailboxState */ }
    }
  ]
}
```

---

#### Get Mailbox

```
GET /mailboxez/:id
```

Returns a specific mailbox's configuration and state.

**Response 200:**
```json
{
  "config": { /* MailboxConfig */ },
  "state": { /* MailboxState */ }
}
```

---

#### Get Mailbox Inbox

```
GET /mailboxez/:id/inbox
```

Returns mail waiting in this mailbox (sent by beez, waiting for external pickup).

**Query Parameters:**
- `status` (string): Filter by status
- `limit` (number): Max items. Default: 100.
- `offset` (number): Pagination offset.

**Response 200:**
```json
{
  "mail": [ /* Mail[] */ ],
  "total": 5
}
```

---

#### Get Mailbox Outbox

```
GET /mailboxez/:id/outbox
```

Returns mail sent from this mailbox to beez.

**Response 200:** Same structure as inbox.

---

#### Send Mail from Mailbox

```
POST /mailboxez/:id/mail
```

Sends mail from this mailbox to a bee (external → internal).

**Request Body:**
```json
{
  "to": "coordinator-bee",
  "subject": "New task",
  "body": "Please process this request..."
}
```

**Response 201:**
```json
{
  "mail": { /* Created Mail */ }
}
```

**Response 403:** No connection from this mailbox to recipient

---

#### Receive Mail from Mailbox

```
POST /mailboxez/:id/receive
```

Marks mail as received/consumed by external service. Removes from inbox.

**Request Body:**
```json
{
  "mailIds": ["mail-id-1", "mail-id-2"]
}
```

**Response 200:**
```json
{
  "received": 2
}
```

---

### Cron Endpoints

#### List All Cron Jobs

```
GET /cron
```

Returns all cron jobs across all beez.

**Response 200:**
```json
{
  "jobs": [
    {
      "beeId": "coordinator",
      "job": { /* CronJob */ },
      "nextFireAt": "2024-01-15T12:00:00Z"
    }
  ]
}
```

---

#### Get Cron Jobs for Bee

```
GET /bees/:id/cron
```

Returns cron jobs for a specific bee.

**Response 200:**
```json
{
  "jobs": [ /* CronJob[] */ ]
}
```

---

#### Create Cron Job

```
POST /bees/:id/cron
```

Creates a new cron job for a bee.

**Request Body:**
```json
{
  "id": "weekly-report",
  "schedule": "0 9 * * 1",
  "mailTemplate": {
    "subject": "Weekly Report",
    "body": "Generate the weekly report."
  },
  "enabled": true
}
```

**Response 201:**
```json
{
  "job": { /* CronJob */ }
}
```

---

#### Update Cron Job

```
PATCH /bees/:id/cron/:jobId
```

Updates a cron job (schedule, template, enabled status).

**Request Body:**
```json
{
  "enabled": false
}
```

**Response 200:**
```json
{
  "job": { /* Updated CronJob */ }
}
```

---

#### Delete Cron Job

```
DELETE /bees/:id/cron/:jobId
```

Deletes a cron job.

**Response 204:** Deleted

---

### System Log Endpoints

#### Get System Log

```
GET /system/log
```

Returns the central system log (container events, startups, failures).

**Query Parameters:**
- `since` (string): ISO 8601 timestamp
- `level` (string): Filter by level (info, warn, error)
- `limit` (number): Max entries. Default: 500.

**Response 200:**
```json
{
  "entries": [
    {
      "timestamp": "2024-01-15T10:30:00Z",
      "level": "info",
      "type": "container:started",
      "beeId": "coordinator",
      "message": "Container started successfully",
      "details": { "containerId": "abc123..." }
    }
  ],
  "total": 1234
}
```

---

## WebSocket API

Connect to `ws://localhost:3001/ws` for real-time updates.

### Connection

On connect, client receives current state:

```json
{
  "type": "connected",
  "payload": {
    "swarmz": { /* SwarmzState */ }
  }
}
```

### Server → Client Events

#### Bee Status Changed

```json
{
  "type": "bee:status",
  "payload": {
    "beeId": "manager-bee",
    "previousStatus": "idle",
    "status": "processing",
    "currentMail": "mail-id-123"
  }
}
```

#### Mail Received

```json
{
  "type": "mail:received",
  "payload": {
    "beeId": "worker-bee",
    "mail": { /* Mail */ }
  }
}
```

#### Mail Sent

```json
{
  "type": "mail:sent",
  "payload": {
    "beeId": "manager-bee",
    "mail": { /* Mail */ }
  }
}
```

#### Mail Bounced

```json
{
  "type": "mail:bounced",
  "payload": {
    "originalMail": { /* Mail that failed */ },
    "bounceMail": { /* Bounce notification */ },
    "reason": "Recipient container crashed"
  }
}
```

#### Mail Pending Approval

```json
{
  "type": "mail:pending_approval",
  "payload": {
    "mail": { /* Mail awaiting approval */ },
    "connection": { /* Connection that requires approval */ }
  }
}
```

#### Transcript Entry

```json
{
  "type": "log:entry",
  "payload": {
    "beeId": "worker-bee",
    "entry": { /* TranscriptEntry */ }
  }
}
```

#### Skill Created

```json
{
  "type": "skill:created",
  "payload": {
    "skill": { /* SkillRegistryEntry */ },
    "createdBy": "agent-bee-id"
  }
}
```

#### Swarmz Updated

```json
{
  "type": "swarmz:updated",
  "payload": {
    "changes": ["bee_added", "connection_removed"],
    "config": { /* Updated SwarmzConfig */ }
  }
}
```

#### Mailbox Mail Arrived

```json
{
  "type": "mailbox:mail",
  "payload": {
    "mailboxId": "human-interface",
    "mail": { /* Mail */ }
  }
}
```

#### Cron Job Fired

```json
{
  "type": "cron:fired",
  "payload": {
    "beeId": "coordinator",
    "jobId": "analytics-hourly",
    "mail": { /* Generated Mail */ }
  }
}
```

#### System Log Entry

```json
{
  "type": "system:log",
  "payload": {
    "timestamp": "2024-01-15T10:30:00Z",
    "level": "error",
    "type": "container:crashed",
    "beeId": "worker-bee",
    "message": "Container exited unexpectedly",
    "details": { "exitCode": 137 }
  }
}
```

#### Error

```json
{
  "type": "error",
  "payload": {
    "beeId": "worker-bee",
    "error": "Container crashed",
    "details": "Exit code 137 (OOM killed)"
  }
}
```

### Client → Server Events

#### Subscribe to Bee

```json
{
  "type": "subscribe:bee",
  "payload": {
    "beeId": "manager-bee"
  }
}
```

Subscribe to detailed events for a specific bee (transcript entries).

#### Unsubscribe from Bee

```json
{
  "type": "unsubscribe:bee",
  "payload": {
    "beeId": "manager-bee"
  }
}
```

#### Ping

```json
{
  "type": "ping"
}
```

Server responds with:
```json
{
  "type": "pong",
  "payload": {
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

---

## Terminal WebSocket

Connect to `ws://localhost:3001/api/bees/:id/terminal` for shell access.

### Protocol

Uses standard terminal WebSocket protocol:
- Binary messages: stdin/stdout data
- Text messages: control commands

#### Input (Client → Server)

```json
{
  "type": "input",
  "data": "ls -la\n"
}
```

Or binary data for raw terminal input.

#### Output (Server → Client)

```json
{
  "type": "output",
  "data": "total 24\ndrwxr-xr-x  5 root root 4096 Jan 15 10:30 .\n..."
}
```

Or binary data for raw terminal output.

#### Resize

```json
{
  "type": "resize",
  "cols": 120,
  "rows": 40
}
```

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid bee configuration",
    "details": {
      "field": "skills",
      "issue": "Skill 'unknown-skill@1.0.0' not found in registry"
    }
  }
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `NOT_FOUND` | 404 | Resource doesn't exist |
| `VALIDATION_ERROR` | 400 | Invalid request data |
| `TOPOLOGY_VIOLATION` | 403 | Mail route not allowed by topology |
| `CONFLICT` | 409 | Resource already exists or state conflict |
| `BEE_BUSY` | 409 | Operation not allowed while bee is processing |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

---

## Rate Limits

**MVP**: No rate limits.

**Future**: Per-endpoint rate limits, configurable per API key.
