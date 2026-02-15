import { Document } from '../document/Document';
import { UndoRedoManager } from '../state/UndoRedoManager';
import { importPlainText } from './ImportPlainText';

export function importTypeScript(
  tsCode: string,
  doc: Document,
  undoManager: UndoRedoManager,
  foreground: number = 15,
  background: number = 0,
): void {
  // Extract string array from TypeScript code
  // Handles formats like: const art = ['line1', 'line2'];
  // or: const art: string[] = [\n  'line1',\n  'line2'\n];
  const lines: string[] = [];

  // Match quoted strings inside array brackets
  const arrayMatch = tsCode.match(/\[([^\]]*)\]/s);
  if (!arrayMatch) return;

  const content = arrayMatch[1];
  const stringRegex = /['"`](.*?)['"`]/g;
  let match;
  while ((match = stringRegex.exec(content)) !== null) {
    lines.push(match[1]
      .replace(/\\'/g, "'")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\'));
  }

  if (lines.length > 0) {
    importPlainText(lines.join('\n'), doc, undoManager, foreground, background);
  }
}
