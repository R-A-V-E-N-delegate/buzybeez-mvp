# Data Models

Complete TypeScript type definitions for all BuzyBeez entities.

---

## Mail

Mail is the fundamental communication unit. Every interaction between beez, humans, and the system is represented as mail.

```typescript
/**
 * A mail message between entities in the system.
 *
 * Mail is immutable once created. Status changes are the only mutation.
 */
interface Mail {
  /** Unique identifier (UUID v4) */
  id: string;

  /**
   * Sender identifier
   * - Bee ID for agent-to-agent mail
   * - Mailbox ID for external mail
   * - "system" for cron events and notifications
   */
  from: string;

  /** Recipient bee ID or mailbox ID */
  to: string;

  /** Short description of mail purpose */
  subject: string;

  /**
   * Freeform content. Can contain:
   * - Natural language instructions
   * - Structured data (JSON embedded in text)
   * - Results, reports, or responses
   */
  body: string;

  /** ISO 8601 timestamp when mail was created */
  timestamp: string;

  /** Mail metadata */
  metadata: MailMetadata;

  /** Current delivery status */
  status: MailStatus;

  /** Reason for bounce (only set if status is "bounced") */
  bounceReason?: string;
}

interface MailMetadata {
  /** Origin type for routing and display purposes */
  type: "agent" | "cron" | "system" | "external";

  /** Processing priority (default: "normal") */
  priority?: "low" | "normal" | "high";

  /** Whether human must approve before delivery */
  requiresApproval?: boolean;

  /** Whether approval has been granted */
  approved?: boolean;

  /** Human who approved (if applicable) */
  approvedBy?: string;

  /** ISO 8601 timestamp of approval */
  approvedAt?: string;

  /**
   * Arbitrary key-value pairs for custom metadata.
   * Agents can attach context here.
   */
  custom?: Record<string, unknown>;
}

type MailStatus =
  | "queued"      // Waiting in sender's outbox or recipient's inbox
  | "pending_approval"  // Waiting for human approval
  | "processing"  // Currently being handled by recipient
  | "delivered"   // Successfully processed by recipient
  | "bounced";    // Delivery failed
```

### Mail Examples

**External task request (via mailbox):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "from": "mailbox:human-interface",
  "to": "coordinator-bee",
  "subject": "Write a haiku about bees",
  "body": "Please write a creative haiku about bees and their importance to the ecosystem.",
  "timestamp": "2024-01-15T10:30:00Z",
  "metadata": {
    "type": "external",
    "priority": "normal"
  },
  "status": "queued"
}
```

**Cron event:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "from": "system",
  "to": "social-media-manager",
  "subject": "Hourly analytics check",
  "body": "Time for your scheduled analytics review. Check engagement metrics across all platforms.",
  "timestamp": "2024-01-15T11:00:00Z",
  "metadata": {
    "type": "cron",
    "priority": "normal",
    "custom": {
      "cronJobId": "analytics-hourly",
      "schedule": "0 * * * *"
    }
  },
  "status": "queued"
}
```

**Agent delegation with approval required:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440002",
  "from": "manager-bee",
  "to": "payment-processor",
  "subject": "Process refund $500",
  "body": "Customer #12345 requested refund for order #67890. Amount: $500. Reason: defective product.",
  "timestamp": "2024-01-15T10:35:00Z",
  "metadata": {
    "type": "agent",
    "priority": "high",
    "requiresApproval": true
  },
  "status": "pending_approval"
}
```

---

## Bee

Beez are the AI agents that process mail and perform work.

```typescript
/**
 * Configuration for a bee (design-time).
 * Stored in swarmz config, used to create containers.
 */
interface BeeConfig {
  /** Unique identifier within the swarmz */
  id: string;

  /** Human-readable name */
  name: string;

  /**
   * Whether to keep the container running while agent is idle.
   * - true: Container stays warm for fast response (default)
   * - false: Container can be stopped when idle (cost optimization)
   */
  keepAlive: boolean;

  /**
   * Assigned skills with versions.
   * Format: "skill-id@version" (e.g., "social-media@1.2.3")
   */
  skills: string[];

