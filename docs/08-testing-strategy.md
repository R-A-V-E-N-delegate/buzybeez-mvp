# Testing Strategy

Comprehensive testing approach for BuzyBeez covering unit, integration, and end-to-end tests.

---

## Testing Philosophy

1. **Test behavior, not implementation**: Focus on what the system does, not how
2. **Fast feedback**: Unit tests run in milliseconds, integration tests in seconds
3. **Realistic scenarios**: E2E tests mirror actual usage
4. **Isolation**: Each test is independent, no shared state between tests

---

## Test Structure

```
packages/
├── core/
│   └── src/
│       └── __tests__/
│           ├── types/
│           │   └── validation.test.ts
│           └── utils/
│               └── logging.test.ts
├── bee-runtime/
│   └── src/
│       └── __tests__/
│           ├── docker/
│           │   └── manager.test.ts
│           ├── agent/
│           │   └── runner.test.ts
│           └── mail/
│               └── inbox.test.ts
├── orchestrator/
│   └── src/
│       └── __tests__/
│           ├── unit/
│           │   ├── topology.test.ts
│           │   └── router.test.ts
│           ├── integration/
│           │   ├── mail-flow.test.ts
│           │   └── bee-lifecycle.test.ts
│           └── api/
│               └── routes.test.ts
└── canvas-ui/
    └── src/
        └── __tests__/
            ├── components/
            │   └── Canvas.test.tsx
            └── hooks/
                └── useSwarm.test.ts

tests/
└── e2e/
    ├── single-bee.test.ts
    ├── multi-bee-delegation.test.ts
    ├── pause-resume.test.ts
    └── human-in-the-loop.test.ts
```

---

## Unit Tests

### Core Package

#### Type Validation Tests

```typescript
// packages/core/src/__tests__/types/validation.test.ts

import { describe, it, expect } from 'vitest';
import { validateMail, validateBeeConfig, validateSwarmzConfig } from '../../utils/validation';

describe('validateMail', () => {
  it('accepts valid mail', () => {
    const mail = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      from: 'human',
      to: 'manager-bee',
      subject: 'Test task',
      body: 'Do something',
      timestamp: '2024-01-15T10:30:00Z',
      metadata: { type: 'human' },
      status: 'queued'
    };

    const result = validateMail(mail);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects mail without id', () => {
    const mail = {
      from: 'human',
      to: 'manager-bee',
      subject: 'Test',
      body: 'Body',
      timestamp: '2024-01-15T10:30:00Z',
      metadata: { type: 'human' },
      status: 'queued'
    };

    const result = validateMail(mail);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ path: 'id', message: expect.any(String) })
    );
  });

  it('rejects invalid timestamp format', () => {
    const mail = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      from: 'human',
      to: 'manager-bee',
      subject: 'Test',
      body: 'Body',
      timestamp: 'not-a-timestamp',
      metadata: { type: 'human' },
      status: 'queued'
    };

    const result = validateMail(mail);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ path: 'timestamp' })
    );
  });

  it('rejects invalid status', () => {
    const mail = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      from: 'human',
      to: 'manager-bee',
      subject: 'Test',
      body: 'Body',
      timestamp: '2024-01-15T10:30:00Z',
      metadata: { type: 'human' },
      status: 'invalid-status'
    };

    const result = validateMail(mail);
    expect(result.valid).toBe(false);
  });
});

describe('validateBeeConfig', () => {
  it('accepts valid bee config', () => {
    const config = {
      id: 'worker-1',
      name: 'Worker Bee',
      keepAlive: false,
      allowSoulEdit: false,
      skills: ['basic-tools@1.0.0'],
      limits: { maxMailPerHour: 50 }
    };

    const result = validateBeeConfig(config);
    expect(result.valid).toBe(true);
  });

  it('rejects invalid keepAlive type', () => {
    const config = {
      id: 'worker-1',
      name: 'Worker Bee',
      keepAlive: 'invalid',
      allowSoulEdit: false,
      skills: [],
      limits: {}
    };

    const result = validateBeeConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ path: 'keepAlive' })
    );
  });

  it('validates cron expressions', () => {
    const config = {
      id: 'worker-1',
      name: 'Worker Bee',
      keepAlive: true,
      allowSoulEdit: false,
      skills: [],
      limits: {},
      cron: [
        {
          id: 'job-1',
          schedule: 'invalid-cron',
          mailTemplate: { subject: 'Test', body: 'Test' },
          enabled: true
        }
      ]
    };

    const result = validateBeeConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ path: 'cron[0].schedule' })
    );
  });
});

describe('validateSwarmzConfig', () => {
  it('accepts valid swarmz config', () => {
    const config = {
      id: 'test-swarmz',
      name: 'Test Swarmz',
      bees: [
        { id: 'bee-1', name: 'Bee 1', keepAlive: true, allowSoulEdit: false, skills: [], limits: {} },
        { id: 'bee-2', name: 'Bee 2', keepAlive: false, allowSoulEdit: false, skills: [], limits: {} }
      ],
      mailboxez: [],
      connections: [
        { id: 'conn-1', from: 'bee-1', to: 'bee-2', bidirectional: true }
      ],
      settings: {
        defaultLimits: {},
        autoRestart: true,
        restartDelay: 5,
        maxRestartAttempts: 3
      },
      updatedAt: '2024-01-15T10:00:00Z'
    };

    const result = validateSwarmzConfig(config);
    expect(result.valid).toBe(true);
  });

  it('rejects connection to non-existent bee', () => {
    const config = {
      id: 'test-swarmz',
      name: 'Test Swarmz',
      bees: [
        { id: 'bee-1', name: 'Bee 1', keepAlive: true, allowSoulEdit: false, skills: [], limits: {} }
      ],
      mailboxez: [],
      connections: [
        { id: 'conn-1', from: 'bee-1', to: 'non-existent', bidirectional: false }
      ],
      settings: { defaultLimits: {}, autoRestart: true, restartDelay: 5, maxRestartAttempts: 3 },
      updatedAt: '2024-01-15T10:00:00Z'
    };

    const result = validateSwarmzConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ message: expect.stringContaining('non-existent') })
    );
  });

  it('rejects duplicate bee ids', () => {
    const config = {
      id: 'test-swarmz',
      name: 'Test Swarmz',
      bees: [
        { id: 'bee-1', name: 'Bee 1', keepAlive: true, allowSoulEdit: false, skills: [], limits: {} },
        { id: 'bee-1', name: 'Duplicate', keepAlive: false, allowSoulEdit: false, skills: [], limits: {} }
      ],
      mailboxez: [],
      connections: [],
      settings: { defaultLimits: {}, autoRestart: true, restartDelay: 5, maxRestartAttempts: 3 },
      updatedAt: '2024-01-15T10:00:00Z'
    };

    const result = validateSwarmzConfig(config);
    expect(result.valid).toBe(false);
  });
});
```

