import type { ExtractedSymbol, FileExtraction } from './extractor.js';
/**
 * Hybrid precision layer (V3.1) — post-filters regex noise.
 * Tree-sitter can replace/enhance this module later without changing the pipeline.
 */
export declare function validateSymbols(symbols: ExtractedSymbol[]): ExtractedSymbol[];
export declare function validateCalls(calls: string[], symbols: ExtractedSymbol[]): string[];
export declare function refineExtraction(ext: FileExtraction): FileExtraction;
//# sourceMappingURL=symbolValidator.d.ts.map