  /**
   * Whether the bee can edit its own soul.md file.
   * Enables self-learning and evolution.
   */
  allowSoulEdit: boolean;

  /** Resource and rate limits */
  limits: BeeLimits;

  /** Scheduled events that generate mail */
  cron?: CronJob[];
}

interface BeeLimits {
  /** Maximum mail items processed per hour (prevents runaway) */
  maxMailPerHour?: number;

  /** Maximum concurrent sub-agents within this bee */
  maxConcurrentTasks?: number;

  /** Maximum tokens per mail processing task */
  maxTokensPerTask?: number;

  /**
   * Maximum seconds for processing a single mail item.
   * null = no timeout (can run forever)
   */
  timeout?: number | null;
}

/**
 * Scheduled event configuration.
 * Cron jobs generate mail at specified intervals.
 */
interface CronJob {
  /** Unique identifier for this cron job */
  id: string;

  /**
   * Cron expression (standard 5-field format)
   * Examples:
   * - "0 * * * *" = every hour
   * - "0 9 * * 1-5" = 9am weekdays
   * - "*/15 * * * *" = every 15 minutes
   */
  schedule: string;

  /** Template for generated mail */
  mailTemplate: {
    subject: string;
    body: string;
    metadata?: Partial<MailMetadata>;
  };

  /** Whether this cron job is active */
  enabled: boolean;
}

/**
 * Runtime state of a bee (changes during execution).
 * Managed by orchestrator, not stored in config.
 */
interface BeeState {
  /** Bee ID (matches BeeConfig.id) */
  id: string;

  /** Current lifecycle status */
  status: BeeStatus;

  /** Mail ID currently being processed (if status is "processing") */
  currentMail?: string;

  /** Queued incoming mail */
  inbox: Mail[];

  /** History of sent mail */
  outbox: Mail[];

  /** Path to persisted agent session state */
  sessionPath: string;

  /** Container ID (Docker) */
  containerId?: string;

  /** Runtime statistics */
  stats: BeeStats;
}

type BeeStatus =
  | "stopped"     // Container not running
  | "starting"    // Container starting up
  | "idle"        // Running, waiting for mail
  | "processing"  // Actively handling mail
  | "paused"      // Frozen mid-task
  | "error";      // Container failed

interface BeeStats {
  /** Mail processed in current 24h period */
  mailProcessedToday: number;

  /** ISO 8601 timestamp of last activity */
  lastActiveAt: string;

  /** Total mail processed all-time */
  totalMailProcessed: number;

  /** Total tokens consumed all-time */
  totalTokensUsed: number;
}
```

### Bee Config Example

```json
{
  "id": "social-media-coordinator",
  "name": "Social Media Coordinator",
  "keepAlive": true,
  "allowSoulEdit": false,
  "skills": [
    "social-media-apis@2.1.0",
    "content-strategy@1.0.0",
    "analytics@1.5.0"
  ],
  "limits": {
    "maxMailPerHour": 50,
    "maxTokensPerTask": 100000,
    "timeout": 300
  },
  "cron": [
    {
      "id": "analytics-hourly",
      "schedule": "0 * * * *",
      "mailTemplate": {
        "subject": "Hourly analytics check",
        "body": "Review current engagement metrics and adjust strategy if needed."
      },
      "enabled": true
    },
    {
      "id": "daily-report",
      "schedule": "0 18 * * *",
      "mailTemplate": {
        "subject": "Daily performance report",
        "body": "Generate and send daily social media performance report."
      },
      "enabled": true
    }
  ]
}
```

The bee's personality and base instructions live in `/soul.md` inside the container, not in config.

---

## Skill

Skills are composable capability packs that define what a bee can do.

```typescript
/**
 * Skill manifest (skill-name/manifest.json).
 * Describes skill contents and metadata.
 */
interface SkillManifest {
  /** Unique identifier (typically folder name) */
  id: string;

  /** Human-readable name */
  name: string;

  /** Semver version string */
  version: string;

  /** What this skill enables */
  description: string;

