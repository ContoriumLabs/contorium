import { type CognitiveModeState, type ContoriumMcpMode } from './types.js';
/** v1 had A=overlay B=core; v2 has A=core B=overlay — invert legacy values. */
export declare function migrateCognitiveMode(raw: CognitiveModeState): CognitiveModeState;
/** Default A = core runtime. Mode B enables cognitive overlay (includes A). */
export declare function readCognitiveMode(workspaceRoot: string): Promise<CognitiveModeState>;
export declare function isCognitiveOverlayEnabled(mode: ContoriumMcpMode): boolean;
export declare function writeCognitiveMode(workspaceRoot: string, mode: ContoriumMcpMode, source?: CognitiveModeState['source']): Promise<CognitiveModeState>;
