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
exports.checkActiveRuntime = checkActiveRuntime;
exports.readHandoffInjectionState = readHandoffInjectionState;
exports.readConfirmedHandoffContext = readConfirmedHandoffContext;
exports.buildInjectionPromptMessage = buildInjectionPromptMessage;
exports.prepareHandoffInjection = prepareHandoffInjection;
exports.confirmHandoffInjection = confirmHandoffInjection;
exports.skipHandoffInjection = skipHandoffInjection;
exports.syncInjectionWithRuntime = syncInjectionWithRuntime;
const fs = __importStar(require("node:fs/promises"));
const path = __importStar(require("node:path"));
const chpHandoff_js_1 = require("./understanding/chpHandoff.js");
const INJECTION_STATE_FILE = 'mcp.handoff-injection.json';
const CONTEXT_FILE = 'mcp.auto-context.md';
const BOOTSTRAP_FILE = 'runtime.bootstrap.json';
function contoraPath(workspaceRoot, name) {
    return path.join(path.resolve(workspaceRoot), '.contora', name);
}
async function readJson(filePath) {
    try {
        const raw = await fs.readFile(filePath, 'utf8');
        return JSON.parse(raw);
    }
    catch {
        return undefined;
    }
}
async function writeJson(filePath, data) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}
/** Active runtime = bootstrap marker + handoff available. */
async function checkActiveRuntime(workspaceRoot) {
    const root = path.resolve(workspaceRoot);
    const bootstrap = await readJson(contoraPath(root, BOOTSTRAP_FILE));
    if (!bootstrap?.runtime_id) {
        return { active: false };
    }
    const handoff = await (0, chpHandoff_js_1.getProjectHandoff)(root, 'compact');
    if (!handoff.found) {
        return { active: false, runtime_id: bootstrap.runtime_id };
    }
    return { active: true, runtime_id: bootstrap.runtime_id };
}
async function readHandoffInjectionState(workspaceRoot) {
    return readJson(contoraPath(workspaceRoot, INJECTION_STATE_FILE));
}
async function readConfirmedHandoffContext(workspaceRoot) {
    const state = await readHandoffInjectionState(workspaceRoot);
    if (state?.status !== 'injected') {
        return undefined;
    }
    try {
        return await fs.readFile(contoraPath(workspaceRoot, CONTEXT_FILE), 'utf8');
    }
    catch {
        return undefined;
    }
}
function buildInjectionPromptMessage(projectHint, compactLine) {
    const project = projectHint || 'this project';
    const lines = [
        `[?] Contorium Runtime active for "${project}". Inject current working state? (Y/n)`,
        `Terminal: Enter or i · IDE: click [?] on status bar · Agent: confirm_handoff_injection`,
    ];
    if (compactLine) {
        lines.push(compactLine);
    }
    return lines.join('\n');
}
/** Prepare semi-auto injection — pending only, does NOT write context file. */
async function prepareHandoffInjection(workspaceRoot, options) {
    const root = path.resolve(workspaceRoot);
    const { active, runtime_id } = await checkActiveRuntime(root);
    if (!active || !runtime_id) {
        return { shouldPrompt: false, alreadyInjected: false };
    }
    const existing = await readHandoffInjectionState(root);
    const compact = await (0, chpHandoff_js_1.getProjectHandoff)(root, 'compact');
    const project = path.basename(root);
    const chatSessionId = options?.newChat
        ? `chat-${Date.now()}`
        : existing?.chat_session_id ?? `chat-${Date.now()}`;
    if (options?.newChat) {
        const state = {
            runtime_id,
            status: 'pending',
            prompted_at: Date.now(),
            context_file: `.contora/${CONTEXT_FILE}`,
            chat_session_id: chatSessionId,
        };
        await writeJson(contoraPath(root, INJECTION_STATE_FILE), state);
        return {
            shouldPrompt: true,
            alreadyInjected: false,
            prompt: buildInjectionPromptMessage(project, compact.text),
            state,
            compact: compact.text,
        };
    }
    if (existing?.runtime_id === runtime_id && existing.status === 'injected') {
        return { shouldPrompt: false, alreadyInjected: true, state: existing };
    }
    if (existing?.runtime_id === runtime_id && existing.status === 'skipped') {
        return { shouldPrompt: false, alreadyInjected: false, state: existing };
    }
    const state = {
        runtime_id,
        status: 'pending',
        prompted_at: Date.now(),
        context_file: `.contora/${CONTEXT_FILE}`,
        chat_session_id: chatSessionId,
    };
    await writeJson(contoraPath(root, INJECTION_STATE_FILE), state);
    return {
        shouldPrompt: true,
        alreadyInjected: false,
        prompt: buildInjectionPromptMessage(project, compact.text),
        state,
        compact: compact.text,
    };
}
/** User confirmed — write context file and mark injected. */
async function confirmHandoffInjection(workspaceRoot, format = 'markdown') {
    const root = path.resolve(workspaceRoot);
    const { active, runtime_id } = await checkActiveRuntime(root);
    if (!active || !runtime_id) {
        return { ok: false, hint: 'No active runtime or handoff — save changes or run sync first.' };
    }
    const result = await (0, chpHandoff_js_1.getProjectHandoff)(root, format);
    if (!result.found || !result.text) {
        return { ok: false, hint: 'Handoff not ready.' };
    }
    const contextPath = contoraPath(root, CONTEXT_FILE);
    await fs.writeFile(contextPath, result.text, 'utf8');
    const state = {
        runtime_id,
        status: 'injected',
        prompted_at: (await readHandoffInjectionState(root))?.prompted_at ?? Date.now(),
        resolved_at: Date.now(),
        context_file: `.contora/${CONTEXT_FILE}`,
        format,
        chat_session_id: (await readHandoffInjectionState(root))?.chat_session_id,
    };
    await writeJson(contoraPath(root, INJECTION_STATE_FILE), state);
    await markHandoffInjectionUsed(root, runtime_id);
    return { ok: true, filePath: contextPath, text: result.text };
}
async function markHandoffInjectionUsed(workspaceRoot, runtimeId) {
    const handoffPath = contoraPath(workspaceRoot, 'handoff.json');
    const raw = await readJson(handoffPath);
    if (!raw) {
        return;
    }
    raw.last_handoff_used = { runtime_id: runtimeId, at: Date.now() };
    await writeJson(handoffPath, raw);
}
/** User declined injection for this runtime session. */
async function skipHandoffInjection(workspaceRoot) {
    const root = path.resolve(workspaceRoot);
    const { runtime_id } = await checkActiveRuntime(root);
    if (!runtime_id) {
        return { ok: false };
    }
    const state = {
        runtime_id,
        status: 'skipped',
        prompted_at: (await readHandoffInjectionState(root))?.prompted_at ?? Date.now(),
        resolved_at: Date.now(),
        context_file: `.contora/${CONTEXT_FILE}`,
        chat_session_id: (await readHandoffInjectionState(root))?.chat_session_id,
    };
    await writeJson(contoraPath(root, INJECTION_STATE_FILE), state);
    return { ok: true };
}
/** Reset pending state when runtime_id changes (new bootstrap). */
async function syncInjectionWithRuntime(workspaceRoot) {
    const root = path.resolve(workspaceRoot);
    const { runtime_id } = await checkActiveRuntime(root);
    if (!runtime_id) {
        return;
    }
    const existing = await readHandoffInjectionState(root);
    if (existing && existing.runtime_id !== runtime_id) {
        await writeJson(contoraPath(root, INJECTION_STATE_FILE), {
            runtime_id,
            status: 'pending',
            prompted_at: Date.now(),
            context_file: `.contora/${CONTEXT_FILE}`,
            chat_session_id: `chat-${Date.now()}`,
        });
    }
}
