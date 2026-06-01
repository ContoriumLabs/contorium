"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CliAdapter = exports.McpAdapter = exports.IdeAdapter = void 0;
class IdeAdapter {
    kind = 'ide';
    describe() {
        return 'IDE event streaming (Mode A)';
    }
}
exports.IdeAdapter = IdeAdapter;
class McpAdapter {
    kind = 'mcp';
    describe() {
        return 'MCP workspace scan + poll (Mode B)';
    }
}
exports.McpAdapter = McpAdapter;
class CliAdapter {
    kind = 'cli';
    describe() {
        return 'CLI scan command (Mode B)';
    }
}
exports.CliAdapter = CliAdapter;
