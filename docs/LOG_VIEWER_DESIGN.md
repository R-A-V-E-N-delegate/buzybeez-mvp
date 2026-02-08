# Log Viewer Design Document

A side-by-side log viewer for monitoring multiple bee transcripts in real-time with timestamp synchronization.

---

## Overview

The Log Viewer component provides a unified view of activity logs from multiple bees, aligned by timestamp for debugging and monitoring. It supports real-time streaming via WebSocket and provides color-coded entries by type.

---

## Component Architecture

### Component Hierarchy

```
LogViewer (main container)
  |
  +-- LogViewerHeader
  |     |-- Bee selector (multi-select)
  |     |-- Filter controls (by log type)
  |     |-- Pause/Resume streaming
  |     +-- Clear logs button
  |
  +-- LogTimelineContainer (horizontal scroll container)
  |     |
  |     +-- LogTimeline (one per selected bee)
  |           |-- Timeline header (bee name, status indicator)
  |           |-- LogEntry[] (virtualized list)
  |           +-- Auto-scroll anchor
  |
  +-- TimeRuler (shared timestamp ruler at top)
  |
  +-- SyncIndicator (shows current sync position)
```

### Components

#### 1. LogViewer.tsx (Main Container)
- Orchestrates the entire log viewing experience
- Manages selected bees and their timelines
- Handles WebSocket connection for real-time logs
- Provides synchronized scrolling across timelines
- Responsive layout that adapts to number of selected bees

#### 2. LogEntry.tsx (Individual Log Entry)
- Renders a single transcript entry
- Color-coded by entry type
- Expandable for detailed view (tool calls, mail content)
- Compact and detailed view modes
- Timestamp display with relative/absolute toggle

#### 3. LogTimeline.tsx (Single Bee Timeline)
- Vertical timeline for one bee's logs
- Virtualized rendering for performance
- Connection status indicator
- Entry grouping by time intervals
- Scroll position sync with other timelines

#### 4. useLogStore.ts (Zustand Store)
- Centralized state for all log data
- Per-bee log entries with efficient storage
- Filter and search state
- Sync position tracking
- WebSocket connection state

---

## State Management

### Store Structure (useLogStore.ts)

```typescript
interface LogStore {
  // Per-bee log entries (keyed by beeId)
  logs: Record<string, LogEntry[]>;

  // Which bees are currently selected for viewing
  selectedBeeIds: string[];

  // Active filters
  filters: {
    types: TranscriptEntryType[];
    search: string;
    since: string | null;  // ISO timestamp
  };

  // Real-time streaming state
  streaming: {
    isConnected: boolean;
    isPaused: boolean;
    subscribedBees: string[];
  };

  // Sync state for aligned viewing
  sync: {
    enabled: boolean;
    anchorTimestamp: string | null;  // Current sync point
    scrollPosition: number;
  };

  // Actions
  addLogEntry: (beeId: string, entry: LogEntry) => void;
  addLogEntries: (beeId: string, entries: LogEntry[]) => void;
  clearLogs: (beeId?: string) => void;
  selectBee: (beeId: string) => void;
  deselectBee: (beeId: string) => void;
  setFilter: (filter: Partial<LogStore['filters']>) => void;
  setSyncAnchor: (timestamp: string) => void;
  togglePause: () => void;
}
```

### Data Flow

```
WebSocket Events (log:entry)
         |
         v
  useLogStore.addLogEntry()
         |
         v
  LogViewer (subscribes to store)
         |
         v
  LogTimeline[] (filtered entries)
         |
         v
  LogEntry[] (rendered with virtualization)
```

---

## WebSocket Integration

### Event Subscription

```typescript
// Subscribe to bee logs when selected
ws.send(JSON.stringify({
  type: 'subscribe:bee',
  payload: { beeId: 'coordinator' }
}));

// Receive log entries
{
  type: 'log:entry',
  payload: {
    beeId: 'coordinator',
    entry: {
      id: 'entry-123',
      timestamp: '2024-01-15T10:30:00.123Z',
      type: 'tool_call',
      content: { toolName: 'read_file', arguments: { path: '/data.json' } }
    }
  }
}
```

### Connection Management

- Auto-reconnect with exponential backoff
- Buffer events during reconnection
- Sync state after reconnect (request logs since last entry)
- Visual indicator for connection state

