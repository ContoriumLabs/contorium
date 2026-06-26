/**
 * CLI dashboard — LLM config stream (View Mode E): provider → API key → auto test.
 */
import { liveModuleTitle } from './statusAnimation.js';
import { truncate } from './uiHelpers.js';
import { LLM_PROVIDER_LABELS, LLM_PROVIDER_ORDER, providerHasSavedKey, } from './aiConfigBridge.js';
function colors(useColor) {
    const wrap = (code) => (text) => useColor ? `\x1b[${code}m${text}\x1b[0m` : text;
    return { bold: wrap('1'), dim: wrap('2'), green: wrap('32'), red: wrap('31'), yellow: wrap('33'), cyan: wrap('36') };
}
export function renderLlmConfigStreams(args) {
    const c = colors(args.useColor);
    const w = args.width;
    const snap = args.snapshot;
    const lines = [
        liveModuleTitle('LLM Config', args.tickCount ?? 0, args.live === true, c, w),
        truncate('─'.repeat(Math.max(16, w - 4)), w),
        truncate(c.dim('Step 1: provider  →  Step 2: API key  →  auto test'), w),
    ];
    if (args.step === 'provider') {
        lines.push('');
        lines.push(truncate(c.bold('① Select provider'), w));
        lines.push(truncate(c.dim('←→ cycle · Enter confirm'), w));
        if (snap) {
            const activeLabel = LLM_PROVIDER_LABELS[snap.provider];
            lines.push(truncate(`Active: ${activeLabel} · ${snap.model}${snap.enabled ? c.green(' · on') : c.dim(' · off')} · Key: ${snap.activeProviderHasKey ? c.green('configured') : c.dim('(not set)')}`, w));
        }
        lines.push('');
        for (const id of LLM_PROVIDER_ORDER) {
            const on = args.providerSelection === id;
            const marker = on ? c.bold('●') : c.dim('○');
            let label = LLM_PROVIDER_LABELS[id];
            const configured = providerHasSavedKey(snap, id);
            if (configured && id !== 'ollama') {
                label += c.green(' · configured');
            }
            if (snap && id === snap.provider && snap.enabled) {
                label += c.green(' · active');
            }
            if (on && !configured && id !== 'ollama') {
                label += c.yellow(' · key required');
            }
            lines.push(truncate(`${marker} ${on ? c.bold(label) : label}`, w));
        }
        if (args.lastTest) {
            lines.push('');
            const statusLine = args.lastTest.ok
                ? c.green(`Last test: ${args.lastTest.message}`)
                : c.red(`Last test: ${args.lastTest.message}`);
            lines.push(truncate(statusLine, w));
        }
        return lines;
    }
    // Step 2: API key
    const providerLabel = LLM_PROVIDER_LABELS[args.providerSelection] ?? args.providerSelection;
    const alreadyConfigured = providerHasSavedKey(snap, args.providerSelection);
    lines.push('');
    lines.push(truncate(c.bold(`② Enter API key — ${providerLabel}`), w));
    if (alreadyConfigured) {
        lines.push(truncate(c.dim('This provider is already configured — enter a new key to replace it'), w));
    }
    else {
        lines.push(truncate(c.dim('Each provider needs its own API key'), w));
    }
    const visible = args.keyInputBuffer.length > 0 ? args.keyInputBuffer : c.dim('(typing…)');
    lines.push(truncate(`${c.yellow('▸')} ${visible}`, w));
    lines.push(truncate(c.dim('Type or Ctrl+V paste · Enter save & test · Esc back'), w));
    if (args.lastTest) {
        lines.push('');
        const statusLine = args.lastTest.ok
            ? c.green(`Test: ${args.lastTest.message}`)
            : c.red(`Test: ${args.lastTest.message}`);
        lines.push(truncate(statusLine, w));
        const ageSec = Math.max(0, Math.round((Date.now() - args.lastTest.at) / 1000));
        lines.push(truncate(c.dim(`${ageSec}s ago`), w));
    }
    return lines;
}
/** @deprecated use renderLlmConfigStreams */
export const renderLlmConfigPanel = renderLlmConfigStreams;
