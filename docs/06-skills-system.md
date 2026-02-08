# Skills System

Skills are composable capability packs that define what beez can do. This document covers skill structure, the registry, skill loading, and agent-created skills.

---

## Skill Folder Structure

Every skill follows a standard folder structure:

```
skill-name/
├── manifest.json           # Required: Skill metadata and configuration
├── context/                # Optional: Context files loaded into agent prompt
│   ├── instructions.md     # How to use this skill
│   ├── examples.md         # Example interactions
│   └── *.md                # Additional context
├── scripts/                # Optional: Executable scripts
│   ├── *.ts                # TypeScript scripts
│   └── *.sh                # Shell scripts
├── mcp/                    # Optional: MCP server code
│   └── server.ts           # Local MCP server
├── .env.example            # Required if envVars: Template for required env vars
└── README.md               # Optional: Human documentation
```

### Why This Structure

1. **Inspectable**: Agents can read their own skills to understand capabilities
2. **Standard**: Consistent structure enables automatic skill detection
3. **Debuggable**: Humans can browse and understand skill contents
4. **Transferable**: Copy a folder to share a skill

---

## Manifest File

The `manifest.json` file defines the skill's metadata and contents.

### Required Fields

```json
{
  "id": "social-media-apis",
  "name": "Social Media APIs",
  "version": "2.1.0",
  "description": "Post to Twitter, Instagram, and Facebook with analytics",
  "owner": "built-in"
}
```

| Field | Description |
|-------|-------------|
| `id` | Unique identifier (lowercase, hyphens allowed) |
| `name` | Human-readable name |
| `version` | Semver version string |
| `description` | What this skill enables |
| `owner` | "built-in" or bee ID that created it |

### Content Fields

```json
{
  "context": [
    "context/instructions.md",
    "context/platform-guidelines.md"
  ],
  "scripts": [
    "scripts/post-twitter.ts",
    "scripts/get-analytics.ts"
  ],
  "envVars": [
    "TWITTER_API_KEY",
    "INSTAGRAM_ACCESS_TOKEN"
  ],
  "mcpServers": [
    {
      "name": "social-mcp",
      "type": "local",
      "command": "node",
      "args": ["mcp/server.js"]
    }
  ]
}
```

| Field | Description |
|-------|-------------|
| `context` | Paths to markdown files loaded into agent prompt |
| `scripts` | Paths to executable scripts the agent can run |
| `envVars` | Required environment variable names (values stored separately) |
| `mcpServers` | MCP server configurations |

### Dependency Fields

```json
{
  "dependencies": ["basic-tools@1.0.0"],
  "nodeVersion": ">=20.0.0",
  "systemPackages": ["chromium", "ffmpeg"]
}
```

| Field | Description |
|-------|-------------|
| `dependencies` | Other skills this skill requires |
| `nodeVersion` | Minimum Node.js version |
| `systemPackages` | System packages to install (apt) |

### Registry Fields (Auto-Populated)

```json
{
  "usedBy": ["social-media-manager", "content-creator"],
  "registeredAt": "2024-01-15T10:00:00Z",
  "updatedAt": "2024-01-15T10:00:00Z"
}
```

These are managed by the skill registry, not manually edited.

---

## Context Files

Context files are markdown documents loaded into the agent's system prompt.

### instructions.md (Recommended)

Primary instructions for using the skill:

```markdown
# Social Media APIs Skill

You have access to social media posting and analytics tools.

## Available Actions

### Posting
- `post-twitter.ts` - Post a tweet (max 280 chars)
- `post-instagram.ts` - Post an image with caption
- `post-facebook.ts` - Post to Facebook page

### Analytics
- `get-analytics.ts` - Retrieve engagement metrics

## Guidelines

1. Always check character limits before posting
2. Include relevant hashtags (max 3 per post)
3. Never post the same content to multiple platforms without adaptation
4. Check analytics before suggesting content changes

## Error Handling

If a post fails, check:
1. API rate limits (wait and retry)
2. Content policy violations (modify content)
3. Authentication issues (report to human)
```

### examples.md (Optional)

Example interactions showing expected behavior:

