import * as fs from 'node:fs/promises';
import * as path from 'node:path';

/** Decision vocabulary → npm package names that implement it. */
export const TECH_TERM_TO_PACKAGES: Record<string, string[]> = {
  redis: ['redis', 'ioredis', '@redis/client', 'node-redis'],
  jwt: ['jsonwebtoken', 'jose', 'passport-jwt', '@auth0/angular-jwt'],
  oauth: ['oauth', 'oauth2', 'passport-oauth2', 'openid-client'],
  postgres: ['pg', 'postgres', 'postgresql', '@prisma/client', 'prisma'],
  mysql: ['mysql', 'mysql2'],
  mongodb: ['mongodb', 'mongoose'],
  sqlite: ['sqlite3', 'better-sqlite3', '@libsql/client'],
  graphql: ['graphql', '@apollo/server', 'apollo-server', 'graphql-yoga'],
  mcp: ['@modelcontextprotocol/sdk', 'mcp'],
  kafka: ['kafkajs', 'node-rdkafka'],
  rabbitmq: ['amqplib', 'amqp-connection-manager'],
};

const DEFAULT_MANIFEST_CANDIDATES = [
  'package.json',
  'packages/state-core/package.json',
  'packages/cli/package.json',
  'packages/mcp/package.json',
  'packages/runtime/package.json',
];

export function extractTechTerms(text: string): string[] {
  const lower = text.toLowerCase();
  return Object.keys(TECH_TERM_TO_PACKAGES).filter((term) => {
    const re = new RegExp(`\\b${term}\\b`, 'i');
    return re.test(lower);
  });
}

export async function collectWorkspaceDependencyNames(
  workspaceRoot: string,
  extraManifests: string[] = [],
): Promise<Set<string>> {
  const names = new Set<string>();
  const candidates = [...new Set([...DEFAULT_MANIFEST_CANDIDATES, ...extraManifests])];

  for (const rel of candidates) {
    const full = path.join(workspaceRoot, rel);
    try {
      const raw = JSON.parse(await fs.readFile(full, 'utf8')) as Record<string, unknown>;
      for (const section of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
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

export function detectDependencyManifestChanges(
  previous: ReadonlySet<string>,
  current: ReadonlySet<string>,
): { added: string[]; removed: string[] } {
  const added: string[] = [];
  const removed: string[] = [];
  for (const p of current) {
    if (!previous.has(p)) {
      added.push(p);
    }
  }
  for (const p of previous) {
    if (!current.has(p)) {
      removed.push(p);
    }
  }
  return { added, removed };
}

export function techTermForPackage(pkgName: string): string | undefined {
  const lower = pkgName.toLowerCase();
  for (const [term, pkgs] of Object.entries(TECH_TERM_TO_PACKAGES)) {
    if (pkgs.some((p) => p.toLowerCase() === lower)) {
      return term;
    }
  }
  return undefined;
}
