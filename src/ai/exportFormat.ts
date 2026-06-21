import * as vscode from 'vscode';
import { CONTORA_CONFIG_SECTION } from '../constants';
import type { ExportFormat } from '../core';

export function readExportFormat(): ExportFormat {
  const raw = vscode.workspace.getConfiguration(CONTORA_CONFIG_SECTION).get<string>('exportFormat');
  if (raw === 'mcp') {
    return 'markdown';
  }
  if (
    raw === 'json' ||
    raw === 'cursor' ||
    raw === 'markdown' ||
    raw === 'claude' ||
    raw === 'openai'
  ) {
    return raw;
  }
  return 'markdown';
}
