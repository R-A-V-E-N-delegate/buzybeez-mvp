# Implementation Guide

Step-by-step guide to building BuzyBeez, organized into phases with clear deliverables.

---

## Prerequisites

Before starting:

- Node.js 20+ installed
- Docker installed and running
- pnpm installed (`npm install -g pnpm`)
- Claude API key (for claude-agent-sdk)

---

## Project Setup

### Initialize Monorepo

```bash
mkdir buzybeez && cd buzybeez
pnpm init

# Create workspace config
cat > pnpm-workspace.yaml << 'EOF'
packages:
  - 'packages/*'
EOF

# Create package directories
mkdir -p packages/{core,bee-runtime,orchestrator,canvas-ui}
mkdir -p skills/{built-in,custom}
mkdir -p data/{swarmz,registry,secrets,mailboxez,logs}
```

### Root package.json

```json
{
  "name": "buzybeez",
  "private": true,
  "scripts": {
    "dev": "pnpm -r dev",
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "lint": "pnpm -r lint"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "tsup": "^8.0.0",
    "@types/node": "^20.0.0"
  }
}
```

### Shared TypeScript Config

```json
// tsconfig.base.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist"
  }
}
```

---

## Phase 1: Core Package

**Goal**: Define all shared types and utilities.

### Directory Structure

```
packages/core/
├── src/
│   ├── types/
│   │   ├── mail.ts
│   │   ├── bee.ts
│   │   ├── skill.ts
│   │   ├── swarmz.ts
│   │   ├── mailbox.ts
│   │   └── index.ts
│   ├── utils/
│   │   ├── validation.ts
│   │   ├── logging.ts
│   │   └── index.ts
│   └── index.ts
├── package.json
└── tsconfig.json
```

### Deliverables

1. **Type definitions** (from Data Models doc)
   - `Mail`, `MailMetadata`, `MailStatus`
   - `BeeConfig`, `BeeState`, `BeeLimits`, `CronJob` (with `keepAlive`, `allowSoulEdit`, `timeout`)
   - `SkillManifest`, `MCPConfig`, `SkillRegistryEntry`
   - `SwarmzConfig`, `MailboxConfig`, `Connection`, `SwarmzSettings`, `SwarmzState`, `MailboxState`

2. **Validation utilities**
   ```typescript
   // packages/core/src/utils/validation.ts

   export function validateMail(mail: unknown): ValidationResult;
   export function validateBeeConfig(config: unknown): ValidationResult;
   export function validateSkillManifest(manifest: unknown): ValidationResult;
   export function validateSwarmzConfig(config: unknown): ValidationResult;
   export function validateMailboxConfig(config: unknown): ValidationResult;

   interface ValidationResult {
     valid: boolean;
     errors: ValidationError[];
   }

   interface ValidationError {
     path: string;
     message: string;
   }
   ```

3. **Logging utility**
   ```typescript
   // packages/core/src/utils/logging.ts

   export interface Logger {
     debug(message: string, data?: object): void;
     info(message: string, data?: object): void;
     warn(message: string, data?: object): void;
     error(message: string, error?: Error, data?: object): void;
   }

   export function createLogger(component: string): Logger;
   ```

### Verification

```bash
cd packages/core
pnpm build
pnpm test  # Type tests, validation tests
```

---

## Phase 2: Bee Runtime

**Goal**: Container management and agent execution.

### Directory Structure

```
packages/bee-runtime/
├── src/
│   ├── docker/
│   │   ├── manager.ts      # Container lifecycle
│   │   ├── builder.ts      # Image building
│   │   └── index.ts
│   ├── agent/
│   │   ├── runner.ts       # claude-agent-sdk wrapper
│   │   ├── state.ts        # Session persistence
│   │   └── index.ts
│   ├── mail/
│   │   ├── inbox.ts        # Inbox management
│   │   ├── outbox.ts       # Outbox management
│   │   └── index.ts
│   ├── skills/
│   │   ├── loader.ts       # Skill mounting
│   │   └── index.ts
│   └── index.ts
├── docker/
│   └── Dockerfile.bee      # Base bee image
├── package.json
└── tsconfig.json
```

### Deliverables

