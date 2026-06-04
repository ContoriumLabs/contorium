import type { FileExtraction } from './extractor.js';
import { extractFile, extractFromSource, isCodeFile } from './extractor.js';
import { refineExtraction } from './symbolValidator.js';

export type ParseBackend = 'regex' | 'tree-sitter';

export interface ParseFileOptions {
  content?: string;
  /** Reserved for tree-sitter incremental parse (previous AST snapshot). */
  previous?: FileExtraction;
}

/**
 * Hybrid parser adapter (V3.1).
 * Default: regex fast path. Tree-sitter activates when `web-tree-sitter` is installed.
 */
export async function parseFileWithAdapter(
  workspaceRoot: string,
  relFile: string,
  options: ParseFileOptions = {},
): Promise<{ extraction: FileExtraction; backend: ParseBackend } | undefined> {
  const normalized = relFile.replace(/\\/g, '/');
  if (!isCodeFile(normalized)) {
    return undefined;
  }

  const ts = await tryTreeSitterParse(normalized, options.content, workspaceRoot);
  if (ts) {
    return { extraction: refineExtraction(ts), backend: 'tree-sitter' };
  }

  let raw: FileExtraction | undefined;
  if (options.content !== undefined) {
    raw = extractFromSource(normalized, options.content);
  } else {
    raw = await extractFile(workspaceRoot, normalized);
  }
  if (!raw) {
    return undefined;
  }
  return { extraction: refineExtraction(raw), backend: 'regex' };
}

async function tryTreeSitterParse(
  relFile: string,
  content: string | undefined,
  workspaceRoot: string,
): Promise<FileExtraction | undefined> {
  // V3.2: wire web-tree-sitter + language grammars here (optional peer dependency).
  // Until then, incremental live edits use regex extractFromSource via parseFileWithAdapter.
  void relFile;
  void content;
  void workspaceRoot;
  return undefined;
}

/** In-memory incremental parse cache for IDE live edits. */
export class IncrementalParseCache {
  private readonly byFile = new Map<string, FileExtraction>();

  get(file: string): FileExtraction | undefined {
    return this.byFile.get(file.replace(/\\/g, '/'));
  }

  set(file: string, extraction: FileExtraction): void {
    this.byFile.set(file.replace(/\\/g, '/'), extraction);
  }

  invalidate(file: string): void {
    this.byFile.delete(file.replace(/\\/g, '/'));
  }

  clear(): void {
    this.byFile.clear();
  }
}
