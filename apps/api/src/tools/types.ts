import { z } from "zod";
import type { CapabilityId } from "../capabilities.js";

export interface ToolDef<I = unknown> {
  name: string;
  capability: CapabilityId;
  description: string;
  inputSchema: z.ZodType<I>;
  execute(input: I): Promise<unknown>;
}
