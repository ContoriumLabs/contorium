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
exports.buildKnowledgeGraph = buildKnowledgeGraph;
exports.syncKnowledgeGraph = syncKnowledgeGraph;
exports.readKnowledgeEntityIndex = readKnowledgeEntityIndex;
exports.readKnowledgeEntity = readKnowledgeEntity;
exports.exploreEntityKnowledge = exploreEntityKnowledge;
const fs = __importStar(require("node:fs/promises"));
const io_js_1 = require("../intelligence/dimensions/io.js");
const paths_js_1 = require("./paths.js");
const types_js_1 = require("./types.js");
const STOP_WORDS = new Set([
    'the', 'and', 'for', 'with', 'from', 'this', 'that', 'was', 'were', 'has', 'have',
    'into', 'using', 'use', 'added', 'updated', 'changed', 'project', 'file', 'module',
]);
function normalizeEntity(raw) {
    const t = raw.trim();
    if (!t || t.length < 2) {
        return null;
    }
    if (/^[A-Z]{2,}$/.test(t)) {
        return t.toUpperCase();
    }
    const lower = t.toLowerCase();
    if (STOP_WORDS.has(lower)) {
        return null;
    }
    return lower.replace(/[^\w.-]+/g, '_').slice(0, 48);
}
function slugForEntity(entity) {
    return entity.toLowerCase().replace(/[^\w.-]+/g, '_');
}
function extractEntitiesFromText(text) {
    const found = new Set();
    const acronyms = text.match(/\b[A-Z]{2,}\b/g) ?? [];
    for (const a of acronyms) {
        const n = normalizeEntity(a);
        if (n) {
            found.add(n);
        }
    }
    for (const word of text.split(/[^\w.-]+/)) {
        const n = normalizeEntity(word);
        if (n && n.length >= 3) {
            found.add(n);
        }
    }
    return [...found];
}
function extractFromEvent(evt) {
    const parts = [evt.title, evt.summary, evt.decision, evt.why, ...evt.files, ...evt.impact].filter(Boolean);
    const entities = new Set();
    for (const p of parts) {
        for (const e of extractEntitiesFromText(p)) {
            entities.add(e);
        }
        const base = p.split(/[/\\]/).pop();
        if (base) {
            const stem = base.replace(/\.[^.]+$/, '');
            const n = normalizeEntity(stem);
            if (n) {
                entities.add(n);
            }
        }
    }
    return [...entities];
}
function extractFromAdr(adr) {
    const parts = [adr.title, adr.reason, ...adr.alternatives, ...adr.related_events];
    const entities = new Set();
    for (const p of parts) {
        for (const e of extractEntitiesFromText(p)) {
            entities.add(e);
        }
    }
    return [...entities];
}
/** Build entity → artifact links from CIL storage (projection, not SoT). */
function buildKnowledgeGraph(events, adrs, snapshots) {
    const map = new Map();
    const now = new Date().toISOString();
    const ensure = (entity) => {
        let rec = map.get(entity);
        if (!rec) {
            rec = {
                schema: types_js_1.KNOWLEDGE_ENTITY_SCHEMA,
                entity,
                updated_at: now,
                projection_of: 'cognitive_events',
                derived_from: [],
                events: [],
                decisions: [],
                modules: [],
                snapshots: [],
            };
            map.set(entity, rec);
        }
        return rec;
    };
    for (const evt of events) {
        for (const entity of extractFromEvent(evt)) {
            const rec = ensure(entity);
            if (!rec.events.includes(evt.id)) {
                rec.events.push(evt.id);
            }
            for (const f of evt.files) {
                const mod = f.split(/[/\\]/).slice(-2).join('/');
                if (mod && !rec.modules.includes(mod)) {
                    rec.modules.push(mod);
                }
            }
        }
    }
    for (const adr of adrs) {
        for (const entity of extractFromAdr(adr)) {
            const rec = ensure(entity);
            if (!rec.decisions.includes(adr.id)) {
                rec.decisions.push(adr.id);
            }
        }
    }
    for (const snap of snapshots) {
        const text = [snap.summary, snap.state.focus, snap.state.current_task].filter(Boolean).join(' ');
        for (const entity of extractEntitiesFromText(text)) {
            const rec = ensure(entity);
            if (!rec.snapshots.includes(snap.id)) {
                rec.snapshots.push(snap.id);
            }
        }
    }
    return map;
}
async function syncKnowledgeGraph(workspaceRoot, events, adrs, snapshots) {
    const graph = buildKnowledgeGraph(events, adrs, snapshots);
    await fs.mkdir((0, paths_js_1.knowledgeDir)(workspaceRoot), { recursive: true });
    for (const [entity, record] of graph) {
        record.derived_from = [...new Set([...record.events, ...record.decisions])];
        await (0, io_js_1.writeJsonFile)((0, paths_js_1.knowledgeEntityPath)(workspaceRoot, slugForEntity(entity)), record);
    }
    const index = {
        schema: 'knowledge_index.v1',
        updated_at: new Date().toISOString(),
        projection_of: 'cognitive_events',
        entities: [...graph.keys()].sort(),
    };
    await (0, io_js_1.writeJsonFile)((0, paths_js_1.knowledgeIndexPath)(workspaceRoot), index);
    return index;
}
async function readKnowledgeEntityIndex(workspaceRoot) {
    return (0, io_js_1.readJsonFile)((0, paths_js_1.knowledgeIndexPath)(workspaceRoot));
}
async function readKnowledgeEntity(workspaceRoot, entityQuery) {
    const needle = entityQuery.trim().toLowerCase();
    const direct = await (0, io_js_1.readJsonFile)((0, paths_js_1.knowledgeEntityPath)(workspaceRoot, slugForEntity(needle)));
    if (direct?.schema === types_js_1.KNOWLEDGE_ENTITY_SCHEMA) {
        return direct;
    }
    const index = await readKnowledgeEntityIndex(workspaceRoot);
    if (!index?.entities.length) {
        return null;
    }
    const match = index.entities.find((e) => e.toLowerCase() === needle) ??
        index.entities.find((e) => e.toLowerCase().includes(needle) || needle.includes(e.toLowerCase()));
    if (!match) {
        return null;
    }
    return (0, io_js_1.readJsonFile)((0, paths_js_1.knowledgeEntityPath)(workspaceRoot, slugForEntity(match)));
}
async function exploreEntityKnowledge(workspaceRoot, entityQuery) {
    const record = await readKnowledgeEntity(workspaceRoot, entityQuery);
    const entity = record?.entity ?? entityQuery;
    if (!record) {
        return {
            entity,
            record: null,
            formatted: [
                `Knowledge Graph: ${entityQuery}`,
                '',
                '(no entity links — run sync to build .contora/knowledge/)',
            ],
        };
    }
    const formatted = [
        `Everything related to: ${record.entity}`,
        '',
        `Events: ${record.events.length}`,
        ...record.events.slice(0, 12).map((id) => `  · ${id}`),
        '',
        `Decisions: ${record.decisions.length}`,
        ...record.decisions.slice(0, 12).map((id) => `  · ${id}`),
        '',
        `Modules: ${record.modules.length}`,
        ...record.modules.slice(0, 8).map((m) => `  · ${m}`),
        '',
        `Snapshots: ${record.snapshots.length}`,
        ...record.snapshots.slice(0, 6).map((id) => `  · ${id}`),
    ];
    return { entity: record.entity, record, formatted };
}
