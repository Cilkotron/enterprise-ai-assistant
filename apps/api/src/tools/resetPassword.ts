import { z } from "zod";
import type { ToolDef } from "./types.js";
import { ACCOUNTS } from "../fixtures.js";

export const resetPasswordTool: ToolDef<{ username: string }> = {
  name: "resetPassword",
  capability: "resetPassword",
  description: "Resets the password of an employee account and sends a reset link (simulated). Restricted to IT administrators.",
  inputSchema: z.object({
    username: z.string().regex(/^[a-z]+\.[a-z]+$/),
  }),
  async execute({ username }) {
    if (ACCOUNTS.includes(username as never)) {
      return { username, status: "reset_link_sent", simulated: true };
    }
    return { error: "unknown_account" };
  },
};
