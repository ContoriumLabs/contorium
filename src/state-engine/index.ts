export { extractTaskAnchor } from './taskAnchor';
export { deriveNextActionsFromGaps } from './gapAnalysis';
export { normalizeProjectBuiltState, filterWeakInferenceLines } from './normalization';
export { detectStateConflicts, formatConflictsMarkdown } from './conflictDetector';
export type { DetectConflictsInput } from './conflictDetector';
export { formatTaggedEntry, formatTaggedList, parseSourceFromTaggedLine, stripSourceSuffix } from './sourcing';
export {
  readConflictsArtifact,
  writeConflictsArtifact,
  deleteConflictsArtifact,
  parseConflictsArtifact,
} from './conflictsStore';
export type {
  StateConflict,
  StateConflictType,
  ConflictsArtifact,
  TaggedEntry,
  StateSource,
} from './types';
