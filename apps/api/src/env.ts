import { z } from "zod";

const envSchema = z.object({
  LLM_API_KEY: z.string().min(1),
  LLM_MODEL: z.string().default("claude-haiku-5-5"),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(raw: unknown): Env {
  try {
    return envSchema.parse(raw);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const missing = err.issues
        .filter((i) => i.path[0] === "LLM_API_KEY")
        .map((i) => i.message)
        .join(", ");
      if (missing) {
        throw new Error(`Missing or invalid LLM_API_KEY: ${missing}`);
      }
    }
    throw err;
  }
}