### Bee Runtime

#### Docker Manager Tests

```typescript
// packages/bee-runtime/src/__tests__/docker/manager.test.ts

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DockerManager } from '../../docker/manager';

// Mock dockerode
vi.mock('dockerode', () => ({
  default: vi.fn().mockImplementation(() => ({
    createContainer: vi.fn(),
    getContainer: vi.fn(),
    listContainers: vi.fn()
  }))
}));

describe('DockerManager', () => {
  let manager: DockerManager;

  beforeEach(() => {
    manager = new DockerManager();
  });

  describe('createContainer', () => {
    it('creates container with correct config', async () => {
      const config = {
        id: 'test-bee',
        name: 'Test Bee',
        keepAlive: false,
        allowSoulEdit: false,
        skills: ['basic-tools@1.0.0'],
        limits: { maxMailPerHour: 50 }
      };

      const containerId = await manager.createContainer(config);

      expect(containerId).toBeDefined();
      expect(typeof containerId).toBe('string');
    });

    it('mounts required volumes', async () => {
      const config = {
        id: 'test-bee',
        name: 'Test Bee',
        keepAlive: false,
        allowSoulEdit: false,
        skills: [],
        limits: {}
      };

      await manager.createContainer(config);

      // Verify volume mounts were configured
      // (implementation depends on mock setup)
    });
  });

  describe('container lifecycle', () => {
    it('starts a stopped container', async () => {
      const containerId = 'test-container-id';
      await manager.startContainer(containerId);
      const status = await manager.getContainerStatus(containerId);
      expect(status).toBe('running');
    });

    it('stops a running container', async () => {
      const containerId = 'test-container-id';
      await manager.stopContainer(containerId);
      const status = await manager.getContainerStatus(containerId);
      expect(status).toBe('stopped');
    });

    it('pauses and unpauses container', async () => {
      const containerId = 'test-container-id';

      await manager.pauseContainer(containerId);
      let status = await manager.getContainerStatus(containerId);
      expect(status).toBe('paused');

      await manager.unpauseContainer(containerId);
      status = await manager.getContainerStatus(containerId);
      expect(status).toBe('running');
    });
  });
});
```

