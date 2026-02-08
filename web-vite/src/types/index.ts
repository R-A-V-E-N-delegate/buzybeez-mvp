import { Node, Edge } from 'reactflow';

export interface BeeState {
  id: string;
  name: string;
  running: boolean;
  containerId?: string;
  lastError?: string;
}

export interface Mail {
  id: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  timestamp: string;
  metadata?: {
    type?: string;
    priority?: string;
  };
  status: 'queued' | 'delivered' | 'failed';
}

export interface Connection {
  from: string;
  to: string;
}

export interface BeeConfig {
  id: string;
  name: string;
  systemPrompt?: string;
}

export interface SwarmConfig {
  name: string;
  bees: BeeConfig[];
  connections: Connection[];
}

export interface MailCounts {
  inbox: number;
  outbox: number;
  processing: boolean;
}

export interface HumanNodeData {
  label: string;
  mailCounts?: MailCounts;
}

export interface BeeNodeData {
  label: string;
  beeId: string;
  running: boolean;
  mailCounts?: MailCounts;
}

export type AppNode = Node<HumanNodeData | BeeNodeData>;
export type AppEdge = Edge;

export interface ContextMenuState {
  x: number;
  y: number;
}

export interface WebSocketMessage {
  event: string;
  data: unknown;
}
