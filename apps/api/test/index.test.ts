import { describe, it, expect } from "vitest";
import app from "../src/index.js";

describe("index.ts", () => {
  it("GET /api/health returns 200 with { status: 'ok' }", async () => {
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: "ok" });
  });

  it("unknown path returns 404 with { error: 'not_found' }", async () => {
    const res = await app.request("/unknown");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toEqual({ error: "not_found" });
  });
});
