import * as fs from 'node:fs/promises';
import * as path from 'node:path';
export async function readDashboardCognitiveInsights(workspaceRoot) {
    try {
        const raw = JSON.parse(await fs.readFile(path.join(workspaceRoot, '.contora/mcp/cognitive-insights.json'), 'utf8'));
        return raw;
    }
    catch {
        return undefined;
    }
}
