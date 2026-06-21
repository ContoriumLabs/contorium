import { cmdControl, CONTROL_USAGE } from '../control/commands.js';

export const COGNITION_USAGE = `Contorium cognition — Project Cognition Interface (inspect only)

  contorium cognition inspect governance [path]
  contorium cognition inspect check [path] --target <file>
  contorium cognition inspect intent [path] "<text>"
  contorium cognition inspect analyze [path]
  contorium cognition inspect health [path]
  contorium cognition inspect ready [path]

  Shorthand (same handlers):
  contorium cognition governance [path]
  contorium cognition check [path] --target <file>
  …

  Legacy: contorium control · contorium inspect · contorium system-inspection
`;

export async function cmdCognition(root: string): Promise<void> {
  let sub = process.argv[3];
  if (sub === 'inspect') {
    sub = process.argv[4];
  }
  if (!sub) {
    process.stderr.write(COGNITION_USAGE);
    process.exit(0);
  }
  await cmdControl(root, sub);
}
