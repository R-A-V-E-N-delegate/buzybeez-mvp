# Design Decisions

This document captures every significant design decision and the reasoning behind it.

---

## Communication

### Decision: Mail-Only Communication

**Choice**: All communication between beez happens via mail. No shared memory, no direct function calls, no pub/sub.

**Alternatives Considered**:
- Shared database/state
- Direct RPC/function calls
- Message queues (RabbitMQ, Redis pub/sub)

**Why Mail**:
1. **Clean interfaces**: Each bee is a black box. It only knows what it's been explicitly told via mail. No hidden coupling through shared state.

2. **Debuggable**: When something goes wrong, you can inspect the exact mail a bee received. No wondering "what state did it see?"

3. **Human-compatible**: Humans can read mail, write mail, approve mail. Same interface for human and agent communication.

4. **Auditable**: Complete communication history is preserved automatically. Essential for understanding agent behavior.

5. **Async-native**: Beez don't block waiting for responses. They process what's in their inbox and send results. Natural fit for agents that might take variable time.

---

### Decision: Direct Inbox Delivery

**Choice**: Sender delivers mail directly to recipient's inbox (via orchestrator).

**Alternatives Considered**:
- Central message broker with consumers polling
- Event-driven pub/sub

**Why Direct Delivery**:
1. **Simpler**: No broker to manage, no subscription logic
2. **Immediate wake**: Recipient wakes as soon as mail arrives
3. **Clear ownership**: Each mail has exactly one recipient

---

### Decision: Queue While Busy

**Choice**: When mail arrives at a bee that's processing, it queues in the inbox. Bee processes queue sequentially when available.

**Alternatives Considered**:
- Reject mail while busy (sender retries)
- Parallel processing within a bee

**Why Queue**:
1. **No lost mail**: Sender doesn't need retry logic
2. **Predictable**: Sequential processing is easier to reason about
3. **Agent-friendly**: Agents work best when focused on one task at a time

---

### Decision: Everything is Mail (Including Cron Events)

**Choice**: Scheduled events, human input, and system notifications all become mail.

**Alternatives Considered**:
- Separate interfaces for cron, human, agent communication
- Different message types with different handling

**Why Unified**:
1. **One interface to learn**: If you understand mail, you understand all input
2. **Same tooling**: Log viewer, queue manager, approval workflow all work for everything
3. **Composable**: A cron event can trigger the same bee logic as an agent message

---

### Decision: Bounce on Delivery Failure

**Choice**: If mail can't be delivered (recipient crashed, doesn't exist), a bounce mail is sent to the original sender.

**Alternatives Considered**:
- Retry with backoff
- Dead letter queue
- Silent failure

**Why Bounce**:
1. **Sender awareness**: Sender learns something is wrong and can decide what to do
2. **No silent failures**: Problems surface immediately
3. **Agent-handleable**: Agents can implement retry/escalation logic themselves

---

## Topology

### Decision: Fixed Swarmz Topology

**Choice**: Beez cannot spawn other beez or create connections at runtime. Topology is designed on canvas.

**Alternatives Considered**:
- Dynamic bee spawning
- Self-modifying topology

**Why Fixed**:
1. **Predictable**: When debugging, you know exactly what the topology looks like
2. **Visible**: The canvas always shows the true structure
3. **Safe**: Runaway agent can't spawn infinite beez

**Flexibility Preserved**: Beez can spawn sub-agents internally via claude-agent-sdk. Complex reasoning happens within a bee, not by changing topology.

---

### Decision: Keep Alive Toggle (Not Types)

**Choice**: Simple boolean toggle `keepAlive` instead of explicit manager/worker types.

**Alternatives Considered**:
- Explicit manager/worker types
- Complex role taxonomy with multiple types

**Why Toggle**:
1. **Simpler**: One boolean is easier to understand than type categories
2. **Flexible**: Any bee can coordinate or execute - it's about lifecycle, not role
3. **Direct**: Says exactly what it does - "keep the container running when idle"
4. **No artificial constraints**: Don't force beez into predefined role boxes

---

### Decision: Soul Files for Bee Identity

**Choice**: Each bee has a `soul.md` file with base instructions, personality, and optionally self-editing capability.

**Alternatives Considered**:
- Everything in systemPrompt config field
- No persistent identity file

