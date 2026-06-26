import type { CilIntent, HistoryRange } from './types.js';
export interface RoutedQuery {
    intent: CilIntent;
    topic?: string;
    range?: HistoryRange;
    perspective?: 'historical' | 'retrospective';
    raw: string;
}
/** Map natural language → structured CIL intent (Query Router). */
export declare function routeQuery(question: string): RoutedQuery;
//# sourceMappingURL=queryRouter.d.ts.map