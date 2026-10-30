import { describe, it, expect } from "vitest";
import { getServiceStatusTool } from "../src/tools/getServiceStatus.js";

describe("getServiceStatus tool", () => {
  it("vpn returns degraded with a note", async () => {
    const result = await getServiceStatusTool.execute({ service: "vpn" });
    expect(result).toEqual({
      service: "vpn",
      status: "degraded",
      note: "Elevated latency on Belgrade gateway",
      since: "2026-10-29T08:15:00Z",
    });
  });

  it("email returns operational", async () => {
    const result = await getServiceStatusTool.execute({ service: "email" });
    expect(result).toEqual({
      service: "email",
      status: "operational",
    });
  });

  it("invalid service name is rejected by inputSchema", () => {
    const parseResult = getServiceStatusTool.inputSchema.safeParse({ service: "invalid" });
    expect(parseResult.success).toBe(false);
  });
});
