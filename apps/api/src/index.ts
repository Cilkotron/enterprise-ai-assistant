import { Hono } from "hono";
import { generateText } from "ai";
import { getModel } from "./llm.js";
import { parseEnv, type Env } from "./env.js";

const app = new Hono<{ Bindings: Env }>();

app.get("/api/health", (c) => c.json({ status: "ok" }));

app.notFound((c) => c.json({ error: "not_found" }, 404));

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "internal_error" }, 500);
});

export default app;