#### Inbox Manager Tests

```typescript
// packages/bee-runtime/src/__tests__/mail/inbox.test.ts

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { InboxManager } from '../../mail/inbox';
import { Mail } from '@buzybeez/core';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('InboxManager', () => {
  let inbox: InboxManager;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'inbox-test-'));
    inbox = new InboxManager(tempDir);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true });
  });

  const createTestMail = (overrides: Partial<Mail> = {}): Mail => ({
    id: '550e8400-e29b-41d4-a716-446655440000',
    from: 'sender',
    to: 'recipient',
    subject: 'Test',
    body: 'Test body',
    timestamp: new Date().toISOString(),
    metadata: { type: 'agent' },
    status: 'queued',
    ...overrides
  });

  describe('addMail', () => {
    it('adds mail to inbox', async () => {
      const mail = createTestMail();
      await inbox.addMail(mail);

      const retrieved = await inbox.getMail(mail.id);
      expect(retrieved).toEqual(mail);
    });

    it('queues multiple mail items', async () => {
      const mail1 = createTestMail({ id: 'mail-1' });
      const mail2 = createTestMail({ id: 'mail-2' });

      await inbox.addMail(mail1);
      await inbox.addMail(mail2);

      const all = await inbox.listMail();
      expect(all).toHaveLength(2);
    });
  });

  describe('getNextMail', () => {
    it('returns oldest mail first (FIFO)', async () => {
      const mail1 = createTestMail({
        id: 'mail-1',
        timestamp: '2024-01-15T10:00:00Z'
      });
      const mail2 = createTestMail({
        id: 'mail-2',
        timestamp: '2024-01-15T10:01:00Z'
      });

      await inbox.addMail(mail2);
      await inbox.addMail(mail1);

      const next = await inbox.getNextMail();
      expect(next?.id).toBe('mail-1');
    });

    it('returns null when inbox is empty', async () => {
      const next = await inbox.getNextMail();
      expect(next).toBeNull();
    });
  });

  describe('updateStatus', () => {
    it('updates mail status', async () => {
      const mail = createTestMail();
      await inbox.addMail(mail);

      await inbox.updateStatus(mail.id, 'processing');

      const retrieved = await inbox.getMail(mail.id);
      expect(retrieved?.status).toBe('processing');
    });
  });

  describe('deleteMail', () => {
    it('removes mail from inbox', async () => {
      const mail = createTestMail();
      await inbox.addMail(mail);
      await inbox.deleteMail(mail.id);

      const retrieved = await inbox.getMail(mail.id);
      expect(retrieved).toBeNull();
    });
  });

  describe('watch', () => {
    it('calls callback when new mail arrives', async () => {
      const callback = vi.fn();
      const unwatch = inbox.watch(callback);

      const mail = createTestMail();
      await inbox.addMail(mail);

      // Wait for filesystem watcher
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ id: mail.id })
      );

      unwatch();
    });
  });
});
```

### Orchestrator

#### Topology Tests