```markdown
# Examples

## Posting a Tweet

**Input mail:**
> Post about our new product launch

**Actions:**
1. Draft tweet under 280 characters
2. Run `post-twitter.ts` with content
3. Report success with tweet URL

**Output mail:**
> Posted successfully: https://twitter.com/example/status/123

## Checking Analytics

**Input mail:**
> How did yesterday's posts perform?

**Actions:**
1. Run `get-analytics.ts` for last 24 hours
2. Summarize key metrics
3. Provide recommendations

**Output mail:**
> Yesterday's performance:
> - Twitter: 1.2K impressions, 45 engagements (3.7% rate)
> - Instagram: 800 impressions, 120 likes
> Recommendation: Twitter content resonated well. Consider similar tone for upcoming posts.
```

---

## Scripts

Scripts are executable files the agent can run as tools.

### TypeScript Scripts

```typescript
// scripts/post-twitter.ts

import { TwitterApi } from 'twitter-api-v2';

interface Args {
  content: string;
  mediaUrls?: string[];
}

async function main(args: Args): Promise<string> {
  const client = new TwitterApi({
    appKey: process.env.TWITTER_API_KEY!,
    appSecret: process.env.TWITTER_API_SECRET!,
    accessToken: process.env.TWITTER_ACCESS_TOKEN!,
    accessSecret: process.env.TWITTER_ACCESS_SECRET!,
  });

  // Validate content length
  if (args.content.length > 280) {
    throw new Error(`Tweet too long: ${args.content.length} chars (max 280)`);
  }

  // Post tweet
  const tweet = await client.v2.tweet(args.content);

  return `Posted: https://twitter.com/i/status/${tweet.data.id}`;
}

// Entry point
const args = JSON.parse(process.argv[2] || '{}');
main(args)
  .then(result => {
    console.log(JSON.stringify({ success: true, result }));
    process.exit(0);
  })
  .catch(error => {
    console.log(JSON.stringify({ success: false, error: error.message }));
    process.exit(1);
  });
```

### Shell Scripts

```bash
#!/bin/bash
# scripts/check-status.sh

# Simple health check
curl -s "https://api.twitter.com/2/tweets" \
  -H "Authorization: Bearer $TWITTER_BEARER_TOKEN" \
  | jq '.meta.result_count'
```

### Script Conventions

1. **Input**: Arguments passed as JSON via command line or stdin
2. **Output**: JSON to stdout with `success` boolean and `result` or `error`
3. **Exit codes**: 0 for success, non-zero for failure
4. **Environment**: API keys available via environment variables

---

## MCP Servers

Local MCP servers run inside the bee container.

### Local MCP Server

```typescript
// mcp/server.ts

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new Server(
  { name: 'social-media-mcp', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

// Define tools
server.setRequestHandler('tools/list', async () => ({
  tools: [
    {
      name: 'post_tweet',
      description: 'Post a tweet to Twitter',
      inputSchema: {
        type: 'object',
        properties: {
          content: { type: 'string', maxLength: 280 }
        },
        required: ['content']
      }
    }
  ]
}));

server.setRequestHandler('tools/call', async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'post_tweet') {
    // Implementation
    return { content: [{ type: 'text', text: 'Tweet posted!' }] };
  }

  throw new Error(`Unknown tool: ${name}`);
});

