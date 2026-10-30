import { createAnthropic } from "@ai-sdk/anthropic";
import type { Env } from "./env.js";

export function getModel(env: Env) {
  const anthropic = createAnthropic({
    apiKey: env.LLM_API_KEY,
  });

  return anthropic(env.LLM_MODEL);
}