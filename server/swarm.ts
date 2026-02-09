/**
 * Swarm Manager - Manages multiple bees and their connections
 */

import Docker from 'dockerode';
import path from 'path';
import fs from 'fs/promises';
import { EventEmitter } from 'events';
import type { BeeConfig, BeeState, SwarmConfig, Connection, Mail } from './types.js';

const IMAGE_NAME = 'buzybeez-bee:latest';

export class SwarmManager extends EventEmitter {
  private docker: Docker;
  private dataDir: string;
  private swarmConfig: SwarmConfig | null = null;
  private beeStates: Map<string, BeeState> = new Map();

  constructor(dataDir: string) {
    super();
    this.docker = new Docker();
    this.dataDir = dataDir;
  }

  async initialize(): Promise<void> {
    // Load or create default swarm config
    const configPath = path.join(this.dataDir, 'swarm.json');
    try {
      const data = await fs.readFile(configPath, 'utf-8');
      this.swarmConfig = JSON.parse(data);
    } catch {
      // Create default swarm with one bee
      this.swarmConfig = {
        id: 'default-swarm',
        name: 'Default Swarm',
        bees: [
          { id: 'bee-001', name: 'Worker Bee' }
        ],
        connections: [
          { from: 'human', to: 'bee-001' },
          { from: 'bee-001', to: 'human' }
        ]
      };
      await this.saveConfig();
    }

    // Check status of all bees
    await this.refreshBeeStates();
  }

  async saveConfig(): Promise<void> {
    const configPath = path.join(this.dataDir, 'swarm.json');
    await fs.writeFile(configPath, JSON.stringify(this.swarmConfig, null, 2));
  }

  getConfig(): SwarmConfig {
    return this.swarmConfig!;
  }

  async setConfig(config: SwarmConfig): Promise<void> {
    this.swarmConfig = config;
    await this.saveConfig();
  }

  getBeeStates(): BeeState[] {
    return Array.from(this.beeStates.values());
  }

  async refreshBeeStates(): Promise<void> {
    for (const bee of this.swarmConfig!.bees) {
      const state = await this.getBeeStatus(bee.id);
      this.beeStates.set(bee.id, {
        id: bee.id,
        name: bee.name,
        ...state
      });
    }
  }

  private async getBeeStatus(beeId: string): Promise<{ running: boolean; containerId?: string; startedAt?: string }> {
    const containerName = `buzybeez-${beeId}`;
    try {
      const container = this.docker.getContainer(containerName);
      const info = await container.inspect();
      return {
        running: info.State.Running,
        containerId: info.Id,
        startedAt: info.State.StartedAt
      };
    } catch (e: any) {
      if (e.statusCode === 404) {
        return { running: false };
      }
      throw e;
    }
  }

  async addBee(config: BeeConfig): Promise<void> {
    // Check if bee already exists
    if (this.swarmConfig!.bees.find(b => b.id === config.id)) {
      throw new Error(`Bee ${config.id} already exists`);
    }

    this.swarmConfig!.bees.push(config);
    await this.saveConfig();

    // Initialize state
    this.beeStates.set(config.id, {
      id: config.id,
      name: config.name,
      running: false
    });
  }

  async removeBee(beeId: string): Promise<void> {
    // Stop if running
    await this.stopBee(beeId);

    // Remove from config
    this.swarmConfig!.bees = this.swarmConfig!.bees.filter(b => b.id !== beeId);
    this.swarmConfig!.connections = this.swarmConfig!.connections.filter(
      c => c.from !== beeId && c.to !== beeId
    );
    await this.saveConfig();

    // Remove state
    this.beeStates.delete(beeId);

    // Optionally remove data directory
    const beeDataDir = path.join(this.dataDir, 'bees', beeId);
    await fs.rm(beeDataDir, { recursive: true, force: true });
  }

