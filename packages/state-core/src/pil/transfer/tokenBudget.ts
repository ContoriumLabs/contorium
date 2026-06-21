import { estimateTokens } from '../../governance/governanceReview.js';

/** Trim long text to roughly `budget` tokens (drop lines from the end). */
export function trimStringToTokenBudget(text: string, budget: number): string {
  if (budget <= 0 || estimateTokens(text) <= budget) {
    return text;
  }
  const lines = text.split('\n');
  let lo = 0;
  let hi = lines.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2);
    const candidate = lines.slice(0, mid).join('\n');
    if (estimateTokens(candidate) <= budget) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  if (lo <= 0) {
    return `${text.slice(0, Math.max(0, budget * 4 - 80))}\n…`;
  }
  return `${lines.slice(0, lo).join('\n')}\n\n<!-- trimmed to ~${budget} tokens -->`;
}
