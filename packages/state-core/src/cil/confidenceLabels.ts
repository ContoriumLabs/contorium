import type { FreshnessLabel } from './types.js';

/** Map numeric confidence + age into user-facing freshness labels. */
export function freshnessFromAge(isoDate: string | undefined, now = Date.now()): FreshnessLabel {
  if (!isoDate) {
    return 'unknown';
  }
  const ts = Date.parse(isoDate);
  if (!Number.isFinite(ts)) {
    return 'unknown';
  }
  const days = (now - ts) / (1000 * 60 * 60 * 24);
  if (days < 7) {
    return 'fresh';
  }
  if (days < 30) {
    return 'verified';
  }
  if (days < 90) {
    return 'stale';
  }
  return 'unknown';
}

export function freshnessLabelText(label: FreshnessLabel): string {
  switch (label) {
    case 'fresh':
      return 'Fresh';
    case 'verified':
      return 'Verified';
    case 'stale':
      return 'Potentially stale';
    case 'unknown':
      return 'Unknown';
  }
}

export function riskFromReversibility(rev?: string): 'low' | 'medium' | 'high' {
  if (rev === 'low') {
    return 'high';
  }
  if (rev === 'medium') {
    return 'medium';
  }
  return 'low';
}
