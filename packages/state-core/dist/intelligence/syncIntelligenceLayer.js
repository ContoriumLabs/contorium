"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncIntelligenceLayer = syncIntelligenceLayer;
const intentVNext_js_1 = require("./intentVNext.js");
const projectIdentity_js_1 = require("./projectIdentity.js");
const whyLayer_js_1 = require("./whyLayer.js");
const projectIntelligenceSync_js_1 = require("./projectIntelligenceSync.js");
async function syncIntelligenceLayer(workspaceRoot, writer, mode = 'merged') {
    const syncMode = mode === 'scan-driven' ? 'scan-driven' : mode === 'merged' ? 'merged' : 'strong';
    const prevIdentity = await (0, projectIdentity_js_1.readProjectIdentity)(workspaceRoot).catch(() => null);
    await (0, intentVNext_js_1.deriveIntentGraphVNext)(workspaceRoot).catch(() => undefined);
    await (0, whyLayer_js_1.syncWhyLayer)(workspaceRoot).catch(() => undefined);
    await (0, projectIdentity_js_1.syncProjectIdentity)(workspaceRoot, writer, syncMode).catch(() => undefined);
    await (0, projectIntelligenceSync_js_1.syncProjectIntelligenceRepository)(workspaceRoot, writer, mode, prevIdentity).catch(() => undefined);
}
