/**
 * BuzyBeez Runner - The agent that runs inside the Docker container
 *
 * This watches /inbox for mail, processes it with Claude via the Agent SDK,
 * and writes responses to /outbox via the MCP mail server.
 */

import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { query } from "@anthropic-ai/claude-agent-sdk";

// Paths
const INBOX_DIR = "/inbox";
const OUTBOX_DIR = "/outbox";
const STATE_DIR = "/state";
const LOGS_DIR = "/logs";
const WORKSPACE_DIR = "/workspace";
const SOUL_PATH = "/soul.md";
const SESSION_ID_PATH = path.join(STATE_DIR, "session-id.txt");

// Config from environment
const BEE_ID = process.env.BEE_ID || "bee-001";
const BEE_NAME = process.env.BEE_NAME || "Worker Bee";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.MODEL || "claude-haiku-4-5-20251001";

if (!ANTHROPIC_API_KEY) {
  console.error("ERROR: ANTHROPIC_API_KEY environment variable is required");
  process.exit(1);
}

// Logging
async function log(entry) {
  const logEntry = {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    beeId: BEE_ID,
    ...entry,
  };

  console.log(JSON.stringify(logEntry));

  try {
    await fs.mkdir(LOGS_DIR, { recursive: true });
    await fs.appendFile(
      path.join(LOGS_DIR, "transcript.jsonl"),
      JSON.stringify(logEntry) + "\n"
    );
  } catch (e) {
    // Continue even if logging fails
  }
}

// Load soul file
async function loadSoul() {
  try {
    return await fs.readFile(SOUL_PATH, "utf-8");
  } catch {
    return `You are ${BEE_NAME}, a helpful AI assistant bee. You can read and write files in your workspace.`;
  }
}

// Load hierarchy info (who this bee receives tasks from, who it can delegate to)
async function loadHierarchy() {
  try {
    const hierarchyPath = path.join(STATE_DIR, "hierarchy.json");
    const data = await fs.readFile(hierarchyPath, "utf-8");
    return JSON.parse(data);
  } catch {
    return { receivesTasksFrom: [], canDelegateTo: [] };
  }
}

// Format hierarchy for system prompt
function formatHierarchyContext(hierarchy) {
  const lines = [];

  if (hierarchy.receivesTasksFrom?.length > 0) {
    const upstream = hierarchy.receivesTasksFrom
      .map((n) => `${n.name} (${n.id})`)
      .join(", ");
    lines.push(
      `Reports to (receives tasks from, sends results back): ${upstream}`
    );
  }

  if (hierarchy.canDelegateTo?.length > 0) {
    const downstream = hierarchy.canDelegateTo
      .map((n) => `${n.name} (${n.id})`)
      .join(", ");
    lines.push(
      `Direct reports (can delegate tasks to, receives their results): ${downstream}`
    );
  }

  return lines.length > 0 ? lines.join("\n") : "No hierarchy connections defined.";
}

// Load persisted session ID for conversation continuity
async function loadSessionId() {
  try {
    const id = await fs.readFile(SESSION_ID_PATH, "utf-8");
    return id.trim() || undefined;
  } catch {
    return undefined;
  }
}

// Save session ID for next invocation
async function saveSessionId(sessionId) {
  await fs.mkdir(STATE_DIR, { recursive: true });
  await fs.writeFile(SESSION_ID_PATH, sessionId);
}

