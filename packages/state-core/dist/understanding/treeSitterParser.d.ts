import type { FileExtraction } from './extractor.js';
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
export declare function parseFileWithAdapter(workspaceRoot: string, relFile: string, options?: ParseFileOptions): Promise<{
    extraction: FileExtraction;
    backend: ParseBackend;
} | undefined>;
/** In-memory incremental parse cache for IDE live edits. */
export declare class IncrementalParseCache {
    private readonly byFile;
    get(file: string): FileExtraction | undefined;
    set(file: string, extraction: FileExtraction): void;
    invalidate(file: string): void;
    clear(): void;
}
//# sourceMappingURL=treeSitterParser.d.ts.map