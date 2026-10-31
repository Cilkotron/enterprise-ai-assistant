import { describe, it, expect } from "vitest";
import { MockLanguageModelV4 } from "ai/test";
import { runItSpecialist } from "../src/agents/it.js";
import { TraceCollector } from "../src/trace.js";
import { USERS } from "../src/users.js";

describe("runItSpecialist", () => {
  it("ana has getServiceStatus in toolset", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: {
        content: [{ type: "text", text: "Done" }],
        finishReason: { unified: "stop", raw: undefined },
        usage: {
          inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
          outputTokens: { total: 5, text: 5, reasoning: undefined },
        },
        warnings: [],
      },
    });
    const trace = new TraceCollector("req-1");
    const result = await runItSpecialist({
      user: USERS.ana,
      model,
      task: "test",
      history: [],
      trace,
    });
    expect(result.ok).toBe(true);
    const events = trace.getEvents();
    const decisions = events.filter((e) => e.type === "permission_decision");
    const getServiceStatusDecision = decisions.find((d) => d.capability === "getServiceStatus");
    expect(getServiceStatusDecision?.allowed).toBe(true);
  });

  it("marko has getServiceStatus in toolset", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: {
        content: [{ type: "text", text: "Done" }],
        finishReason: { unified: "stop", raw: undefined },
        usage: {
          inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
          outputTokens: { total: 5, text: 5, reasoning: undefined },
        },
        warnings: [],
      },
    });
    const trace = new TraceCollector("req-1");
    const result = await runItSpecialist({
      user: USERS.marko,
      model,
      task: "test",
      history: [],
      trace,
    });
    expect(result.ok).toBe(true);
    const events = trace.getEvents();
    const decisions = events.filter((e) => e.type === "permission_decision");
    const getServiceStatusDecision = decisions.find((d) => d.capability === "getServiceStatus");
    expect(getServiceStatusDecision?.allowed).toBe(true);
  });

  it("marko has resetPassword in toolset", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: {
        content: [{ type: "text", text: "Done" }],
        finishReason: { unified: "stop", raw: undefined },
        usage: {
          inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
          outputTokens: { total: 5, text: 5, reasoning: undefined },
        },
        warnings: [],
      },
    });
    const trace = new TraceCollector("req-1");
    const result = await runItSpecialist({
      user: USERS.marko,
      model,
      task: "test",
      history: [],
      trace,
    });
    expect(result.ok).toBe(true);
    const events = trace.getEvents();
    const decisions = events.filter((e) => e.type === "permission_decision");
    const resetPasswordDecision = decisions.find((d) => d.capability === "resetPassword");
    expect(resetPasswordDecision?.allowed).toBe(true);
  });

  it("ana does NOT have resetPassword in toolset", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: {
        content: [{ type: "text", text: "Done" }],
        finishReason: { unified: "stop", raw: undefined },
        usage: {
          inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
          outputTokens: { total: 5, text: 5, reasoning: undefined },
        },
        warnings: [],
      },
    });
    const trace = new TraceCollector("req-1");
    const result = await runItSpecialist({
      user: USERS.ana,
      model,
      task: "test",
      history: [],
      trace,
    });
    expect(result.ok).toBe(true);
    const events = trace.getEvents();
    const decisions = events.filter((e) => e.type === "permission_decision");
    const resetPasswordDecision = decisions.find((d) => d.capability === "resetPassword");
    expect(resetPasswordDecision?.allowed).toBe(false);
  });
});
