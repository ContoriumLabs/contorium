import type { FreshnessLabel } from './types.js';
/** Map numeric confidence + age into user-facing freshness labels. */
export declare function freshnessFromAge(isoDate: string | undefined, now?: number): FreshnessLabel;
export declare function freshnessLabelText(label: FreshnessLabel): string;
export declare function riskFromReversibility(rev?: string): 'low' | 'medium' | 'high';
//# sourceMappingURL=confidenceLabels.d.ts.map