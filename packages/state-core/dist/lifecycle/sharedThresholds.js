"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SHARED_STALE_VERIFY_DAYS = void 0;
const policy_js_1 = require("./policy.js");
/** Shared stale-verify days for Cognitive Health + Lifecycle (single source of truth). */
exports.SHARED_STALE_VERIFY_DAYS = policy_js_1.LIFECYCLE_POLICY.staleVerifyDays;
