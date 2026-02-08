# Core Concepts

BuzyBeez has five fundamental concepts: **Beez**, **Skillz**, **Swarmz**, **Mail**, and **Mailboxez**.

---

## Beez

A **Bee** is an AI agent running inside a sandboxed Docker container.

### What a Bee Is

- A container that hosts an AI agent
- Uses `claude-agent-sdk` as the core agent runtime
- Wakes when mail arrives, processes it, then returns to idle
- Can spawn sub-agents internally (via claude-agent-sdk) for complex tasks
- Has full access to its container filesystem
- Has a `soul.md` file that defines its personality and base instructions

### Keep Alive Setting

Each bee has a `keepAlive` toggle (default: `true`):

| Setting | Behavior | Use Case |
|---------|----------|----------|
| `keepAlive: true` | Container stays running while agent is idle | Coordination roles, fast response needed |
| `keepAlive: false` | Container can be stopped when idle | Cost optimization, infrequent tasks |

This is a simple toggle rather than explicit "types" - any bee can coordinate or execute work.

### Soul File

Every bee has a `soul.md` file that:
- Contains base instructions and personality injected into the system prompt
- Can be viewed and edited by humans from the UI
- Optionally allows self-editing if `allowSoulEdit: true` is set
- Enables beez to learn and evolve over time when self-editing is enabled

The soul file is separate from skills - it's the bee's core identity that persists regardless of which skills are assigned.

### Timeout Configuration

Beez can be configured with an optional timeout:
- `timeout: null` - Bee can run forever (default)
- `timeout: 300` - Bee times out after 300 seconds of processing a single mail item

Timeouts prevent runaway agents and help with cost control.

### Bee Lifecycle

```
STOPPED → IDLE → PROCESSING → IDLE → ... → PAUSED → IDLE → STOPPED
           ↑        ↓
           └── mail arrives
```

- **Stopped**: Container not running
- **Idle**: Container running, agent waiting for mail
- **Processing**: Agent actively working on a mail item
- **Paused**: Frozen mid-task, can resume without losing state

### Bee Capabilities

Each bee can:
- Read/write its own filesystem
- Execute scripts from mounted skills
- Make API calls (with injected credentials)
- Use MCP tools (local or remote)
- Send mail to connected beez or mailboxez
- Create new skills (which appear in the global registry)
- Edit its own soul.md (if `allowSoulEdit` is enabled)

---

## Skillz

A **Skill** is a composable capability pack that gives a bee specific abilities.

### What a Skill Contains

| Component | Description | How It's Used |
|-----------|-------------|---------------|
| **Context** | Markdown files with instructions, examples, domain knowledge | Loaded into agent's system prompt |
| **Scripts** | TypeScript/shell scripts for specific actions | Executed by agent as tools |
| **API Keys** | Credentials for external services | Injected as environment variables |
| **MCP Servers** | Model Context Protocol servers | Local: run in container. Remote: configured on agent |

### Skill Characteristics

- **Versioned**: `social-media-skill@1.2.3` - enables reproducibility
- **Owned**: Either `built-in` or owned by a specific bee
- **Transferable**: Skills created by one bee can be assigned to others
- **Self-documenting**: Standard folder structure makes skills inspectable

### Why Skillz Matter

Skills separate "what an agent knows how to do" from "the agent itself." This means:
- Same bee can be reconfigured with different skills
- Skills can be developed and tested independently
- Agents can create skills for themselves (self-improvement)
- Teams can share skill packs

---

## Swarmz

A **Swarmz** is a topology of beez and mailboxez with defined communication routes.

### What a Swarmz Defines

- Which beez exist and their configurations
- Which mailboxez exist for external communication
- Which entities can communicate with which (connections)
- Direction of communication (unidirectional or bidirectional)
- Human-in-the-loop requirements on specific routes
- Default limits for all beez

### Topology is Fixed

Beez cannot spawn other beez or create new connections at runtime. The swarmz topology is designed on the canvas and remains stable during execution.

**Why?** Predictability and debuggability. When something goes wrong, you can trace the exact path mail took through a known topology. Dynamic topologies become impossible to reason about.

**Flexibility within constraints**: While beez can't create new beez, they can spawn sub-agents internally using claude-agent-sdk. This allows complex multi-step reasoning within a single bee without changing the swarmz topology.

### Swarmz Examples

**Simple**: One bee doing coding tasks
```
[Mailbox: Human] → [Coder Bee]
```

**Delegation**: Coordinator delegates to specialists
```
[Mailbox: Human] → [Social Media Coordinator]
                          ↓
              ┌───────────┼───────────┐
              ↓           ↓           ↓
        [Instagram] [Twitter] [Facebook]
```

