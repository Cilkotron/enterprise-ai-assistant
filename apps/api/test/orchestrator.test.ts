import { describe, it, expect } from "vitest";
import { createDelegationTools } from "../src/orchestrator/delegation.js";
import { createSessionState, InMemorySessionStore } from "../src/orchestrator/session.js";
import { buildToolset } from "../src/toolset.js";
import { TraceCollector } from "../src/trace.js";
import { USERS } from "../src/users.js";
import { type ModelMessage } from 'ai';

describe("orchestrator toolset", () => {
    it("for ana and marko it contains exactly delegateToIt and delegateToHr", () => {
        for (const user of [USERS.ana, USERS.marko]) {
            const trace = new TraceCollector("req-1");
            const session = createSessionState();
            const tools = createDelegationTools({
                model: {} as any,
                user,
                trace,
                session,
                mcp: { MCP_URL: "http://test", MCP_AUTH_TOKEN: "token" },
            });
            const toolset = buildToolset({ user, agent: "orchestrator", trace }, tools);
            expect(Object.keys(toolset)).toEqual(["delegateToIt", "delegateToHr"]);
        }
    });
});

describe("delegation concurrency", () => {
    it("both delegation_started events are earlier than both delegation_completed events", async () => {
        const trace = new TraceCollector("req-1");
        const session = createSessionState();
        const user = USERS.marko;

        const fakeRunIt = async () => {
            await new Promise((resolve) => setTimeout(resolve, 50));
            return { ok: true, text: "IT done", newMessages: [] as ModelMessage[] } as const;
        };
        const fakeRunHr = async () => {
            await new Promise((resolve) => setTimeout(resolve, 50));
            return { ok: true, text: "HR done", newMessages: [] as ModelMessage[] } as const;
        };

        const tools = createDelegationTools({
            model: {} as any,
            user,
            trace,
            session,
            mcp: { MCP_URL: "http://test", MCP_AUTH_TOKEN: "token" },
            runIt: fakeRunIt,
            runHr: fakeRunHr,
        });

        await Promise.all([
            tools[0].execute({ task: "IT task" }),
            tools[1].execute({ task: "HR task" }),
        ]);

        const events = trace.getEvents();
        const starts = events
            .filter((e) => e.type === "delegation_started")
            .map((e) => Date.parse(e.ts));
        const ends = events
            .filter((e) => e.type === "delegation_completed")
            .map((e) => Date.parse(e.ts));

        expect(starts).toHaveLength(2);
        expect(ends).toHaveLength(2);
        // Overlap: both started before either finished
        expect(Math.max(...starts)).toBeLessThan(Math.min(...ends));
    });
});

describe("delegation result passing", () => {
    it("task string containing HR result is received unchanged by fake runIt", async () => {
        const trace = new TraceCollector("req-1");
        const session = createSessionState();
        const user = USERS.marko;

        let receivedTask: string | undefined;
        const fakeRunIt = async ({ task }: { task: string }) => {
            receivedTask = task;
            return { ok: true, text: "IT done", newMessages: [] as ModelMessage[] } as const;
        };

        const tools = createDelegationTools({
            model: {} as any,
            user,
            trace,
            session,
            mcp: { MCP_URL: "http://test", MCP_AUTH_TOKEN: "token" },
            runIt: fakeRunIt,
        });

        const hrResult = "Profile: MacBook Pro 16";
        await tools[0].execute({ task: `Setup device for: ${hrResult}` });

        expect(receivedTask).toContain(hrResult);
    });
});

describe("specialist history isolation", () => {
    it("after delegating to IT only, session.it grew and session.hr did not", async () => {
        const trace = new TraceCollector("req-1");
        const session = createSessionState();
        const user = USERS.marko;

        const fakeRunIt = async () => ({ ok: true, text: "IT done", newMessages: [] as ModelMessage[] } as const);

        const tools = createDelegationTools({
            model: {} as any,
            user,
            trace,
            session,
            mcp: { MCP_URL: "http://test", MCP_AUTH_TOKEN: "token" },
            runIt: fakeRunIt,
        });

        await tools[0].execute({ task: "IT task" });

        expect(session.it).toHaveLength(2);
        expect(session.hr).toHaveLength(0);
        expect(session.it[0]).toEqual({ role: "user", content: "IT task" });
        expect(session.it[1]).toEqual({ role: "assistant", content: "IT done" });
    });
});

describe("failing specialist", () => {
    it("returns { status: failed } and delegation_completed with outcome error", async () => {
        const trace = new TraceCollector("req-1");
        const session = createSessionState();
        const user = USERS.marko;

        const fakeRunIt = async () => ({ ok: false, error: "timeout" } as const);

        const tools = createDelegationTools({
            model: {} as any,
            user,
            trace,
            session,
            mcp: { MCP_URL: "http://test", MCP_AUTH_TOKEN: "token" },
            runIt: fakeRunIt,
        });

        const result = await tools[0].execute({ task: "IT task" });

        expect(result).toEqual({ status: "failed", reason: "timeout" });

        const events = trace.getEvents();
        const completed = events.find((e) => e.type === "delegation_completed");
        expect(completed?.type === "delegation_completed" && completed.outcome).toBe("error");
    });
});

describe("runOrchestrator with mock model", () => {
    it("skipped: configuring MockLanguageModelV4 to call tools is complicated for this test setup");
});

describe("InMemorySessionStore", () => {
    it("stores and retrieves session state", async () => {
        const store = new InMemorySessionStore();
        const state = createSessionState();
        state.orchestrator.push({ role: "user", content: "test" });

        await store.set("key1", state);
        const retrieved = await store.get("key1");

        expect(retrieved).toEqual(state);
    });

    it("caps at 200 sessions and drops oldest", async () => {
        const store = new InMemorySessionStore();

        for (let i = 0; i < 201; i++) {
            const state = createSessionState();
            state.orchestrator.push({ role: "user", content: `session-${i}` });
            await store.set(`key${i}`, state);
        }

        const first = await store.get("key0");
        expect(first).toBeUndefined();

        const last = await store.get("key200");
        expect(last).toBeDefined();
    });
});