---

## Data Structures

### LogEntry Type

```typescript
interface LogEntry {
  id: string;
  timestamp: string;  // ISO 8601
  type: LogEntryType;
  content: LogEntryContent;
  beeId: string;      // Denormalized for convenience
}

type LogEntryType =
  | 'mail_received'
  | 'mail_sent'
  | 'tool_call'
  | 'tool_result'
  | 'thinking'
  | 'error'
  | 'state_saved'
  | 'state_restored';

type LogEntryContent =
  | MailReceivedContent
  | MailSentContent
  | ToolCallContent
  | ToolResultContent
  | ThinkingContent
  | ErrorContent
  | StateContent;

interface MailReceivedContent {
  mail: {
    id: string;
    from: string;
    subject: string;
    body: string;
  };
}

interface MailSentContent {
  mail: {
    id: string;
    to: string;
    subject: string;
    body: string;
  };
}

interface ToolCallContent {
  toolName: string;
  arguments: Record<string, unknown>;
  duration?: number;
}

interface ToolResultContent {
  toolName: string;
  result: unknown;
  error?: string;
  duration?: number;
}

interface ThinkingContent {
  text: string;
}

interface ErrorContent {
  message: string;
  stack?: string;
  code?: string;
}

interface StateContent {
  path: string;
  size: number;
}
```

---

## UI Mockup Description

### Layout

```
+------------------------------------------------------------------+
| Log Viewer                                           [x] Close   |
+------------------------------------------------------------------+
| [Coordinator v] [Worker-1 v] [+ Add Bee]  | Types: [v] All      |
| [Search logs...]                          | [Pause] [Clear]     |
+------------------------------------------------------------------+
|  10:30:00  |  10:30:01  |  10:30:02  |  10:30:03  |  10:30:04   |  <- TimeRuler
+------------------------------------------------------------------+
| Coordinator          | Worker-1           | Worker-2            |
| [Running]            | [Idle]             | [Processing]        |
+---------------------+--------------------+---------------------+
|                     |                    |                     |
| 10:30:00.123        | 10:30:00.456       |                     |
| [MAIL IN]           | [TOOL CALL]        |                     |
| From: human         | read_file          |                     |
| Subject: Write...   | /workspace/data    |                     |
|                     |                    |                     |
| 10:30:01.234        | 10:30:01.789       | 10:30:01.567        |
| [TOOL CALL]         | [TOOL RESULT]      | [MAIL IN]           |
| send_mail           | { "data": [...] }  | From: coordinator   |
| { to: "worker-1"... |                    | Subject: Process... |
|                     |                    |                     |
|         ...         |         ...        |         ...         |
|                     |                    |                     |
+---------------------+--------------------+---------------------+
```

### Entry Type Colors

| Type           | Background      | Border/Accent  | Icon  |
|----------------|-----------------|----------------|-------|
| mail_received  | blue-50/10      | blue-500       | inbox |
| mail_sent      | green-50/10     | green-500      | send  |
| tool_call      | amber-50/10     | amber-500      | tool  |
| tool_result    | purple-50/10    | purple-500     | code  |
| thinking       | gray-50/10      | gray-400       | brain |
| error          | red-50/10       | red-500        | alert |

### Interaction States

1. **Hover on entry**: Expand to show full content
2. **Click on entry**: Pin expanded view, show in detail panel
3. **Click on timestamp**: Set as sync anchor point
4. **Scroll in one timeline**: Other timelines follow (if sync enabled)
5. **Drag to select time range**: Highlight entries in that range across all timelines

---

## Timeline Synchronization Algorithm

### Concept

Multiple bee logs need to be aligned by timestamp so that events happening at the same time appear at the same vertical position across timelines.

### Algorithm

