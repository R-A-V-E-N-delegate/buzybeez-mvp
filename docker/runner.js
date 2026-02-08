/**
 * BuzyBeez Runner - The agent that runs inside the Docker container
 *
 * This watches /inbox for mail, processes it with Claude, and writes responses to /outbox.
 * It has access to filesystem tools so Claude can read/write files in /workspace.
 */

import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import Anthropic from '@anthropic-ai/sdk';
import { randomUUID } from 'crypto';

// Paths
const INBOX_DIR = '/inbox';
const OUTBOX_DIR = '/outbox';
const STATE_DIR = '/state';
const LOGS_DIR = '/logs';
const WORKSPACE_DIR = '/workspace';
const SOUL_PATH = '/soul.md';
const CONVERSATION_PATH = path.join(STATE_DIR, 'conversation.json');

// Config from environment
const BEE_ID = process.env.BEE_ID || 'bee-001';
const BEE_NAME = process.env.BEE_NAME || 'Worker Bee';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.MODEL || 'claude-haiku-4-5-20251001'; // Default to Haiku 4.5 for cost savings

if (!ANTHROPIC_API_KEY) {
  console.error('ERROR: ANTHROPIC_API_KEY environment variable is required');
  process.exit(1);
}

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// Tool definitions for Claude
const tools = [
  {
    name: 'read_file',
    description: 'Read the contents of a file from the workspace. Returns the file contents as a string.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'The file path relative to /workspace (e.g., "hello.txt" or "subdir/file.txt")'
        }
      },
      required: ['path']
    }
  },
  {
    name: 'write_file',
    description: 'Write content to a file in the workspace. Creates the file if it doesn\'t exist, overwrites if it does.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'The file path relative to /workspace (e.g., "hello.txt" or "subdir/file.txt")'
        },
        content: {
          type: 'string',
          description: 'The content to write to the file'
        }
      },
      required: ['path', 'content']
    }
  },
  {
    name: 'list_files',
    description: 'List files and directories in the workspace. Returns an array of file/directory names.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'The directory path relative to /workspace (e.g., "." for root or "subdir")',
          default: '.'
        }
      },
      required: []
    }
  },
  {
    name: 'delete_file',
    description: 'Delete a file from the workspace.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'The file path relative to /workspace to delete'
        }
      },
      required: ['path']
    }
  },
  {
    name: 'execute_command',
    description: 'Execute a shell command in the workspace directory. Use this to run scripts, start servers, install packages, or perform any shell operation. Commands run with a 60 second timeout by default. For long-running processes like servers, use the background option.',
    input_schema: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'The shell command to execute (e.g., "python3 server.py", "npm install", "ls -la")'
        },
        timeout: {
          type: 'number',
          description: 'Timeout in seconds (default: 60, max: 300)',
          default: 60
        },
        background: {
          type: 'boolean',
          description: 'Run the command in the background. Use for long-running processes like servers. Returns immediately with the process ID.',
          default: false
        }
      },
      required: ['command']
    }
  },
  {
    name: 'kill_process',
    description: 'Kill a background process by its process ID.',
    input_schema: {
      type: 'object',
      properties: {
        pid: {
          type: 'number',
          description: 'The process ID to kill'
        }
      },
      required: ['pid']
    }
  },
  {
    name: 'send_mail',
    description: 'Send a mail message to another bee or to the human. This is the ONLY way to send responses - there is no automatic reply. Always use this tool to respond to mail you receive.',
    input_schema: {
      type: 'object',
      properties: {
        to: {
          type: 'string',
          description: 'The recipient ID (e.g., "bee-002", "human")'
        },
        subject: {
          type: 'string',
          description: 'The mail subject line'
        },
        body: {
          type: 'string',
          description: 'The mail body text'
        }
      },
      required: ['to', 'subject', 'body']
    }
  }
];

