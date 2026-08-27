/**
 * Lives in its own module, deliberately separate from both domain/tools.ts and
 * webmcp/adapter.ts. adapter.ts needs this list to gate policy drafting; domain/tools.ts is
 * where the six tools — and conceptually this list — belong. Importing it directly from
 * domain/tools.ts, which itself imports registerLadderTool from adapter.ts, would recreate
 * a circular import between those two files — the exact cycle that once produced a
 * live-browser TDZ crash (`ReferenceError: Cannot access 'mc' before initialization`) before
 * registration was deferred behind registerDomainTools(). A one-way dependency from both
 * files onto this one instead has no cycle to trip over, regardless of import order or how
 * either file evolves later.
 */
// notify_customers is the only externally-visible write left in this domain: once a message is
// sent, it cannot be recalled. propose_remedy only ever rewrites in-app fields (remedy, cost,
// recovered hours) and stays reversible, so it can still earn a standing rule the ordinary way.
export const NEVER_ELIGIBLE: string[] = ['notify_customers'];