```typescript
interface TimeSlot {
  startTime: number;    // Unix timestamp (ms)
  endTime: number;      // Unix timestamp (ms)
  entries: Map<string, LogEntry[]>;  // beeId -> entries in this slot
}

function synchronizeTimelines(
  logs: Record<string, LogEntry[]>,
  slotDuration: number = 1000  // 1 second slots
): TimeSlot[] {
  // 1. Find global time range
  const allEntries = Object.values(logs).flat();
  if (allEntries.length === 0) return [];

  const timestamps = allEntries.map(e => new Date(e.timestamp).getTime());
  const minTime = Math.min(...timestamps);
  const maxTime = Math.max(...timestamps);

  // 2. Create time slots
  const slots: TimeSlot[] = [];
  for (let t = minTime; t <= maxTime; t += slotDuration) {
    slots.push({
      startTime: t,
      endTime: t + slotDuration,
      entries: new Map()
    });
  }

  // 3. Assign entries to slots
  for (const [beeId, entries] of Object.entries(logs)) {
    for (const entry of entries) {
      const entryTime = new Date(entry.timestamp).getTime();
      const slotIndex = Math.floor((entryTime - minTime) / slotDuration);
      if (slotIndex >= 0 && slotIndex < slots.length) {
        const slot = slots[slotIndex];
        if (!slot.entries.has(beeId)) {
          slot.entries.set(beeId, []);
        }
        slot.entries.get(beeId)!.push(entry);
      }
    }
  }

  // 4. Filter empty slots (optional - keep for visual gaps)
  return slots.filter(slot => slot.entries.size > 0);
}
```

### Scroll Synchronization

```typescript
function syncScroll(
  sourceTimeline: HTMLElement,
  targetTimelines: HTMLElement[],
  anchorTimestamp: string | null
) {
  // Calculate relative scroll position
  const sourceRect = sourceTimeline.getBoundingClientRect();
  const scrollRatio = sourceTimeline.scrollTop / sourceTimeline.scrollHeight;

  // If we have an anchor, find the element at that timestamp
  if (anchorTimestamp) {
    const anchorElement = sourceTimeline.querySelector(
      `[data-timestamp="${anchorTimestamp}"]`
    );
    if (anchorElement) {
      const anchorOffset = anchorElement.offsetTop;

      // Sync other timelines to same timestamp
      for (const target of targetTimelines) {
        const targetAnchor = target.querySelector(
          `[data-timestamp="${anchorTimestamp}"]`
        );
        if (targetAnchor) {
          target.scrollTop = targetAnchor.offsetTop - anchorOffset + sourceTimeline.scrollTop;
        }
      }
      return;
    }
  }

  // Fallback: sync by scroll ratio
  for (const target of targetTimelines) {
    target.scrollTop = scrollRatio * target.scrollHeight;
  }
}
```

### Performance Considerations

1. **Virtualization**: Only render visible entries (react-window or similar)
2. **Debounced sync**: Throttle scroll sync to 60fps
3. **Incremental updates**: Append new entries without re-sorting entire array
4. **Indexed storage**: Use Map for O(1) lookups by beeId
5. **Web Workers**: Consider offloading sort/filter to worker for large logs

---

## API Integration

### Initial Load

```typescript
// Fetch historical logs when selecting a bee
async function loadHistoricalLogs(beeId: string, since?: string): Promise<LogEntry[]> {
  const params = new URLSearchParams();
  if (since) params.set('since', since);
  params.set('limit', '1000');

  const response = await fetch(`/api/bees/${beeId}/transcript?${params}`);
  const { entries } = await response.json();
  return entries;
}
```

### Real-time Updates

```typescript
// In useWebSocket hook or similar
function handleLogEntry(message: { type: 'log:entry', payload: any }) {
  const { beeId, entry } = message.payload;
  logStore.addLogEntry(beeId, {
    ...entry,
    beeId  // Denormalize for convenience
  });
}
```

---

## Implementation Checklist

- [ ] Create LogEntry.tsx with color coding and expand/collapse
- [ ] Create LogTimeline.tsx with virtualized list
- [ ] Create LogViewer.tsx main container with layout
- [ ] Create useLogStore.ts with Zustand
- [ ] Add WebSocket subscription for log events
- [ ] Implement timeline synchronization
- [ ] Add filter controls (by type, search)
- [ ] Add pause/resume streaming
- [ ] Add time ruler component
- [ ] Add responsive layout for 1-4 timelines
- [ ] Add entry detail modal/panel
- [ ] Performance testing with 10k+ entries

---

## Future Enhancements

1. **Log export**: Download logs as JSON/CSV
2. **Bookmarks**: Save interesting entry positions
3. **Diff view**: Compare logs between two time periods
4. **Correlation**: Auto-detect related entries across bees (by mail ID)
5. **Search highlighting**: Highlight matches across all timelines
6. **Playback mode**: Step through logs at configurable speed
