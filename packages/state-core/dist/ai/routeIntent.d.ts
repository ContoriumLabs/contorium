import { routeQuery, type RoutedQuery } from '../cil/queryRouter.js';
/**
 * Hybrid intent router — rule first, optional LLM fallback (优化.md).
 * Fact engines unchanged; only routing may use LLM.
 */
export declare function routeIntent(workspaceRoot: string, question: string): Promise<RoutedQuery>;
export { routeQuery };
//# sourceMappingURL=routeIntent.d.ts.map