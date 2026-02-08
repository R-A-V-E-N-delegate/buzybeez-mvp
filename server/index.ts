/**
 * BuzyBeez MVP - API Server (Multi-Bee Edition)
 *
 * Manages multiple bee containers and provides API for the canvas UI.
 */

import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import chokidar from 'chokidar';
import multer from 'multer';
import mime from 'mime-types';
import type { Mail, BeeConfig, CanvasNode, CanvasEdge, FileAttachment, SkillManifest } from './types.js';
import { SwarmManager } from './swarm.js';
import { SkillsRegistry } from './skills.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '..', 'data');
const FILES_DIR = path.resolve(DATA_DIR, 'files');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    await fs.mkdir(FILES_DIR, { recursive: true });
    cb(null, FILES_DIR);
  },
  filename: (req, file, cb) => {
    // Generate unique ID for the file
    const fileId = uuidv4();
    const ext = path.extname(file.originalname);
    cb(null, `${fileId}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors());
app.use(express.json());

// Serve Vite build if it exists, otherwise fall back to vanilla web/
const viteDistPath = path.resolve(__dirname, '..', 'web-vite', 'dist');
const webPath = path.resolve(__dirname, '..', 'web');
import { existsSync } from 'fs';
const staticPath = existsSync(viteDistPath) ? viteDistPath : webPath;
app.use(express.static(staticPath));

// Initialize swarm manager
const swarm = new SwarmManager(DATA_DIR);

// Initialize skills registry
const skills = new SkillsRegistry(DATA_DIR);

// Human mailbox state
let humanInbox: Mail[] = [];
let humanOutbox: Mail[] = [];

// Outbox watchers for each bee
const watchers: Map<string, chokidar.FSWatcher> = new Map();

// WebSocket clients
const clients = new Set<WebSocket>();

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log('WebSocket client connected');

  ws.on('close', () => {
    clients.delete(ws);
    console.log('WebSocket client disconnected');
  });
});

function broadcast(event: string, data: unknown) {
  const message = JSON.stringify({ event, data });
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

// Broadcast mail counts to all clients
async function broadcastMailCounts() {
  try {
    const config = swarm.getConfig();
    const counts: Record<string, { inbox: number; outbox: number; processing: boolean }> = {};

    // Human counts
    counts['human'] = {
      inbox: humanInbox.length,
      outbox: humanOutbox.length,
      processing: false
    };

    // Bee counts
    for (const bee of config.bees) {
      const inboxPath = path.join(DATA_DIR, 'bees', bee.id, 'inbox');
      const outboxPath = path.join(DATA_DIR, 'bees', bee.id, 'outbox');

      let inboxCount = 0;
      let outboxCount = 0;

      try {
        await fs.mkdir(inboxPath, { recursive: true });
        const inboxFiles = await fs.readdir(inboxPath);
        inboxCount = inboxFiles.filter(f => f.endsWith('.json')).length;
      } catch {}

      try {
        await fs.mkdir(outboxPath, { recursive: true });
        const outboxFiles = await fs.readdir(outboxPath);
        outboxCount = outboxFiles.filter(f => f.endsWith('.json')).length;
      } catch {}

      // Check if bee is processing (has inbox items and is running)
      const beeState = swarm.getBeeStates().find(b => b.id === bee.id);
      const isProcessing = beeState?.running && inboxCount > 0;

      counts[bee.id] = {
        inbox: inboxCount,
        outbox: outboxCount,
        processing: isProcessing || false
      };
    }

    broadcast('mail:counts', counts);
  } catch (e) {
    console.error('Error broadcasting mail counts:', e);
  }
}

// Inbox watchers for mail count updates
const inboxWatchers: Map<string, chokidar.FSWatcher> = new Map();

// Watch a bee's inbox for mail count changes
async function watchBeeInbox(beeId: string) {
  const inboxDir = path.join(DATA_DIR, 'bees', beeId, 'inbox');
  await fs.mkdir(inboxDir, { recursive: true });

  // Stop existing watcher
  const existing = inboxWatchers.get(beeId);
  if (existing) {
    await existing.close();
  }

  const watcher = chokidar.watch(inboxDir, {
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 100 }
  });

  watcher.on('add', async () => {
    await broadcastMailCounts();
  });

  watcher.on('unlink', async () => {
    await broadcastMailCounts();
  });

  inboxWatchers.set(beeId, watcher);
  console.log(`📥 Watching inbox for ${beeId}`);
}

// Watch a bee's outbox for responses
async function watchBeeOutbox(beeId: string) {
  const outboxDir = path.join(DATA_DIR, 'bees', beeId, 'outbox');
  await fs.mkdir(outboxDir, { recursive: true });

  // Stop existing watcher
  const existing = watchers.get(beeId);
  if (existing) {
    await existing.close();
  }

  const watcher = chokidar.watch(outboxDir, {
    persistent: true,
    ignoreInitial: false,
    awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 100 }
  });

  watcher.on('add', async (filePath) => {
    if (!filePath.endsWith('.json')) return;

    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      const mail = JSON.parse(raw) as Mail;

      // Delete the file
      await fs.unlink(filePath).catch(() => {});

      // Route the mail
      await routeOutboundMail(mail);
    } catch (e) {
      console.error('Error processing outbox file:', e);
    }
  });

  watchers.set(beeId, watcher);
  console.log(`👀 Watching outbox for ${beeId}`);
}

// Route mail from a bee
async function routeOutboundMail(mail: Mail) {
  console.log(`📬 Mail from ${mail.from} to ${mail.to}: ${mail.subject}`);

  if (mail.to === 'human') {
    // Deliver to human inbox
    mail.status = 'delivered';
    humanInbox.push(mail);
    await saveHumanMailbox();
    broadcast('mail:received', mail);
  } else {
    // Route to another bee
    try {
      await swarm.routeMail(mail);
      broadcast('mail:routed', mail);
    } catch (e: any) {
      console.error('Mail routing failed:', e.message);
      mail.status = 'failed';
      broadcast('mail:failed', { mail, error: e.message });
    }
  }
}

// Human mailbox persistence
async function loadHumanMailbox() {
  const mailboxPath = path.join(DATA_DIR, 'human-mailbox.json');
  try {
    const data = await fs.readFile(mailboxPath, 'utf-8');
    const parsed = JSON.parse(data);
    humanInbox = parsed.inbox || [];
    humanOutbox = parsed.outbox || [];
  } catch {
    humanInbox = [];
    humanOutbox = [];
  }
}

async function saveHumanMailbox() {
  const mailboxPath = path.join(DATA_DIR, 'human-mailbox.json');
  await fs.writeFile(mailboxPath, JSON.stringify({
    inbox: humanInbox,
    outbox: humanOutbox
  }, null, 2));
}

// ==================== API Routes ====================

// Get swarm config
app.get('/api/swarm', (req, res) => {
  res.json(swarm.getConfig());
});

// Update swarm config
app.put('/api/swarm', async (req, res) => {
  try {
    await swarm.setConfig(req.body);
    broadcast('swarm:updated', swarm.getConfig());
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Get all bee states
app.get('/api/bees', async (req, res) => {
  await swarm.refreshBeeStates();
  res.json(swarm.getBeeStates());
});

// Add a new bee
app.post('/api/bees', async (req, res) => {
  try {
    const config: BeeConfig = req.body;
    await swarm.addBee(config);
    broadcast('swarm:updated', swarm.getConfig());
    res.json({ success: true, config });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Remove a bee
app.delete('/api/bees/:id', async (req, res) => {
  try {
    await swarm.removeBee(req.params.id);
    const watcher = watchers.get(req.params.id);
    if (watcher) {
      await watcher.close();
      watchers.delete(req.params.id);
    }
    broadcast('swarm:updated', swarm.getConfig());
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Start a bee
app.post('/api/bees/:id/start', async (req, res) => {
  try {
    const state = await swarm.startBee(req.params.id);
    await watchBeeOutbox(req.params.id);
    broadcast('bee:status', state);
    res.json({ success: true, state });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Stop a bee
app.post('/api/bees/:id/stop', async (req, res) => {
  try {
    const state = await swarm.stopBee(req.params.id);
    broadcast('bee:status', state);
    res.json({ success: true, state });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Get bee status
app.get('/api/bees/:id/status', async (req, res) => {
  await swarm.refreshBeeStates();
  const state = swarm.getBeeStates().find(b => b.id === req.params.id);
  if (!state) {
    return res.status(404).json({ error: 'Bee not found' });
  }
  res.json(state);
});

// Get bee hierarchy (who they receive tasks from, who they can delegate to)
app.get('/api/bees/:id/hierarchy', async (req, res) => {
  const beeId = req.params.id;
  const config = swarm.getConfig();
  const connections = config.connections || [];
  const bees = config.bees || [];

  // Find upstream (nodes that connect TO this bee - they assign tasks)
  // In our model: connection.from -> connection.to means "from delegates to to"
  const upstream = connections
    .filter(c => c.to === beeId)
    .map(c => {
      if (c.from === 'human') {
        return { id: 'human', name: 'Human', type: 'human' };
      }
      const bee = bees.find(b => b.id === c.from);
      return { id: c.from, name: bee?.name || c.from, type: 'bee' };
    });

  // Find downstream (nodes this bee connects TO - they receive delegated tasks)
  const downstream = connections
    .filter(c => c.from === beeId)
    .map(c => {
      if (c.to === 'human') {
        return { id: 'human', name: 'Human', type: 'human' };
      }
      const bee = bees.find(b => b.id === c.to);
      return { id: c.to, name: bee?.name || c.to, type: 'bee' };
    });

  res.json({
    beeId,
    receivesTasksFrom: upstream,
    canDelegateTo: downstream
  });
});

// Get bee transcript
app.get('/api/bees/:id/transcript', async (req, res) => {
  try {
    const transcriptPath = path.join(DATA_DIR, 'bees', req.params.id, 'logs', 'transcript.jsonl');
    const content = await fs.readFile(transcriptPath, 'utf-8');
    const entries = content.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
    res.json(entries);
  } catch {
    res.json([]);
  }
});

// Get bee workspace files
app.get('/api/bees/:id/files', async (req, res) => {
  try {
    const workspacePath = path.join(DATA_DIR, 'bees', req.params.id, 'workspace');
    const entries = await fs.readdir(workspacePath, { withFileTypes: true });
    const files = await Promise.all(entries.map(async (e) => {
      const stat = await fs.stat(path.join(workspacePath, e.name));
      return {
        name: e.name,
        type: e.isDirectory() ? 'directory' : 'file',
        size: stat.size
      };
    }));
    res.json(files);
  } catch {
    res.json([]);
  }
});

// Connection management
app.post('/api/connections', async (req, res) => {
  try {
    const { from, to, bidirectional } = req.body;
    swarm.addConnection(from, to, bidirectional);
    broadcast('swarm:updated', swarm.getConfig());
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/connections', async (req, res) => {
  try {
    const { from, to, bidirectional } = req.body;
    swarm.removeConnection(from, to, bidirectional);
    broadcast('swarm:updated', swarm.getConfig());
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Update bidirectional flag on a connection
app.patch('/api/connections', async (req, res) => {
  try {
    const { from, to, bidirectional } = req.body;
    swarm.updateConnectionBidirectional(from, to, bidirectional);
    broadcast('swarm:updated', swarm.getConfig());
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ==================== File Management Routes ====================

// Upload a file
app.post('/api/files', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileId = path.basename(req.file.filename, path.extname(req.file.filename));
    const mimeType = req.file.mimetype || mime.lookup(req.file.originalname) || 'application/octet-stream';

    const attachment: FileAttachment = {
      id: fileId,
      filename: req.file.originalname,
      mimeType,
      size: req.file.size,
      path: req.file.filename  // Relative path within files directory
    };

    // Save metadata for later lookup
    const metaPath = path.join(FILES_DIR, `${fileId}.meta.json`);
    await fs.writeFile(metaPath, JSON.stringify(attachment, null, 2));

    res.json({ success: true, file: attachment });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Download a file by ID
app.get('/api/files/:id', async (req, res) => {
  try {
    const fileId = req.params.id;

    // Find the file (could have any extension)
    const files = await fs.readdir(FILES_DIR);
    const matchingFile = files.find(f => f.startsWith(fileId));

    if (!matchingFile) {
      return res.status(404).json({ error: 'File not found' });
    }

    const filePath = path.join(FILES_DIR, matchingFile);
    const stat = await fs.stat(filePath);
    const mimeType = mime.lookup(matchingFile) || 'application/octet-stream';

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', stat.size);

    // Stream the file
    const { createReadStream } = await import('fs');
    createReadStream(filePath).pipe(res);
  } catch (e: any) {
    if (e.code === 'ENOENT') {
      return res.status(404).json({ error: 'File not found' });
    }
    res.status(500).json({ error: e.message });
  }
});

// Get file metadata by ID
app.get('/api/files/:id/metadata', async (req, res) => {
  try {
    const fileId = req.params.id;

    // Find the file (could have any extension)
    const files = await fs.readdir(FILES_DIR);
    const matchingFile = files.find(f => f.startsWith(fileId));

    if (!matchingFile) {
      return res.status(404).json({ error: 'File not found' });
    }

    const filePath = path.join(FILES_DIR, matchingFile);
    const stat = await fs.stat(filePath);
    const mimeType = mime.lookup(matchingFile) || 'application/octet-stream';

    res.json({
      id: fileId,
      filename: matchingFile,
      mimeType,
      size: stat.size,
      path: matchingFile
    });
  } catch (e: any) {
    if (e.code === 'ENOENT') {
      return res.status(404).json({ error: 'File not found' });
    }
    res.status(500).json({ error: e.message });
  }
});

// Get bee's inbox mail
app.get('/api/bees/:id/inbox', async (req, res) => {
  try {
    const inboxPath = path.join(DATA_DIR, 'bees', req.params.id, 'inbox');
    await fs.mkdir(inboxPath, { recursive: true });
    const files = await fs.readdir(inboxPath);
    const mails: Mail[] = [];
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      try {
        const raw = await fs.readFile(path.join(inboxPath, file), 'utf-8');
        mails.push(JSON.parse(raw));
      } catch {
        // Skip invalid files
      }
    }
    // Sort by timestamp, newest first
    mails.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    res.json(mails);
  } catch {
    res.json([]);
  }
});

// Get bee's outbox mail
app.get('/api/bees/:id/outbox', async (req, res) => {
  try {
    const outboxPath = path.join(DATA_DIR, 'bees', req.params.id, 'outbox');
    await fs.mkdir(outboxPath, { recursive: true });
    const files = await fs.readdir(outboxPath);
    const mails: Mail[] = [];
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      try {
        const raw = await fs.readFile(path.join(outboxPath, file), 'utf-8');
        mails.push(JSON.parse(raw));
      } catch {
        // Skip invalid files
      }
    }
    // Sort by timestamp, newest first
    mails.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    res.json(mails);
  } catch {
    res.json([]);
  }
});

// Get all mail counts for visualization
app.get('/api/mail/counts', async (req, res) => {
  try {
    const config = swarm.getConfig();
    const counts: Record<string, { inbox: number; outbox: number; processing: boolean }> = {};

    // Human counts
    counts['human'] = {
      inbox: humanInbox.length,
      outbox: humanOutbox.length,
      processing: false
    };

    // Bee counts
    for (const bee of config.bees) {
      const inboxPath = path.join(DATA_DIR, 'bees', bee.id, 'inbox');
      const outboxPath = path.join(DATA_DIR, 'bees', bee.id, 'outbox');

      let inboxCount = 0;
      let outboxCount = 0;

      try {
        await fs.mkdir(inboxPath, { recursive: true });
        const inboxFiles = await fs.readdir(inboxPath);
        inboxCount = inboxFiles.filter(f => f.endsWith('.json')).length;
      } catch {}

      try {
        await fs.mkdir(outboxPath, { recursive: true });
        const outboxFiles = await fs.readdir(outboxPath);
        outboxCount = outboxFiles.filter(f => f.endsWith('.json')).length;
      } catch {}

      // Check if bee is processing (has inbox items and is running)
      const beeState = swarm.getBeeStates().find(b => b.id === bee.id);
      const isProcessing = beeState?.running && inboxCount > 0;

      counts[bee.id] = {
        inbox: inboxCount,
        outbox: outboxCount,
        processing: isProcessing || false
      };
    }

    res.json(counts);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Human mailbox routes
app.get('/api/mail/inbox', (req, res) => {
  res.json(humanInbox);
});

app.get('/api/mail/outbox', (req, res) => {
  res.json(humanOutbox);
});

app.post('/api/mail/send', async (req, res) => {
  try {
    const { to, subject, body, attachments } = req.body;
    if (!to || !subject || !body) {
      return res.status(400).json({ error: 'to, subject, and body required' });
    }

    // Check connection
    if (!swarm.canSendMail('human', to)) {
      return res.status(400).json({ error: `No connection from human to ${to}` });
    }

    // Resolve attachment metadata if provided
    let resolvedAttachments: FileAttachment[] | undefined;
    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      resolvedAttachments = [];
      for (const fileId of attachments) {
        const metaPath = path.join(FILES_DIR, `${fileId}.meta.json`);
        try {
          const metaData = await fs.readFile(metaPath, 'utf-8');
          resolvedAttachments.push(JSON.parse(metaData));
        } catch {
          return res.status(400).json({ error: `Attachment not found: ${fileId}` });
        }
      }
    }

    const mail: Mail = {
      id: uuidv4(),
      from: 'human',
      to,
      subject,
      body,
      timestamp: new Date().toISOString(),
      metadata: { type: 'human', priority: 'normal' },
      status: 'queued',
      attachments: resolvedAttachments
    };

    // Track in human outbox
    humanOutbox.push(mail);
    await saveHumanMailbox();

    // Route to bee
    await swarm.routeMail(mail);

    broadcast('mail:sent', mail);
    res.json({ success: true, mail });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Canvas layout persistence
app.get('/api/canvas', async (req, res) => {
  try {
    const layoutPath = path.join(DATA_DIR, 'canvas-layout.json');
    const data = await fs.readFile(layoutPath, 'utf-8');
    const layout = JSON.parse(data);

    // Merge edges to show bidirectional connections
    const mergedConnections = swarm.getMergedConnections();
    const edges: CanvasEdge[] = mergedConnections.map(c => ({
      id: c.bidirectional ? `${c.from}<->${c.to}` : `${c.from}->${c.to}`,
      source: c.from,
      target: c.to,
      bidirectional: c.bidirectional
    }));

    res.json({ nodes: layout.nodes, edges });
  } catch {
    // Return default layout based on swarm config
    const config = swarm.getConfig();
    const nodes: CanvasNode[] = [
      {
        id: 'human',
        type: 'human',
        position: { x: 100, y: 200 },
        data: { label: 'Human Mailbox' }
      }
    ];

    config.bees.forEach((bee, i) => {
      nodes.push({
        id: bee.id,
        type: 'bee',
        position: { x: 400, y: 100 + i * 150 },
        data: { label: bee.name, beeId: bee.id, running: false }
      });
    });

    // Merge edges to show bidirectional connections
    const mergedConnections = swarm.getMergedConnections();
    const edges: CanvasEdge[] = mergedConnections.map(c => ({
      id: c.bidirectional ? `${c.from}<->${c.to}` : `${c.from}->${c.to}`,
      source: c.from,
      target: c.to,
      bidirectional: c.bidirectional
    }));

    res.json({ nodes, edges });
  }
});

app.put('/api/canvas', async (req, res) => {
  try {
    const layoutPath = path.join(DATA_DIR, 'canvas-layout.json');
    await fs.writeFile(layoutPath, JSON.stringify(req.body, null, 2));
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Legacy single-bee compatibility endpoints
app.get('/api/bee/status', async (req, res) => {
  await swarm.refreshBeeStates();
  const states = swarm.getBeeStates();
  if (states.length > 0) {
    res.json(states[0]);
  } else {
    res.json({ running: false });
  }
});

app.post('/api/bee/start', async (req, res) => {
  try {
    const config = swarm.getConfig();
    if (config.bees.length === 0) {
      return res.status(400).json({ error: 'No bees configured' });
    }
    const state = await swarm.startBee(config.bees[0].id);
    await watchBeeOutbox(config.bees[0].id);
    broadcast('bee:status', state);
    res.json({ success: true, status: state });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/bee/stop', async (req, res) => {
  try {
    const config = swarm.getConfig();
    if (config.bees.length === 0) {
      return res.status(400).json({ error: 'No bees configured' });
    }
    const state = await swarm.stopBee(config.bees[0].id);
    broadcast('bee:status', state);
    res.json({ success: true, status: state });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ==================== Skills API ====================

// List all skills
app.get('/api/skills', (req, res) => {
  res.json({ skills: skills.listSkills() });
});

// Get skill by ID
app.get('/api/skills/:id', async (req, res) => {
  const entry = skills.getSkill(req.params.id);
  if (!entry) {
    return res.status(404).json({ error: 'Skill not found' });
  }

  const version = req.query.version as string | undefined;
  const manifest = await skills.getSkillManifest(req.params.id, version);

  res.json({
    entry,
    manifest,
    versions: entry.versions
  });
});

// Register new skill
app.post('/api/skills', async (req, res) => {
  try {
    const manifest = req.body as SkillManifest;
    // For API registration, skill files should already be in a temp location
    // In a full implementation, this would accept a zip file or path
    const tempDir = path.join(DATA_DIR, 'skills', 'temp', manifest.id);
    await fs.mkdir(tempDir, { recursive: true });
    await fs.writeFile(path.join(tempDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

    const entry = await skills.registerSkill(manifest, tempDir);
    res.status(201).json({ entry });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Delete skill
app.delete('/api/skills/:id', async (req, res) => {
  try {
    const version = req.query.version as string | undefined;
    await skills.removeSkill(req.params.id, version);
    res.status(204).send();
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Start server
const PORT = process.env.PORT || 3000;

async function main() {
  // Initialize
  await swarm.initialize();
  await skills.initialize();
  await loadHumanMailbox();

  // Watch outboxes for all existing bees
  const config = swarm.getConfig();
  for (const bee of config.bees) {
    const beeDataDir = path.join(DATA_DIR, 'bees', bee.id);
    try {
      await fs.access(beeDataDir);
      await watchBeeOutbox(bee.id);
    } catch {
      // Bee data doesn't exist yet
    }
  }

  server.listen(PORT, () => {
    console.log(`🐝 BuzyBeez MVP server running on http://localhost:${PORT}`);
    console.log(`   Swarm: ${config.name} (${config.bees.length} bees)`);
  });
}

main().catch(console.error);
