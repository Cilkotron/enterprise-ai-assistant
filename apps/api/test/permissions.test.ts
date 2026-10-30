import { describe, it, expect } from "vitest";
import type { UserContext } from "../src/types.js";
import {
  checkPermission,
  getAllowedCapabilities,
  type PermissionDecisionEvent,
  type TraceSink,
} from "../src/permissions.js";

const ana: UserContext = { userId: "1", name: "Ana", role: "employee" };
const marko: UserContext = { userId: "2", name: "Marko", role: "it_admin" };

const users = [ana, marko] as const;
const agents = ["orchestrator", "it", "hr"] as const;
const capabilities = [
  "getServiceStatus",
  "searchHrPolicy",
  "getEquipmentProfile",
  "resetPassword",
  "loadSkill",
  "delegateToIt",
  "delegateToHr",
] as const;

describe("checkPermission table-driven", () => {
  for (const user of users) {
    for (const agent of agents) {
      for (const capability of capabilities) {
        it(`${user.name} (${user.role}) + ${agent} + ${capability}`, () => {
          const result = checkPermission(user, agent, capability);
          const allowed =
            (capability === "resetPassword" ? user.role === "it_admin" : true) &&
            ((agent === "it" &&
              (capability === "getServiceStatus" ||
                capability === "resetPassword" ||
                capability === "loadSkill")) ||
              (agent === "hr" &&
                (capability === "searchHrPolicy" ||
                  capability === "getEquipmentProfile")) ||
              (agent === "orchestrator" &&
                (capability === "delegateToIt" ||
                  capability === "delegateToHr")));
          expect(result.allowed).toBe(allowed);
        });
      }
    }
  }
});

describe("checkPermission specific cases", () => {
  it("ana + it + resetPassword => denied (role)", () => {
    const result = checkPermission(ana, "it", "resetPassword");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("role");
  });

  it("marko + it + resetPassword => allowed", () => {
    const result = checkPermission(marko, "it", "resetPassword");
    expect(result.allowed).toBe(true);
  });

  it("marko + hr + resetPassword => denied (agent)", () => {
    const result = checkPermission(marko, "hr", "resetPassword");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("agent");
  });

  it("unknown capability => denied", () => {
    const result = checkPermission(ana, "it", "unknownCapability");
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("unknown capability");
  });

  it("toString => denied (proto pollution)", () => {
    const result = checkPermission(ana, "it", "toString");
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("unknown capability");
  });

  it("__proto__ => denied (proto pollution)", () => {
    const result = checkPermission(ana, "it", "__proto__");
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("unknown capability");
  });
});

describe("getAllowedCapabilities", () => {
  it("ana + hr => searchHrPolicy, getEquipmentProfile", () => {
    const result = getAllowedCapabilities(ana, "hr");
    expect(result).toEqual(["searchHrPolicy", "getEquipmentProfile"]);
  });

  it("marko + it => includes resetPassword", () => {
    const result = getAllowedCapabilities(marko, "it");
    expect(result).toContain("resetPassword");
  });

  it("ana + it => does not include resetPassword", () => {
    const result = getAllowedCapabilities(ana, "it");
    expect(result).not.toContain("resetPassword");
  });

  it("orchestrator => only delegateToIt, delegateToHr", () => {
    const result = getAllowedCapabilities(ana, "orchestrator");
    expect(result).toEqual(["delegateToIt", "delegateToHr"]);
  });
});

describe("trace sink", () => {
  it("records permission_decision event for allowed", () => {
    const events: PermissionDecisionEvent[] = [];
    const sink: TraceSink = {
      record: (event) => events.push(event),
    };
    checkPermission(marko, "it", "resetPassword", sink);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "permission_decision",
      agent: "it",
      userId: "2",
      role: "it_admin",
      capability: "resetPassword",
      allowed: true,
    });
  });

  it("records permission_decision event for denied", () => {
    const events: PermissionDecisionEvent[] = [];
    const sink: TraceSink = {
      record: (event) => events.push(event),
    };
    checkPermission(ana, "it", "resetPassword", sink);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "permission_decision",
      agent: "it",
      userId: "1",
      role: "employee",
      capability: "resetPassword",
      allowed: false,
    });
  });

  it("without sink, checkPermission works and does not throw", () => {
    expect(() => checkPermission(ana, "it", "resetPassword")).not.toThrow();
    const result = checkPermission(ana, "it", "resetPassword");
    expect(result.allowed).toBe(false);
  });
});
