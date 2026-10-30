import type { Role, AgentId } from "./types.js";

export type TraceEvent =
  | { type: "delegation_started"; to: AgentId; task: string }
  | { type: "delegation_completed"; to: AgentId; durationMs: number; outcome: "ok" | "error" }
  | { type: "skill_loaded"; skill: string }
  | { type: "tool_call"; tool: string; outcome: "ok" | "error" | "denied"; durationMs: number }
  | { type: "permission_decision"; userId: string; role: Role; capability: string; allowed: boolean; reason: string }
  | { type: "error"; message: string };

// What callers pass to record(): the collector adds ts and requestId.
export type NewTraceEvent = TraceEvent & { agent: AgentId };

export type RecordedEvent = NewTraceEvent & { ts: string; requestId: string };

export class TraceCollector {
  private events: RecordedEvent[] = [];

  constructor(
    private readonly requestId: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  record(event: NewTraceEvent): void {
    // ts and requestId come last so callers cannot override them.
    this.events.push({ ...event, ts: this.now().toISOString(), requestId: this.requestId });
  }

  getEvents(): readonly RecordedEvent[] {
    return [...this.events];
  }

  async measure<T>(fn: () => Promise<T>): Promise<{ result: T; durationMs: number }> {
    const start = this.now();
    const result = await fn();
    return { result, durationMs: this.now().getTime() - start.getTime() };
  }
}