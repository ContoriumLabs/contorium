import * as fs from 'node:fs';
import * as path from 'node:path';
let startupWorkspaceOverride;
/** Set once at process start from CLI --workspace (highest priority). */
export function setStartupWorkspace(workspace) {
    startupWorkspaceOverride = workspace?.trim() || undefined;
}
function parseWorkspaceArg(argv) {
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--workspace' && argv[i + 1]) {
            return argv[i + 1].trim();
        }
        if (arg.startsWith('--workspace=')) {
            return arg.slice('--workspace='.length).trim();
        }
    }
    return undefined;
}
function expandEnvPlaceholders(value) {
    return value.replace(/\$\{([^}]+)\}/g, (_, name) => process.env[name]?.trim() ?? '');
}
function readMcpJsonWorkspace(startDir) {
    const candidates = [
        path.join(startDir, '.mcp.json'),
        path.join(startDir, '.cursor', 'mcp.json'),
    ];
    for (const file of candidates) {
        try {
            const raw = fs.readFileSync(file, 'utf8');
            const parsed = JSON.parse(raw);
            const servers = parsed.mcpServers;
            const contoriumBlock = parsed.contorium;
            const env = servers?.contorium?.env ??
                servers?.['@contorium/mcp']?.env ??
                contoriumBlock?.env;
            const ws = env?.CONTORIUM_WORKSPACE?.trim();
            if (ws) {
                const expanded = expandEnvPlaceholders(ws);
                if (expanded) {
                    return path.resolve(expanded);
                }
            }
        }
        catch {
            // try next candidate
        }
    }
    return undefined;
}
/**
 * Workspace hint resolution (MCP v1 standard):
 * 1. CLI --workspace
 * 2. CONTORIUM_WORKSPACE (+ host env aliases)
 * 3. .mcp.json / .cursor/mcp.json
 * 4. process.cwd()
 */
export function resolveMcpStartupConfig(argv = process.argv.slice(2)) {
    const fromArgv = parseWorkspaceArg(argv);
    if (fromArgv) {
        setStartupWorkspace(fromArgv);
        return { workspaceHint: path.resolve(fromArgv), workspaceFromArgv: true };
    }
    if (startupWorkspaceOverride) {
        return { workspaceHint: path.resolve(startupWorkspaceOverride), workspaceFromArgv: true };
    }
    const fromEnv = process.env.CONTORIUM_WORKSPACE?.trim() ||
        process.env.CODEX_PROJECT_DIR?.trim() ||
        process.env.CLAUDE_PROJECT_DIR?.trim() ||
        process.env.CLAUDE_PROJECT_ROOT?.trim() ||
        process.env.MCP_WORKSPACE_ROOT?.trim();
    if (fromEnv) {
        return { workspaceHint: path.resolve(fromEnv), workspaceFromArgv: false };
    }
    const fromMcpJson = readMcpJsonWorkspace(process.cwd());
    if (fromMcpJson) {
        return { workspaceHint: fromMcpJson, workspaceFromArgv: false };
    }
    return { workspaceHint: process.cwd(), workspaceFromArgv: false };
}
