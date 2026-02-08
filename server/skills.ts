/**
 * BuzyBeez Skills Registry
 *
 * Manages skill registration, validation, and loading.
 * Skills are composable capability packs that define what beez can do.
 */

import fs from 'fs/promises';
import path from 'path';
import type {
  SkillManifest,
  SkillRegistry,
  SkillRegistryEntry,
  SkillValidationResult,
  SkillTool
} from './types.js';

export class SkillsRegistry {
  private dataDir: string;
  private skillsDir: string;
  private registryPath: string;
  private registry: SkillRegistry = { skills: [] };

  constructor(dataDir: string) {
    this.dataDir = dataDir;
    this.skillsDir = path.join(dataDir, 'skills');
    this.registryPath = path.join(this.skillsDir, 'index.json');
  }

  /**
   * Initialize the skills registry
   */
  async initialize(): Promise<void> {
    // Ensure skills directory exists
    await fs.mkdir(this.skillsDir, { recursive: true });
    await fs.mkdir(path.join(this.skillsDir, 'built-in'), { recursive: true });
    await fs.mkdir(path.join(this.skillsDir, 'custom'), { recursive: true });

    // Load or create registry
    try {
      const data = await fs.readFile(this.registryPath, 'utf-8');
      this.registry = JSON.parse(data);
    } catch {
      this.registry = { skills: [] };
      await this.saveRegistry();
    }

    console.log(`Skills registry initialized with ${this.registry.skills.length} skills`);
  }

  /**
   * Save the registry to disk
   */
  private async saveRegistry(): Promise<void> {
    await fs.writeFile(this.registryPath, JSON.stringify(this.registry, null, 2));
  }

  /**
   * List all registered skills
   */
  listSkills(): SkillRegistryEntry[] {
    return this.registry.skills;
  }

  /**
   * Get a specific skill by ID
   */
  getSkill(id: string): SkillRegistryEntry | undefined {
    return this.registry.skills.find(s => s.id === id);
  }

