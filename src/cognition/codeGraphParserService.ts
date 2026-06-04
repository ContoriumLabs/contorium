import * as vscode from 'vscode';
import { IncrementalParseCache, isCodeFile, parseFileWithAdapter } from '@contora/state-core';
import type { CognitionPipeline } from './cognitionPipeline';

const DEBOUNCE_MS = 1_200;

/** Tree-sitter-ready incremental parse on live edits → triggers cognition rebuild. */
export class CodeGraphParserService {
  private readonly cache = new IncrementalParseCache();
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private lastBackend = 'regex';

  constructor(
    private readonly cognition: CognitionPipeline | undefined,
    private readonly getFolder: () => vscode.WorkspaceFolder | undefined,
  ) {}

  activate(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
      vscode.workspace.onDidChangeTextDocument((e) => {
        void this.onDocumentChange(e.document);
      }),
      vscode.workspace.onDidSaveTextDocument((doc) => {
        void this.onDocumentChange(doc, true);
      }),
    );
  }

  getParserBackend(): string {
    return this.lastBackend;
  }

  private async onDocumentChange(doc: vscode.TextDocument, immediate = false): Promise<void> {
    const folder = this.getFolder();
    if (!folder || doc.uri.scheme !== 'file') {
      return;
    }
    const rel = vscode.workspace.asRelativePath(doc.uri, false).replace(/\\/g, '/');
    if (!isCodeFile(rel)) {
      return;
    }

    const run = async () => {
      this.timers.delete(rel);
      const prev = this.cache.get(rel);
      const parsed = await parseFileWithAdapter(folder.uri.fsPath, rel, {
        content: doc.getText(),
        previous: prev,
      });
      if (parsed) {
        this.cache.set(rel, parsed.extraction);
        this.lastBackend = parsed.backend;
      }
      this.cognition?.scheduleUpdate(undefined, [rel]);
    };

    if (immediate) {
      const t = this.timers.get(rel);
      if (t) {
        clearTimeout(t);
        this.timers.delete(rel);
      }
      await run();
      return;
    }

    const existing = this.timers.get(rel);
    if (existing) {
      clearTimeout(existing);
    }
    this.timers.set(
      rel,
      setTimeout(() => {
        void run();
      }, DEBOUNCE_MS),
    );
  }

  dispose(): void {
    for (const t of this.timers.values()) {
      clearTimeout(t);
    }
    this.timers.clear();
    this.cache.clear();
  }
}
