import { createControlSurface } from '@contora/state-core';
function isPathLike(value) {
    return (value === '.' ||
        value === '..' ||
        value.startsWith('/') ||
        value.includes('\\') ||
        /^[A-Za-z]:[/\\]/.test(value));
}
function positionalTextAfterCommand() {
    const argv = process.argv.slice(2);
    let rest = argv.slice(1);
    if (rest[0] && isPathLike(rest[0])) {
        rest = rest.slice(1);
    }
    const parts = [];
    for (let j = 0; j < rest.length; j++) {
        const token = rest[j];
        if (token.startsWith('--')) {
            if (token === '--target' || token === '--description' || token === '--snippet') {
                j++;
            }
            continue;
        }
        parts.push(token);
    }
    return parts.join(' ').trim();
}
function flagValue(name) {
    const i = process.argv.indexOf(name);
    if (i < 0 || !process.argv[i + 1]) {
        return undefined;
    }
    return process.argv[i + 1];
}
function hasFlag(name) {
    return process.argv.includes(name);
}
export const CONTROL_USAGE = `Contorium control-core — unified closed loop (IDE / MCP / CLI)

MCP-parity top-level commands:
  contorium get-governance [path]                    get_governance
  contorium check-action [path] --target <file>      check_action
  contorium update-project-intent [path] "<text>"    update_project_intent

  (underscore aliases: get_governance, check_action, update_project_intent)

  contorium control governance [path]              Read constitution / truth / identity
  contorium control check [path] --target <file>   Pre-action guard check
  contorium control intent [path] "<text>"         Update user intent overlay
  contorium control analyze [path]                 Full project snapshot
  contorium control execute [path] --target <file> Check + audit + cognitive feedback
  contorium control ready [path]                   Ensure governance + sync

Options (check / check-action / execute):
  --target <path>       Relative file path
  --description <text>  Planned change description
  --snippet <text>      Code snippet for hardcode detection
  --confirmed           User confirmed override
  --strict              Block confirm without prior user approval (execute only)
  --no-audit            Skip change-log (execute only)
`;
export async function cmdGetGovernance(root) {
    const control = createControlSurface(root, 'cli');
    const result = await control.getGovernance();
    console.log(JSON.stringify(result, null, 2));
}
export async function cmdCheckAction(root) {
    const control = createControlSurface(root, 'cli');
    const result = await control.checkAction({
        type: 'file_write',
        target_path: flagValue('--target'),
        description: flagValue('--description'),
        code_snippet: flagValue('--snippet'),
        user_confirmed: hasFlag('--confirmed'),
    });
    console.log(JSON.stringify(result, null, 2));
    if (!result.guard.allow && result.guard.action !== 'warn') {
        process.exit(2);
    }
}
export async function cmdUpdateProjectIntent(root) {
    const text = positionalTextAfterCommand();
    if (!text) {
        process.stderr.write('contorium update-project-intent: provide user text\n');
        process.exit(1);
    }
    const control = createControlSurface(root, 'cli');
    const result = await control.updateIntent(text);
    console.log(JSON.stringify(result, null, 2));
}
export async function cmdControl(root, sub) {
    const control = createControlSurface(root, 'cli');
    switch (sub) {
        case 'governance':
        case 'gov':
            await cmdGetGovernance(root);
            return;
        case 'check':
            await cmdCheckAction(root);
            return;
        case 'intent':
            await cmdUpdateProjectIntent(root);
            return;
        case 'analyze': {
            const result = await control.analyze();
            console.log(JSON.stringify(result, null, 2));
            return;
        }
        case 'execute': {
            const target = flagValue('--target');
            const result = await control.executeAction({
                type: 'file_write',
                target_path: target,
                description: flagValue('--description'),
                code_snippet: flagValue('--snippet'),
                user_confirmed: hasFlag('--confirmed'),
                strict: hasFlag('--strict'),
                audit: !hasFlag('--no-audit'),
            });
            console.log(JSON.stringify(result, null, 2));
            if (!result.allowed) {
                process.exit(2);
            }
            return;
        }
        case 'ready': {
            const result = await control.ensureReady();
            console.log(JSON.stringify({ workspaceRoot: root, source: 'cli', ...result }, null, 2));
            return;
        }
        default:
            process.stderr.write(CONTROL_USAGE);
            process.exit(sub ? 1 : 0);
    }
}