  async startBee(beeId: string): Promise<BeeState> {
    const bee = this.swarmConfig!.bees.find(b => b.id === beeId);
    if (!bee) {
      throw new Error(`Bee ${beeId} not found`);
    }

    const containerName = `buzybeez-${beeId}`;

    // Try to start existing container
    try {
      const container = this.docker.getContainer(containerName);
      const info = await container.inspect();
      if (!info.State.Running) {
        await container.start();
      }
      const state = await this.getBeeStatus(beeId);
      const beeState = { id: beeId, name: bee.name, ...state };
      this.beeStates.set(beeId, beeState);
      return beeState;
    } catch (e: any) {
      if (e.statusCode !== 404) throw e;
    }

    // Create new container
    const beeDataDir = path.join(this.dataDir, 'bees', beeId);
    const dirs = ['inbox', 'outbox', 'state', 'logs', 'workspace', 'claude-data'];
    for (const dir of dirs) {
      await fs.mkdir(path.join(beeDataDir, dir), { recursive: true });
    }

    // Create soul file
    const soulPath = path.join(beeDataDir, 'soul.md');
    const soulContent = bee.soul || `# ${bee.name}

You are ${bee.name}, a helpful AI bee in the BuzyBeez system.

## Your Purpose
You process mail and help with tasks. You have access to a workspace where you can create, read, manage files, and execute code.

## Your Tools
- Read, Write, Edit - File operations in /workspace
- Bash - Run shell commands (python3, node, bash, etc.)
- Glob, Grep - Search for files and content
- send_mail - Send mail to other bees or the human (bee-to-bee communication)

## Guidelines
- Be helpful and concise
- You CAN run code! Use the Bash tool to run scripts, start servers, install packages
- Always confirm what you've done
`;
    await fs.writeFile(soulPath, soulContent);

    // Create hierarchy file with upstream/downstream relationships
    const connections = this.swarmConfig!.connections || [];
    const bees = this.swarmConfig!.bees || [];

    // Upstream: nodes that connect TO this bee (they assign tasks)
    const upstream = connections
      .filter(c => c.to === beeId)
      .map(c => {
        if (c.from === 'human') {
          return { id: 'human', name: 'Human', type: 'human' };
        }
        const b = bees.find(x => x.id === c.from);
        return { id: c.from, name: b?.name || c.from, type: 'bee' };
      });

    // Downstream: nodes this bee connects TO (they receive delegated tasks)
    const downstream = connections
      .filter(c => c.from === beeId)
      .map(c => {
        if (c.to === 'human') {
          return { id: 'human', name: 'Human', type: 'human' };
        }
        const b = bees.find(x => x.id === c.to);
        return { id: c.to, name: b?.name || c.to, type: 'bee' };
      });

    const hierarchyPath = path.join(beeDataDir, 'state', 'hierarchy.json');
    await fs.writeFile(hierarchyPath, JSON.stringify({
      beeId,
      receivesTasksFrom: upstream,
      canDelegateTo: downstream
    }, null, 2));

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable required');
    }

    const container = await this.docker.createContainer({
      name: containerName,
      Image: IMAGE_NAME,
      Env: [
        `ANTHROPIC_API_KEY=${apiKey}`,
        `BEE_ID=${beeId}`,
        `BEE_NAME=${bee.name}`,
        `MODEL=${bee.model || 'claude-haiku-4-5-20251001'}`,
        `CLAUDE_CODE_CWD=/workspace`
      ],
      HostConfig: {
        Binds: [
          `${path.join(beeDataDir, 'inbox')}:/inbox`,
          `${path.join(beeDataDir, 'outbox')}:/outbox`,
          `${path.join(beeDataDir, 'state')}:/state`,
          `${path.join(beeDataDir, 'logs')}:/logs`,
          `${path.join(beeDataDir, 'workspace')}:/workspace`,
          `${soulPath}:/soul.md:ro`,
          `${path.join(beeDataDir, 'claude-data')}:/root/.claude`
        ],
        RestartPolicy: { Name: 'unless-stopped' }
      }
    });

    await container.start();

