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
export declare function isCodeFile(rel: string): boolean;
declare function nodeId(file: string, kind: string, name: string): string;
export { nodeId };
export declare function extractFile(workspaceRoot: string, relFile: string): Promise<FileExtraction | undefined>;
/** Parse in-memory source (IDE live edit / incremental path). */
export declare function extractFromSource(relFile: string, text: string): FileExtraction | undefined;
export declare function resolveRelativeImport(fromFile: string, importTarget: string): string | undefined;
export declare function symbolNamesByKind(extraction: FileExtraction, kind: 'function' | 'class'): string[];
//# sourceMappingURL=extractor.d.ts.map