  /**
   * Who created this skill:
   * - "built-in" for pre-packaged skills
   * - Bee ID for agent-created skills
   */
  owner: string;

  /** List of bee IDs currently using this skill */
  usedBy: string[];

  // ─── Content References ───────────────────────────────

  /**
   * Paths to context files (relative to skill root).
   * These are loaded into agent's system prompt.
   */
  context: string[];

  /**
   * Paths to executable scripts (relative to skill root).
   * Agent can invoke these as tools.
   */
  scripts: string[];

  /**
   * Names of required environment variables.
   * Actual values stored separately in secrets.
   */
  envVars: string[];

  /** MCP server configurations */
  mcpServers?: MCPConfig[];

  // ─── Dependencies ─────────────────────────────────────

  /** Other skills this skill depends on */
  dependencies?: string[];

  /** Minimum Node.js version required */
  nodeVersion?: string;

  /** System packages required (apt packages) */
  systemPackages?: string[];
}

/**
 * MCP (Model Context Protocol) server configuration.
 */
interface MCPConfig {
  /** Server identifier */
  name: string;

  /**
   * Server type:
   * - local: Runs inside bee container
   * - remote: External endpoint
   */
  type: "local" | "remote";

  /** Command to start server (local only) */
  command?: string;

  /** Arguments for command (local only) */
  args?: string[];

  /** Server URL (remote only) */
  url?: string;

  /** Additional environment variables for this MCP */
  env?: Record<string, string>;
}

/**
 * Global skill registry entry.
 * Registry tracks all skills across the system.
 */
interface SkillRegistryEntry {
  /** Skill ID */
  id: string;

  /** Available versions (newest first) */
  versions: string[];

  /** Current/default version */
  latestVersion: string;

  /** Owner (built-in or bee ID) */
  owner: string;

  /** Beez currently using any version of this skill */
  usedBy: string[];

  /** ISO 8601 timestamp of registration */
  registeredAt: string;

  /** ISO 8601 timestamp of last update */
  updatedAt: string;
}
```

### Skill Manifest Example

```json
{
  "id": "social-media-apis",
  "name": "Social Media APIs",
  "version": "2.1.0",
  "description": "APIs and tools for posting to Twitter, Instagram, and Facebook",
  "owner": "built-in",
  "usedBy": ["social-media-manager", "content-creator"],

  "context": [
    "context/instructions.md",
    "context/platform-guidelines.md",
    "context/best-practices.md"
  ],

  "scripts": [
    "scripts/post-twitter.ts",
    "scripts/post-instagram.ts",
    "scripts/post-facebook.ts",
    "scripts/get-analytics.ts"
  ],

  "envVars": [
    "TWITTER_API_KEY",
    "TWITTER_API_SECRET",
    "INSTAGRAM_ACCESS_TOKEN",
    "FACEBOOK_PAGE_TOKEN"
  ],

  "mcpServers": [
    {
      "name": "social-media-mcp",
      "type": "local",
      "command": "node",
      "args": ["mcp/server.js"]
    }
  ],

  "dependencies": ["basic-tools@1.0.0"],
  "nodeVersion": ">=20.0.0",
  "systemPackages": ["chromium"]
}
```

---

## Swarmz

A swarmz defines the topology of beez, mailboxez, and their connections.

```typescript
/**
 * Complete swarmz configuration.
 * Stored as JSON, loaded by orchestrator.
 */
interface SwarmzConfig {
  /** Unique swarmz identifier */
  id: string;

  /** Human-readable name */
  name: string;

  /** Optional description */
  description?: string;

  /** All beez in this swarmz */
  bees: BeeConfig[];

  /** External mailboxez for humans/services */
  mailboxez: MailboxConfig[];

  /** Communication routes between entities */
  connections: Connection[];

  /** Swarmz-wide settings */
  settings: SwarmzSettings;

  /** ISO 8601 timestamp of last modification */
  updatedAt: string;
}

/**
 * Mailbox configuration for external communication.
 */
interface MailboxConfig {
  /** Unique identifier (prefixed with "mailbox:" in mail) */
  id: string;

  /** Human-readable name */
  name: string;

  /** Description of this mailbox's purpose */
  description?: string;

