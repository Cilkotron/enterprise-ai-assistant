import { describe, it, expect } from "vitest";
import { SKILLS } from "../src/skills.generated.js";
import { createLoadSkillTool, buildSkillCatalog } from "../src/tools/loadSkill.js";
import { TraceCollector } from "../src/trace.js";

describe("skills.generated.ts", () => {
  it("contains vpn-troubleshooting with non-empty description and body", () => {
    const skill = SKILLS["vpn-troubleshooting"];
    expect(skill).toBeDefined();
    expect(skill?.description).toBeTruthy();
    expect(skill?.body).toBeTruthy();
  });

  it("contains new-hire-device-setup with non-empty description and body", () => {
    const skill = SKILLS["new-hire-device-setup"];
    expect(skill).toBeDefined();
    expect(skill?.description).toBeTruthy();
    expect(skill?.body).toBeTruthy();
  });
});

describe("buildSkillCatalog", () => {
  it("contains names and descriptions but NOT body text", () => {
    const catalog = buildSkillCatalog();
    expect(catalog).toContain("vpn-troubleshooting");
    expect(catalog).toContain("new-hire-device-setup");
    expect(catalog).toContain("Step-by-step guidance");
    expect(catalog).toContain("Setup guidance");
    // Body text should not be in the catalog
    expect(catalog).not.toContain("Check the VPN service status first");
    expect(catalog).not.toContain("Use the equipment profile");
  });
});

describe("loadSkill tool", () => {
  it("returns the body and records a skill_loaded trace event with the right agent", async () => {
    const trace = new TraceCollector("req-1");
    const tool = createLoadSkillTool(trace, "it");
    const result = await tool.execute({ name: "vpn-troubleshooting" });
    expect(result).toEqual({
      name: "vpn-troubleshooting",
      instructions: SKILLS["vpn-troubleshooting"].body,
    });
    const events = trace.getEvents();
    const skillLoaded = events.find((e) => e.type === "skill_loaded");
    expect(skillLoaded).toBeDefined();
    if (skillLoaded?.type === "skill_loaded") {
      expect(skillLoaded.agent).toBe("it");
      expect(skillLoaded.skill).toBe("vpn-troubleshooting");
    }
  });

  it("unknown names are rejected by inputSchema", () => {
    const trace = new TraceCollector("req-1");
    const tool = createLoadSkillTool(trace, "it");
    const parseResult = tool.inputSchema.safeParse({ name: "unknown" });
    expect(parseResult.success).toBe(false);
  });
});
