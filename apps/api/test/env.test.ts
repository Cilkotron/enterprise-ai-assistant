import { describe, it, expect } from "vitest";
import { parseEnv } from "../src/env.js";

describe("parseEnv", () => {
  it("accepts valid env with LLM_API_KEY and applies default model", () => {
    const env = parseEnv({ LLM_API_KEY: "sk-test" });
    expect(env.LLM_API_KEY).toBe("sk-test");
    expect(env.LLM_MODEL).toBe("claude-haiku-5-5");
  });

  it("accepts valid env with custom model", () => {
    const env = parseEnv({ LLM_API_KEY: "sk-test", LLM_MODEL: "claude-sonnet-5-5" });
    expect(env.LLM_API_KEY).toBe("sk-test");
    expect(env.LLM_MODEL).toBe("claude-sonnet-5-5");
  });

  it("throws on missing LLM_API_KEY", () => {
    expect(() => parseEnv({})).toThrow("Missing or invalid LLM_API_KEY");
  });

  it("throws on empty LLM_API_KEY", () => {
    expect(() => parseEnv({ LLM_API_KEY: "" })).toThrow("Missing or invalid LLM_API_KEY");
  });

  it("error message does not contain the key value", () => {
    try {
      parseEnv({ LLM_API_KEY: "secret-key-123" });
    } catch (err) {
      expect((err as Error).message).not.toContain("secret-key-123");
    }
  });
});