// Tool execution
async function executeTool(name, input) {
  const safePath = (p) => {
    const resolved = path.resolve(WORKSPACE_DIR, p || '.');
    if (!resolved.startsWith(WORKSPACE_DIR)) {
      throw new Error('Path traversal not allowed');
    }
    return resolved;
  };

  try {
    switch (name) {
      case 'read_file': {
        const filePath = safePath(input.path);
        const content = await fs.readFile(filePath, 'utf-8');
        return { success: true, content };
      }
      case 'write_file': {
        const filePath = safePath(input.path);
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, input.content);
        return { success: true, message: `File written: ${input.path}` };
      }
      case 'list_files': {
        const dirPath = safePath(input.path || '.');
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        const files = entries.map(e => ({
          name: e.name,
          type: e.isDirectory() ? 'directory' : 'file'
        }));
        return { success: true, files };
      }
      case 'delete_file': {
        const filePath = safePath(input.path);
        await fs.unlink(filePath);
        return { success: true, message: `File deleted: ${input.path}` };
      }
      case 'execute_command': {
        const timeout = Math.min(input.timeout || 60, 300) * 1000; // Max 5 minutes
        const background = input.background || false;

        return new Promise((resolve) => {
          const proc = spawn('sh', ['-c', input.command], {
            cwd: WORKSPACE_DIR,
            env: { ...process.env, PATH: '/usr/local/bin:/usr/bin:/bin' },
            detached: background
          });

          if (background) {
            // For background processes, detach and return immediately
            proc.unref();
            resolve({
              success: true,
              background: true,
              pid: proc.pid,
              message: `Process started in background with PID ${proc.pid}`
            });
            return;
          }

          let stdout = '';
          let stderr = '';

          proc.stdout.on('data', (data) => { stdout += data.toString(); });
          proc.stderr.on('data', (data) => { stderr += data.toString(); });

          const timer = setTimeout(() => {
            proc.kill('SIGKILL');
            resolve({
              success: false,
              error: 'Command timed out',
              stdout: stdout.slice(0, 10000),
              stderr: stderr.slice(0, 10000)
            });
          }, timeout);

          proc.on('close', (code) => {
            clearTimeout(timer);
            resolve({
              success: code === 0,
              exitCode: code,
              stdout: stdout.slice(0, 10000),
              stderr: stderr.slice(0, 10000)
            });
          });

          proc.on('error', (err) => {
            clearTimeout(timer);
            resolve({ success: false, error: err.message });
          });
        });
      }
      case 'kill_process': {
        try {
          process.kill(input.pid, 'SIGTERM');
          return { success: true, message: `Sent SIGTERM to process ${input.pid}` };
        } catch (err) {
          return { success: false, error: err.message };
        }
      }
      case 'send_mail': {
        const mailMsg = {
          id: randomUUID(),
          from: BEE_ID,
          to: input.to,
          subject: input.subject,
          body: input.body,
          timestamp: new Date().toISOString(),
          metadata: {
            type: 'agent',
            priority: 'normal'
          },
          status: 'queued'
        };
        const outPath = path.join(OUTBOX_DIR, `${Date.now()}-${mailMsg.id}.json`);
        await fs.writeFile(outPath, JSON.stringify(mailMsg, null, 2));
        await log({ type: 'mail_sent', mailId: mailMsg.id, to: mailMsg.to, subject: mailMsg.subject });
        return { success: true, message: `Mail sent to ${input.to}: ${input.subject}` };
      }
      default:
        return { success: false, error: `Unknown tool: ${name}` };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Logging
async function log(entry) {
  const logEntry = {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    beeId: BEE_ID,
    ...entry
  };

  console.log(JSON.stringify(logEntry));

  try {
    await fs.mkdir(LOGS_DIR, { recursive: true });
    await fs.appendFile(
      path.join(LOGS_DIR, 'transcript.jsonl'),
      JSON.stringify(logEntry) + '\n'
    );
  } catch (e) {
    // Continue even if logging fails
  }
}

// Load soul file
async function loadSoul() {
  try {
    return await fs.readFile(SOUL_PATH, 'utf-8');
  } catch {
    return `You are ${BEE_NAME}, a helpful AI assistant bee. You can read and write files in your workspace.`;
  }
}

// Load/save conversation state
async function loadConversation() {
  try {
    const data = await fs.readFile(CONVERSATION_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function saveConversation(messages) {
  await fs.mkdir(STATE_DIR, { recursive: true });
  await fs.writeFile(CONVERSATION_PATH, JSON.stringify(messages, null, 2));
}

// Load hierarchy info (who this bee receives tasks from, who it can delegate to)
async function loadHierarchy() {
  try {
    const hierarchyPath = path.join(STATE_DIR, 'hierarchy.json');
    const data = await fs.readFile(hierarchyPath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return { receivesTasksFrom: [], canDelegateTo: [] };
  }
}

// Format hierarchy for system prompt
function formatHierarchyContext(hierarchy) {
  const lines = [];

  if (hierarchy.receivesTasksFrom?.length > 0) {
    const upstream = hierarchy.receivesTasksFrom.map(n => `${n.name} (${n.id})`).join(', ');
    lines.push(`Reports to (receives tasks from, sends results back): ${upstream}`);
  }

  if (hierarchy.canDelegateTo?.length > 0) {
    const downstream = hierarchy.canDelegateTo.map(n => `${n.name} (${n.id})`).join(', ');
    lines.push(`Direct reports (can delegate tasks to, receives their results): ${downstream}`);
  }

  return lines.length > 0 ? lines.join('\n') : 'No hierarchy connections defined.';
}

// Process a single mail with Claude
async function processMail(mail) {
  await log({ type: 'mail_received', mailId: mail.id, from: mail.from, subject: mail.subject });

  const soul = await loadSoul();
  const conversation = await loadConversation();
  const hierarchy = await loadHierarchy();
  const hierarchyContext = formatHierarchyContext(hierarchy);

  // Add the new mail as a user message
  const userMessage = `[Mail from ${mail.from}]\nSubject: ${mail.subject}\n\n${mail.body}`;
  conversation.push({ role: 'user', content: userMessage });

  // Build system prompt with hierarchy context
  const systemPrompt = `${soul}

You are a bee in the BuzyBeez system. You process mail and can use tools to interact with your filesystem.

Current time: ${new Date().toISOString()}
Your ID: ${BEE_ID}
Your name: ${BEE_NAME}

## Your Position in the Hierarchy
${hierarchyContext}

## Communication Guidelines
IMPORTANT: You must use the send_mail tool to send ALL responses. There is no automatic reply.

- When you receive a task, complete it using your tools, then use send_mail to report back.
- If a task is complex, consider delegating subtasks to bees you can delegate to.
- To reply: send_mail(to: "<sender-id>", subject: "Re: ...", body: "...")
- To delegate: send_mail(to: "<downstream-bee-id>", subject: "Task: ...", body: "...")

Always be concise in your responses.`;

  let response;
  let assistantContent = [];

  // Agentic loop - keep going until Claude stops using tools
  while (true) {
    await log({ type: 'claude_request', messageCount: conversation.length });

    response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      tools,
      messages: conversation
    });

    await log({
      type: 'claude_response',
      stopReason: response.stop_reason,
      usage: response.usage
    });

    // Collect the assistant's content
    assistantContent = response.content;
    conversation.push({ role: 'assistant', content: assistantContent });

    // If Claude wants to use tools, execute them
    if (response.stop_reason === 'tool_use') {
      const toolResults = [];

      for (const block of assistantContent) {
        if (block.type === 'tool_use') {
          await log({ type: 'tool_call', tool: block.name, input: block.input });

          const result = await executeTool(block.name, block.input);

          await log({ type: 'tool_result', tool: block.name, result });

          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify(result)
          });
        }
      }

      // Add tool results and continue the loop
      conversation.push({ role: 'user', content: toolResults });
    } else {
      // Claude is done (stop_reason === 'end_turn' or 'max_tokens')
      break;
    }
  }

  // Save conversation state
  await saveConversation(conversation);

  // Extract text response
  let responseText = '';
  for (const block of assistantContent) {
    if (block.type === 'text') {
      responseText += block.text;
    }
  }

  // No auto-reply - bees must use send_mail tool explicitly for ALL responses
  // This gives full control over when and what bees communicate
  await log({ type: 'mail_processed', mailId: mail.id, from: mail.from, responseText: responseText?.slice(0, 200) });
  return null;
}

// Main loop - watch inbox for mail
async function main() {
  console.log(`🐝 ${BEE_NAME} (${BEE_ID}) starting up...`);

  // Ensure directories exist
  await fs.mkdir(INBOX_DIR, { recursive: true });
  await fs.mkdir(OUTBOX_DIR, { recursive: true });
  await fs.mkdir(STATE_DIR, { recursive: true });
  await fs.mkdir(LOGS_DIR, { recursive: true });
  await fs.mkdir(WORKSPACE_DIR, { recursive: true });

  await log({ type: 'bee_started', name: BEE_NAME });

  console.log(`📬 Watching ${INBOX_DIR} for mail...`);

  // Process any existing mail first
  const existingFiles = await fs.readdir(INBOX_DIR);
  for (const file of existingFiles.sort()) {
    if (!file.endsWith('.json')) continue;
    const filePath = path.join(INBOX_DIR, file);
    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      const mail = JSON.parse(raw);
      await fs.unlink(filePath); // Remove from inbox
      await processMail(mail);
    } catch (e) {
      console.error(`Error processing ${file}:`, e.message);
      await log({ type: 'error', error: e.message, file });
    }
  }

  // Watch for new mail using polling (simpler and more reliable than fs.watch in Docker)
  let lastFiles = new Set();

  while (true) {
    try {
      const files = await fs.readdir(INBOX_DIR);
      const jsonFiles = files.filter(f => f.endsWith('.json')).sort();

      for (const file of jsonFiles) {
        if (lastFiles.has(file)) continue; // Already processed

        const filePath = path.join(INBOX_DIR, file);
        try {
          const raw = await fs.readFile(filePath, 'utf-8');
          const mail = JSON.parse(raw);
          await fs.unlink(filePath); // Remove from inbox
          await processMail(mail);
        } catch (e) {
          console.error(`Error processing ${file}:`, e.message);
          await log({ type: 'error', error: e.message, file });
        }
      }

      lastFiles = new Set(jsonFiles);
    } catch (e) {
      // Ignore errors, keep polling
    }

    // Poll every 500ms
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
