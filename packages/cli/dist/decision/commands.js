import { cmdGovernanceCycle, cmdGovernanceExport, cmdGovernanceReview, } from '../governance/commands.js';
export const DECISION_USAGE = `Contorium decision — Decision Provenance (Project Understanding CLI)

  contorium decision derive [path] [--target <file>]    Derive provenance chain → governance/*
  contorium decision trace [path] [--target <file>]     Alias of derive
  contorium decision snapshot [path] [--target <file>]  Project decision snapshot (same as derive)
  contorium decision synthesize [path] [--copy]         Synthesize cognition export to stdout/clipboard

  Legacy: contorium governance provenance-build · decision-snapshot · cycle · trace
`;
export async function cmdDecision(root) {
    const sub = process.argv[3];
    switch (sub) {
        case 'derive':
        case 'trace':
        case 'snapshot':
            await cmdGovernanceCycle(root);
            return;
        case 'synthesize':
            await cmdGovernanceExport(root);
            return;
        case 'understand':
            await cmdGovernanceReview(root);
            return;
        default:
            process.stderr.write(DECISION_USAGE);
            process.exit(sub ? 1 : 0);
    }
}