1. **Docker Manager**
   ```typescript
   // packages/bee-runtime/src/docker/manager.ts

   export class DockerManager {
     constructor(options: DockerManagerOptions);

     // Container lifecycle
     async createContainer(config: BeeConfig): Promise<string>;
     async startContainer(containerId: string): Promise<void>;
     async stopContainer(containerId: string, force?: boolean): Promise<void>;
     async removeContainer(containerId: string): Promise<void>;
     async pauseContainer(containerId: string): Promise<void>;
     async unpauseContainer(containerId: string): Promise<void>;

     // Container info
     async getContainerStatus(containerId: string): Promise<ContainerStatus>;
     async getContainerLogs(containerId: string, options?: LogOptions): Promise<string>;

     // File operations
     async writeFile(containerId: string, path: string, content: Buffer): Promise<void>;
     async readFile(containerId: string, path: string): Promise<Buffer>;
     async listDirectory(containerId: string, path: string): Promise<FileEntry[]>;

     // Exec
     async exec(containerId: string, command: string[]): Promise<ExecResult>;
     createTerminal(containerId: string): TerminalStream;
   }
   ```

2. **Base Dockerfile**
   ```dockerfile
   # packages/bee-runtime/docker/Dockerfile.bee

   FROM debian:bookworm-slim

   # Install Node.js 20
   RUN apt-get update && apt-get install -y \
       curl \
       ca-certificates \
       && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
       && apt-get install -y nodejs \
       && apt-get clean \
       && rm -rf /var/lib/apt/lists/*

   # Create bee directories
   RUN mkdir -p /skills /inbox /outbox /state /logs

   # Install bee agent dependencies
   WORKDIR /app
   COPY package.json ./
   RUN npm install

   # Copy bee agent code
   COPY agent/ ./agent/

   # Entry point
   CMD ["node", "agent/runner.js"]
   ```

3. **Agent Runner**
   ```typescript
   // packages/bee-runtime/src/agent/runner.ts

   export class AgentRunner {
     constructor(options: AgentRunnerOptions);

     // Lifecycle
     async start(): Promise<void>;
     async stop(): Promise<void>;
     async pause(): Promise<void>;
     async resume(): Promise<void>;

     // State
     async saveState(): Promise<void>;
     async loadState(): Promise<void>;

     // Mail processing
     async processMail(mail: Mail): Promise<Mail | null>;

     // Events
     on(event: 'mail:received', handler: (mail: Mail) => void): void;
     on(event: 'mail:sent', handler: (mail: Mail) => void): void;
     on(event: 'tool:called', handler: (call: ToolCall) => void): void;
     on(event: 'error', handler: (error: Error) => void): void;
   }
   ```

4. **Inbox/Outbox Management**
   ```typescript
   // packages/bee-runtime/src/mail/inbox.ts

   export class InboxManager {
     constructor(inboxPath: string);

     // Mail operations
     async addMail(mail: Mail): Promise<void>;
     async getMail(id: string): Promise<Mail | null>;
     async listMail(): Promise<Mail[]>;
     async deleteMail(id: string): Promise<void>;
     async updateStatus(id: string, status: MailStatus): Promise<void>;

     // Queue operations
     async getNextMail(): Promise<Mail | null>;
     async getQueueLength(): Promise<number>;

     // Watch for new mail
     watch(callback: (mail: Mail) => void): () => void;
   }
   ```

5. **Skill Loader**
   ```typescript
   // packages/bee-runtime/src/skills/loader.ts

   export class SkillLoader {
     constructor(skillsBasePath: string);

     // Loading
     async loadSkills(skillIds: string[]): Promise<LoadedSkill[]>;
     async resolveVersion(skillId: string): Promise<string>;

     // Mounting
     async mountToContainer(
       containerId: string,
       skills: LoadedSkill[]
     ): Promise<void>;

     // Prompt building
     buildSystemPrompt(skills: LoadedSkill[], beeConfig: BeeConfig): string;
   }

   interface LoadedSkill {
     manifest: SkillManifest;
     contextContent: string;
     scriptPaths: string[];
     mcpConfigs: MCPConfig[];
   }
   ```

### Verification

```bash
# Build and test
cd packages/bee-runtime
pnpm build
pnpm test

# Manual test: create and start a container
node -e "
const { DockerManager } = require('./dist');
const dm = new DockerManager();
dm.createContainer({ id: 'test', name: 'Test Bee', keepAlive: false, allowSoulEdit: false, skills: [], limits: {} })
  .then(id => console.log('Created:', id))
  .catch(console.error);
"
```