// Start server
const transport = new StdioServerTransport();
server.connect(transport);
```

### Remote MCP Servers

For external MCP servers, just configure the URL:

```json
{
  "mcpServers": [
    {
      "name": "external-api",
      "type": "remote",
      "url": "https://mcp.example.com/api"
    }
  ]
}
```

---

## Skill Registry

The global skill registry tracks all available skills.

### Registry File Structure

```
/registry/skills.json
```

```json
{
  "skills": [
    {
      "id": "social-media-apis",
      "versions": ["2.1.0", "2.0.0", "1.0.0"],
      "latestVersion": "2.1.0",
      "owner": "built-in",
      "usedBy": ["social-media-manager", "content-creator"],
      "registeredAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-15T10:00:00Z"
    },
    {
      "id": "custom-reporting",
      "versions": ["1.0.0"],
      "latestVersion": "1.0.0",
      "owner": "analytics-bee",
      "usedBy": ["analytics-bee", "manager-bee"],
      "registeredAt": "2024-01-15T14:30:00Z",
      "updatedAt": "2024-01-15T14:30:00Z"
    }
  ]
}
```

### Registry Operations

| Operation | Description |
|-----------|-------------|
| **List** | Get all registered skills |
| **Get** | Get specific skill by ID |
| **Register** | Add new skill to registry |
| **Update** | Add new version of existing skill |
| **Delete** | Remove skill (fails if in use) |

---

## Skill Loading

When a bee starts, skills are loaded into its container.

### Loading Process

1. **Resolve versions**: Map `skill-id@version` to actual skill paths
2. **Check dependencies**: Ensure all skill dependencies are satisfied
3. **Mount directories**: Mount skill folders to `/skills/` in container
4. **Inject env vars**: Set API keys from secrets store
5. **Start MCPs**: Launch local MCP servers
6. **Build prompt**: Concatenate context files into system prompt

### Container Directory Structure

After loading, the bee's `/skills/` directory looks like:

```
/skills/
├── social-media-apis/
│   ├── manifest.json
│   ├── context/
│   │   ├── instructions.md
│   │   └── examples.md
│   ├── scripts/
│   │   ├── post-twitter.ts
│   │   └── get-analytics.ts
│   └── mcp/
│       └── server.ts
├── basic-tools/
│   ├── manifest.json
│   ├── context/
│   │   └── instructions.md
│   └── scripts/
│       ├── read-file.ts
│       └── write-file.ts
```

### System Prompt Construction

The agent's system prompt includes:

1. Soul file contents (`/soul.md`) - bee's core identity and personality
2. Concatenated context from all skills
3. List of available tools (scripts + MCP tools)

```
# Soul