```typescript
// packages/orchestrator/src/__tests__/unit/topology.test.ts

import { describe, it, expect } from 'vitest';
import { TopologyValidator } from '../../swarmz/topology';
import { SwarmzConfig } from '@buzybeez/core';

describe('TopologyValidator', () => {
  const createSwarmz = (overrides: Partial<SwarmzConfig> = {}): SwarmzConfig => ({
    id: 'test',
    name: 'Test Swarmz',
    bees: [
      { id: 'bee-a', name: 'A', keepAlive: true, allowSoulEdit: false, skills: [], limits: {} },
      { id: 'bee-b', name: 'B', keepAlive: false, allowSoulEdit: false, skills: [], limits: {} },
      { id: 'bee-c', name: 'C', keepAlive: false, allowSoulEdit: false, skills: [], limits: {} }
    ],
    mailboxez: [],
    connections: [
      { id: 'a-to-b', from: 'bee-a', to: 'bee-b', bidirectional: false },
      { id: 'b-to-c', from: 'bee-b', to: 'bee-c', bidirectional: true }
    ],
    settings: {
      defaultLimits: {},
      autoRestart: true,
      restartDelay: 5,
      maxRestartAttempts: 3
    },
    updatedAt: new Date().toISOString(),
    ...overrides
  });

  describe('hasConnection', () => {
    it('returns true for direct connection', () => {
      const validator = new TopologyValidator(createSwarmz());
      expect(validator.hasConnection('bee-a', 'bee-b')).toBe(true);
    });

    it('returns false for reverse of unidirectional', () => {
      const validator = new TopologyValidator(createSwarmz());
      expect(validator.hasConnection('bee-b', 'bee-a')).toBe(false);
    });

    it('returns true for both directions of bidirectional', () => {
      const validator = new TopologyValidator(createSwarmz());
      expect(validator.hasConnection('bee-b', 'bee-c')).toBe(true);
      expect(validator.hasConnection('bee-c', 'bee-b')).toBe(true);
    });

    it('returns true for human to any bee', () => {
      const validator = new TopologyValidator(createSwarmz());
      expect(validator.hasConnection('human', 'bee-a')).toBe(true);
      expect(validator.hasConnection('human', 'bee-c')).toBe(true);
    });

    it('returns false for non-existent connection', () => {
      const validator = new TopologyValidator(createSwarmz());
      expect(validator.hasConnection('bee-a', 'bee-c')).toBe(false);
    });
  });

  describe('requiresApproval', () => {
    it('returns true when connection requires approval', () => {
      const swarm = createSwarmz({
        connections: [
          { id: 'a-to-b', from: 'bee-a', to: 'bee-b', bidirectional: false, requiresApproval: true }
        ]
      });
      const validator = new TopologyValidator(swarm);
      expect(validator.requiresApproval('bee-a', 'bee-b')).toBe(true);
    });

    it('returns false when connection does not require approval', () => {
      const validator = new TopologyValidator(createSwarmz());
      expect(validator.requiresApproval('bee-a', 'bee-b')).toBe(false);
    });
  });

  describe('detectCycles', () => {
    it('returns empty for acyclic topology', () => {
      const validator = new TopologyValidator(createSwarmz());
      const cycles = validator.detectCycles();
      expect(cycles).toHaveLength(0);
    });

    it('detects simple cycle', () => {
      const swarm = createSwarmz({
        connections: [
          { id: 'a-to-b', from: 'bee-a', to: 'bee-b', bidirectional: false },
          { id: 'b-to-a', from: 'bee-b', to: 'bee-a', bidirectional: false }
        ]
      });
      const validator = new TopologyValidator(swarm);
      const cycles = validator.detectCycles();
      expect(cycles.length).toBeGreaterThan(0);
    });
  });

  describe('getReachableBeez', () => {
    it('returns directly connected beez', () => {
      const validator = new TopologyValidator(createSwarmz());
      const reachable = validator.getReachableBeez('bee-a');
      expect(reachable).toContain('bee-b');
    });

    it('returns transitively reachable beez', () => {
      const validator = new TopologyValidator(createSwarmz());
      const reachable = validator.getReachableBeez('bee-a');
      expect(reachable).toContain('bee-c');
    });
  });
});
```

#### Mail Router Tests

