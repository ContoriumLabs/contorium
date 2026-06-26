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
exports.syncModuleHistory = syncModuleHistory;
exports.readModuleHistoryRecord = readModuleHistoryRecord;
exports.exploreModuleHistory = exploreModuleHistory;
exports.filterEventsByModule = filterEventsByModule;
const fs = __importStar(require("node:fs/promises"));
const path = __importStar(require("node:path"));
const paths_js_1 = require("./paths.js");
const io_js_1 = require("../intelligence/dimensions/io.js");
function moduleSlugFromPath(filePath) {
    const norm = filePath.replace(/\\/g, '/');
    const parts = norm.split('/').filter(Boolean);
    if (parts.length >= 2) {
        return parts[0];
    }
    const base = parts[0] ?? norm;
    return base.replace(/\.[^.]+$/, '') || 'root';
}
function moduleMatches(event, needle) {
    const n = needle.toLowerCase();
    if (event.title.toLowerCase().includes(n) || event.summary.toLowerCase().includes(n)) {
        return true;
    }
    return event.files.some((f) => f.toLowerCase().includes(n));
}
/** Persist per-module event feeds under .contora/module-history/ */
async function syncModuleHistory(workspaceRoot, events) {
    const byModule = new Map();
    for (const evt of events) {
        const modules = new Set();
        for (const f of evt.files) {
            modules.add(moduleSlugFromPath(f));
        }
        if (evt.impact.length) {
            for (const imp of evt.impact) {
                modules.add(moduleSlugFromPath(imp));
            }
        }
        if (modules.size === 0 && evt.linked_intent) {
            modules.add(moduleSlugFromPath(evt.linked_intent));
        }
        for (const mod of modules) {
            const list = byModule.get(mod) ?? [];
            list.push(evt);
            byModule.set(mod, list);
        }
    }
    await fs.mkdir((0, paths_js_1.moduleHistoryDir)(workspaceRoot), { recursive: true });
    for (const [module, modEvents] of byModule) {
        const slug = module.replace(/[^\w.-]+/g, '_').slice(0, 64) || 'root';
        const record = {
            schema: 'module_history.v1',
            module,
            updated_at: new Date().toISOString(),
            projection_of: 'cognitive_events',
            events: modEvents
                .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
                .slice(0, 64)
                .map((e) => ({
                date: e.timestamp.slice(0, 10),
                title: e.title,
                why: e.why,
                event_id: e.id,
            })),
        };
        await (0, io_js_1.writeJsonFile)((0, paths_js_1.moduleHistoryPath)(workspaceRoot, slug), record);
    }
    return new Map([...byModule.entries()].map(([mod, evts]) => [
        mod,
        {
            schema: 'module_history.v1',
            module: mod,
            updated_at: new Date().toISOString(),
            projection_of: 'cognitive_events',
            events: evts.slice(0, 64).map((e) => ({
                date: e.timestamp.slice(0, 10),
                title: e.title,
                why: e.why,
                event_id: e.id,
            })),
        },
    ]));
}
async function readModuleHistoryRecord(workspaceRoot, module) {
    const slug = module.replace(/[^\w.-]+/g, '_').slice(0, 64);
    try {
        const text = await fs.readFile((0, paths_js_1.moduleHistoryPath)(workspaceRoot, slug), 'utf8');
        const raw = JSON.parse(text);
        if (raw?.schema === 'module_history.v1') {
            return raw;
        }
    }
    catch {
        /* fall through */
    }
    try {
        const dir = (0, paths_js_1.moduleHistoryDir)(workspaceRoot);
        const files = await fs.readdir(dir);
        const needle = module.toLowerCase();
        for (const f of files) {
            if (!f.endsWith('.json')) {
                continue;
            }
            const text = await fs.readFile(path.join(dir, f), 'utf8');
            const raw = JSON.parse(text);
            if (raw.module.toLowerCase().includes(needle)) {
                return raw;
            }
        }
    }
    catch {
        return null;
    }
    return null;
}
async function exploreModuleHistory(workspaceRoot, module, events) {
    let record = await readModuleHistoryRecord(workspaceRoot, module);
    if (!record && events) {
        const filtered = events.filter((e) => moduleMatches(e, module));
        record = {
            schema: 'module_history.v1',
            module,
            updated_at: new Date().toISOString(),
            projection_of: 'cognitive_events',
            events: filtered.map((e) => ({
                date: e.timestamp.slice(0, 10),
                title: e.title,
                why: e.why,
                event_id: e.id,
            })),
        };
    }
    const formatted = [`Module History: ${module}`, ''];
    if (!record?.events.length) {
        formatted.push('(no events for this module yet)');
        return { module, formatted, record };
    }
    for (const entry of record.events.slice(0, 24)) {
        formatted.push(entry.date, '', entry.title, '');
        if (entry.why) {
            formatted.push('WHY', entry.why, '');
        }
    }
    return { module, formatted, record };
}
function filterEventsByModule(events, module) {
    return events.filter((e) => moduleMatches(e, module));
}
