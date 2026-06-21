import {
  captureProjectFocus,
  captureProjectNote,
  captureProjectDecision,
} from '@contora/state-core';

/** IDE PIL Runtime — Capture group (mirrors MCP capture_* / CLI capture). */

export async function ideCaptureFocus(workspaceRoot: string, focus: string) {
  return captureProjectFocus(workspaceRoot, focus, 'ide');
}

export async function ideCaptureNote(workspaceRoot: string, text: string) {
  return captureProjectNote(workspaceRoot, text, 'ide');
}

export async function ideCaptureDecision(
  workspaceRoot: string,
  input: { selected: string; reason?: string },
) {
  return captureProjectDecision(workspaceRoot, input);
}