```typescript
// packages/orchestrator/src/__tests__/unit/router.test.ts

import { describe, it, expect, vi } from 'vitest';
import { MailRouter } from '../../mail/router';
import { TopologyValidator } from '../../swarmz/topology';
import { BeeManager } from '../../lifecycle/bee-manager';
import { Mail } from '@buzybeez/core';

describe('MailRouter', () => {
  const createMockTopology = () => ({
    hasConnection: vi.fn().mockReturnValue(true),
    requiresApproval: vi.fn().mockReturnValue(false)
  });

  const createMockBeeManager = () => ({
    getBeeState: vi.fn().mockReturnValue({ status: 'idle' }),
    deliverMail: vi.fn().mockResolvedValue(undefined)
  });

  const createMail = (overrides: Partial<Mail> = {}): Mail => ({
    id: 'test-mail',
    from: 'bee-a',
    to: 'bee-b',
    subject: 'Test',
    body: 'Test',
    timestamp: new Date().toISOString(),
    metadata: { type: 'agent' },
    status: 'queued',
    ...overrides
  });

  describe('route', () => {
    it('delivers mail when connection exists', async () => {
      const topology = createMockTopology();
      const beeManager = createMockBeeManager();
      const router = new MailRouter(topology as any, beeManager as any);

      const mail = createMail();
      const result = await router.route(mail);

      expect(result.status).toBe('delivered');
      expect(beeManager.deliverMail).toHaveBeenCalledWith('bee-b', mail);
    });

    it('bounces when no connection exists', async () => {
      const topology = createMockTopology();
      topology.hasConnection.mockReturnValue(false);
      const beeManager = createMockBeeManager();
      const router = new MailRouter(topology as any, beeManager as any);

      const mail = createMail();
      const result = await router.route(mail);

      expect(result.status).toBe('bounced');
      expect(result.reason).toContain('connection');
    });

    it('returns pending_approval when required', async () => {
      const topology = createMockTopology();
      topology.requiresApproval.mockReturnValue(true);
      const beeManager = createMockBeeManager();
      const router = new MailRouter(topology as any, beeManager as any);

      const mail = createMail();
      const result = await router.route(mail);

      expect(result.status).toBe('pending_approval');
    });

    it('bounces when recipient is crashed', async () => {
      const topology = createMockTopology();
      const beeManager = createMockBeeManager();
      beeManager.getBeeState.mockReturnValue({ status: 'error' });
      const router = new MailRouter(topology as any, beeManager as any);

      const mail = createMail();
      const result = await router.route(mail);

      expect(result.status).toBe('bounced');
      expect(result.reason).toContain('crashed');
    });
  });
});
```

---

## Integration Tests

### Mail Flow Test

```typescript
// packages/orchestrator/src/__tests__/integration/mail-flow.test.ts

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Orchestrator } from '../../index';
import { SwarmzConfig, Mail } from '@buzybeez/core';

describe('Mail Flow Integration', () => {
  let orchestrator: Orchestrator;

  const testSwarmz: SwarmzConfig = {
    id: 'integration-test',
    name: 'Integration Test Swarmz',
    bees: [
      {
        id: 'sender',
        name: 'Sender Bee',
        keepAlive: true,
        allowSoulEdit: false,
        skills: ['basic-tools@1.0.0'],
        limits: {}
      },
      {
        id: 'receiver',
        name: 'Receiver Bee',
        keepAlive: false,
        allowSoulEdit: false,
        skills: ['basic-tools@1.0.0'],
        limits: {}
      }
    ],
    mailboxez: [],
    connections: [
      { id: 'send', from: 'sender', to: 'receiver', bidirectional: true }
    ],
    settings: {
      defaultLimits: {},
      autoRestart: false,
      restartDelay: 0,
      maxRestartAttempts: 0
    },
    updatedAt: new Date().toISOString()
  };

  beforeAll(async () => {
    orchestrator = new Orchestrator({ testMode: true });
    await orchestrator.loadSwarmz(testSwarmz);
    await orchestrator.startSwarmz();
  });

  afterAll(async () => {
    await orchestrator.stopSwarmz();
    await orchestrator.cleanup();
  });

  it('delivers mail from sender to receiver', async () => {
    const mail: Partial<Mail> = {
      from: 'sender',
      to: 'receiver',
      subject: 'Test message',
      body: 'Hello from sender!'
    };

    const result = await orchestrator.sendMail(mail);
    expect(result.status).toBe('delivered');

    const receiverInbox = await orchestrator.getInbox('receiver');
    expect(receiverInbox).toContainEqual(
      expect.objectContaining({ subject: 'Test message' })
    );
  });

  it('receiver can reply to sender', async () => {
    // First, send initial mail
    await orchestrator.sendMail({
      from: 'sender',
      to: 'receiver',
      subject: 'Initial',
      body: 'Hello'
    });

    // Receiver replies
    const reply = await orchestrator.sendMail({
      from: 'receiver',
      to: 'sender',
      subject: 'Re: Initial',
      body: 'Hello back!'
    });

    expect(reply.status).toBe('delivered');

    const senderInbox = await orchestrator.getInbox('sender');
    expect(senderInbox).toContainEqual(
      expect.objectContaining({ subject: 'Re: Initial' })
    );
  });

  it('bounces mail when no connection exists', async () => {
    // Add a third bee with no connections
    await orchestrator.addBee({
      id: 'isolated',
      name: 'Isolated Bee',
      keepAlive: false,
      allowSoulEdit: false,
      skills: [],
      limits: {}
    });

    const result = await orchestrator.sendMail({
      from: 'sender',
      to: 'isolated',
      subject: 'Should bounce',
      body: 'This should not be delivered'
    });

    expect(result.status).toBe('bounced');
  });
});
```