  /**
   * Whether mail in this mailbox requires human approval before delivery.
   * Useful for outbound notifications that need review.
   */
  requiresApprovalForOutbound?: boolean;
}

/**
 * Connection between two entities (beez or mailboxez).
 * Defines allowed mail routes.
 */
interface Connection {
  /** Unique connection identifier */
  id: string;

  /** Source entity ID (bee ID or "mailbox:{id}") */
  from: string;

  /** Destination entity ID (bee ID or "mailbox:{id}") */
  to: string;

  /**
   * If true, mail can flow both directions.
   * Equivalent to two separate connections.
   */
  bidirectional: boolean;

  /** Whether mail on this route requires human approval */
  requiresApproval?: boolean;

  /** Optional description of this connection's purpose */
  description?: string;
}

interface SwarmzSettings {
  /** Default limits applied to all beez (can be overridden per-bee) */
  defaultLimits: BeeLimits;

  /** Whether to auto-restart crashed beez */
  autoRestart: boolean;

  /** Seconds to wait before restarting crashed bee */
  restartDelay: number;

  /** Maximum restart attempts before giving up */
  maxRestartAttempts: number;
}

/**
 * Runtime state of the entire swarmz.
 * Managed by orchestrator.
 */
interface SwarmzState {
  /** Swarmz ID */
  id: string;

  /** Current swarmz status */
  status: SwarmzStatus;

  /** State of each bee */
  bees: Record<string, BeeState>;

  /** State of each mailbox */
  mailboxez: Record<string, MailboxState>;

  /** ISO 8601 timestamp of last state change */
  updatedAt: string;
}

type SwarmzStatus =
  | "stopped"   // All beez stopped
  | "starting"  // Beez starting up
  | "running"   // At least one bee running
  | "paused"    // All beez paused
  | "error";    // Critical failure

/**
 * Runtime state of a mailbox.
 */
interface MailboxState {
  /** Mailbox ID */
  id: string;

  /** Queued incoming mail (waiting for bee to pick up) */
  inbox: Mail[];

  /** Outgoing mail history (sent by beez to this mailbox) */
  outbox: Mail[];

  /** Pending approval queue */
  pendingApproval: Mail[];
}
```

### Swarmz Config Example

```json
{
  "id": "social-media-swarmz",
  "name": "Social Media Team",
  "description": "Automated social media management with content creation and analytics",

  "bees": [
    {
      "id": "coordinator",
      "name": "Social Media Coordinator",
      "keepAlive": true,
      "allowSoulEdit": false,
      "skills": ["social-media-apis@2.1.0", "analytics@1.5.0"],
      "limits": { "maxMailPerHour": 100 }
    },
    {
      "id": "content-creator",
      "name": "Content Creator",
      "keepAlive": false,
      "allowSoulEdit": true,
      "skills": ["content-generation@1.0.0", "image-tools@1.2.0"],
      "limits": { "maxMailPerHour": 50, "maxTokensPerTask": 50000 }
    },
    {
      "id": "twitter-poster",
      "name": "Twitter Specialist",
      "keepAlive": false,
      "allowSoulEdit": false,
      "skills": ["social-media-apis@2.1.0"],
      "limits": { "maxMailPerHour": 30 }
    },
    {
      "id": "instagram-poster",
      "name": "Instagram Specialist",
      "keepAlive": false,
      "allowSoulEdit": false,
      "skills": ["social-media-apis@2.1.0", "image-tools@1.2.0"],
      "limits": { "maxMailPerHour": 20 }
    }
  ],

  "mailboxez": [
    {
      "id": "human",
      "name": "Human Interface",
      "description": "Primary interface for human operators"
    },
    {
      "id": "slack-notifications",
      "name": "Slack Notifications",
      "description": "Outbound alerts to Slack",
      "requiresApprovalForOutbound": false
    }
  ],

  "connections": [
    {
      "id": "human-to-coordinator",
      "from": "mailbox:human",
      "to": "coordinator",
      "bidirectional": true
    },
    {
      "id": "coordinator-to-content",
      "from": "coordinator",
      "to": "content-creator",
      "bidirectional": true
    },
    {
      "id": "coordinator-to-twitter",
      "from": "coordinator",
      "to": "twitter-poster",
      "bidirectional": true,
      "requiresApproval": true,
      "description": "Tweets require human approval"
    },
    {
      "id": "coordinator-to-instagram",
      "from": "coordinator",
      "to": "instagram-poster",
      "bidirectional": true,
      "requiresApproval": true
    },
    {
      "id": "coordinator-to-slack",
      "from": "coordinator",
      "to": "mailbox:slack-notifications",
      "bidirectional": false
    }
  ],

  "settings": {
    "defaultLimits": {
      "maxMailPerHour": 50,
      "maxTokensPerTask": 100000,
      "timeout": 300
    },
    "autoRestart": true,
    "restartDelay": 5,
    "maxRestartAttempts": 3
  },

  "updatedAt": "2024-01-15T10:00:00Z"
}
```

---

## Canvas (UI State)

Types for the visual canvas representation.

```typescript
/**
 * Canvas node representing a bee or mailbox.
 * Used by react-flow for rendering.
 */
