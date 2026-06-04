"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getContoriumPackageVersion = getContoriumPackageVersion;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
let cachedVersion;
/** Read @contora/state-core version from package.json (not hardcoded). */
function getContoriumPackageVersion() {
    if (cachedVersion) {
        return cachedVersion;
    }
    try {
        const pkgPath = (0, node_path_1.join)(__dirname, '..', 'package.json');
        const pkg = JSON.parse((0, node_fs_1.readFileSync)(pkgPath, 'utf8'));
        cachedVersion = pkg.version ?? '0.0.0';
    }
    catch {
        cachedVersion = '0.0.0';
    }
    return cachedVersion;
}