### Bee Lifecycle Test

```typescript
// packages/orchestrator/src/__tests__/integration/bee-lifecycle.test.ts

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Orchestrator } from '../../index';

describe('Bee Lifecycle Integration', () => {
  let orchestrator: Orchestrator;

  beforeAll(async () => {
    orchestrator = new Orchestrator({ testMode: true });
  });

  afterAll(async () => {
    await orchestrator.cleanup();
  });

  it('starts a bee and reports running status', async () => {
    await orchestrator.addBee({
      id: 'lifecycle-test',
      name: 'Lifecycle Test',
      keepAlive: false,
      allowSoulEdit: false,
      skills: [],
      limits: {}
    });

    await orchestrator.startBee('lifecycle-test');

    const state = orchestrator.getBeeState('lifecycle-test');
    expect(state?.status).toBe('idle');
  });

  it('pauses and resumes a bee', async () => {
    await orchestrator.pauseBee('lifecycle-test');

    let state = orchestrator.getBeeState('lifecycle-test');
    expect(state?.status).toBe('paused');

    await orchestrator.resumeBee('lifecycle-test');

    state = orchestrator.getBeeState('lifecycle-test');
    expect(state?.status).toBe('idle');
  });

  it('stops a bee', async () => {
    await orchestrator.stopBee('lifecycle-test');

    const state = orchestrator.getBeeState('lifecycle-test');
    expect(state?.status).toBe('stopped');
  });

  it('restarts a stopped bee', async () => {
    await orchestrator.startBee('lifecycle-test');

    const state = orchestrator.getBeeState('lifecycle-test');
    expect(state?.status).toBe('idle');
  });
});
```

---

## End-to-End Tests

### Single Bee E2E

```typescript
// tests/e2e/single-bee.test.ts

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, ChildProcess } from 'child_process';

describe('Single Bee E2E', () => {
  let orchestratorProcess: ChildProcess;
  const API_URL = 'http://localhost:3001/api';

  beforeAll(async () => {
    // Start orchestrator
    orchestratorProcess = spawn('pnpm', ['--filter', '@buzybeez/orchestrator', 'start'], {
      stdio: 'pipe',
      env: { ...process.env, NODE_ENV: 'test' }
    });

    // Wait for server to be ready
    await waitForServer(API_URL + '/health');
  });

  afterAll(async () => {
    orchestratorProcess.kill();
  });

  it('creates a swarmz with one bee', async () => {
    const response = await fetch(API_URL + '/swarmz', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'e2e-single',
        name: 'E2E Single Bee Test',
        bees: [{
          id: 'solo-bee',
          name: 'Solo Bee',
          keepAlive: false,
          allowSoulEdit: false,
          skills: ['basic-tools@1.0.0'],
          limits: {}
        }],
        mailboxez: [],
        connections: [],
        settings: {
          defaultLimits: {},
          autoRestart: false,
          restartDelay: 0,
          maxRestartAttempts: 0
        }
      })
    });

    expect(response.status).toBe(200);
  });

  it('starts the swarmz', async () => {
    const response = await fetch(API_URL + '/swarm/start', { method: 'POST' });
    expect(response.status).toBe(200);

    // Wait for bee to be idle
    await waitForBeeStatus('solo-bee', 'idle');
  });

  it('sends mail to bee and receives response', async () => {
    // Send mail
    const sendResponse = await fetch(API_URL + '/bees/solo-bee/mail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'human',
        subject: 'Test task',
        body: 'Say hello'
      })
    });

    expect(sendResponse.status).toBe(201);

    // Wait for processing
    await waitForBeeStatus('solo-bee', 'idle', 30000);

    // Check outbox for response
    const outboxResponse = await fetch(API_URL + '/bees/solo-bee/outbox');
    const outbox = await outboxResponse.json();

    expect(outbox.mail.length).toBeGreaterThan(0);
  });

  it('shows transcript of bee activity', async () => {
    const response = await fetch(API_URL + '/bees/solo-bee/transcript');
    const transcript = await response.json();

    expect(transcript.entries.length).toBeGreaterThan(0);
    expect(transcript.entries).toContainEqual(
      expect.objectContaining({ type: 'mail_received' })
    );
  });

  it('stops the swarmz', async () => {
    const response = await fetch(API_URL + '/swarm/stop', { method: 'POST' });
    expect(response.status).toBe(200);

    const state = await (await fetch(API_URL + '/swarmz')).json();
    expect(state.state.status).toBe('stopped');
  });
});

// Helper functions
async function waitForServer(url: string, timeout = 30000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      await fetch(url);
      return;
    } catch {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  throw new Error('Server did not start in time');
}

async function waitForBeeStatus(beeId: string, status: string, timeout = 10000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const response = await fetch(`http://localhost:3001/api/bees/${beeId}`);
    const data = await response.json();
    if (data.state.status === status) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Bee ${beeId} did not reach status ${status} in time`);
}
```

