import type { AdapterKind } from './types.js';

/** Tool adapter contract — adapters ingest; State Engine owns truth. */
export interface ContoriumAdapter {
  readonly kind: AdapterKind;
  /** Human-readable status for logs / MCP debug. */
  describe(): string;
}

export class IdeAdapter implements ContoriumAdapter {
  readonly kind = 'ide' as const;
  describe(): string {
    return 'IDE event streaming (Mode A)';
  }
}

export class McpAdapter implements ContoriumAdapter {
  readonly kind = 'mcp' as const;
  describe(): string {
    return 'MCP workspace scan + poll (Mode B)';
  }
}

export class CliAdapter implements ContoriumAdapter {
  readonly kind = 'cli' as const;
  describe(): string {
    return 'CLI scan command (Mode B)';
  }
}
