import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import type { AiModuleId, LlmConfig } from './types.js';

function cacheDir(workspaceRoot: string): string {
  return path.join(workspaceRoot, '.contora', 'cache', 'llm');
}

function cacheFile(workspaceRoot: string, module: AiModuleId, key: string): string {
  const hash = crypto.createHash('sha256').update(key).digest('hex').slice(0, 24);
  return path.join(cacheDir(workspaceRoot), module, `${hash}.json`);
}

interface CacheEntry {
  text: string;
  created_at: string;
  module: AiModuleId;
}

export async function readLlmCache(
  workspaceRoot: string,
  config: LlmConfig,
  module: AiModuleId,
  key: string,
): Promise<string | null> {
  if (!config.cache?.enabled) {
    return null;
  }
  const ttlDays = config.cache.ttl_days ?? 30;
  const file = cacheFile(workspaceRoot, module, key);
  try {
    const raw = await fs.readFile(file, 'utf8');
    const entry = JSON.parse(raw) as CacheEntry;
    const ageMs = Date.now() - new Date(entry.created_at).getTime();
    if (ageMs > ttlDays * 86400_000) {
      return null;
    }
    return entry.text;
  } catch {
    return null;
  }
}

export async function writeLlmCache(
  workspaceRoot: string,
  module: AiModuleId,
  key: string,
  text: string,
): Promise<void> {
  const file = cacheFile(workspaceRoot, module, key);
  await fs.mkdir(path.dirname(file), { recursive: true });
  const entry: CacheEntry = { text, created_at: new Date().toISOString(), module };
  await fs.writeFile(file, `${JSON.stringify(entry, null, 2)}\n`, 'utf8');
}