    const state = await this.getBeeStatus(beeId);
    const beeState = { id: beeId, name: bee.name, ...state };
    this.beeStates.set(beeId, beeState);
    return beeState;
  }

  async stopBee(beeId: string): Promise<BeeState> {
    const bee = this.swarmConfig!.bees.find(b => b.id === beeId);
    if (!bee) {
      throw new Error(`Bee ${beeId} not found`);
    }

    const containerName = `buzybeez-${beeId}`;
    try {
      const container = this.docker.getContainer(containerName);
      await container.stop();
    } catch (e: any) {
      if (e.statusCode !== 404 && e.statusCode !== 304) {
        throw e;
      }
    }

    const beeState = { id: beeId, name: bee.name, running: false };
    this.beeStates.set(beeId, beeState);
    return beeState;
  }

  // Connection management
  addConnection(from: string, to: string, bidirectional?: boolean): void {
    if (bidirectional) {
      // For bidirectional, we store both directions internally
      // First check if either direction already exists
      const existsForward = this.swarmConfig!.connections.find(
        c => c.from === from && c.to === to
      );
      const existsReverse = this.swarmConfig!.connections.find(
        c => c.from === to && c.to === from
      );

      if (!existsForward) {
        this.swarmConfig!.connections.push({ from, to, bidirectional: true });
      } else if (!existsForward.bidirectional) {
        existsForward.bidirectional = true;
      }

      if (!existsReverse) {
        this.swarmConfig!.connections.push({ from: to, to: from, bidirectional: true });
      } else if (!existsReverse.bidirectional) {
        existsReverse.bidirectional = true;
      }
    } else {
      const exists = this.swarmConfig!.connections.find(
        c => c.from === from && c.to === to
      );
      if (!exists) {
        this.swarmConfig!.connections.push({ from, to });
      }
    }
    this.saveConfig();
  }

  removeConnection(from: string, to: string, bidirectional?: boolean): void {
    if (bidirectional) {
      // Remove both directions
      this.swarmConfig!.connections = this.swarmConfig!.connections.filter(
        c => !((c.from === from && c.to === to) || (c.from === to && c.to === from))
      );
    } else {
      this.swarmConfig!.connections = this.swarmConfig!.connections.filter(
        c => !(c.from === from && c.to === to)
      );
    }
    this.saveConfig();
  }

  // Update bidirectional flag on existing connection
  updateConnectionBidirectional(from: string, to: string, bidirectional: boolean): void {
    if (bidirectional) {
      // Add the reverse connection if it doesn't exist
      this.addConnection(from, to, true);
    } else {
      // Remove the bidirectional flag from both and remove the reverse connection
      const forward = this.swarmConfig!.connections.find(
        c => c.from === from && c.to === to
      );
      if (forward) {
        delete forward.bidirectional;
      }
      // Remove the reverse direction
      this.swarmConfig!.connections = this.swarmConfig!.connections.filter(
        c => !(c.from === to && c.to === from)
      );
      this.saveConfig();
    }
  }

  // Get merged connections for display (combines parallel edges into bidirectional)
  getMergedConnections(): Connection[] {
    const connections = this.swarmConfig!.connections;
    const merged: Connection[] = [];
    const processed = new Set<string>();

    for (const conn of connections) {
      const key = `${conn.from}->${conn.to}`;
      const reverseKey = `${conn.to}->${conn.from}`;

      if (processed.has(key) || processed.has(reverseKey)) {
        continue;
      }

      // Check if reverse exists
      const reverse = connections.find(
        c => c.from === conn.to && c.to === conn.from
      );

      if (reverse) {
        // Both directions exist - mark as bidirectional
        // Use consistent ordering (alphabetically smaller source first)
        const source = conn.from < conn.to ? conn.from : conn.to;
        const target = conn.from < conn.to ? conn.to : conn.from;
        merged.push({ from: source, to: target, bidirectional: true });
        processed.add(key);
        processed.add(reverseKey);
      } else {
        merged.push({ from: conn.from, to: conn.to, bidirectional: false });
        processed.add(key);
      }
    }

    return merged;
  }

  canSendMail(from: string, to: string): boolean {
    return this.swarmConfig!.connections.some(
      c => c.from === from && c.to === to
    );
  }

  // Mail routing
  async routeMail(mail: Mail): Promise<void> {
    if (!this.canSendMail(mail.from, mail.to)) {
      throw new Error(`No connection from ${mail.from} to ${mail.to}`);
    }

    if (mail.to === 'human') {
      // Deliver to human inbox
      this.emit('mail:to-human', mail);
      return;
    }

    // Deliver to bee inbox
    const beeDataDir = path.join(this.dataDir, 'bees', mail.to);
    const inboxDir = path.join(beeDataDir, 'inbox');
    await fs.mkdir(inboxDir, { recursive: true });

    const filename = `${Date.now()}-${mail.id}.json`;
    await fs.writeFile(
      path.join(inboxDir, filename),
      JSON.stringify(mail, null, 2)
    );

    this.emit('mail:routed', mail);
  }

  getBeeDataDir(beeId: string): string {
    return path.join(this.dataDir, 'bees', beeId);
  }
}
