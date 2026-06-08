import * as fs from 'node:fs/promises';
import * as path from 'node:path';

const CODE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py']);
/** Files that should appear in change/handoff artifacts (includes static web assets). */
const TRACKABLE_EXT = new Set([
  ...CODE_EXT,
  '.html',
  '.htm',
  '.css',
  '.scss',
  '.md',
  '.json',
  '.yaml',
  '.yml',
  '.vue',
  '.svelte',
]);
const CALL_KEYWORDS = new Set([
  'if', 'for', 'while', 'switch', 'catch', 'return', 'new', 'typeof', 'instanceof', 'function',
  'class', 'import', 'export', 'await', 'async', 'throw', 'delete', 'void', 'super', 'this',
]);

export interface ExtractedSymbol {
  kind: 'function' | 'class' | 'import';
  name: string;
  line: number;
  importTarget?: string;
}

export interface FileExtraction {
  file: string;
  symbols: ExtractedSymbol[];
  /** Direct call targets detected in this file (same-file or imported names). */
  calls: string[];
}

function norm(rel: string): string {
  return rel.replace(/\\/g, '/');
}

export function isCodeFile(rel: string): boolean {
  const ext = path.extname(rel).toLowerCase();
  return CODE_EXT.has(ext);
}

export function isTrackableFile(rel: string): boolean {
  const ext = path.extname(rel).toLowerCase();
  return TRACKABLE_EXT.has(ext);
}

function nodeId(file: string, kind: string, name: string): string {
  return `${norm(file)}::${kind}::${name}`;
}

export { nodeId };

function extractTsJs(lines: string[]): { symbols: ExtractedSymbol[]; calls: string[] } {
  const symbols: ExtractedSymbol[] = [];
  const calls = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const ln = i + 1;

    const fnMatch =
      line.match(/^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/) ??
      line.match(/^\s*(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(/) ??
      line.match(/^\s*(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?function\b/);
    if (fnMatch?.[1]) {
      symbols.push({ kind: 'function', name: fnMatch[1], line: ln });
    }

    const classMatch = line.match(/^\s*(?:export\s+)?class\s+([A-Za-z_$][\w$]*)/);
    if (classMatch?.[1]) {
      symbols.push({ kind: 'class', name: classMatch[1], line: ln });
    }

    const importFrom = line.match(/^\s*import\s+(?:[\w*{}\s,]+?\s+from\s+)?['"]([^'"]+)['"]/);
    if (importFrom?.[1]) {
      symbols.push({ kind: 'import', name: importFrom[1], line: ln, importTarget: importFrom[1] });
    }
    const importSide = line.match(/^\s*import\s+['"]([^'"]+)['"]/);
    if (importSide?.[1] && !importFrom) {
      symbols.push({ kind: 'import', name: importSide[1], line: ln, importTarget: importSide[1] });
    }

    for (const m of line.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)) {
      const name = m[1]!;
      if (!CALL_KEYWORDS.has(name)) {
        calls.add(name);
      }
    }
  }

  return { symbols, calls: [...calls] };
}

function extractPython(lines: string[]): { symbols: ExtractedSymbol[]; calls: string[] } {
  const symbols: ExtractedSymbol[] = [];
  const calls = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const ln = i + 1;

    const defMatch = line.match(/^\s*(?:async\s+)?def\s+([A-Za-z_][\w]*)\s*\(/);
    if (defMatch?.[1]) {
      symbols.push({ kind: 'function', name: defMatch[1], line: ln });
    }

    const classMatch = line.match(/^\s*class\s+([A-Za-z_][\w]*)\s*[(:]/);
    if (classMatch?.[1]) {
      symbols.push({ kind: 'class', name: classMatch[1], line: ln });
    }

    const importMatch = line.match(/^\s*(?:from\s+(\S+)\s+import|import\s+(\S+))/);
    if (importMatch) {
      const target = (importMatch[1] ?? importMatch[2] ?? '').split(',')[0]!.trim();
      if (target) {
        symbols.push({ kind: 'import', name: target, line: ln, importTarget: target });
      }
    }

    for (const m of line.matchAll(/\b([A-Za-z_][\w]*)\s*\(/g)) {
      const name = m[1]!;
      if (!CALL_KEYWORDS.has(name) && name !== 'def' && name !== 'class') {
        calls.add(name);
      }
    }
  }

  return { symbols, calls: [...calls] };
}

export async function extractFile(
  workspaceRoot: string,
  relFile: string,
): Promise<FileExtraction | undefined> {
  const normalized = norm(relFile);
  if (!isCodeFile(normalized)) {
    return undefined;
  }
  const abs = path.join(workspaceRoot, normalized);
  let text: string;
  try {
    text = await fs.readFile(abs, 'utf8');
  } catch {
    return undefined;
  }
  if (text.length > 512_000) {
    return undefined;
  }
  const lines = text.split('\n');
  const ext = path.extname(normalized).toLowerCase();
  const parsed = ext === '.py' ? extractPython(lines) : extractTsJs(lines);
  return { file: normalized, symbols: parsed.symbols, calls: parsed.calls };
}

/** Parse in-memory source (IDE live edit / incremental path). */
export function extractFromSource(relFile: string, text: string): FileExtraction | undefined {
  const normalized = norm(relFile);
  if (!isCodeFile(normalized) || text.length > 512_000) {
    return undefined;
  }
  const lines = text.split('\n');
  const ext = path.extname(normalized).toLowerCase();
  const parsed = ext === '.py' ? extractPython(lines) : extractTsJs(lines);
  return { file: normalized, symbols: parsed.symbols, calls: parsed.calls };
}

export function resolveRelativeImport(fromFile: string, importTarget: string): string | undefined {
  if (!importTarget.startsWith('.')) {
    return undefined;
  }
  const base = path.dirname(fromFile);
  const joined = norm(path.join(base, importTarget));
  const candidates = [
    joined,
    `${joined}.ts`,
    `${joined}.tsx`,
    `${joined}.js`,
    `${joined}.jsx`,
    `${joined}/index.ts`,
    `${joined}/index.js`,
  ];
  return candidates[0];
}

export function symbolNamesByKind(
  extraction: FileExtraction,
  kind: 'function' | 'class',
): string[] {
  return extraction.symbols.filter((s) => s.kind === kind).map((s) => s.name);
}
