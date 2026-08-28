/**
 * Its own module for the same reason the freight product's copy is: `store.ts` hands this list to
 * the adapter as part of the host binding, and `tools.ts` is where the tools — and conceptually
 * this list — belong. Importing it from `tools.ts`, which itself imports `registerLadderTool`
 * from `webmcp/adapter.ts`, would put it on the wrong side of a cycle. A one-way dependency from
 * both files onto this one has no cycle to trip over whatever order they evaluate in.
 */
// A page reaches a person. Once a rotation has been woken there is no unsending it, so no number
// of clean approvals earns page_oncall a standing rule. roll_config only ever rewrites in-app
// rollout state and stays reversible, so it can earn one the ordinary way.
export const NEVER_ELIGIBLE: string[] = ['page_oncall'];
