import { type ProjectIntentKernel } from './types.js';
export declare const PIK_KERNEL_FILE = "kernel.json";
export declare function pikKernelPath(workspaceRoot: string): string;
export declare function readProjectIntentKernel(workspaceRoot: string): Promise<ProjectIntentKernel | null>;
export declare function writeProjectIntentKernel(workspaceRoot: string, kernel: ProjectIntentKernel): Promise<ProjectIntentKernel>;
//# sourceMappingURL=store.d.ts.map