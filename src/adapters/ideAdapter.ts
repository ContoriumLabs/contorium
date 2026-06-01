/**
 * IDE Adapter (v2.2) — file watch / editor events feed EventStore; State Engine owns truth.
 * Implementation: scanners in extension.ts + cognitionPipeline (Mode A).
 */
export const IDE_ADAPTER_LAYER = 'ide-event-stream' as const;

export function describeIdeAdapter(): string {
  return 'IDE event streaming (Mode A: event-driven)';
}
