"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeStabilityIndex = exports.queryStabilityIndex = exports.readStabilityIndex = exports.deriveStabilityFromSignals = void 0;
/** @deprecated — use confidenceIndex.ts. Re-exports for backward compatibility. */
var confidenceIndex_js_1 = require("./confidenceIndex.js");
Object.defineProperty(exports, "deriveStabilityFromSignals", { enumerable: true, get: function () { return confidenceIndex_js_1.deriveConfidenceFromSignals; } });
Object.defineProperty(exports, "readStabilityIndex", { enumerable: true, get: function () { return confidenceIndex_js_1.readConfidenceIndex; } });
Object.defineProperty(exports, "queryStabilityIndex", { enumerable: true, get: function () { return confidenceIndex_js_1.queryConfidenceIndex; } });
Object.defineProperty(exports, "writeStabilityIndex", { enumerable: true, get: function () { return confidenceIndex_js_1.writeConfidenceIndex; } });
