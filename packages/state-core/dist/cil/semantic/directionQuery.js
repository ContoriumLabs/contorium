"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isDirectionQuery = isDirectionQuery;
exports.isDriftQuery = isDriftQuery;
/** Direction / identity questions — PIK must dominate reasoning. */
function isDirectionQuery(question) {
    const q = question.toLowerCase().trim();
    if (!q) {
        return false;
    }
    return (/core direction|project direction|where (are we|is (this )?project) going|primary goal|project goal|main goal|what is this project|project identity|why does this project exist|what are we building|project essence|north star|mission|vision|偏离|核心方向|项目本质|项目目标|我们在做什么/.test(q) || /^what is this\b/.test(q));
}
/** Drift / alignment questions. */
function isDriftQuery(question) {
    const q = question.toLowerCase();
    return /drift|off.?track|aligned|alignment|偏离目标|是否偏离/.test(q);
}