interface CanvasNode {
  /** Same as entity ID */
  id: string;

  /** Node type for react-flow */
  type: "bee" | "mailbox";

  /** Position on canvas */
  position: { x: number; y: number };

  /** Data passed to node component */
  data: {
    config: BeeConfig | MailboxConfig;
    state: BeeState | MailboxState;
  };
}

/**
 * Canvas edge representing a connection.
 */
interface CanvasEdge {
  /** Same as connection ID */
  id: string;

  /** Source bee ID */
  source: string;

  /** Target bee ID */
  target: string;

  /** Edge type for react-flow */
  type: "mail";

  /** Data passed to edge component */
  data: {
    connection: Connection;
    /** Recent mail on this connection for animation */
    recentMail?: Mail[];
  };
}

/**
 * Complete canvas state.
 */
interface CanvasState {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  viewport: { x: number; y: number; zoom: number };
}
```

---

## Logging & Transcript

Types for agent activity logging.

```typescript
/**
 * Single entry in agent transcript.
 */
interface TranscriptEntry {
  /** Unique entry ID */
  id: string;

  /** ISO 8601 timestamp */
  timestamp: string;

  /** Entry type */
  type: TranscriptEntryType;

  /** Entry content (structure depends on type) */
  content: unknown;
}

type TranscriptEntryType =
  | "mail_received"    // Agent received mail
  | "mail_sent"        // Agent sent mail
  | "tool_call"        // Agent called a tool
  | "tool_result"      // Tool returned result
  | "thinking"         // Agent's reasoning (if available)
  | "error"            // Error occurred
  | "state_saved"      // Session state persisted
  | "state_restored";  // Session state restored

/**
 * Tool call entry content.
 */
interface ToolCallContent {
  toolName: string;
  arguments: Record<string, unknown>;
  duration?: number;
}

/**
 * Tool result entry content.
 */
interface ToolResultContent {
  toolName: string;
  result: unknown;
  error?: string;
}
```

---

## File Structure Summary

```
/swarmz
  /{swarmz-id}
    config.json              # SwarmzConfig
    state.json               # SwarmzState (runtime)

/skills
  /built-in
    /{skill-id}
      manifest.json          # SkillManifest
      /context
      /scripts
      /mcp
  /custom
    /{skill-id}
      manifest.json
      /context
      /scripts
      /mcp

/registry
  skills.json                # SkillRegistryEntry[]

/logs
  system.jsonl               # Central system log (container events, startups, failures)

/mailboxez
  /{mailbox-id}
    inbox/                   # Incoming mail from external sources
    outbox/                  # Outgoing mail to external sources
    pending/                 # Mail pending approval

/containers (inside each bee)
  /skills                    # Mounted skills
  /inbox                     # Mail[] as individual JSON files
  /outbox                    # Mail[] as individual JSON files (auto-sent)
  /state                     # Agent session state
  /logs                      # TranscriptEntry[] as JSONL
  soul.md                    # Bee's personality and base instructions
```
