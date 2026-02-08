/**
 * Transcript watcher - streams bee activity logs to UI
 */

import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';
import chokidar from 'chokidar';

export interface TranscriptEntry {
  id: string;
  timestamp: string;
  beeId: string;
  type: string;
  [key: string]: unknown;
}

export class TranscriptWatcher extends EventEmitter {
  private dataDir: string;
  private entries: TranscriptEntry[] = [];
  private watcher?: chokidar.FSWatcher;
  private lastSize = 0;

  constructor(dataDir: string) {
    super();
    this.dataDir = dataDir;
  }

  async getAll(): Promise<TranscriptEntry[]> {
    await this.loadTranscript();
    return this.entries;
  }

  async startWatching(): Promise<void> {
    const logsDir = path.join(this.dataDir, 'logs');
    await fs.mkdir(logsDir, { recursive: true });

    const transcriptPath = path.join(logsDir, 'transcript.jsonl');

    // Load existing entries
    await this.loadTranscript();

    // Watch for changes
    this.watcher = chokidar.watch(transcriptPath, {
      persistent: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50
      }
    });

    this.watcher.on('change', async () => {
      await this.checkForNewEntries(transcriptPath);
    });

    this.watcher.on('add', async () => {
      await this.checkForNewEntries(transcriptPath);
    });

    console.log(`👀 Watching transcript for bee activity...`);
  }

  private async loadTranscript(): Promise<void> {
    const transcriptPath = path.join(this.dataDir, 'logs', 'transcript.jsonl');

    try {
      const content = await fs.readFile(transcriptPath, 'utf-8');
      this.lastSize = content.length;

      this.entries = content
        .trim()
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(Boolean) as TranscriptEntry[];
    } catch {
      this.entries = [];
      this.lastSize = 0;
    }
  }

  private async checkForNewEntries(transcriptPath: string): Promise<void> {
    try {
      const content = await fs.readFile(transcriptPath, 'utf-8');

      // Only process new content
      if (content.length <= this.lastSize) return;

      const newContent = content.slice(this.lastSize);
      this.lastSize = content.length;

      const newEntries = newContent
        .trim()
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(Boolean) as TranscriptEntry[];

      for (const entry of newEntries) {
        this.entries.push(entry);
        this.emit('entry', entry);
      }
    } catch {
      // File might be mid-write
    }
  }

  stopWatching(): void {
    this.watcher?.close();
  }
}
