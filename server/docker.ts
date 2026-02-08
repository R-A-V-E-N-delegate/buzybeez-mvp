/**
 * Docker management for the bee container
 */

import Docker from 'dockerode';
import path from 'path';
import fs from 'fs/promises';

const CONTAINER_NAME = 'buzybeez-bee';
const IMAGE_NAME = 'buzybeez-bee:latest';

export interface BeeStatus {
  running: boolean;
  containerId?: string;
  state?: string;
  startedAt?: string;
}

export class DockerManager {
  private docker: Docker;
  private dataDir: string;

  constructor(dataDir: string) {
    this.docker = new Docker();
    this.dataDir = dataDir;
  }

  async getStatus(): Promise<BeeStatus> {
    try {
      const container = this.docker.getContainer(CONTAINER_NAME);
      const info = await container.inspect();

      return {
        running: info.State.Running,
        containerId: info.Id,
        state: info.State.Status,
        startedAt: info.State.StartedAt
      };
    } catch (e: any) {
      if (e.statusCode === 404) {
        return { running: false };
      }
      throw e;
    }
  }

  async start(): Promise<void> {
    // First, try to start existing container
    try {
      const container = this.docker.getContainer(CONTAINER_NAME);
      const info = await container.inspect();

      if (!info.State.Running) {
        console.log('Starting existing container...');
        await container.start();
      }
      return;
    } catch (e: any) {
      if (e.statusCode !== 404) throw e;
      // Container doesn't exist, create it
    }

    // Ensure image exists
    try {
      await this.docker.getImage(IMAGE_NAME).inspect();
    } catch {
      throw new Error(`Docker image ${IMAGE_NAME} not found. Run: npm run docker:build`);
    }

    // Ensure directories exist
    const dirs = ['inbox', 'outbox', 'state', 'logs', 'workspace'];
    for (const dir of dirs) {
      await fs.mkdir(path.join(this.dataDir, dir), { recursive: true });
    }

    // Ensure soul.md exists
    const soulPath = path.join(this.dataDir, 'soul.md');
    try {
      await fs.access(soulPath);
    } catch {
      await fs.writeFile(soulPath, `# Worker Bee

You are a helpful Worker Bee in the BuzyBeez system.

Your job is to process mail and help with tasks. You have access to a workspace where you can create, read, and manage files.

Be helpful, be concise, and always do your best work.
`);
    }

    // Get API key from environment
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable required');
    }

    console.log('Creating new container...');

    const container = await this.docker.createContainer({
      name: CONTAINER_NAME,
      Image: IMAGE_NAME,
      Env: [
        `ANTHROPIC_API_KEY=${apiKey}`,
        'BEE_ID=bee-001',
        'BEE_NAME=Worker Bee'
      ],
      HostConfig: {
        Binds: [
          `${path.join(this.dataDir, 'inbox')}:/inbox`,
          `${path.join(this.dataDir, 'outbox')}:/outbox`,
          `${path.join(this.dataDir, 'state')}:/state`,
          `${path.join(this.dataDir, 'logs')}:/logs`,
          `${path.join(this.dataDir, 'workspace')}:/workspace`,
          `${soulPath}:/soul.md:ro`
        ],
        RestartPolicy: { Name: 'unless-stopped' }
      }
    });

    await container.start();
    console.log('Container started');
  }

  async stop(): Promise<void> {
    try {
      const container = this.docker.getContainer(CONTAINER_NAME);
      await container.stop();
      console.log('Container stopped');
    } catch (e: any) {
      if (e.statusCode === 404 || e.statusCode === 304) {
        return; // Container doesn't exist or already stopped
      }
      throw e;
    }
  }

  async remove(): Promise<void> {
    try {
      const container = this.docker.getContainer(CONTAINER_NAME);
      await container.remove({ force: true });
      console.log('Container removed');
    } catch (e: any) {
      if (e.statusCode === 404) {
        return;
      }
      throw e;
    }
  }

  async listWorkspaceFiles(subPath: string = ''): Promise<{ name: string; type: string; size: number }[]> {
    const dirPath = path.join(this.dataDir, 'workspace', subPath);
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      const results = [];

      for (const entry of entries) {
        const stat = await fs.stat(path.join(dirPath, entry.name));
        results.push({
          name: entry.name,
          type: entry.isDirectory() ? 'directory' : 'file',
          size: stat.size
        });
      }

      return results;
    } catch {
      return [];
    }
  }

  async readWorkspaceFile(filePath: string): Promise<string> {
    const fullPath = path.join(this.dataDir, 'workspace', filePath);

    // Security: ensure we're still within workspace
    const resolved = path.resolve(fullPath);
    const workspaceRoot = path.resolve(this.dataDir, 'workspace');
    if (!resolved.startsWith(workspaceRoot)) {
      throw new Error('Invalid path');
    }

    return await fs.readFile(fullPath, 'utf-8');
  }
}
