/**
 * Type definitions for BuzyBeez MVP
 */

export interface BeeConfig {
  id: string;
  name: string;
  soul?: string; // Custom soul content, or use default
  model?: string; // claude-haiku-4-20250514 (default) or claude-sonnet-4-20250514
}

export interface BeeState {
  id: string;
  name: string;
  running: boolean;
  containerId?: string;
  startedAt?: string;
}

export interface SwarmConfig {
  id: string;
  name: string;
  bees: BeeConfig[];
  connections: Connection[];
}

export interface Connection {
  from: string; // bee id or 'human'
  to: string;   // bee id or 'human'
  bidirectional?: boolean; // If true, represents both directions (from->to and to->from)
}

export interface FileAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  path: string;  // Relative path in the data/files directory
}

export interface Mail {
  id: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  timestamp: string;
  metadata: {
    type: 'human' | 'agent' | 'system';
    priority?: 'low' | 'normal' | 'high';
    inReplyTo?: string;
  };
  status: 'queued' | 'processing' | 'delivered' | 'failed';
  attachments?: FileAttachment[];
}

export interface CanvasNode {
  id: string;
  type: 'bee' | 'human';
  position: { x: number; y: number };
  data: {
    label: string;
    beeId?: string;
    running?: boolean;
  };
}

export interface CanvasEdge {
  id: string;
  source: string;
  target: string;
  bidirectional?: boolean; // If true, edge has markers on both ends
}

// ==================== Skills System ====================

export interface SkillManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  owner: 'built-in' | string;  // 'built-in' or bee ID that created it

  // Content fields
  context?: string[];          // Paths to context files relative to skill dir
  scripts?: string[];          // Paths to executable scripts
  envVars?: string[];          // Required environment variable names
  mcpServers?: McpServerConfig[];

  // Dependency fields
  dependencies?: string[];     // Other skills this skill requires (e.g., "basic-tools@1.0.0")
  nodeVersion?: string;        // Minimum Node.js version
  systemPackages?: string[];   // System packages to install (apt)
}

export interface McpServerConfig {
  name: string;
  type: 'local' | 'remote';
  command?: string;            // For local: command to run
  args?: string[];             // For local: command arguments
  url?: string;                // For remote: server URL
}

export interface SkillTool {
  name: string;
  description: string;
  input_schema: object;
  implementation: 'builtin' | 'script';
  script?: string;             // Path to script for custom tools
}

export interface SkillRegistryEntry {
  id: string;
  versions: string[];
  latestVersion: string;
  owner: 'built-in' | string;
  usedBy: string[];            // Bee IDs using this skill
  registeredAt: string;
  updatedAt: string;
}

export interface SkillRegistry {
  skills: SkillRegistryEntry[];
}

export interface SkillValidationResult {
  valid: boolean;
  errors: string[];
}
