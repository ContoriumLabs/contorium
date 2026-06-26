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
    const { syncCognitiveInteractionLayer } = await Promise.resolve().then(() => __importStar(require('../cil/kernel.js')));
    await syncCognitiveInteractionLayer(workspaceRoot, writer).catch(() => undefined);
}