---

## Phase 3: Orchestrator

**Goal**: Swarmz management, mail routing, mailboxez, and API server.

### Directory Structure

```
packages/orchestrator/
├── src/
│   ├── swarmz/
│   │   ├── config.ts       # Config parsing
│   │   ├── topology.ts     # Topology validation
│   │   ├── manager.ts      # Swarmz state management
│   │   └── index.ts
│   ├── lifecycle/
│   │   ├── bee-manager.ts  # Bee start/stop/pause/resume
│   │   ├── scheduler.ts    # Timer-based cron (fires at exact time)
│   │   └── index.ts
│   ├── mail/
│   │   ├── router.ts       # Mail routing
│   │   ├── validator.ts    # Topology validation
│   │   ├── outbox-watcher.ts # Watch bee outbox for auto-send
│   │   └── index.ts
│   ├── mailboxez/
│   │   ├── manager.ts      # Mailbox state management
│   │   └── index.ts
│   ├── skills/
│   │   ├── registry.ts     # Skill registry
│   │   ├── watcher.ts      # Watch for new skills
│   │   └── index.ts
│   ├── logging/
│   │   ├── system-log.ts   # Central system log
│   │   └── index.ts
│   ├── api/
│   │   ├── server.ts       # HTTP server
│   │   ├── routes/
│   │   │   ├── swarmz.ts
│   │   │   ├── bees.ts
│   │   │   ├── mailboxez.ts
│   │   │   ├── mail.ts
│   │   │   ├── cron.ts
│   │   │   ├── skills.ts
│   │   │   ├── files.ts
│   │   │   └── system-log.ts
│   │   ├── websocket.ts    # WebSocket handler
│   │   └── index.ts
│   └── index.ts
├── package.json
└── tsconfig.json
```

### Deliverables

1. **Swarmz Config Parser**
   ```typescript
   // packages/orchestrator/src/swarmz/config.ts

   export class SwarmzConfigParser {
     async load(path: string): Promise<SwarmzConfig>;
     async save(config: SwarmzConfig, path: string): Promise<void>;
     validate(config: SwarmzConfig): ValidationResult;
   }
   ```

2. **Topology Validator**
   ```typescript
   // packages/orchestrator/src/swarmz/topology.ts

   export class TopologyValidator {
     constructor(config: SwarmzConfig);

     // Validation
     validate(): ValidationResult;
     hasConnection(from: string, to: string): boolean;
     requiresApproval(from: string, to: string): boolean;

     // Analysis
     detectCycles(): string[][];
     getReachableBeez(from: string): string[];
   }
   ```

3. **Mail Router**
   ```typescript
   // packages/orchestrator/src/mail/router.ts

   export class MailRouter {
     constructor(topology: TopologyValidator, beeManager: BeeManager);

     // Routing
     async route(mail: Mail): Promise<RouteResult>;

     // Results
     // - delivered: Mail delivered to recipient inbox
     // - pending_approval: Mail waiting for human approval
     // - bounced: Delivery failed, bounce sent to sender
   }

   type RouteResult =
     | { status: 'delivered'; mail: Mail }
     | { status: 'pending_approval'; mail: Mail }
     | { status: 'bounced'; mail: Mail; reason: string };
   ```

4. **Cron Scheduler**
   ```typescript
   // packages/orchestrator/src/lifecycle/scheduler.ts

   export class CronScheduler {
     constructor(router: MailRouter);

     // Management
     addJob(beeId: string, job: CronJob): void;
     removeJob(beeId: string, jobId: string): void;
     enableJob(beeId: string, jobId: string): void;
     disableJob(beeId: string, jobId: string): void;

     // Lifecycle
     start(): void;
     stop(): void;

     // Events
     on(event: 'job:fired', handler: (beeId: string, job: CronJob) => void): void;
   }
   ```

