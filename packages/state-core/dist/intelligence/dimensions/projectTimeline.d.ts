import type { AdapterKind } from '../../types.js';
import type { EvolutionEventType, ProjectEvolutionEvent, ProjectEvolutionTimeline } from '../types.js';
export interface ProjectTimelineQuery {
    from?: number;
    to?: number;
    type?: EvolutionEventType;
    intent?: string;
}
export declare function readProjectEvolutionTimeline(workspaceRoot: string): Promise<ProjectEvolutionTimeline | null>;
export declare function queryProjectEvolutionTimeline(timeline: ProjectEvolutionTimeline, query?: ProjectTimelineQuery): ProjectEvolutionEvent[];
export declare function appendProjectEvolutionEvents(workspaceRoot: string, events: ProjectEvolutionEvent[]): Promise<ProjectEvolutionTimeline>;
export declare function makeEvolutionEvent(input: {
    event_type: EvolutionEventType;
    entity_id: string;
    before_snapshot?: Record<string, unknown>;
    after_snapshot?: Record<string, unknown>;
    trigger_source: AdapterKind | ProjectEvolutionEvent['trigger_source'];
    linked_intent?: string;
    linked_decision?: string;
    impact_summary?: string;
    timestamp?: number;
}): ProjectEvolutionEvent;
//# sourceMappingURL=projectTimeline.d.ts.map