"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scanGitPorcelain = scanGitPorcelain;
const node_child_process_1 = require("node:child_process");
const node_util_1 = require("node:util");
const execFileAsync = (0, node_util_1.promisify)(node_child_process_1.execFile);
function norm(p) {
    return p.replace(/\\/g, '/');
}
/** Git scan without simple-git — for MCP/CLI standalone. */
async function scanGitPorcelain(workspaceRoot) {
    try {
        const { stdout } = await execFileAsync('git', ['-C', workspaceRoot, 'status', '--porcelain'], { timeout: 15_000, maxBuffer: 2 * 1024 * 1024 });
        const staged = new Set();
        const working = new Set();
        for (const line of stdout.split('\n')) {
            if (line.length < 4) {
                continue;
            }
            const xy = line.slice(0, 2);
            const file = norm(line.slice(3).trim());
            if (!file) {
                continue;
            }
            const index = xy[0];
            const work = xy[1];
            if (index !== ' ' && index !== '?') {
                staged.add(file);
            }
            if (work !== ' ' && work !== '?') {
                working.add(file);
            }
            if (xy === '??') {
                working.add(file);
            }
        }
        return { staged: [...staged], working: [...working], isRepo: true };
    }
    catch {
        return { staged: [], working: [], isRepo: false };
    }
}
