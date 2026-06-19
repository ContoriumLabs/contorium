import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { Constitution, Identity, TruthLayer } from './types.js';

async function readProjectMeta(root: string): Promise<{ name: string; purpose?: string }> {
  const fallback = path.basename(root);
  try {
    const text = await fs.readFile(path.join(root, 'package.json'), 'utf8');
    const pkg = JSON.parse(text) as { name?: string; displayName?: string; description?: string };
    return {
      name: pkg.displayName ?? pkg.name ?? fallback,
      purpose: typeof pkg.description === 'string' ? pkg.description : undefined,
    };
  } catch {
    return { name: fallback };
  }
}

export function defaultConstitution(): Constitution {
  return {
    version: 1,
    principles: [
      'Do not modify core architecture without explicit approval',
      'Never introduce hardcoded production values without marking them in truth.json',
      'All mock data must be explicitly marked',
      'All AI changes must be traceable',
    ],
    protected_paths: [
      { path: 'src/core/', level: 'critical' },
      { path: 'packages/state-core/', level: 'high' },
      { path: 'packages/state-core/src/understanding/knowledgeGraph/', level: 'critical' },
    ],
    forbidden_actions: ['delete_database_schema', 'overwrite_core_logic'],
    forbidden_patterns: [
      { type: 'filesystem', pattern: 'rm -rf' },
      { type: 'database', pattern: 'drop table' },
      { type: 'database', pattern: 'drop database' },
      { type: 'database', pattern: 'truncate table' },
      { type: 'security', pattern: 'delete database' },
    ],
    ai_rules: [
      'Always check truth layer before modifying business logic',
      'Validate intent alignment before execution',
      'Review change severity on protected paths — not every edit is high risk',
    ],
  };
}

export function defaultTruthLayer(): TruthLayer {
  return {
    version: 1,
    mock_data: ['src/mock/**', '**/__mocks__/**', '**/*.mock.ts', '**/*.mock.js'],
    hardcoded_values: [],
    production_flags: [],
    sensitive_constants: [
      'PRICE_RATE',
      'TAX_RATE',
      'COMMISSION_RATE',
      'INTEREST_RATE',
      'FEE_RATE',
    ],
    business_rules: [],
  };
}

export async function defaultIdentity(workspaceRoot: string): Promise<Identity> {
  const meta = await readProjectMeta(workspaceRoot);
  return {
    version: 1,
    name: meta.name,
    purpose: meta.purpose ?? 'Software project with AI-assisted development',
    current_focus: [],
    non_goals: ['Not a model company', 'Not an IDE replacement'],
  };
}
