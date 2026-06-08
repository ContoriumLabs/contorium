"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveGitExecutable = resolveGitExecutable;
exports.runGit = runGit;
const node_child_process_1 = require("node:child_process");
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const gitRuntime_js_1 = require("./gitRuntime.js");
let cachedGitExe;
/** Resolve real git.exe on Windows — never git.cmd (opens console). */
function resolveGitExecutable() {
    if (cachedGitExe) {
        return cachedGitExe;
    }
    if (process.platform !== 'win32') {
        cachedGitExe = 'git';
        return cachedGitExe;
    }
    const fromEnv = process.env.GIT_EXEC_PATH?.trim();
    if (fromEnv && fs.existsSync(fromEnv)) {
        cachedGitExe = fromEnv;
        return cachedGitExe;
    }
    const programFiles = process.env.ProgramFiles ?? 'C:\\Program Files';
    const programFilesX86 = process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)';
    const candidates = [
        path.join(programFiles, 'Git', 'mingw64', 'bin', 'git.exe'),
        path.join(programFiles, 'Git', 'bin', 'git.exe'),
        path.join(programFiles, 'Git', 'cmd', 'git.exe'),
        path.join(programFilesX86, 'Git', 'cmd', 'git.exe'),
    ];
    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            cachedGitExe = candidate;
            return cachedGitExe;
        }
    }
    try {
        const where = (0, node_child_process_1.execFileSync)('where.exe', ['git.exe'], {
            encoding: 'utf8',
            windowsHide: true,
            timeout: 5_000,
        });
        const line = where
            .split(/\r?\n/)
            .map((s) => s.trim())
            .find((s) => s.toLowerCase().endsWith('git.exe') && fs.existsSync(s));
        if (line) {
            cachedGitExe = line;
            return cachedGitExe;
        }
    }
    catch {
        // fall through
    }
    cachedGitExe = 'git.exe';
    return cachedGitExe;
}
function gitEnv() {
    return {
        ...process.env,
        GIT_TERMINAL_PROMPT: '0',
        GCM_INTERACTIVE: 'never',
        GIT_ASKPASS: '',
        SSH_ASKPASS: '',
        GIT_PAGER: '',
        PAGER: '',
    };
}
/** Run git in workspace root — deferred until runtime activity unless forced. */
async function runGit(workspaceRoot, gitArgs, options) {
    if (!options?.force && !(0, gitRuntime_js_1.isGitSubprocessAllowed)()) {
        return '';
    }
    (0, gitRuntime_js_1.traceGitInvocation)(workspaceRoot, gitArgs);
    const git = resolveGitExecutable();
    const timeout = options?.timeout ?? 15_000;
    const maxBuffer = options?.maxBuffer ?? 2 * 1024 * 1024;
    const args = [
        '-C',
        path.resolve(workspaceRoot),
        '-c',
        'core.pager=',
        '-c',
        'core.hooksPath=NUL',
        '-c',
        'credential.helper=',
        '--no-pager',
        ...gitArgs,
    ];
    return new Promise((resolve, reject) => {
        const spawnOpts = {
            windowsHide: true,
            shell: false,
            stdio: ['ignore', 'pipe', 'pipe'],
            env: gitEnv(),
        };
        if (process.platform === 'win32') {
            spawnOpts.creationFlags =
                0x08000000;
        }
        const child = (0, node_child_process_1.spawn)(git, args, spawnOpts);
        let stdout = '';
        let stderr = '';
        let killed = false;
        const timer = setTimeout(() => {
            killed = true;
            child.kill('SIGTERM');
            reject(new Error(`git timed out after ${timeout}ms`));
        }, timeout);
        child.stdout?.on('data', (chunk) => {
            stdout += chunk.toString('utf8');
            if (stdout.length > maxBuffer) {
                killed = true;
                child.kill('SIGTERM');
                reject(new Error('git stdout exceeded maxBuffer'));
            }
        });
        child.stderr?.on('data', (chunk) => {
            stderr += chunk.toString('utf8');
        });
        child.on('error', (err) => {
            clearTimeout(timer);
            reject(err);
        });
        child.on('close', (code) => {
            clearTimeout(timer);
            if (killed) {
                return;
            }
            if (code === 0) {
                resolve(stdout);
                return;
            }
            reject(new Error(stderr.trim() || `git exited with code ${code ?? 'unknown'}`));
        });
    });
}
