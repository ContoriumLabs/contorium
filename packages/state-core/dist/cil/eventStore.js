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
exports.readCognitiveEventIndex = readCognitiveEventIndex;
exports.readCognitiveEvent = readCognitiveEvent;
exports.writeCognitiveEvent = writeCognitiveEvent;
exports.readAllCognitiveEvents = readAllCognitiveEvents;
exports.readAdrRecord = readAdrRecord;
exports.writeAdrRecord = writeAdrRecord;
exports.readAllAdrRecords = readAllAdrRecords;
exports.persistCilIndex = persistCilIndex;
const fs = __importStar(require("node:fs/promises"));
const path = __importStar(require("node:path"));
const paths_js_1 = require("./paths.js");
const types_js_1 = require("./types.js");
async function readJson(filePath) {
    try {
        const text = await fs.readFile(filePath, 'utf8');
        return JSON.parse(text);
    }
    catch {
        return null;
    }
}
async function writeJson(filePath, data) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}
async function readCognitiveEventIndex(workspaceRoot) {
    const raw = await readJson((0, paths_js_1.cilIndexPath)(workspaceRoot));
    if (raw?.schema === types_js_1.CIL_INDEX_SCHEMA) {
        return raw;
    }
    return null;
}
async function readCognitiveEvent(workspaceRoot, eventId) {
    const raw = await readJson((0, paths_js_1.cognitiveEventPath)(workspaceRoot, eventId));
    if (raw?.schema === types_js_1.COGNITIVE_EVENT_SCHEMA && raw.id === eventId) {
        return raw;
    }
    return null;
}
async function writeCognitiveEvent(workspaceRoot, event) {
    await writeJson((0, paths_js_1.cognitiveEventPath)(workspaceRoot, event.id), event);
}
async function readAllCognitiveEvents(workspaceRoot) {
    const index = await readCognitiveEventIndex(workspaceRoot);
    if (index?.event_ids.length) {
        const events = [];
        for (const id of index.event_ids) {
            const evt = await readCognitiveEvent(workspaceRoot, id);
            if (evt) {
                events.push(evt);
            }
        }
        return events.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    }
    const dir = (0, paths_js_1.cognitiveEventsDir)(workspaceRoot);
    try {
        const files = await fs.readdir(dir);
        const events = [];
        for (const f of files) {
            if (!f.endsWith('.json')) {
                continue;
            }
            const raw = await readJson(path.join(dir, f));
            if (raw?.schema === types_js_1.COGNITIVE_EVENT_SCHEMA) {
                events.push(raw);
            }
        }
        return events.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    }
    catch {
        return [];
    }
}
async function readAdrRecord(workspaceRoot, adrId) {
    const raw = await readJson((0, paths_js_1.adrPath)(workspaceRoot, adrId));
    if (!raw?.id || raw.id !== adrId) {
        return null;
    }
    if (raw.schema === types_js_1.ADR_RECORD_SCHEMA) {
        return raw;
    }
    if (raw.schema === 'adr.v1') {
        return { ...raw, schema: types_js_1.ADR_RECORD_SCHEMA, edges: raw.related_events ?? [] };
    }
    return null;
}
async function writeAdrRecord(workspaceRoot, adr) {
    await writeJson((0, paths_js_1.adrPath)(workspaceRoot, adr.id), adr);
}
async function readAllAdrRecords(workspaceRoot) {
    const index = await readCognitiveEventIndex(workspaceRoot);
    if (index?.adr_ids.length) {
        const records = [];
        for (const id of index.adr_ids) {
            const adr = await readAdrRecord(workspaceRoot, id);
            if (adr) {
                records.push(adr);
            }
        }
        return records.sort((a, b) => b.date.localeCompare(a.date));
    }
    try {
        const files = await fs.readdir((0, paths_js_1.adrDir)(workspaceRoot));
        const records = [];
        for (const f of files) {
            if (!f.endsWith('.json')) {
                continue;
            }
            const raw = await readJson(path.join((0, paths_js_1.adrDir)(workspaceRoot), f));
            if (raw?.schema === types_js_1.ADR_RECORD_SCHEMA) {
                records.push(raw);
            }
        }
        return records.sort((a, b) => b.date.localeCompare(a.date));
    }
    catch {
        return [];
    }
}
async function persistCilIndex(workspaceRoot, eventIds, adrIds) {
    const index = {
        schema: types_js_1.CIL_INDEX_SCHEMA,
        updated_at: new Date().toISOString(),
        event_ids: [...new Set(eventIds)],
        adr_ids: [...new Set(adrIds)],
    };
    await writeJson((0, paths_js_1.cilIndexPath)(workspaceRoot), index);
    return index;
}