5. **Bee Lifecycle Manager**
   ```typescript
   // packages/orchestrator/src/lifecycle/bee-manager.ts

   export class BeeManager {
     constructor(dockerManager: DockerManager, skillLoader: SkillLoader);

     // Lifecycle
     async startBee(config: BeeConfig): Promise<BeeState>;
     async stopBee(beeId: string, force?: boolean): Promise<void>;
     async pauseBee(beeId: string): Promise<void>;
     async resumeBee(beeId: string): Promise<void>;
     async restartBee(beeId: string): Promise<void>;

     // State
     getBeeState(beeId: string): BeeState | undefined;
     getAllBeeStates(): Map<string, BeeState>;

     // Events
     on(event: 'bee:status', handler: (beeId: string, status: BeeStatus) => void): void;
     on(event: 'bee:error', handler: (beeId: string, error: Error) => void): void;
   }
   ```

6. **Skill Registry**
   ```typescript
   // packages/orchestrator/src/skills/registry.ts

   export class SkillRegistry {
     constructor(registryPath: string, skillsBasePath: string);

     // CRUD
     async list(): Promise<SkillRegistryEntry[]>;
     async get(id: string, version?: string): Promise<SkillManifest | null>;
     async register(manifest: SkillManifest): Promise<SkillRegistryEntry>;
     async delete(id: string, version?: string): Promise<void>;

     // Usage tracking
     async addUsage(skillId: string, beeId: string): Promise<void>;
     async removeUsage(skillId: string, beeId: string): Promise<void>;

     // Watching
     watchForNewSkills(callback: (manifest: SkillManifest) => void): () => void;
   }
   ```

7. **API Server** (see API Specification doc for full routes)
   ```typescript
   // packages/orchestrator/src/api/server.ts

   export class ApiServer {
     constructor(options: ApiServerOptions);

     // Server lifecycle
     async start(): Promise<void>;
     async stop(): Promise<void>;

     // Middleware
     use(middleware: Middleware): void;
   }
   ```

8. **WebSocket Handler**
   ```typescript
   // packages/orchestrator/src/api/websocket.ts

   export class WebSocketHandler {
     constructor(server: HttpServer);

     // Broadcasting
     broadcast(event: WSEvent): void;
     broadcastToBee(beeId: string, event: WSEvent): void;

     // Subscriptions
     subscribeToBee(clientId: string, beeId: string): void;
     unsubscribeFromBee(clientId: string, beeId: string): void;
   }
   ```

### Verification

```bash
# Build and test
cd packages/orchestrator
pnpm build
pnpm test

# Start orchestrator
pnpm dev

# Test API
curl http://localhost:3001/api/swarm
```

---

## Phase 4: Canvas UI

**Goal**: React app with node-based editor and observability tools.

### Directory Structure

```
packages/canvas-ui/
├── src/
│   ├── components/
│   │   ├── canvas/
│   │   │   ├── Canvas.tsx
│   │   │   ├── BeeNode.tsx
│   │   │   ├── ConnectionEdge.tsx
│   │   │   └── index.ts
│   │   ├── sidebar/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── BeeConfig.tsx
│   │   │   ├── SkillBrowser.tsx
│   │   │   └── index.ts
│   │   ├── logs/
│   │   │   ├── LogViewer.tsx
│   │   │   ├── TranscriptEntry.tsx
│   │   │   ├── MailTimeline.tsx
│   │   │   └── index.ts
│   │   ├── mail/
│   │   │   ├── MailQueue.tsx
│   │   │   ├── MailEditor.tsx
│   │   │   ├── ApprovalDialog.tsx
│   │   │   └── index.ts
│   │   ├── files/
│   │   │   ├── FileExplorer.tsx
│   │   │   ├── FileViewer.tsx
│   │   │   └── index.ts
│   │   ├── terminal/
│   │   │   ├── Terminal.tsx
│   │   │   └── index.ts
│   │   └── common/
│   │       ├── Button.tsx
│   │       ├── Input.tsx
│   │       └── ...
│   ├── hooks/
│   │   ├── useWebSocket.ts
│   │   ├── useSwarm.ts
│   │   ├── useBee.ts
│   │   └── index.ts
│   ├── stores/
│   │   ├── swarmStore.ts
│   │   ├── uiStore.ts
│   │   └── index.ts
│   ├── api/
│   │   └── client.ts
│   ├── App.tsx
│   └── main.tsx
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js
```

### Deliverables

1. **Node Canvas** (react-flow based)
   - Drag to reposition beez
   - Drag from bee to bee to create connections
   - Click bee to select and show details in sidebar
   - Visual status indicators (running, paused, error)
   - Mail flow animation on edges

