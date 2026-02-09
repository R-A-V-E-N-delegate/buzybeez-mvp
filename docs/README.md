# BuzyBeez MVP

An AI agent orchestration platform where autonomous "bees" (Claude-powered agents) run in Docker containers, communicate via a mail system, and are managed through a React canvas UI.

## Key Features

- **Multi-agent orchestration**: Run multiple Claude-powered agents simultaneously in isolated Docker containers
- **Mail-based communication**: Bees communicate with each other and humans exclusively through a structured mail system
- **Visual canvas UI**: Drag-and-drop interface built with React Flow for arranging bees, drawing connections, and managing the swarm
- **Claude Agent SDK**: Each bee uses the official `@anthropic-ai/claude-agent-sdk` with built-in tools (Read, Write, Edit, Bash, Glob, Grep) and MCP support
- **Session persistence**: Bees retain conversation context across restarts via SDK session management
- **Real-time updates**: WebSocket-powered live updates for mail delivery, bee status changes, and transcript streaming
- **Hierarchical delegation**: Bees can delegate subtasks to downstream bees and report results upstream
- **Soul files**: Customizable personality and instructions per bee via markdown soul files

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, TypeScript, React Flow, TailwindCSS |
| API Server | Express, TypeScript, WebSocket (ws), Chokidar |
| Bee Runner | Node.js, Claude Agent SDK, MCP (Model Context Protocol) |
| Infrastructure | Docker, dockerode |

## Quick Start

### Prerequisites

- Node.js 20+
- Docker (running)
- Anthropic API key

### Setup

```bash
# Clone and install
cd buzybeez-mvp
npm install

# Set your API key
export ANTHROPIC_API_KEY=sk-ant-...

# Build the bee Docker image
npm run docker:build

# Start the server
npm run dev
```

Open `http://localhost:3000` in your browser. Use the canvas to start a bee and send it mail.

## Project Structure

```
buzybeez-mvp/
  server/           # Express API server + swarm management
    index.ts        # REST API routes + WebSocket server
    swarm.ts        # Docker container lifecycle management
    types.ts        # TypeScript interfaces
    skills.ts       # Skills registry (extensibility system)
  web-vite/         # React frontend (Vite)
    src/
      components/   # Canvas, MailComposer, LogViewer, etc.
      hooks/        # useWebSocket, useSwarm, etc.
  docker/           # Bee container image
    runner.js       # Agent SDK runner (inbox polling + query())
    mcp-mail-server.js  # MCP server providing send_mail tool
    Dockerfile      # Bee container image definition
    package.json    # Runner dependencies
  data/             # Runtime data (gitignored)
    bees/           # Per-bee directories (inbox, outbox, workspace, etc.)
    swarm.json      # Swarm configuration
  docs/             # Documentation (this directory)
  docs-archive/     # Previous documentation (archived)
```

## Documentation

- [Architecture](architecture.md) - System architecture, data flow, and design decisions
- [Bee Runner](bee-runner.md) - How the Agent SDK runner works inside each container
- [API Reference](api-reference.md) - REST endpoints and WebSocket events
- [Data Models](data-models.md) - TypeScript interfaces, mail schema, transcript format
- [Development](development.md) - Setup, development workflow, and testing
- [Skills System](skills-system.md) - Extensible skills registry
