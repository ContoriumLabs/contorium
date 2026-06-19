import { truncate, type ColorFn } from './uiHelpers.js';

export function renderKeyHintLines(args: {
  injectionPending: boolean;
  useColor: boolean;
  width: number;
  view: 'compact' | 'expanded';
  hasGovernanceReview?: boolean;
}): string[] {
  const c = args.useColor;
  const dim = (s: string) => (c ? `\x1b[2m${s}\x1b[0m` : s);
  const yellow = (s: string) => (c ? `\x1b[33m${s}\x1b[0m` : s);
  const w = args.width;

  if (args.injectionPending) {
    return [
      truncate(yellow('[Enter/i] Inject context   [n] Skip'), w),
      truncate(
        dim(
          args.view === 'compact'
            ? '[space] Expand   [c] Copy   [q] Quit   ↑↓ Mode   Enter Apply'
            : '[space] Minimize   [c] Copy   [q] Quit   ↑↓ Mode   Enter Apply',
        ),
        w,
      ),
    ];
  }

  const copyLabel = args.hasGovernanceReview ? '[c] Export Governance' : '[c] Copy To AI';
  const toggle = args.view === 'compact' ? '[space] Expand' : '[space] Minimize';
  return [
    truncate(dim(`${copyLabel}   ${toggle}   [q] Quit`), w),
    truncate(dim('↑↓ Select Mode   Enter Apply'), w),
  ];
}