**Why Soul Files**:
1. **Inspectable**: Easy to view what defines a bee's behavior
2. **Editable**: Humans can tweak personality from UI
3. **Self-improving**: Beez can learn by editing their own soul (if allowed)
4. **Separate from skills**: Soul is identity, skills are capabilities

---

### Decision: Configurable Timeouts

**Choice**: Optional timeout parameter on beez (can run forever or timeout at limit).

**Why**:
1. **Safety**: Prevent runaway agents from consuming resources forever
2. **Cost control**: Limit maximum processing time per mail item
3. **Flexibility**: Default is no timeout for trusted beez

---

## Skills

### Decision: Skills as Mounted Filesystem

**Choice**: Skills are directories mounted into containers. Context is files, scripts are files, MCPs are processes.

**Alternatives Considered**:
- Skills as container images
- Skills as database records
- Skills as API endpoints

**Why Filesystem**:
1. **Inspectable**: Agents can read their own skills, understand what they have
2. **Debuggable**: Humans can browse skill contents
3. **Modifiable**: Agents can create/edit skills (new files in /skills/)
4. **Standard**: No special tooling needed, just files

---

### Decision: Agents Can Create Skills

**Choice**: When an agent creates a skill folder with proper structure, it's automatically detected and registered.

**Alternatives Considered**:
- Skills only created by humans
- Skills require approval to register

**Why Allow**:
1. **Self-improvement**: Agents can build tools they need
2. **Emergence**: Useful skills discovered through agent work
3. **Transferable**: Agent-created skill can be given to other agents

---

### Decision: Skills are Versioned

**Choice**: Skills have semver versions (`social-media@1.2.3`).

**Why**:
1. **Reproducibility**: Know exactly what version a bee is using
2. **Safe updates**: Can test new version without affecting production
3. **Rollback**: Can revert to previous version if new one has issues

---

### Decision: Global Skill Registry

**Choice**: Single registry file tracks all skills (built-in and agent-created), their versions, owners, and users.

**Why**:
1. **Discoverability**: See all available skills in one place
2. **Dependency tracking**: Know which beez use which skills
3. **Transfer**: Easy to assign skill from one bee to another

---

### Decision: External Mailboxez

**Choice**: Dedicated mailbox entities for external communication, visible on canvas.

**Alternatives Considered**:
- Implicit human connection to all beez
- API-only external access

**Why Mailboxez**:
1. **Explicit**: External touchpoints are visible on the canvas
2. **Unified model**: External mail uses same abstraction as internal
3. **Multiple channels**: Different mailboxez for different integrations
4. **Manageable**: View/edit mail in mailboxez from UI

---

## State & Persistence

### Decision: State Persists in Container

**Choice**: Agent state (claude-agent-sdk session) persists to container's /state/ directory.

**Alternatives Considered**:
- External database
- Orchestrator-managed state

**Why Container-Local**:
1. **Simple**: No external dependency
2. **Fast**: Local filesystem access
3. **Portable**: Container carries its own state
4. **SDK-native**: claude-agent-sdk handles serialization

---

### Decision: Pause/Resume Without Confusion

**Choice**: Beez can be paused mid-task and resumed without losing context or getting confused.

**Implementation**:
1. Docker pause freezes container state
2. Agent session already persisted to /state/
3. On resume, agent continues from exact point

**Why Important**:
1. **Cost control**: Pause expensive beez overnight
2. **Human review**: Pause to inspect before continuing
3. **Debugging**: Pause to examine state

---

## Observability

### Decision: Complete Transcript Logging

**Choice**: Every agent action is logged - tool calls, thoughts, inputs, outputs.

**Why**:
1. **Debugging**: See exactly what agent did and why
2. **Learning**: Understand agent behavior patterns
3. **Audit**: Required for high-stakes workflows

---

### Decision: Central System Log

**Choice**: Separate system log for container events, startups, failures (distinct from bee transcripts).

**Why**:
1. **Overview**: See system health without diving into individual beez
2. **Debugging**: Container issues visible in one place
3. **Monitoring**: Easy to watch for system-level problems

---

### Decision: Mail + Transcript Can Be Viewed Separately or Together

**Choice**: UI allows viewing just inbox/outbox (high-level) or full transcript (detailed).

**Why**:
1. **Zoom levels**: Sometimes you want overview, sometimes detail
2. **Timeline view**: See mail across beez synchronized by time
3. **Focus**: Hide transcript noise when debugging communication

---

### Decision: Full Container Access (Filesystem, SSH)

