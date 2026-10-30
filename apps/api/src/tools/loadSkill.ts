import { z } from "zod";
import { SKILLS } from "../skills.generated.js";
import type { TraceCollector } from "../trace.js";
import type { AgentId } from "../types.js";
import type { ToolDef } from "./types.js";

export function createLoadSkillTool(trace: TraceCollector, agent: AgentId): ToolDef<{ name: string }> {
  const names = Object.keys(SKILLS) as [string, ...string[]];
  return {
    name: "loadSkill",
    capability: "loadSkill",
    description:
      "Loads the full instructions of a skill by name. Call it when a skill description matches the task, before you answer.",
    inputSchema: z.object({ name: z.enum(names) }),
    async execute({ name }) {
      const skill = SKILLS[name];
      if (!skill) return { error: "unknown_skill" };
      trace.record({ agent, type: "skill_loaded", skill: name });
      return { name, instructions: skill.body };
    },
  };
}

// Only names and descriptions go into the system prompt; bodies are loaded on demand.
export function buildSkillCatalog(): string {
  const lines = Object.entries(SKILLS).map(([name, s]) => `- ${name}: ${s.description}`);
  return `Available skills (call loadSkill to read the full instructions):\n${lines.join("\n")}`;
}