**With External Integration**: Webhooks and APIs
```
[Mailbox: Webhooks] → [Event Handler] → [Processor] → [Mailbox: Slack Notifications]
```

**Full Company**: Hierarchical organization
```
[Mailbox: Human] → [CEO Bee]
                       ↓
           ┌───────────┼───────────┐
           ↓           ↓           ↓
       [Sales]   [Engineering] [Marketing]
           ↓           ↓             ↓
         [...]    [Dev Team]    [Content]
                       ↓             ↓
                    [QA]          [Design]
```

---

## Mail

**Mail is the only communication mechanism.** Everything that triggers agent activity is mail.

### What is Mail?

A structured message with:
- **Envelope**: from, to, subject, timestamp
- **Body**: Freeform content (instructions, data, results)
- **Metadata**: Type, priority, approval requirements

### Everything is Mail

| Event | How It Becomes Mail |
|-------|---------------------|
| Human sends a task | Human mail → bee inbox |
| Bee delegates to another bee | Agent mail → recipient inbox |
| Scheduled event fires | Cron system generates mail → bee inbox |
| System notification | System mail → bee inbox |
| Delivery failure | Bounce mail → original sender inbox |

### Why Mail-Only?

1. **Clean interfaces**: No shared state between beez. Each bee only knows what it's been told via mail.

2. **Debuggable**: You can inspect any bee's inbox/outbox to understand exactly what it knew and did.

3. **Auditable**: Complete history of all communication is preserved.

4. **Human-compatible**: Humans can read, edit, and approve mail. The same interface works for humans and agents.

5. **Asynchronous by nature**: Beez don't block waiting for responses. They process mail and send results.

### Mail Flow

```
Sender                          Orchestrator                       Recipient
   │                                │                                  │
   │ ── send mail ────────────────► │                                  │
   │                                │ ── validate topology ──►         │
   │                                │ ── check approval req ──►        │
   │                                │                                  │
   │                                │ ◄── (if approval needed) ────────│
   │                                │      wait for human              │
   │                                │                                  │
   │                                │ ── deliver to inbox ───────────► │
   │                                │                                  │
   │                                │                    agent wakes ──┤
   │                                │                    processes     │
   │                                │                    sends reply ──┤
   │                                │ ◄── reply mail ──────────────────│
   │ ◄── reply delivered ───────────│                                  │
```

### Mail Queue Behavior

When mail arrives at a bee that's already processing:
1. Mail is added to the inbox queue
2. Bee finishes current task
3. Bee picks up next mail from queue (FIFO)
4. Repeat until inbox is empty
5. Bee returns to idle

### Bounce Handling

If mail cannot be delivered (recipient container crashed, bee doesn't exist):
1. Orchestrator creates bounce mail
2. Bounce mail sent to original sender's inbox
3. Sender can decide how to handle (retry, escalate, ignore)

---

## Mailboxez

A **Mailbox** is an external communication endpoint for humans and external services.

### What a Mailbox Is

- A named inbox/outbox pair that appears on the canvas
- Allows humans and external services to send AND receive mail
- Exposed via API for programmatic access
- Shows up as a distinct node type on the canvas

### Mailbox Use Cases

| Use Case | Description |
|----------|-------------|
| **Human Interface** | Primary way humans send tasks and receive results |
| **Webhook Receiver** | External services post events that become mail |
| **API Integration** | External apps poll for outgoing mail, send responses |
| **Notifications** | Beez send alerts/reports to external systems |

### Why Mailboxez?

1. **Unified model**: External communication uses the same mail abstraction as internal
2. **Visible**: Mailboxez appear on the canvas, making external touchpoints clear
3. **Manageable**: Humans can view/edit/delete mail in mailboxez from the UI
4. **Flexible**: Multiple mailboxez allow different external integrations

### Mailbox vs Bee

| Mailbox | Bee |
|---------|-----|
| No agent, just a queue | Has an AI agent |
| External access via API | Internal processing |
| Passive (stores mail) | Active (processes mail) |
| No skills | Has skills |

---

## How They Work Together

1. **Swarmz** defines the topology (which beez and mailboxez exist and how they connect)
2. **Skillz** define what each bee can do (mounted when container starts)
3. **Mail** triggers activity (arrives in inbox, wakes bee)
4. **Bee** processes mail using its skills and soul, sends results via mail
5. **Mailboxez** bridge external world (humans, services) to the swarmz

The result is a system where:
- Structure is visible and predictable (swarmz topology)
- Capabilities are composable and transferable (skillz)
- Identity is persistent and evolvable (soul files)
- Communication is inspectable and auditable (mail)
- External integration is explicit (mailboxez)
- Execution is sandboxed and controllable (beez)
