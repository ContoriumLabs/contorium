export {
  PIK_SCHEMA,
  DEFAULT_PIK,
  type ProjectIntentKernel,
  type PikGoal,
  type DriftReport,
  type DriftSeverity,
  type DriftType,
} from './types.js';
export { pikKernelPath, PIK_KERNEL_FILE, readProjectIntentKernel, writeProjectIntentKernel } from './store.js';
export { generateProjectIntentKernel, ensureProjectIntentKernel } from './generator.js';
export { detectProjectDrift } from './drift.js';