**Choice**: Humans can browse filesystem and open terminal to any bee container.

**Alternatives Considered**:
- Locked-down containers
- Read-only access

**Why Full Access**:
1. **Debugging**: Need to see what's actually in the container
2. **Intervention**: Fix issues without restarting
3. **Trust model**: Humans are operators, not users

---

## Limits & Safety

### Decision: Configurable Limits Per Bee

**Choice**: Each bee can have limits on mail per hour, concurrent tasks, tokens per task.

**Why**:
1. **Cost control**: Prevent runaway spending
2. **Safety**: Limit blast radius of misbehaving agent
3. **Fairness**: Prevent one bee from starving others

---

### Decision: Human-in-the-Loop on Specific Routes

**Choice**: Connections can require human approval before mail is delivered.

**Why**:
1. **Critical paths**: Some actions need human oversight
2. **Gradual trust**: Start with approval, remove as confidence grows
3. **Compliance**: Some workflows require human sign-off

---

## Compute

### Decision: Docker Containers (Local Dev)

**Choice**: Start with local Docker containers. Design for future remote compute.

**Why**:
1. **Available**: Docker is standard, runs anywhere
2. **Sandboxed**: Container isolation is well-understood
3. **Debuggable**: Easy to shell in, inspect, restart

---

### Decision: debian:bookworm-slim Base Image

**Choice**: Minimal Debian base rather than Alpine or custom.

**Alternatives Considered**:
- Alpine (smaller)
- Ubuntu (more familiar)
- Custom minimal image

**Why Debian**:
1. **Stability**: Debian is rock-solid
2. **Compatibility**: Most tools work without issues
3. **Size**: bookworm-slim is small enough (80MB)
4. **Future-proof**: When we add VNC, GUI tools work on Debian

---

### Decision: Modular Compute Layer

**Choice**: Docker Manager is abstracted so alternative compute backends can be added.

**Why**:
1. **Mac Mini**: User wants to connect physical machines as beez
2. **Cloud**: Future scaling to cloud VMs
3. **Hybrid**: Mix of local and remote compute

---

## UI

### Decision: Cron Management from UI

**Choice**: Cron jobs can be viewed, created, edited, and toggled from the canvas UI.

**Alternatives Considered**:
- Config-file only cron management
- Separate cron admin interface

**Why UI Management**:
1. **Visibility**: See all scheduled events alongside topology
2. **Quick edits**: Enable/disable without touching config files
3. **Skill integration**: A cron-management skill allows beez to manage their own schedules

---

### Decision: Same Interface for Design and Runtime

**Choice**: The canvas is both the design tool and the runtime monitor.

**Alternatives Considered**:
- Separate design and monitoring tools
- Config files for design, UI for monitoring

**Why Unified**:
1. **Simplicity**: One tool to learn
2. **Context**: See design decisions while monitoring runtime
3. **Quick edits**: Modify topology without switching tools

---

### Decision: Node-Based Canvas (react-flow)

**Choice**: Visual node editor like n8n, not code/config-first.

**Why**:
1. **Visible topology**: See the swarm structure at a glance
2. **Approachable**: Non-programmers can design swarms
3. **Matches mental model**: Beez and connections naturally map to nodes and edges

---

### Decision: Notion-like Aesthetic

**Choice**: White and honey colors, thin lines, hexagons, rounded shapes, smooth animations.

**Why**:
1. **Calm**: AI orchestration can be stressful; calm UI helps
2. **Professional**: Clean aesthetic for eventual product
3. **Bee theme**: Hexagons and honey connect to branding

---

## Data Format

### Decision: JSON for All Config

**Choice**: Swarm config, skill manifests, mail, registry - all JSON.

**Alternatives Considered**:
- YAML (more readable)
- TOML (better for config)
- Binary formats

**Why JSON**:
1. **Universal**: Every tool reads/writes JSON
2. **TypeScript-native**: Direct mapping to/from objects
3. **Debuggable**: Human-readable when needed
4. **Programmatic**: Easy for agents to create/modify

---

### Decision: WebSocket for Real-Time Updates

**Choice**: WebSocket connection from UI to orchestrator for live updates.

**Alternatives Considered**:
- Polling
- Server-sent events

**Why WebSocket**:
1. **Bidirectional**: UI can send commands too
2. **Low latency**: Instant updates for good UX
3. **Standard**: Well-supported in React ecosystem
