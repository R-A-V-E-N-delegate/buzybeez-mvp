# BuzyBeez Documentation

**BuzyBeez** is an AI agent orchestrator where agents ("Beez") run in sandboxed containers, communicate exclusively via mail, and are composed with capability packs ("Skillz"). Users design agent topologies on a node-based canvas ("Swarmz").

Think of it as **n8n for AI agent orchestration**.

---

## Design Principles

1. **KISS** - Keep it simple. Prefer obvious solutions over clever ones.
2. **Modular** - Components are independent and replaceable.
3. **Composable** - Small pieces combine to create complex behaviors.

---

## Documentation Index

| Document | Description |
|----------|-------------|
| [Core Concepts](./01-core-concepts.md) | Beez, Skillz, Swarmz, Mail, Mailboxez - the fundamental building blocks |
| [Architecture](./02-architecture.md) | System layers, components, and data flow |
| [Design Decisions](./03-design-decisions.md) | Every major decision with rationale |
| [Data Models](./04-data-models.md) | TypeScript interfaces and schemas |
| [API Specification](./05-api-specification.md) | REST endpoints and WebSocket events |
| [Skills System](./06-skills-system.md) | Skill structure, registry, and agent-created skills |
| [Implementation Guide](./07-implementation-guide.md) | Phased build plan with deliverables |
| [Testing Strategy](./08-testing-strategy.md) | Unit, integration, and E2E test plans |
| [UI Vision](./09-ui-vision.md) | Visual design language, layouts, and component patterns |

---

## Quick Start (Future)

```bash
# Clone and install
git clone https://github.com/you/buzybeez
cd buzybeez
pnpm install

# Start the platform
pnpm dev

# Open canvas UI
open http://localhost:3000
```

---

## MVP Scope

**In scope:**
- Local Docker containers as bee compute
- Node-based canvas for swarmz design
- Mail-based communication between beez
- External mailboxez for humans and external services
- Skill mounting and management
- Soul files for bee personality and self-learning
- Full observability (logs, transcripts, mail history, system log)
- Container access (filesystem, SSH terminal)
- Cron-based scheduled events (manageable from UI)
- Human-in-the-loop approval workflows
- Pause/resume for individual beez and entire swarmz
- Configurable bee timeouts

**Out of scope (for now):**
- Authentication / multi-tenancy
- Remote Docker hosts / cloud compute
- VNC for GUI access
- Skill marketplace
- Cloud deployment
- Billing / usage tracking

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js 20+, TypeScript |
| Agent | claude-agent-sdk |
| Containers | Docker (via dockerode) |
| API | Express or Fastify |
| WebSocket | ws or socket.io |
| UI Framework | React |
| Canvas | react-flow |
| Terminal | xterm.js |
| State Management | Zustand |
| Styling | Tailwind CSS |
| Build | pnpm workspaces, tsup |

---

## Aesthetic

- Notion-like elegance, lightness, simplicity
- White and honey-colored palette
- Thin lines, hexagons, rounded ovals
- Smooth morph animations

---

## Project Structure

```
/packages
  /core           # Shared types, interfaces, utilities
  /bee-runtime    # Docker management, agent execution
  /orchestrator   # Swarmz config, lifecycle, mail routing, API
  /canvas-ui      # React app with node-based editor

/skills
  /built-in       # Pre-packaged skills
  /custom         # Agent-created skills

/docs             # This documentation
```
