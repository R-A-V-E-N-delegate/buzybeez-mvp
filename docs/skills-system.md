# Skills System

The skills system (`server/skills.ts`) provides an extensible registry for composable capability packs. Skills can define context files, scripts, MCP servers, and dependencies.

**Current status**: The skills registry is functional for registration, validation, and querying via the API, but is not yet integrated with the Agent SDK runner. Bees do not currently load skills at startup.

## Overview

A skill is a directory containing a `manifest.json` and supporting files (context docs, scripts, etc.). Skills are registered in a central index at `data/skills/index.json`.

## Manifest Format

```json
{
  "id": "web-scraping",
  "name": "Web Scraping",
  "version": "1.0.0",
  "description": "Tools for fetching and parsing web pages",
  "owner": "built-in",
  "context": ["docs/usage.md"],
  "scripts": ["scripts/fetch-page.sh"],
  "envVars": ["PROXY_URL"],
  "mcpServers": [
    {
      "name": "web-tools",
      "type": "local",
      "command": "node",
      "args": ["servers/web-tools.js"]
    }
  ],
  "dependencies": ["basic-tools@1.0.0"],
  "nodeVersion": "20",
  "systemPackages": ["chromium"]
}
```

### Manifest Fields

| Field | Required | Description |
|---|---|---|
| `id` | Yes | Lowercase letters, numbers, hyphens only |
| `name` | Yes | Human-readable name |
| `version` | Yes | Semver format (X.Y.Z) |
| `description` | Yes | What the skill provides |
| `owner` | Yes | `"built-in"` or a bee ID |
| `context` | No | Markdown files appended to the system prompt |
| `scripts` | No | Executable scripts exposed as tools |
| `envVars` | No | Required environment variables |
| `mcpServers` | No | MCP servers to start |
| `dependencies` | No | Other skills this requires |
| `nodeVersion` | No | Minimum Node.js version |
| `systemPackages` | No | System packages (apt) |

## Registry Structure

```
data/skills/
  index.json          # Registry index
  built-in/           # Built-in skills
    basic-tools@1.0.0/
      manifest.json
  custom/             # User-created skills
    my-skill@1.0.0/
      manifest.json
      docs/
      scripts/
  temp/               # Temporary upload location
```

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/skills` | List all registered skills |
| GET | `/api/skills/:id` | Get skill details + manifest |
| POST | `/api/skills` | Register a new skill |
| DELETE | `/api/skills/:id` | Remove a skill |

See [api-reference.md](api-reference.md#skills) for full request/response examples.

## Registry Operations

The `SkillsRegistry` class provides:

- **registerSkill(manifest, skillDir)**: Validate, copy to registry location, add to index
- **removeSkill(id, version?)**: Remove a version or all versions (fails if skill is in use)
- **getSkillManifest(id, version?)**: Load manifest for a specific version
- **loadSkillContext(id, version?)**: Read and concatenate all context files
- **getSkillTools(id, version?)**: Extract tool definitions from scripts
- **resolveDependencies(skillIds)**: Recursively resolve all dependencies
- **addSkillUser/removeSkillUser**: Track which bees use which skills

## Validation Rules

When registering a skill, the manifest is validated:

- `id` must be lowercase letters, numbers, and hyphens
- `version` must be semver format (X.Y.Z)
- `name` and `description` must be non-empty strings
- All referenced `context` files must exist in the skill directory
- All referenced `scripts` must exist in the skill directory

## Future Integration

To integrate skills with the Agent SDK runner, the following would be needed:

1. Load assigned skills when a bee starts
2. Append skill context files to the system prompt
3. Add skill MCP servers to the `mcpServers` config in `query()`
4. Install required system packages in the Dockerfile
5. Set required environment variables in the container
