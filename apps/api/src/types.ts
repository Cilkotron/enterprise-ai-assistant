import { z } from "zod";

const roleSchema = z.enum(["employee", "it_admin"]);
export type Role = z.infer<typeof roleSchema>;

const agentIdSchema = z.enum(["orchestrator", "it", "hr"]);
export type AgentId = z.infer<typeof agentIdSchema>;

const userContextSchema = z.object({
  userId: z.string(),
  name: z.string(),
  role: roleSchema,
});
export type UserContext = z.infer<typeof userContextSchema>;

export { roleSchema, agentIdSchema, userContextSchema };