/** Decision vocabulary → npm package names that implement it. */
export declare const TECH_TERM_TO_PACKAGES: Record<string, string[]>;
export declare function extractTechTerms(text: string): string[];
export declare function collectWorkspaceDependencyNames(workspaceRoot: string, extraManifests?: string[]): Promise<Set<string>>;
export declare function detectDependencyManifestChanges(previous: ReadonlySet<string>, current: ReadonlySet<string>): {
    added: string[];
    removed: string[];
};
export declare function techTermForPackage(pkgName: string): string | undefined;
//# sourceMappingURL=dependencyInventory.d.ts.map