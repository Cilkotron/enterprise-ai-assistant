import { tool, type ToolSet } from "ai";
import { checkPermission } from "./permissions.js";
import type { TraceCollector } from "./trace.js";
import type { AgentId, UserContext } from "./types.js";
import type { ToolDef } from "./tools/types.js";

export interface ToolContext {
  user: UserContext;
  agent: AgentId;
  trace: TraceCollector;
}

export function buildToolset(ctx: ToolContext, defs: ToolDef<any>[]): ToolSet {
  const toolset: ToolSet = {};

  for (const def of defs) {
    // 1. Build-time decision: logged to the trace; denied tools never reach the model.
    const decision = checkPermission(ctx.user, ctx.agent, def.capability, ctx.trace);
    if (!decision.allowed) continue;

    toolset[def.name] = tool({
      description: def.description,
      inputSchema: def.inputSchema,
      execute: async (input) => {
        // 2. Defense in depth: re-check at execution time (no extra trace noise if allowed).
        if (!checkPermission(ctx.user, ctx.agent, def.capability).allowed) {
          ctx.trace.record({
            agent: ctx.agent, type: "tool_call",
            tool: def.name, outcome: "denied", durationMs: 0,
          });
          return { error: "not_permitted" };
        }

        const started = Date.now();
        try {
          const { result, durationMs } = await ctx.trace.measure(() => def.execute(input));
          ctx.trace.record({
            agent: ctx.agent, type: "tool_call",
            tool: def.name, outcome: "ok", durationMs,
          });
          return result;
        } catch {
          ctx.trace.record({
            agent: ctx.agent, type: "tool_call",
            tool: def.name, outcome: "error", durationMs: Date.now() - started,
          });
          // Never leak internal errors to the model; it should report failure honestly.
          return { error: "tool_failed" };
        }
      },
    });
  }

  return toolset;
}