2. **Sidebar**
   - Bee configuration editor
   - Skill browser and assignment
   - Connection configuration
   - Swarm-wide settings

3. **Log Viewer**
   - Full transcript with collapsible tool calls
   - Mail-only view option
   - Timeline view across multiple beez
   - Search and filter

4. **Mail Queue**
   - View pending mail
   - Edit mail body/subject
   - Delete mail
   - Approve/reject human-in-the-loop mail

5. **File Explorer**
   - Browse bee container filesystem
   - View file contents
   - Edit files
   - Upload/download

6. **Terminal**
   - xterm.js integration
   - WebSocket to container shell
   - Multiple terminal tabs

7. **Real-time Updates**
   - WebSocket connection to orchestrator
   - Automatic state refresh
   - Toast notifications for important events

### Styling

Use Tailwind CSS with custom theme:

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        honey: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
        },
        // Notion-like grays
        canvas: '#ffffff',
        surface: '#f7f6f3',
        border: '#e5e5e5',
        text: {
          primary: '#37352f',
          secondary: '#787774',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      }
    }
  }
}
```

### Verification

```bash
# Build and test
cd packages/canvas-ui
pnpm build
pnpm test

# Development
pnpm dev
# Open http://localhost:3000
```

---

## Phase 5: Integration & Skills

**Goal**: Wire everything together, create built-in skills.

### Deliverables

1. **Built-in Skills**
   - `basic-tools@1.0.0`: File operations, HTTP requests
   - `mail-tools@1.0.0`: Inbox inspection, mail search

2. **End-to-End Flow**
   - Human sends mail via UI
   - Manager bee receives, delegates
   - Worker bee processes, responds
   - Response visible in UI

3. **Example Swarm**
   - Pre-configured demo swarm
   - Manager + 2 workers
   - Cron job example

4. **Docker Compose**
   ```yaml
   # docker-compose.yml
   version: '3.8'
   services:
     orchestrator:
       build: ./packages/orchestrator
       ports:
         - "3001:3001"
       volumes:
         - ./data:/data
         - /var/run/docker.sock:/var/run/docker.sock

     ui:
       build: ./packages/canvas-ui
       ports:
         - "3000:3000"
       depends_on:
         - orchestrator
   ```

### Verification

Full E2E test:
1. Start docker-compose
2. Open UI at localhost:3000
3. Load example swarm
4. Start swarm
5. Send mail to manager: "Write a haiku about bees"
6. Watch mail flow through system
7. See response in UI
8. Pause/resume swarm
9. SSH into bee container
10. Check transcript logs

---

## Development Workflow

### Local Development

```bash
# Terminal 1: Orchestrator
cd packages/orchestrator
pnpm dev

# Terminal 2: UI
cd packages/canvas-ui
pnpm dev

# Terminal 3: Watch core changes
cd packages/core
pnpm dev
```

### Testing

```bash
# All packages
pnpm test

# Specific package
pnpm --filter @buzybeez/core test

# Watch mode
pnpm --filter @buzybeez/orchestrator test:watch
```

### Building

```bash
# All packages
pnpm build

# Production build
pnpm build:prod
```

---

## Dependencies Summary

### Core
```json
{
  "dependencies": {},
  "devDependencies": {
    "typescript": "^5.3.0",
    "vitest": "^1.0.0"
  }
}
```

### Bee Runtime
```json
{
  "dependencies": {
    "@buzybeez/core": "workspace:*",
    "dockerode": "^4.0.0",
    "@anthropic-ai/claude-agent-sdk": "^0.1.0",
    "chokidar": "^3.5.0"
  }
}
```

### Orchestrator
```json
{
  "dependencies": {
    "@buzybeez/core": "workspace:*",
    "@buzybeez/bee-runtime": "workspace:*",
    "fastify": "^4.25.0",
    "@fastify/websocket": "^8.3.0",
    "cron-parser": "^4.9.0"
  }
}
```

### Canvas UI
```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "reactflow": "^11.10.0",
    "zustand": "^4.4.0",
    "xterm": "^5.3.0",
    "xterm-addon-fit": "^0.8.0"
  },
  "devDependencies": {
    "vite": "^5.0.0",
    "@vitejs/plugin-react": "^4.2.0",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0"
  }
}
```
