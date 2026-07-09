import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { AdrRecord } from '../cil/types.js';
import type { ValiditySignal } from './types.js';

/** Decision vocabulary → npm package names that implement it. */
const TECH_PACKAGES: Record<string, string[]> = {
  redis: ['redis', 'ioredis', '@redis/client', 'node-redis'],
  jwt: ['jsonwebtoken', 'jose', 'passport-jwt', '@auth0/angular-jwt'],
  oauth: ['oauth', 'oauth2', 'passport-oauth2', 'openid-client'],
  postgres: ['pg', 'postgres', 'postgresql', '@prisma/client', 'prisma'],
  mysql: ['mysql', 'mysql2'],
  mongodb: ['mongodb', 'mongoose'],
  sqlite: ['sqlite3', 'better-sqlite3', '@libsql/client'],
  graphql: ['graphql', '@apollo/server', 'apollo-server', 'graphql-yoga'],
  mcp: ['@modelcontextprotocol/sdk', 'mcp'],
};

function extractTechTerms(text: string): string[] {
  const lower = text.toLowerCase();
  return Object.keys(TECH_PACKAGES).filter((term) => {
    const re = new RegExp(`\\b${term}\\b`, 'i');
    return re.test(lower);
  });
}

async function readWorkspaceDependencies(workspaceRoot: string): Promise<Set<string>> {
  const names = new Set<string>();
  const candidates = [
    'package.json',
    'packages/state-core/package.json',
    'packages/cli/package.json',
    'packages/mcp/package.json',
  ];

  for (const rel of candidates) {
    const full = path.join(workspaceRoot, rel);
    try {
      const raw = JSON.parse(await fs.readFile(full, 'utf8')) as Record<string, unknown>;
      for (const section of ['dependencies', 'devDependencies', 'optionalDependencies']) {
        const deps = raw[section];
        if (deps && typeof deps === 'object') {
          for (const name of Object.keys(deps as Record<string, string>)) {
            names.add(name.toLowerCase());
          }
        }
      }
    } catch {
      // skip missing manifests
    }
  }

  return names;
}

/** Detect dependency drift vs ADR technology choices. */
export async function scanDependencyValiditySignals(
  workspaceRoot: string,
  adr: AdrRecord,
): Promise<ValiditySignal[]> {
  if (adr.status === 'superseded' || adr.status === 'deprecated' || adr.status === 'rejected') {
    return [];
  }

  const terms = extractTechTerms(`${adr.title} ${adr.reason}`);
  if (!terms.length) {
    return [];
  }

  const installed = await readWorkspaceDependencies(workspaceRoot);
  if (!installed.size) {
    return [];
  }

  const signals: ValiditySignal[] = [];
  const now = new Date().toISOString();
  const adrText = `${adr.title} ${adr.reason}`.toLowerCase();

  for (const term of terms) {
    const packages = TECH_PACKAGES[term] ?? [];
    const hasPkg = packages.some((p) => installed.has(p.toLowerCase()));
    if (hasPkg) {
      continue;
    }

    const altInstalled = Object.entries(TECH_PACKAGES)
      .filter(([other]) => other !== term)
      .filter(([, pkgs]) => pkgs.some((p) => installed.has(p.toLowerCase())))
      .map(([other]) => other)
      .filter((other) => adrText.includes(other) === false);

    if (altInstalled.length) {
      signals.push({
        type: 'DEPENDENCY_CHANGE',
        detected_at: now,
        reason: `Decision emphasizes "${term}" but workspace uses ${altInstalled.slice(0, 2).join(', ')}`,
        severity: 'high',
        evidence: term,
        detail: `Referenced stack may have migrated away from ${term}`,
      });
    } else {
      signals.push({
        type: 'DEPENDENCY_REMOVAL',
        detected_at: now,
        reason: `Referenced technology "${term}" has no matching dependency in workspace manifests`,
        severity: 'medium',
        evidence: term,
        detail: 'Dependency may have been removed or decision predates current stack',
      });
    }
  }

  return signals.slice(0, 4);
}
