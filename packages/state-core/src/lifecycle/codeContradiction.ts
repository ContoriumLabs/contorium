import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { AdrRecord } from '../cil/types.js';
import { LIFECYCLE_POLICY } from './policy.js';

export interface CodeDecisionTension {
  decision_id: string;
  decision_title: string;
  decision_term: string;
  code_signal: string;
  detail: string;
  confidence: number;
  evidence_path?: string;
  matched_decision_term?: string;
  matched_code_term?: string;
}

/** Heuristic pairs — decision vocabulary vs implementation signals in paths/events. */
const TENSION_PAIRS: Array<{ decision: RegExp; code: RegExp; label: string }> = [
  { decision: /\bjwt\b/i, code: /\boauth2?\b/i, label: 'JWT vs OAuth2' },
  { decision: /\boauth2?\b/i, code: /\bjwt\b/i, label: 'OAuth2 vs JWT' },
  { decision: /\bredis\b/i, code: /\b(valkey|dragonfly|memcached)\b/i, label: 'Redis vs alternate store' },
  { decision: /\bmcp\b/i, code: /\b(rest|graphql)\b/i, label: 'MCP vs REST/GraphQL' },
  { decision: /\bmonolith\b/i, code: /\bmicroservice/i, label: 'Monolith vs microservices' },
  { decision: /\bsqlite\b/i, code: /\b(postgres|mysql|mongodb)\b/i, label: 'SQLite vs server DB' },
];

const TEXT_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.md',
  '.yml',
  '.yaml',
  '.toml',
  '.env',
  '.txt',
]);

const STOP_WORDS = new Set([
  'that',
  'this',
  'with',
  'from',
  'have',
  'will',
  'been',
  'were',
  'they',
  'their',
  'about',
  'which',
  'would',
  'should',
  'could',
  'using',
  'because',
  'decision',
  'project',
  'approach',
  'instead',
  'rather',
]);

/** Decision vocabulary → alternate implementation signals in code bodies. */
const KEYWORD_OPPOSING: Record<string, { pattern: RegExp; label: string }[]> = {
  jwt: [
    { pattern: /\boauth2?\b/i, label: 'OAuth2' },
    { pattern: /\bsession[\s_-]?cookie/i, label: 'session cookies' },
  ],
  oauth: [{ pattern: /\bjwt\b/i, label: 'JWT tokens' }],
  redis: [
    { pattern: /\b(valkey|dragonfly|memcached)\b/i, label: 'alternate cache store' },
  ],
  sqlite: [{ pattern: /\b(postgres|postgresql|mysql|mongodb)\b/i, label: 'server database' }],
  monolith: [{ pattern: /\bmicroservice/i, label: 'microservices' }],
  microservice: [{ pattern: /\bmonolith/i, label: 'monolith' }],
  mcp: [{ pattern: /\b(rest|graphql)\b/i, label: 'REST/GraphQL API' }],
  graphql: [{ pattern: /\brest\b/i, label: 'REST API' }],
  rest: [{ pattern: /\bgraphql\b/i, label: 'GraphQL' }],
};

function extractDecisionKeywords(adrText: string): string[] {
  const tokens = new Set<string>();
  for (const ac of adrText.match(/\b[A-Z]{2,8}\b/g) ?? []) {
    tokens.add(ac.toLowerCase());
  }
  for (const w of adrText.toLowerCase().match(/\b[a-z][a-z0-9_-]{3,}\b/g) ?? []) {
    if (!STOP_WORDS.has(w)) {
      tokens.add(w);
    }
  }
  return [...tokens].slice(0, 16);
}

function pushTension(
  out: CodeDecisionTension[],
  seen: Set<string>,
  adr: AdrRecord,
  hit: { path: string; text: string },
  detail: string,
  decisionTerm: string,
  codeTerm: string,
  confidence: number,
): void {
  const key = `${adr.id}|${decisionTerm}|${codeTerm}|${hit.path}`;
  if (seen.has(key)) {
    return;
  }
  seen.add(key);
  out.push({
    decision_id: adr.id,
    decision_title: adr.title,
    decision_term: decisionTerm,
    code_signal: hit.path || 'recent changes',
    detail,
    confidence,
    evidence_path: hit.path,
    matched_decision_term: decisionTerm,
    matched_code_term: codeTerm,
  });
}

