import type { TimeTravelPerspective, TimeTravelResult } from './types.js';
export interface TimeTravelOptions {
    perspective?: TimeTravelPerspective;
}
/**
 * Time Travel Query — two perspectives:
 * - historical: what we knew ON that date
 * - retrospective: what we know NOW about that date (superseded ADRs annotated)
 */
export declare function queryTimeTravel(workspaceRoot: string, dateStr: string, options?: TimeTravelOptions): Promise<TimeTravelResult>;
//# sourceMappingURL=timeTravel.d.ts.map