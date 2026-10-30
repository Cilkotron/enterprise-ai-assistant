import { describe, it, expect } from "vitest";
import { TraceCollector, type RecordedEvent } from "../src/trace.js";
import type { UserContext } from "../src/types.js";
import { checkPermission } from "../src/permissions.js";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("TraceCollector", () => {
  it("records event with ISO timestamp and requestId", () => {
    const collector = new TraceCollector("req-123");
    collector.record({ agent: "orchestrator", type: "delegation_started", to: "hr", task: "test" });
    const events = collector.getEvents();
    expect(events).toHaveLength(1);
    expect(events[0]?.requestId).toBe("req-123");
    expect(events[0]?.ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it("events keep insertion order", () => {
    const collector = new TraceCollector("req-123");
    collector.record({ agent: "it", type: "skill_loaded", skill: "skill1" });
    collector.record({ agent: "it", type: "skill_loaded", skill: "skill2" });
    const skills = collector
      .getEvents()
      .flatMap((e) => (e.type === "skill_loaded" ? [e.skill] : []));
    expect(skills).toEqual(["skill1", "skill2"]);
  });

  it("getEvents returns a copy; mutating it does not affect the collector", () => {
    const collector = new TraceCollector("req-123");
    collector.record({ agent: "it", type: "skill_loaded", skill: "skill1" });
    const copy = collector.getEvents() as RecordedEvent[];
    copy.push({
      agent: "it",
      type: "error",
      message: "fake",
      ts: "x",
      requestId: "x",
    });
    expect(collector.getEvents()).toHaveLength(1);
  });

  it("injected clock produces different timestamps", () => {
    let t = 0;
    const collector = new TraceCollector("req-123", () => new Date(t++));
    collector.record({ agent: "it", type: "skill_loaded", skill: "skill1" });
    collector.record({ agent: "it", type: "skill_loaded", skill: "skill2" });
    const events = collector.getEvents();
    expect(events[0]?.ts).not.toBe(events[1]?.ts);
  });

  it("works directly as a sink for checkPermission", () => {
    const collector = new TraceCollector("req-123");
    const user: UserContext = { userId: "1", name: "Ana", role: "employee" };
    checkPermission(user, "it", "resetPassword", collector);
    const events = collector.getEvents();
    expect(events).toHaveLength(1);
    const event = events[0];
    expect(event?.type).toBe("permission_decision");
    if (event?.type === "permission_decision") {
      expect(event.allowed).toBe(false);
      expect(event.agent).toBe("it");
    }
  });

  it("measure returns result and a non-negative duration", async () => {
    const collector = new TraceCollector("req-123");
    const { result, durationMs } = await collector.measure(async () => 42);
    expect(result).toBe(42);
    expect(durationMs).toBeGreaterThanOrEqual(0);
  });

  it("measure rethrows if fn throws", async () => {
    const collector = new TraceCollector("req-123");
    await expect(
      collector.measure(async () => {
        throw new Error("test error");
      }),
    ).rejects.toThrow("test error");
  });

  it("concurrency: two delegations run in parallel with overlapping intervals", async () => {
    const collector = new TraceCollector("req-123");

    const delegate = async (to: "it" | "hr") => {
      collector.record({ agent: "orchestrator", type: "delegation_started", to, task: "t" });
      const { durationMs } = await collector.measure(() => sleep(30));
      collector.record({
        agent: "orchestrator",
        type: "delegation_completed",
        to,
        durationMs,
        outcome: "ok",
      });
    };

    await Promise.all([delegate("it"), delegate("hr")]);

    const events = collector.getEvents();
    const starts = events.filter((e) => e.type === "delegation_started").map((e) => Date.parse(e.ts));
    const ends = events.filter((e) => e.type === "delegation_completed").map((e) => Date.parse(e.ts));

    expect(starts).toHaveLength(2);
    expect(ends).toHaveLength(2);
    // Overlap: both started before either one finished.
    expect(Math.max(...starts)).toBeLessThan(Math.min(...ends));
  });
});