function normalizedRelPath(workspaceRoot: string, candidate: string): string | undefined {
  const clean = candidate.trim();
  if (!clean || clean.includes('\0')) {
    return undefined;
  }
  const resolved = path.resolve(workspaceRoot, clean);
  const root = path.resolve(workspaceRoot);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    return undefined;
  }
  return resolved;
}

async function readBoundedText(workspaceRoot: string, relPath: string): Promise<string | undefined> {
  const full = normalizedRelPath(workspaceRoot, relPath);
  if (!full) {
    return undefined;
  }
  const ext = path.extname(full).toLowerCase();
  if (ext && !TEXT_EXTENSIONS.has(ext)) {
    return undefined;
  }
  try {
    const st = await fs.stat(full);
    if (!st.isFile() || st.size > LIFECYCLE_POLICY.codeScanMaxBytesPerFile) {
      return undefined;
    }
    return await fs.readFile(full, 'utf8');
  } catch {
    return undefined;
  }
}

async function buildCodeSignalText(
  recentPaths: string[],
  workspaceRoot?: string,
): Promise<Array<{ path: string; text: string }>> {
  const unique = [...new Set(recentPaths.filter(Boolean))].slice(0, LIFECYCLE_POLICY.codeScanMaxFiles);
  const entries = unique.map((p) => ({ path: p, text: p }));
  if (!workspaceRoot) {
    return entries;
  }
  for (const entry of entries) {
    const text = await readBoundedText(workspaceRoot, entry.path);
    if (text) {
      entry.text = `${entry.path}\n${text}`;
    }
  }
  return entries;
}

/** Scan recent file paths for signals that tension with accepted ADR decisions. */
export async function detectCodeDecisionTensions(
  adrs: AdrRecord[],
  recentPaths: string[],
  workspaceRoot?: string,
): Promise<CodeDecisionTension[]> {
  const active = adrs.filter(
    (a) => a.status === 'accepted' || a.status === 'implemented' || a.status === 'proposed',
  );
  const entries = await buildCodeSignalText(recentPaths, workspaceRoot);
  if (!entries.some((e) => e.text.trim())) {
    return [];
  }

  const out: CodeDecisionTension[] = [];
  const seen = new Set<string>();

  for (const adr of active) {
    const adrText = `${adr.title} ${adr.reason}`.toLowerCase();
    const keywords = extractDecisionKeywords(`${adr.title} ${adr.reason}`);

    for (const pair of TENSION_PAIRS) {
      if (!pair.decision.test(adrText)) {
        continue;
      }
      const hit = entries.find((entry) => pair.code.test(entry.text.toLowerCase()));
      if (!hit) {
        continue;
      }
      const [decisionTerm, codeTerm] = pair.label.split(' vs ');
      pushTension(
        out,
        seen,
        adr,
        hit,
        `Decision mentions ${decisionTerm ?? adr.title}; codebase shows ${codeTerm ?? 'alternate approach'} (${hit.path})`,
        decisionTerm ?? adr.title,
        codeTerm ?? 'alternate approach',
        workspaceRoot ? 0.82 : 0.72,
      );
    }

    for (const keyword of keywords) {
      const opposites = KEYWORD_OPPOSING[keyword];
      if (!opposites?.length) {
        continue;
      }
      if (!adrText.includes(keyword)) {
        continue;
      }
      for (const opp of opposites) {
        const hit = entries.find((entry) => opp.pattern.test(entry.text));
        if (!hit) {
          continue;
        }
        pushTension(
          out,
          seen,
          adr,
          hit,
          `ADR emphasizes "${keyword}" but code references ${opp.label} (${hit.path})`,
          keyword,
          opp.label,
          workspaceRoot ? 0.78 : 0.68,
        );
      }
    }

    for (const hit of entries) {
      if (!hit.text.includes('\n')) {
        continue;
      }
      const body = hit.text.slice(hit.path.length).toLowerCase();
      const strongKeywords = keywords.filter((k) => k.length >= 5 && adrText.includes(k));
      const missingInCode = strongKeywords.filter((k) => !body.includes(k));
      if (strongKeywords.length >= 2 && missingInCode.length === strongKeywords.length) {
        pushTension(
          out,
          seen,
          adr,
          hit,
          `Decision terms (${strongKeywords.slice(0, 3).join(', ')}) absent from ${hit.path} while alternate stack signals present`,
          strongKeywords[0] ?? adr.title,
          'implementation drift',
          workspaceRoot ? 0.65 : 0.55,
        );
      }
    }
  }

  return out.slice(0, 16);
}