  /**
   * Get the manifest for a specific skill version
   */
  async getSkillManifest(id: string, version?: string): Promise<SkillManifest | null> {
    const entry = this.getSkill(id);
    if (!entry) return null;

    const resolvedVersion = version || entry.latestVersion;
    if (!entry.versions.includes(resolvedVersion)) return null;

    const manifestPath = path.join(
      this.skillsDir,
      entry.owner === 'built-in' ? 'built-in' : 'custom',
      `${id}@${resolvedVersion}`,
      'manifest.json'
    );

    try {
      const data = await fs.readFile(manifestPath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  /**
   * Get the full path to a skill directory
   */
  getSkillPath(id: string, version?: string): string | null {
    const entry = this.getSkill(id);
    if (!entry) return null;

    const resolvedVersion = version || entry.latestVersion;
    return path.join(
      this.skillsDir,
      entry.owner === 'built-in' ? 'built-in' : 'custom',
      `${id}@${resolvedVersion}`
    );
  }

  /**
   * Validate a skill manifest
   */
  async validateManifest(manifest: unknown, skillDir: string): Promise<SkillValidationResult> {
    const errors: string[] = [];
    const m = manifest as Record<string, unknown>;

    // Required fields
    if (!m.id || typeof m.id !== 'string') {
      errors.push('Missing or invalid id');
    } else if (!/^[a-z0-9-]+$/.test(m.id)) {
      errors.push('Invalid id format (lowercase letters, numbers, and hyphens only)');
    }

    if (!m.name || typeof m.name !== 'string') {
      errors.push('Missing or invalid name');
    }

    if (!m.version || typeof m.version !== 'string') {
      errors.push('Missing or invalid version');
    } else if (!/^\d+\.\d+\.\d+$/.test(m.version)) {
      errors.push('Invalid version format (must be semver: X.Y.Z)');
    }

    if (!m.description || typeof m.description !== 'string') {
      errors.push('Missing or invalid description');
    }

    // Validate context files exist
    if (Array.isArray(m.context)) {
      for (const contextPath of m.context) {
        const fullPath = path.join(skillDir, contextPath as string);
        try {
          await fs.access(fullPath);
        } catch {
          errors.push(`Context file not found: ${contextPath}`);
        }
      }
    }

    // Validate scripts exist
    if (Array.isArray(m.scripts)) {
      for (const scriptPath of m.scripts) {
        const fullPath = path.join(skillDir, scriptPath as string);
        try {
          await fs.access(fullPath);
        } catch {
          errors.push(`Script not found: ${scriptPath}`);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Register a new skill or update an existing one
   */
  async registerSkill(manifest: SkillManifest, skillDir: string): Promise<SkillRegistryEntry> {
    // Validate manifest
    const validation = await this.validateManifest(manifest, skillDir);
    if (!validation.valid) {
      throw new Error(`Invalid manifest: ${validation.errors.join(', ')}`);
    }

    const now = new Date().toISOString();
    const isBuiltIn = manifest.owner === 'built-in';
    const targetDir = path.join(
      this.skillsDir,
      isBuiltIn ? 'built-in' : 'custom',
      `${manifest.id}@${manifest.version}`
    );

    // Copy skill files to registry location (if not already there)
    if (skillDir !== targetDir) {
      await fs.mkdir(targetDir, { recursive: true });
      await this.copyDirectory(skillDir, targetDir);
    }

    // Update or create registry entry
    let entry = this.registry.skills.find(s => s.id === manifest.id);

    if (entry) {
      // Update existing entry
      if (!entry.versions.includes(manifest.version)) {
        entry.versions.push(manifest.version);
        entry.versions.sort((a, b) => this.compareVersions(b, a)); // Sort descending
      }
      entry.latestVersion = entry.versions[0];
      entry.updatedAt = now;
    } else {
      // Create new entry
      entry = {
        id: manifest.id,
        versions: [manifest.version],
        latestVersion: manifest.version,
        owner: manifest.owner,
        usedBy: [],
        registeredAt: now,
        updatedAt: now
      };
      this.registry.skills.push(entry);
    }

    await this.saveRegistry();
    return entry;
  }

  /**
   * Remove a skill from the registry
   */
  async removeSkill(id: string, version?: string): Promise<void> {
    const entry = this.getSkill(id);
    if (!entry) {
      throw new Error(`Skill not found: ${id}`);
    }

    // Check if skill is in use
    if (entry.usedBy.length > 0) {
      throw new Error(`Cannot remove skill ${id}: in use by ${entry.usedBy.join(', ')}`);
    }

    if (version) {
      // Remove specific version
      entry.versions = entry.versions.filter(v => v !== version);

      if (entry.versions.length === 0) {
        // Remove entire skill if no versions left
        this.registry.skills = this.registry.skills.filter(s => s.id !== id);
      } else {
        // Update latest version
        entry.latestVersion = entry.versions[0];
        entry.updatedAt = new Date().toISOString();
      }

      // Remove version directory
      const skillPath = path.join(
        this.skillsDir,
        entry.owner === 'built-in' ? 'built-in' : 'custom',
        `${id}@${version}`
      );
      await fs.rm(skillPath, { recursive: true, force: true });
    } else {
      // Remove all versions
      for (const v of entry.versions) {
        const skillPath = path.join(
          this.skillsDir,
          entry.owner === 'built-in' ? 'built-in' : 'custom',
          `${id}@${v}`
        );
        await fs.rm(skillPath, { recursive: true, force: true });
      }
      this.registry.skills = this.registry.skills.filter(s => s.id !== id);
    }

    await this.saveRegistry();
  }

  /**
   * Mark a skill as being used by a bee
   */
  async addSkillUser(skillId: string, beeId: string): Promise<void> {
    const entry = this.getSkill(skillId);
    if (!entry) {
      throw new Error(`Skill not found: ${skillId}`);
    }

    if (!entry.usedBy.includes(beeId)) {
      entry.usedBy.push(beeId);
      entry.updatedAt = new Date().toISOString();
      await this.saveRegistry();
    }
  }

  /**
   * Remove a bee from a skill's users
   */
  async removeSkillUser(skillId: string, beeId: string): Promise<void> {
    const entry = this.getSkill(skillId);
    if (!entry) return;

    entry.usedBy = entry.usedBy.filter(id => id !== beeId);
    entry.updatedAt = new Date().toISOString();
    await this.saveRegistry();
  }

  /**
   * Load context files for a skill
   */
  async loadSkillContext(id: string, version?: string): Promise<string> {
    const manifest = await this.getSkillManifest(id, version);
    if (!manifest) return '';

    const skillPath = this.getSkillPath(id, version);
    if (!skillPath) return '';

    const contextParts: string[] = [];

    if (manifest.context) {
      for (const contextFile of manifest.context) {
        try {
          const content = await fs.readFile(path.join(skillPath, contextFile), 'utf-8');
          contextParts.push(content);
        } catch {
          console.warn(`Could not load context file: ${contextFile}`);
        }
      }
    }

    return contextParts.join('\n\n---\n\n');
  }

  /**
   * Get tools defined by a skill (from scripts)
   */
  async getSkillTools(id: string, version?: string): Promise<SkillTool[]> {
    const manifest = await this.getSkillManifest(id, version);
    if (!manifest || !manifest.scripts) return [];

    const tools: SkillTool[] = [];
    const skillPath = this.getSkillPath(id, version);
    if (!skillPath) return [];

    for (const scriptPath of manifest.scripts) {
      const scriptName = path.basename(scriptPath, path.extname(scriptPath));
      const fullPath = path.join(skillPath, scriptPath);

      // Try to extract description from script (look for a special comment)
      let description = `Execute ${scriptName} script`;
      try {
        const content = await fs.readFile(fullPath, 'utf-8');
        const descMatch = content.match(/@description\s+(.+)/);
        if (descMatch) {
          description = descMatch[1].trim();
        }
      } catch {
        // Use default description
      }

      tools.push({
        name: scriptName.replace(/-/g, '_'),
        description,
        input_schema: {
          type: 'object',
          properties: {
            args: {
              type: 'object',
              description: 'Arguments to pass to the script'
            }
          }
        },
        implementation: 'script',
        script: fullPath
      });
    }

    return tools;
  }

  /**
   * Resolve skill dependencies
   */
  async resolveDependencies(skillIds: string[]): Promise<string[]> {
    const resolved = new Set<string>();
    const toResolve = [...skillIds];

    while (toResolve.length > 0) {
      const skillRef = toResolve.pop()!;
      if (resolved.has(skillRef)) continue;

      // Parse skill reference (e.g., "basic-tools@1.0.0" or "basic-tools")
      const [id, version] = skillRef.includes('@') ? skillRef.split('@') : [skillRef, undefined];

      const manifest = await this.getSkillManifest(id, version);
      if (!manifest) {
        throw new Error(`Skill not found: ${skillRef}`);
      }

      resolved.add(`${manifest.id}@${manifest.version}`);

      // Add dependencies
      if (manifest.dependencies) {
        for (const dep of manifest.dependencies) {
          if (!resolved.has(dep)) {
            toResolve.push(dep);
          }
        }
      }
    }

    return Array.from(resolved);
  }

  // Utility methods

  private compareVersions(a: string, b: string): number {
    const partsA = a.split('.').map(Number);
    const partsB = b.split('.').map(Number);

    for (let i = 0; i < 3; i++) {
      if (partsA[i] > partsB[i]) return 1;
      if (partsA[i] < partsB[i]) return -1;
    }
    return 0;
  }

  private async copyDirectory(src: string, dest: string): Promise<void> {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }
}
