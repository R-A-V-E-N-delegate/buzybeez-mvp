/**
 * Mailbox management - handles mail between human and bee
 */

import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import chokidar from 'chokidar';

export interface Mail {
  id: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  timestamp: string;
  metadata: {
    type: 'human' | 'agent' | 'system';
    priority?: 'low' | 'normal' | 'high';
    inReplyTo?: string;
  };
  status: 'queued' | 'delivered' | 'read';
}

const HUMAN_ID = 'human-mailbox';
const BEE_ID = 'bee-001';

export class MailboxManager extends EventEmitter {
  private dataDir: string;
  private humanInbox: Mail[] = [];
  private humanOutbox: Mail[] = [];
  private watcher?: chokidar.FSWatcher;

  constructor(dataDir: string) {
    super();
    this.dataDir = dataDir;
  }

  /**
   * Send mail from human to bee
   */
  async sendToBee(subject: string, body: string): Promise<Mail> {
    const mail: Mail = {
      id: uuidv4(),
      from: HUMAN_ID,
      to: BEE_ID,
      subject,
      body,
      timestamp: new Date().toISOString(),
      metadata: {
        type: 'human',
        priority: 'normal'
      },
      status: 'queued'
    };

    // Write to bee's inbox
    const inboxDir = path.join(this.dataDir, 'inbox');
    await fs.mkdir(inboxDir, { recursive: true });

    const filename = `${Date.now()}-${mail.id}.json`;
    await fs.writeFile(
      path.join(inboxDir, filename),
      JSON.stringify(mail, null, 2)
    );

    // Track in human's outbox
    this.humanOutbox.push(mail);
    await this.saveHumanMailbox();

    console.log(`📤 Mail sent to bee: ${subject}`);
    return mail;
  }

  /**
   * Get mail that human has received (from bee)
   */
  async getHumanInbox(): Promise<Mail[]> {
    await this.loadHumanMailbox();
    return this.humanInbox;
  }

  /**
   * Get mail that human has sent (to bee)
   */
  async getHumanOutbox(): Promise<Mail[]> {
    await this.loadHumanMailbox();
    return this.humanOutbox;
  }

  /**
   * Start watching bee's outbox for responses
   */
  async startWatching(): Promise<void> {
    const outboxDir = path.join(this.dataDir, 'outbox');
    await fs.mkdir(outboxDir, { recursive: true });

    // Load existing human mailbox
    await this.loadHumanMailbox();

    // Process any existing outbox files first
    await this.processExistingOutbox(outboxDir);

    // Watch for new files
    this.watcher = chokidar.watch(outboxDir, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 200,
        pollInterval: 100
      }
    });

    this.watcher.on('add', async (filePath) => {
      if (!filePath.endsWith('.json')) return;

      try {
        await this.processOutboxFile(filePath);
      } catch (e) {
        console.error('Error processing outbox file:', e);
      }
    });

    console.log(`👀 Watching ${outboxDir} for bee responses...`);
  }

  private async processExistingOutbox(outboxDir: string): Promise<void> {
    try {
      const files = await fs.readdir(outboxDir);
      for (const file of files.sort()) {
        if (!file.endsWith('.json')) continue;

        const filePath = path.join(outboxDir, file);
        await this.processOutboxFile(filePath);
      }
    } catch {
      // Directory might not exist yet
    }
  }

  private async processOutboxFile(filePath: string): Promise<void> {
    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      const mail = JSON.parse(raw) as Mail;

      // Only process mail addressed to human
      if (mail.to !== HUMAN_ID && mail.from !== BEE_ID) {
        return;
      }

      // Check if we already have this mail
      const exists = this.humanInbox.some(m => m.id === mail.id);
      if (exists) {
        // Delete the file since we've processed it
        await fs.unlink(filePath).catch(() => {});
        return;
      }

      // Add to human inbox
      mail.status = 'delivered';
      this.humanInbox.push(mail);
      await this.saveHumanMailbox();

      // Delete processed file
      await fs.unlink(filePath).catch(() => {});

      console.log(`📬 Mail received from bee: ${mail.subject}`);
      this.emit('mail:received', mail);
    } catch (e) {
      console.error('Error processing mail:', e);
    }
  }

  private async loadHumanMailbox(): Promise<void> {
    const mailboxPath = path.join(this.dataDir, 'human-mailbox.json');
    try {
      const data = await fs.readFile(mailboxPath, 'utf-8');
      const parsed = JSON.parse(data);
      this.humanInbox = parsed.inbox || [];
      this.humanOutbox = parsed.outbox || [];
    } catch {
      this.humanInbox = [];
      this.humanOutbox = [];
    }
  }

  private async saveHumanMailbox(): Promise<void> {
    const mailboxPath = path.join(this.dataDir, 'human-mailbox.json');
    await fs.writeFile(mailboxPath, JSON.stringify({
      inbox: this.humanInbox,
      outbox: this.humanOutbox
    }, null, 2));
  }

  stopWatching(): void {
    this.watcher?.close();
  }
}
