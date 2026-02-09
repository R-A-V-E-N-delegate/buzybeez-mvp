/**
 * BuzyBeez MCP Mail Server
 *
 * A small MCP server that provides the `send_mail` tool to the Agent SDK.
 * Runs as a subprocess spawned by the SDK's mcpServers config.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const BEE_ID = process.env.BEE_ID || "bee-001";
const OUTBOX_DIR = "/outbox";

const server = new McpServer({
  name: "buzybeez-mail",
  version: "1.0.0",
});

server.tool(
  "send_mail",
  "Send a mail message to another bee or to the human. This is the ONLY way to send responses - there is no automatic reply. Always use this tool to respond to mail you receive.",
  {
    to: z.string().describe('The recipient ID (e.g., "bee-002", "human")'),
    subject: z.string().describe("The mail subject line"),
    body: z.string().describe("The mail body text"),
  },
  async ({ to, subject, body }) => {
    const mailMsg = {
      id: randomUUID(),
      from: BEE_ID,
      to,
      subject,
      body,
      timestamp: new Date().toISOString(),
      metadata: {
        type: "agent",
        priority: "normal",
      },
      status: "queued",
    };

    await fs.mkdir(OUTBOX_DIR, { recursive: true });
    const outPath = path.join(OUTBOX_DIR, `${Date.now()}-${mailMsg.id}.json`);
    await fs.writeFile(outPath, JSON.stringify(mailMsg, null, 2));

    return {
      content: [
        {
          type: "text",
          text: `Mail sent to ${to}: ${subject} (id: ${mailMsg.id})`,
        },
      ],
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