// Process a single mail with Claude via the Agent SDK
async function processMail(mail) {
  await log({
    type: "mail_received",
    mailId: mail.id,
    from: mail.from,
    subject: mail.subject,
  });

  const soul = await loadSoul();
  const hierarchy = await loadHierarchy();
  const hierarchyContext = formatHierarchyContext(hierarchy);

  // Build the prompt from the mail
  const mailContent = `[Mail from ${mail.from}]\nSubject: ${mail.subject}\n\n${mail.body}`;

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

  await log({ type: "claude_request", messageCount: 1 });

  const sessionId = await loadSessionId();

  try {
    let finalResponseText = "";
    let capturedSessionId = sessionId;

    for await (const message of query({
      prompt: mailContent,
      options: {
        model: MODEL,
        systemPrompt,
        allowedTools: [
          "Read",
          "Write",
          "Edit",
          "Bash",
          "Glob",
          "Grep",
          "mcp__buzybeez-mail__send_mail",
        ],
        permissionMode: "bypassPermissions",
        cwd: WORKSPACE_DIR,
        maxTurns: 50,
        sessionId,
        mcpServers: {
          "buzybeez-mail": {
            command: "node",
            args: ["/app/mcp-mail-server.js"],
            env: {
              BEE_ID,
              OUTBOX_DIR,
            },
          },
        },
      },
    })) {
      // Capture session ID from init messages
      if (message.type === "init" && message.sessionId) {
        capturedSessionId = message.sessionId;
        await saveSessionId(capturedSessionId);
      }

      // Log tool calls for transcript compatibility
      if (message.type === "tool_use") {
        const toolName = message.name || message.tool;
        await log({
          type: "tool_call",
          tool: toolName,
          input: message.input,
        });

        // Log mail_sent when send_mail is called
        if (
          toolName === "mcp__buzybeez-mail__send_mail" ||
          toolName === "send_mail"
        ) {
          await log({
            type: "mail_sent",
            mailId: message.input?.id || "pending",
            to: message.input?.to,
            subject: message.input?.subject,
          });
        }
      }

      // Log tool results
      if (message.type === "tool_result") {
        await log({
          type: "tool_result",
          tool: message.name || message.tool,
          result:
            typeof message.content === "string"
              ? message.content
              : message.content,
        });
      }

      // Capture text content for final response logging
      if (message.type === "text") {
        finalResponseText += message.text || "";
      }

      // Log assistant messages
      if (message.type === "assistant" && message.content) {
        const textParts = Array.isArray(message.content)
          ? message.content
              .filter((b) => b.type === "text")
              .map((b) => b.text)
              .join("")
          : typeof message.content === "string"
            ? message.content
            : "";
        if (textParts) {
          finalResponseText += textParts;
        }
      }
    }

    await log({
      type: "claude_response",
      stopReason: "end_turn",
      responseText: finalResponseText?.slice(0, 200),
    });

    await log({
      type: "mail_processed",
      mailId: mail.id,
      from: mail.from,
      responseText: finalResponseText?.slice(0, 200),
    });
  } catch (error) {
    await log({
      type: "error",
      error: error.message,
      mailId: mail.id,
    });
    console.error(`Error processing mail ${mail.id}:`, error);
  }

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

  await log({ type: "bee_started", name: BEE_NAME });

  console.log(`📬 Watching ${INBOX_DIR} for mail...`);

  // Process any existing mail first
  const existingFiles = await fs.readdir(INBOX_DIR);
  for (const file of existingFiles.sort()) {
    if (!file.endsWith(".json")) continue;
    const filePath = path.join(INBOX_DIR, file);
    try {
      const raw = await fs.readFile(filePath, "utf-8");
      const mail = JSON.parse(raw);
      await fs.unlink(filePath); // Remove from inbox
      await processMail(mail);
    } catch (e) {
      console.error(`Error processing ${file}:`, e.message);
      await log({ type: "error", error: e.message, file });
    }
  }

  // Watch for new mail using polling (simpler and more reliable than fs.watch in Docker)
  let lastFiles = new Set();

  while (true) {
    try {
      const files = await fs.readdir(INBOX_DIR);
      const jsonFiles = files.filter((f) => f.endsWith(".json")).sort();

      for (const file of jsonFiles) {
        if (lastFiles.has(file)) continue; // Already processed

        const filePath = path.join(INBOX_DIR, file);
        try {
          const raw = await fs.readFile(filePath, "utf-8");
          const mail = JSON.parse(raw);
          await fs.unlink(filePath); // Remove from inbox
          await processMail(mail);
        } catch (e) {
          console.error(`Error processing ${file}:`, e.message);
          await log({ type: "error", error: e.message, file });
        }
      }

      lastFiles = new Set(jsonFiles);
    } catch (e) {
      // Ignore errors, keep polling
    }

    // Poll every 500ms
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
