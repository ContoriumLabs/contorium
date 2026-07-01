/** Story / narrative identity — route to Story engine, not PIK. */
export declare function isStoryIdentityQuery(question: string): boolean;
/** Direction / goal questions — PIK must dominate reasoning. */
export declare function isDirectionQuery(question: string): boolean;
/** Drift / alignment questions. */
export declare function isDriftQuery(question: string): boolean;
/** Extract entity topic from "What is MCP?" / "What is the auth module?" */
export declare function extractWhatIsEntityTopic(question: string): string | undefined;
//# sourceMappingURL=directionQuery.d.ts.map