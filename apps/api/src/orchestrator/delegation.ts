import type { LanguageModel, ModelMessage } from "ai";
import { z } from "zod";
import type { ToolDef } from "../tools/types.js";
import type { TraceCollector } from "../trace.js";
import type { UserContext } from "../types.js";
import type { SessionState } from "./session.js";
import { runItSpecialist, type SpecialistResult } from "../agents/it.js";
import { runHrSpecialist } from "../agents/hr.js";
import type { McpConfig } from "../mcp-tools.js";

type RunItArgs = Parameters<typeof runItSpecialist>[0];
type RunHrArgs = Parameters<typeof runHrSpecialist>[0];

export interface DelegationDeps {
  model: LanguageModel;
  user: UserContext;
  trace: TraceCollector;
  session: SessionState;
  mcp: McpConfig;
  runIt?: typeof runItSpecialist;
  runHr?: typeof runHrSpecialist;
}

export function createDelegationTools(deps: DelegationDeps): ToolDef<{ task: string }>[] {
  const { model, user, trace, session, mcp, runIt = runItSpecialist, runHr = runHrSpecialist } = deps;

  return [
    {
      name: "delegateToIt",
      capability: "delegateToIt",
      description:
        "Delegate a self-contained IT task (service status, troubleshooting, VPN, device setup) to the IT specialist. The specialist cannot see the conversation, so include all needed details.",
      inputSchema: z.object({
        task: z.string().min(1).max(2000),
      }),
      async execute({ task }) {
        const truncatedTask = task.slice(0, 300);
        trace.record({
          agent: "orchestrator",
          type: "delegation_started",
          to: "it",
          task: truncatedTask,
        });

        const started = Date.now();
        const result = await runIt({
          model,
          user,
          trace,
          task,
          history: session.it,
        });

        const durationMs = Date.now() - started;
        trace.record({
          agent: "orchestrator",
          type: "delegation_completed",
          to: "it",
          durationMs,
          outcome: result.ok ? "ok" : "error",
        });

        if (result.ok) {
          session.it.push(
            { role: "user", content: task },
            { role: "assistant", content: result.text },
          );
          session.it = session.it.slice(-20);
          return { status: "ok", result: result.text };
        }

        return { status: "failed", reason: result.error };
      },
    },
    {
      name: "delegateToHr",
      capability: "delegateToHr",
      description:
        "Delegate a self-contained HR task (vacation, hybrid work, parental leave, equipment profiles) to the HR specialist. The specialist cannot see the conversation, so include all needed details.",
      inputSchema: z.object({
        task: z.string().min(1).max(2000),
      }),
      async execute({ task }) {
        const truncatedTask = task.slice(0, 300);
        trace.record({
          agent: "orchestrator",
          type: "delegation_started",
          to: "hr",
          task: truncatedTask,
        });

        const started = Date.now();
        const result = await runHr({
          model,
          user,
          trace,
          task,
          history: session.hr,
          mcp,
        });

        const durationMs = Date.now() - started;
        trace.record({
          agent: "orchestrator",
          type: "delegation_completed",
          to: "hr",
          durationMs,
          outcome: result.ok ? "ok" : "error",
        });

        if (result.ok) {
          session.hr.push(
            { role: "user", content: task },
            { role: "assistant", content: result.text },
          );
          session.hr = session.hr.slice(-20);
          return { status: "ok", result: result.text };
        }

        return { status: "failed", reason: result.error };
      },
    },
  ];
}
