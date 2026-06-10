import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export interface DashboardCognitiveInsights {
  detected_intent?: { intent: string; confidence: number };
  suggested_skills?: { name: string; reason?: string }[];
  suggested_models?: { mode: string; reason?: string }[];
  cognitive_overlay_enabled?: boolean;
}

export async function readDashboardCognitiveInsights(
  workspaceRoot: string,
): Promise<DashboardCognitiveInsights | undefined> {
  try {
    const raw = JSON.parse(
      await fs.readFile(path.join(workspaceRoot, '.contora/mcp/cognitive-insights.json'), 'utf8'),
    ) as DashboardCognitiveInsights;
    return raw;
  } catch {
    return undefined;
  }
}