[contents of /soul.md - bee's personality and base instructions]

---

# Available Skills

## Social Media APIs (v2.1.0)

[contents of social-media-apis/context/instructions.md]

[contents of social-media-apis/context/examples.md]

## Basic Tools (v1.0.0)

[contents of basic-tools/context/instructions.md]

---

# Available Tools

- post-twitter.ts: Post a tweet to Twitter
- get-analytics.ts: Retrieve engagement metrics
- read-file.ts: Read a file from disk
- write-file.ts: Write content to a file

# MCP Tools

- social-media-mcp: post_tweet, get_analytics, ...
```

Note: The soul file (`/soul.md`) is the primary source of bee identity. It can be edited by humans from the UI, and if `allowSoulEdit: true`, the bee can edit it itself to learn and evolve.

---

## Agent-Created Skills

Beez can create their own skills, which appear in the registry.

### How It Works

1. Agent creates folder in `/skills/custom/skill-name/`
2. Agent writes `manifest.json` with required fields
3. Agent adds context files and scripts
4. Orchestrator detects new skill folder
5. Skill registered with `owner: bee-id`
6. Skill available for assignment to other beez

### Detection Mechanism

The orchestrator watches `/skills/custom/` for changes:

```typescript
// Pseudocode
watch('/skills/custom/', async (event) => {
  if (event.type === 'create' && event.path.endsWith('manifest.json')) {
    const manifest = await readJson(event.path);
    if (validateManifest(manifest)) {
      await registerSkill(manifest);
      emit('skill:created', { skill: manifest, createdBy: getBeeId() });
    }
  }
});
```

### Skill Creation Example

An agent might create a skill through this sequence:

```
1. Mail received: "Create a skill for generating weekly reports"

2. Agent actions:
   - mkdir /skills/custom/weekly-reports
   - write /skills/custom/weekly-reports/manifest.json
   - write /skills/custom/weekly-reports/context/instructions.md
   - write /skills/custom/weekly-reports/scripts/generate-report.ts

3. Orchestrator detects new skill
   - Validates manifest
   - Registers in registry with owner = bee-id

4. Mail sent: "Created weekly-reports skill (v1.0.0). It can now be assigned to other beez."
```

### Skill Validation

Before registration, manifests are validated:

```typescript
interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function validateManifest(manifest: unknown): ValidationResult {
  const errors: string[] = [];

  // Required fields
  if (!manifest.id) errors.push('Missing id');
  if (!manifest.name) errors.push('Missing name');
  if (!manifest.version) errors.push('Missing version');
  if (!manifest.description) errors.push('Missing description');

  // ID format
  if (!/^[a-z0-9-]+$/.test(manifest.id)) {
    errors.push('Invalid id format (lowercase, numbers, hyphens only)');
  }

  // Version format
  if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) {
    errors.push('Invalid version format (must be semver)');
  }

  // Context files exist
  for (const path of manifest.context || []) {
    if (!fileExists(resolve(skillDir, path))) {
      errors.push(`Context file not found: ${path}`);
    }
  }

  // Scripts exist and are executable
  for (const path of manifest.scripts || []) {
    if (!fileExists(resolve(skillDir, path))) {
      errors.push(`Script not found: ${path}`);
    }
  }

  return { valid: errors.length === 0, errors };
}
```

---

## Built-in Skills

BuzyBeez ships with essential built-in skills.

### basic-tools

Fundamental file and system operations:

```json
{
  "id": "basic-tools",
  "name": "Basic Tools",
  "version": "1.0.0",
  "description": "File operations, web requests, and system utilities",
  "owner": "built-in",

  "scripts": [
    "scripts/read-file.ts",
    "scripts/write-file.ts",
    "scripts/list-directory.ts",
    "scripts/http-request.ts",
    "scripts/run-command.ts"
  ]
}
```

### mail-tools (Optional)

Utilities for managing mail:

```json
{
  "id": "mail-tools",
  "name": "Mail Tools",
  "version": "1.0.0",
  "description": "Inspect inbox, search mail history, manage queues",
  "owner": "built-in",

  "context": ["context/mail-system.md"],
  "scripts": [
    "scripts/list-inbox.ts",
    "scripts/search-history.ts",
    "scripts/mail-stats.ts"
  ]
}
```

### cron-tools (Optional)

Utilities for managing scheduled events:

```json
{
  "id": "cron-tools",
  "name": "Cron Tools",
  "version": "1.0.0",
  "description": "Manage scheduled events and cron jobs",
  "owner": "built-in",

  "context": ["context/scheduling.md"],
  "scripts": [
    "scripts/list-cron-jobs.ts",
    "scripts/create-cron-job.ts",
    "scripts/update-cron-job.ts",
    "scripts/delete-cron-job.ts",
    "scripts/toggle-cron-job.ts"
  ]
}
```

This skill allows beez to manage their own scheduled events programmatically. Combined with UI management, cron jobs can be created and modified by both humans and agents.

---

## Secrets Management

API keys are stored separately from skill manifests.

### Secrets File

```
/secrets/env.json
```

```json
{
  "TWITTER_API_KEY": "abc123...",
  "TWITTER_API_SECRET": "def456...",
  "INSTAGRAM_ACCESS_TOKEN": "ghi789...",
  "OPENAI_API_KEY": "sk-..."
}
```

### Injection Process

1. Skill manifest declares required `envVars`
2. On bee start, orchestrator reads secrets file
3. Matching values injected as container environment variables
4. Agent never sees raw secrets file, only env vars

### Missing Secrets

If a required env var is not in secrets:

1. Warning logged during skill loading
2. Bee starts but skill may fail when scripts run
3. UI shows warning indicator on bee

---

## Skill Versioning

Skills use semantic versioning for safe updates.

### Version Format

`MAJOR.MINOR.PATCH` (e.g., `2.1.0`)

- **MAJOR**: Breaking changes to context or script interfaces
- **MINOR**: New features, backward compatible
- **PATCH**: Bug fixes

### Multiple Versions

Registry can hold multiple versions:

```json
{
  "id": "social-media-apis",
  "versions": ["2.1.0", "2.0.0", "1.0.0"],
  "latestVersion": "2.1.0"
}
```

### Version Resolution

When a bee specifies `social-media-apis@2.1.0`:
- Exact version used
- Error if version not found

When a bee specifies `social-media-apis` (no version):
- Latest version used
- Warning logged (explicit versions recommended)

### Updating Skills

To update a skill:

1. Create new version folder: `/skills/built-in/social-media-apis@2.2.0/`
2. Update manifest with new version
3. Register via API
4. Update bee configs to use new version
5. Restart beez to load new version