### Multi-Bee Delegation E2E

```typescript
// tests/e2e/multi-bee-delegation.test.ts

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

describe('Multi-Bee Delegation E2E', () => {
  const API_URL = 'http://localhost:3001/api';

  beforeAll(async () => {
    // Create swarmz with coordinator and worker
    await fetch(API_URL + '/swarmz', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'e2e-delegation',
        name: 'E2E Delegation Test',
        bees: [
          {
            id: 'coordinator',
            name: 'Coordinator',
            keepAlive: true,
            allowSoulEdit: false,
            skills: ['basic-tools@1.0.0'],
            limits: {}
          },
          {
            id: 'worker',
            name: 'Worker',
            keepAlive: false,
            allowSoulEdit: false,
            skills: ['basic-tools@1.0.0'],
            limits: {}
          }
        ],
        mailboxez: [
          { id: 'human', name: 'Human Interface' }
        ],
        connections: [
          { id: 'human-coordinator', from: 'mailbox:human', to: 'coordinator', bidirectional: true },
          { id: 'coordinator-worker', from: 'coordinator', to: 'worker', bidirectional: true }
        ],
        settings: { defaultLimits: {}, autoRestart: false, restartDelay: 0, maxRestartAttempts: 0 }
      })
    });

    await fetch(API_URL + '/swarm/start', { method: 'POST' });
    await waitForBeeStatus('coordinator', 'idle');
    await waitForBeeStatus('worker', 'idle');
  });

  afterAll(async () => {
    await fetch(API_URL + '/swarm/stop', { method: 'POST' });
  });

  it('coordinator delegates to worker and returns result', async () => {
    // Send task to coordinator
    await fetch(API_URL + '/bees/coordinator/mail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'human',
        subject: 'Complete task',
        body: 'Please have your worker write a haiku about bees.'
      })
    });

    // Wait for full flow: coordinator → worker → coordinator → mailbox
    await new Promise(resolve => setTimeout(resolve, 60000));

    // Check coordinator's outbox for delegation
    const coordinatorOutbox = await (await fetch(API_URL + '/bees/coordinator/outbox')).json();
    const delegation = coordinatorOutbox.mail.find((m: any) => m.to === 'worker');
    expect(delegation).toBeDefined();

    // Check worker's outbox for response
    const workerOutbox = await (await fetch(API_URL + '/bees/worker/outbox')).json();
    const workerResponse = workerOutbox.mail.find((m: any) => m.to === 'coordinator');
    expect(workerResponse).toBeDefined();

    // Check coordinator's outbox for mailbox response
    const mailboxResponse = coordinatorOutbox.mail.find((m: any) => m.to === 'mailbox:human');
    expect(mailboxResponse).toBeDefined();
  }, 120000);
});
```

### Pause/Resume E2E

```typescript
// tests/e2e/pause-resume.test.ts

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

describe('Pause/Resume E2E', () => {
  const API_URL = 'http://localhost:3001/api';

  beforeAll(async () => {
    // Setup swarmz
    // ... (similar to other E2E tests)
  });

  it('pausing a bee preserves state', async () => {
    // Send a task
    await fetch(API_URL + '/bees/test-bee/mail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'human',
        subject: 'Long task',
        body: 'This is a task that takes time'
      })
    });

    // Wait for processing to start
    await waitForBeeStatus('test-bee', 'processing');

    // Pause
    await fetch(API_URL + '/bees/test-bee/pause', { method: 'POST' });
    const pausedState = await (await fetch(API_URL + '/bees/test-bee')).json();
    expect(pausedState.state.status).toBe('paused');
    expect(pausedState.state.currentMail).toBeDefined();

    // Resume
    await fetch(API_URL + '/bees/test-bee/resume', { method: 'POST' });

    // Wait for completion
    await waitForBeeStatus('test-bee', 'idle', 60000);

    // Verify task completed
    const outbox = await (await fetch(API_URL + '/bees/test-bee/outbox')).json();
    expect(outbox.mail.length).toBeGreaterThan(0);
  });
});
```

### Human-in-the-Loop E2E

```typescript
// tests/e2e/human-in-the-loop.test.ts

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

describe('Human-in-the-Loop E2E', () => {
  const API_URL = 'http://localhost:3001/api';

  beforeAll(async () => {
    // Create swarmz with approval required
    await fetch(API_URL + '/swarmz', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'e2e-hitl',
        name: 'E2E HITL Test',
        bees: [
          { id: 'sender', name: 'Sender', keepAlive: true, allowSoulEdit: false, skills: [], limits: {} },
          { id: 'receiver', name: 'Receiver', keepAlive: false, allowSoulEdit: false, skills: [], limits: {} }
        ],
        mailboxez: [],
        connections: [
          {
            id: 'approved-route',
            from: 'sender',
            to: 'receiver',
            bidirectional: false,
            requiresApproval: true
          }
        ],
        settings: { defaultLimits: {}, autoRestart: false, restartDelay: 0, maxRestartAttempts: 0 }
      })
    });

    await fetch(API_URL + '/swarm/start', { method: 'POST' });
  });

  it('mail waits for approval', async () => {
    // Sender creates mail to receiver
    const sendResponse = await fetch(API_URL + '/bees/sender/mail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'sender',
        to: 'receiver',
        subject: 'Needs approval',
        body: 'This should wait for human approval'
      })
    });

    const { mail } = await sendResponse.json();

    // Check mail is pending
    const mailStatus = await (await fetch(API_URL + `/mail/${mail.id}`)).json();
    expect(mailStatus.mail.status).toBe('pending_approval');

    // Receiver should not have mail yet
    const receiverInbox = await (await fetch(API_URL + '/bees/receiver/inbox')).json();
    expect(receiverInbox.mail).not.toContainEqual(
      expect.objectContaining({ id: mail.id })
    );
  });

  it('approved mail is delivered', async () => {
    // Get pending mail
    const inbox = await (await fetch(API_URL + '/bees/sender/outbox')).json();
    const pendingMail = inbox.mail.find((m: any) => m.status === 'pending_approval');

    // Approve
    await fetch(API_URL + `/mail/${pendingMail.id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approvedBy: 'test-user' })
    });

    // Wait for delivery
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check receiver has mail
    const receiverInbox = await (await fetch(API_URL + '/bees/receiver/inbox')).json();
    expect(receiverInbox.mail).toContainEqual(
      expect.objectContaining({ id: pendingMail.id })
    );
  });

  it('rejected mail bounces to sender', async () => {
    // Create new mail
    const sendResponse = await fetch(API_URL + '/bees/sender/mail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'sender',
        to: 'receiver',
        subject: 'Will be rejected',
        body: 'This will be rejected'
      })
    });

    const { mail } = await sendResponse.json();

    // Reject
    await fetch(API_URL + `/mail/${mail.id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Policy violation' })
    });

    // Check sender received bounce
    const senderInbox = await (await fetch(API_URL + '/bees/sender/inbox')).json();
    expect(senderInbox.mail).toContainEqual(
      expect.objectContaining({
        subject: expect.stringContaining('Rejected'),
        body: expect.stringContaining('Policy violation')
      })
    );
  });
});
```

---

## Running Tests

```bash
# All tests
pnpm test

# Unit tests only
pnpm test:unit

# Integration tests only
pnpm test:integration

# E2E tests only
pnpm test:e2e

# Watch mode
pnpm test:watch

# Coverage report
pnpm test:coverage

# Specific package
pnpm --filter @buzybeez/core test
pnpm --filter @buzybeez/orchestrator test:integration
```

---

## CI Configuration

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm test:unit

  integration:
    runs-on: ubuntu-latest
    services:
      docker:
        image: docker:dind
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm test:integration

  e2e:
    runs-on: ubuntu-latest
    services:
      docker:
        image: docker:dind
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm build
      - run: pnpm test:e2e
```
